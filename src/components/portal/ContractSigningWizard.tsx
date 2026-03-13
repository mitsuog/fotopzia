'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SignaturePad } from '@/components/signature/SignaturePad'
import type { ContractAnnex } from '@/types/quotes'

interface ContractSigningWizardProps {
  token: string
  contractId: string
  contractNumber: string
  contractTitle: string
  contractBody: string
  pageCount: number
  signerNameDefault: string
  initialAnnexes: ContractAnnex[]
  contractAlreadySigned: boolean
}

type StepKind =
  | { kind: 'annex'; annexId: string }
  | { kind: 'contract' }

function isSectionHeader(line: string): boolean {
  return (
    /^[IVXLCDM]+\./i.test(line) ||
    /^CONTRATO DE PRESTACI/i.test(line) ||
    /^Firmas$/.test(line) ||
    /^(EL PRESTADOR|EL CLIENTE)$/.test(line)
  )
}

function DocBody({ body, templateKey }: { body: string; templateKey?: string | null }) {
  const lines = body.split('\n')

  // Anexo B: pipe-table
  if (templateKey === 'anexo-b') {
    const tableRows: string[][] = []
    const noteLines: string[] = []
    let headerRow: string[] | null = null

    for (const line of lines) {
      const t = line.trim()
      if (!t) continue
      if (t.includes('|')) {
        const cols = t.split('|').map(c => c.trim())
        if (!headerRow) headerRow = cols
        else tableRows.push(cols)
      } else {
        noteLines.push(t)
      }
    }

    return (
      <div className="space-y-4">
        {noteLines.filter((_, i) => i === 0).map((note, i) => (
          <p key={i} className="text-xs italic text-gray-500">{note}</p>
        ))}
        <div className="overflow-x-auto rounded-lg border border-brand-stone">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-navy text-white">
                {(headerRow ?? ['Hito', 'Fecha compromiso', 'Observaciones']).map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left text-xs font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && (
                <tr><td colSpan={3} className="px-3 py-3 text-xs text-gray-500">Sin hitos registrados</td></tr>
              )}
              {tableRows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-brand-paper/40'}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 text-xs text-gray-700">{cell || '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {noteLines.slice(1).map((note, i) => (
          <p key={`note-${i}`} className="text-xs text-gray-500 italic">{note}</p>
        ))}
      </div>
    )
  }

  // Anexo A: key:value table
  if (templateKey === 'anexo-a') {
    const kvRows: Array<{ label: string; value: string }> = []
    const textLines: string[] = []

    for (const line of lines) {
      const t = line.trim()
      if (!t) continue
      const colon = t.indexOf(':')
      if (colon > 0 && colon < 60 && /^[A-ZÁÉÍÓÚÑ\s\/()]+$/.test(t.slice(0, colon))) {
        kvRows.push({ label: t.slice(0, colon).trim(), value: t.slice(colon + 1).trim() })
      } else {
        textLines.push(t)
      }
    }

    return (
      <div className="space-y-4">
        {textLines.filter((_, i) => i === 0).map((note, i) => (
          <p key={i} className="text-xs italic text-gray-500">{note}</p>
        ))}
        <div className="overflow-hidden rounded-lg border border-brand-stone">
          {kvRows.map((row, i) => (
            <div key={i} className={`flex gap-3 border-b border-brand-stone/50 px-3 py-2.5 last:border-0 ${i % 2 === 0 ? 'bg-white' : 'bg-brand-paper/40'}`}>
              <span className="w-48 shrink-0 text-xs font-semibold text-gray-600">{row.label}</span>
              <span className="text-sm text-gray-800">{row.value || '—'}</span>
            </div>
          ))}
        </div>
        {textLines.slice(1).map((note, i) => (
          <p key={`note-${i}`} className="text-xs text-gray-500 italic">{note}</p>
        ))}
      </div>
    )
  }

  // Default (contract body + Anexo C): formatted paragraphs
  return (
    <div className="space-y-1 text-sm leading-relaxed text-gray-700">
      {lines.map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="h-2" />
        if (isSectionHeader(t)) {
          return <h3 key={i} className="mt-5 mb-1 text-base font-bold text-brand-navy first:mt-0">{t}</h3>
        }
        if (/^\d+\./.test(t)) {
          return <p key={i} className="mb-1 text-sm text-gray-800">{t}</p>
        }
        return <p key={i} className="text-sm text-gray-700">{t}</p>
      })}
    </div>
  )
}

export function ContractSigningWizard({
  token,
  contractId,
  contractNumber,
  contractTitle,
  contractBody,
  pageCount,
  signerNameDefault,
  initialAnnexes,
  contractAlreadySigned,
}: ContractSigningWizardProps) {
  const [annexes, setAnnexes] = useState<ContractAnnex[]>(initialAnnexes)
  const [signerName, setSignerName] = useState(signerNameDefault)
  const [signature, setSignature] = useState<string | null>(null)
  const [initialsData, setInitialsData] = useState<(string | null)[]>(
    Array.from({ length: Math.max(1, pageCount) }, () => null),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contractSigned, setContractSigned] = useState(contractAlreadySigned)
  const docScrollRef = useRef<HTMLDivElement>(null)

  // Build ordered steps
  const steps: StepKind[] = useMemo(() => [
    ...annexes
      .filter(a => a.requires_signature)
      .map(a => ({ kind: 'annex' as const, annexId: a.id })),
    { kind: 'contract' as const },
  ], [annexes])

  // Find first incomplete step
  const firstIncompleteIndex = useMemo(() => {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      if (step.kind === 'annex') {
        const annex = annexes.find(a => a.id === step.annexId)
        if (!annex?.signed_at) return i
      } else {
        if (!contractSigned) return i
      }
    }
    return steps.length // all done
  }, [steps, annexes, contractSigned])

  const [stepIndex, setStepIndex] = useState(() => Math.min(firstIncompleteIndex, steps.length - 1))

  const currentStep = steps[stepIndex]
  const currentAnnex = currentStep?.kind === 'annex'
    ? annexes.find(a => a.id === currentStep.annexId) ?? null
    : null

  const allDone = firstIncompleteIndex >= steps.length

  function scrollDocToTop() {
    setTimeout(() => docScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 50)
  }

  function goToStep(index: number) {
    setStepIndex(index)
    setSignature(null)
    setError(null)
    scrollDocToTop()
  }

  async function handleSignAnnex() {
    if (!currentAnnex) return
    setError(null)
    if (!signerName.trim()) { setError('Ingresa tu nombre completo antes de firmar.'); return }
    if (!signature) { setError('Registra tu firma en el recuadro para continuar.'); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/portal/${token}/contracts/${contractId}/annexes/${currentAnnex.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_name: signerName.trim(), signature_data: signature }),
      })
      const data = await res.json().catch(() => ({ error: 'Error al firmar.' }))
      if (!res.ok) throw new Error(data.error ?? 'No fue posible firmar el anexo.')

      setAnnexes(prev => prev.map(a => a.id === currentAnnex.id
        ? { ...a, signed_at: data.data?.signed_at ?? new Date().toISOString(), signed_by: signerName.trim(), signature_data: signature }
        : a))
      setSignature(null)
      // Advance
      const next = stepIndex + 1
      if (next < steps.length) goToStep(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible firmar el anexo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignContract() {
    setError(null)
    if (!signerName.trim()) { setError('Ingresa tu nombre completo antes de firmar.'); return }
    if (!signature) { setError('Registra tu firma en el recuadro para continuar.'); return }
    if (pageCount > 1 && initialsData.some(i => !i)) {
      setError(`Registra la antefirma en las ${pageCount} páginas antes de firmar el contrato.`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/portal/${token}/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signature_data: signature,
          initials_data: initialsData.filter((i): i is string => Boolean(i)),
        }),
      })
      const data = await res.json().catch(() => ({ error: 'Error al firmar.' }))
      if (!res.ok) throw new Error(data.error ?? 'No fue posible firmar el contrato.')
      setContractSigned(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible firmar el contrato.')
    } finally {
      setLoading(false)
    }
  }

  // ── All done ─────────────────────────────────────────────────────────────
  if (allDone || contractSigned) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">✓</div>
        <h2 className="text-xl font-bold text-emerald-800">¡Documentos firmados!</h2>
        <p className="mt-2 text-sm text-emerald-700">
          Todos los documentos han sido firmados correctamente. Fotopzia recibirá una copia automáticamente.
        </p>
        <Link
          href={`/portal/${token}/documents`}
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-800"
        >
          Ir a mis documentos
        </Link>
      </div>
    )
  }

  // ── Step labels ───────────────────────────────────────────────────────────
  const stepLabels = steps.map(step => {
    if (step.kind === 'annex') {
      const a = annexes.find(x => x.id === step.annexId)
      return a?.title ?? 'Anexo'
    }
    return 'Contrato principal'
  })

  const isCurrentStepDone = (i: number): boolean => {
    const step = steps[i]
    if (!step) return false
    if (step.kind === 'annex') {
      const a = annexes.find(x => x.id === step.annexId)
      return Boolean(a?.signed_at)
    }
    return contractSigned
  }

  // ── Document content for current step ────────────────────────────────────
  const docTitle = currentStep?.kind === 'annex'
    ? (currentAnnex?.title ?? 'Anexo')
    : contractTitle
  const docBody = currentStep?.kind === 'annex'
    ? (currentAnnex?.body ?? '')
    : contractBody
  const docTemplateKey = currentStep?.kind === 'annex'
    ? (currentAnnex?.template_key ?? null)
    : null

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="rounded-xl border border-brand-stone bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-brand-navy">
            Paso {stepIndex + 1} de {steps.length}
          </p>
          <p className="text-xs text-gray-500">{Math.round((firstIncompleteIndex / steps.length) * 100)}% completado</p>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-brand-stone">
          <div
            className="h-full rounded-full bg-brand-navy transition-all"
            style={{ width: `${(firstIncompleteIndex / steps.length) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {stepLabels.map((label, i) => {
            const done = isCurrentStepDone(i)
            const active = i === stepIndex
            return (
              <button
                key={i}
                type="button"
                onClick={() => done || i <= firstIncompleteIndex ? goToStep(i) : undefined}
                disabled={!done && i > firstIncompleteIndex}
                className={[
                  'flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  done
                    ? 'bg-emerald-100 text-emerald-700 cursor-pointer hover:bg-emerald-200'
                    : active
                      ? 'bg-brand-navy text-white'
                      : 'border border-brand-stone bg-white text-gray-400 cursor-default',
                ].join(' ')}
              >
                {done ? '✓ ' : `${i + 1}. `}
                <span className="max-w-[120px] truncate">{label.replace(/^Anexo [ABC]\.\s*/, 'Anexo ').replace('Autorizacion de Uso de Imagen / Voz / Mascota / Obra', 'C')}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Document panel */}
        <div className="lg:col-span-3 flex flex-col rounded-xl border border-brand-stone bg-white overflow-hidden">
          <div className="shrink-0 border-b border-brand-stone bg-brand-paper px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Leyendo documento</p>
            <h2 className="mt-0.5 text-sm font-bold text-brand-navy">{docTitle}</h2>
            <p className="mt-0.5 text-[11px] text-gray-500">Contrato {contractNumber}</p>
          </div>
          <div
            ref={docScrollRef}
            className="flex-1 overflow-y-auto p-4"
            style={{ maxHeight: '65vh' }}
          >
            <DocBody body={docBody} templateKey={docTemplateKey} />
          </div>
        </div>

        {/* Signing panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Signer name */}
          <div className="rounded-xl border border-brand-stone bg-white p-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nombre completo del firmante
            </label>
            <input
              value={signerName}
              onChange={e => setSignerName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
            />
          </div>

          {/* Initials (contract step, multi-page) */}
          {currentStep?.kind === 'contract' && pageCount > 1 && (
            <div className="rounded-xl border border-brand-stone bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Antefirma por página (obligatoria)
              </p>
              <div className="space-y-3">
                {initialsData.map((initial, i) => (
                  <SignaturePad
                    key={i}
                    label={`Antefirma — Página ${i + 1}`}
                    value={initial}
                    onChange={val => setInitialsData(prev => prev.map((x, idx) => idx === i ? val : x))}
                    height={80}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Signature pad */}
          <div className="rounded-xl border border-brand-stone bg-white p-4">
            <SignaturePad
              label={`Firma — ${docTitle}`}
              value={signature}
              onChange={setSignature}
              height={160}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          {/* Action button */}
          <button
            type="button"
            onClick={currentStep?.kind === 'annex' ? handleSignAnnex : handleSignContract}
            disabled={loading}
            className="w-full rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-light disabled:opacity-50"
          >
            {loading
              ? 'Firmando...'
              : currentStep?.kind === 'annex'
                ? `Firmar ${docTitle} →`
                : stepIndex < steps.length - 1
                  ? 'Firmar y continuar →'
                  : 'Firmar contrato y finalizar'}
          </button>

          {/* Back link */}
          <Link
            href={`/portal/${token}/documents`}
            className="block text-center text-xs text-gray-500 underline hover:text-brand-navy"
          >
            Volver a documentos
          </Link>
        </div>
      </div>
    </div>
  )
}
