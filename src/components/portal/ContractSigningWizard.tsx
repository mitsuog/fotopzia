'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { SignaturePad } from '@/components/signature/SignaturePad'
import { paginateContractBody } from '@/lib/documents/contract-pagination'
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
    /^Firmas$/i.test(line) ||
    /^(EL PRESTADOR|EL CLIENTE)$/.test(line)
  )
}

function ContractPageBody({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed text-gray-700">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" />
        if (isSectionHeader(trimmed)) {
          return <h3 key={i} className="mt-5 mb-1 text-base font-bold text-brand-navy first:mt-0">{trimmed}</h3>
        }
        if (/^\d+\./.test(trimmed)) {
          return <p key={i} className="mb-1 text-sm text-gray-800">{trimmed}</p>
        }
        return <p key={i} className="text-sm text-gray-700">{trimmed}</p>
      })}
    </div>
  )
}

function AnnexBody({ body, templateKey }: { body: string; templateKey?: string | null }) {
  const lines = body.split('\n')

  if (templateKey === 'anexo-b') {
    const tableRows: string[][] = []
    const noteLines: string[] = []
    let headerRow: string[] | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.includes('|')) {
        const cols = trimmed.split('|').map(col => col.trim())
        if (!headerRow) headerRow = cols
        else tableRows.push(cols)
      } else {
        noteLines.push(trimmed)
      }
    }

    return (
      <div className="space-y-4">
        {noteLines[0] ? <p className="text-xs italic text-gray-500">{noteLines[0]}</p> : null}
        <div className="overflow-x-auto rounded-lg border border-brand-stone">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-navy text-white">
                {(headerRow ?? ['Hito', 'Fecha compromiso', 'Observaciones']).map((label, index) => (
                  <th key={index} className="px-3 py-2 text-left text-xs font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-xs text-gray-500">Sin hitos registrados</td>
                </tr>
              )}
              {tableRows.map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-brand-paper/40'}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 text-xs text-gray-700">{cell || '-'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {noteLines.slice(1).map((line, index) => (
          <p key={index} className="text-xs italic text-gray-500">{line}</p>
        ))}
      </div>
    )
  }

  if (templateKey === 'anexo-a') {
    const keyValueRows: Array<{ label: string; value: string }> = []
    const freeTextLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const colonIndex = trimmed.indexOf(':')
      if (colonIndex > 0 && colonIndex < 60) {
        const label = trimmed.slice(0, colonIndex).trim()
        const value = trimmed.slice(colonIndex + 1).trim()
        keyValueRows.push({ label, value })
      } else {
        freeTextLines.push(trimmed)
      }
    }

    return (
      <div className="space-y-4">
        {freeTextLines[0] ? <p className="text-xs italic text-gray-500">{freeTextLines[0]}</p> : null}
        <div className="overflow-hidden rounded-lg border border-brand-stone">
          {keyValueRows.map((row, index) => (
            <div key={index} className={`flex gap-3 border-b border-brand-stone/50 px-3 py-2.5 last:border-0 ${index % 2 === 0 ? 'bg-white' : 'bg-brand-paper/40'}`}>
              <span className="w-48 shrink-0 text-xs font-semibold text-gray-600">{row.label}</span>
              <span className="text-sm text-gray-800">{row.value || '-'}</span>
            </div>
          ))}
        </div>
        {freeTextLines.slice(1).map((line, index) => (
          <p key={index} className="text-xs italic text-gray-500">{line}</p>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-1 text-sm leading-relaxed text-gray-700">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (!trimmed) return <div key={i} className="h-2" />
        if (isSectionHeader(trimmed)) {
          return <h3 key={i} className="mt-5 mb-1 text-base font-bold text-brand-navy first:mt-0">{trimmed}</h3>
        }
        if (/^\d+\./.test(trimmed)) {
          return <p key={i} className="mb-1 text-sm text-gray-800">{trimmed}</p>
        }
        return <p key={i} className="text-sm text-gray-700">{trimmed}</p>
      })}
    </div>
  )
}

function PaperFrame({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#d8d3c8] bg-[#fffdf8] shadow-[0_8px_30px_-20px_rgba(16,37,68,0.45)]">
      <header className="border-b border-[#e5dfd2] bg-[#f7f3ea] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-500">Documento</p>
        <h3 className="mt-1 text-base font-bold text-brand-navy">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </header>
      <div className="space-y-5 px-5 py-5">{children}</div>
      {footer ? <footer className="border-t border-[#e5dfd2] bg-[#faf6ee] px-5 py-4">{footer}</footer> : null}
    </article>
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

  const contractPages = useMemo(
    () => paginateContractBody(contractBody, Math.max(1, pageCount)),
    [contractBody, pageCount],
  )

  useEffect(() => {
    setInitialsData(prev => Array.from({ length: contractPages.length }, (_, index) => prev[index] ?? null))
  }, [contractPages.length])

  const steps: StepKind[] = useMemo(() => [
    ...annexes
      .filter(annex => annex.requires_signature)
      .map(annex => ({ kind: 'annex' as const, annexId: annex.id })),
    { kind: 'contract' as const },
  ], [annexes])

  const firstIncompleteIndex = useMemo(() => {
    for (let i = 0; i < steps.length; i += 1) {
      const step = steps[i]
      if (step.kind === 'annex') {
        const annex = annexes.find(item => item.id === step.annexId)
        if (!annex?.signed_at) return i
      } else if (!contractSigned) {
        return i
      }
    }
    return steps.length
  }, [steps, annexes, contractSigned])

  const [stepIndex, setStepIndex] = useState(() => Math.min(firstIncompleteIndex, Math.max(0, steps.length - 1)))

  useEffect(() => {
    if (stepIndex > steps.length - 1) {
      setStepIndex(Math.max(0, steps.length - 1))
    }
  }, [stepIndex, steps.length])

  const currentStep = steps[stepIndex]
  const currentAnnex = currentStep?.kind === 'annex'
    ? annexes.find(annex => annex.id === currentStep.annexId) ?? null
    : null

  const allDone = firstIncompleteIndex >= steps.length

  function goToStep(index: number) {
    setStepIndex(index)
    setSignature(null)
    setError(null)
  }

  async function handleSignAnnex() {
    if (!currentAnnex) return

    setError(null)
    if (!signerName.trim()) {
      setError('Ingresa tu nombre completo antes de firmar.')
      return
    }
    if (!signature) {
      setError('Firma directamente en el documento para continuar.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/portal/${token}/contracts/${contractId}/annexes/${currentAnnex.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_name: signerName.trim(), signature_data: signature }),
      })
      const payload = await response.json().catch(() => ({ error: 'Error al firmar el anexo.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible firmar el anexo.')

      setAnnexes(prev => prev.map(annex => (
        annex.id === currentAnnex.id
          ? {
              ...annex,
              signed_at: payload.data?.signed_at ?? new Date().toISOString(),
              signed_by: signerName.trim(),
              signature_data: signature,
            }
          : annex
      )))
      setSignature(null)

      const nextStep = stepIndex + 1
      if (nextStep < steps.length) {
        goToStep(nextStep)
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible firmar el anexo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignContract() {
    setError(null)

    if (!signerName.trim()) {
      setError('Ingresa tu nombre completo antes de firmar.')
      return
    }

    if (!signature) {
      setError('Registra la firma final del contrato en el bloque de firma.')
      return
    }

    if (contractPages.length > 1 && initialsData.some(initial => !initial)) {
      setError(`Debes registrar antefirma en cada una de las ${contractPages.length} paginas del contrato.`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/portal/${token}/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signature_data: signature,
          initials_data: initialsData.filter((initial): initial is string => Boolean(initial)),
        }),
      })

      const payload = await response.json().catch(() => ({ error: 'Error al firmar el contrato.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible firmar el contrato.')
      setContractSigned(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible firmar el contrato.')
    } finally {
      setLoading(false)
    }
  }

  if (allDone || contractSigned) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">OK</div>
        <h2 className="text-xl font-bold text-emerald-800">Documentos firmados</h2>
        <p className="mt-2 text-sm text-emerald-700">
          Todo el paquete documental se firmo correctamente. Fotopzia recibira una copia automatica.
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

  const stepLabels = steps.map(step => {
    if (step.kind === 'annex') {
      const annex = annexes.find(item => item.id === step.annexId)
      return annex?.title ?? 'Anexo'
    }
    return 'Contrato principal'
  })

  const progressPercent = steps.length > 0
    ? Math.round((Math.min(firstIncompleteIndex, steps.length) / steps.length) * 100)
    : 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-stone bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold text-brand-navy">Paso {stepIndex + 1} de {steps.length}</p>
          <p className="text-xs text-gray-500">{progressPercent}% completado</p>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-brand-stone">
          <div className="h-full rounded-full bg-brand-navy transition-all" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {stepLabels.map((label, index) => {
            const done = index < firstIncompleteIndex
            const active = index === stepIndex
            const canJump = done || index === firstIncompleteIndex

            return (
              <button
                key={label + index}
                type="button"
                onClick={() => (canJump ? goToStep(index) : undefined)}
                disabled={!canJump}
                className={[
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  done
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                    : active
                      ? 'bg-brand-navy text-white'
                      : 'border border-brand-stone bg-white text-gray-400',
                ].join(' ')}
              >
                {done ? 'OK ' : `${index + 1}. `}
                {label.replace('Autorizacion de Uso de Imagen / Voz / Mascota / Obra', 'Anexo C')}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-brand-stone bg-white p-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Nombre completo del firmante
        </label>
        <input
          value={signerName}
          onChange={event => setSignerName(event.target.value)}
          placeholder="Nombre completo"
          className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
        />
      </div>

      {currentStep?.kind === 'annex' && currentAnnex && (
        <PaperFrame
          title={currentAnnex.title}
          subtitle={`Contrato ${contractNumber}`}
          footer={
            <SignaturePad
              label="Firma final del anexo"
              value={signature}
              onChange={setSignature}
              variant="document-signature"
              hintText="Firma aqui para autorizar este anexo."
            />
          }
        >
          <AnnexBody body={currentAnnex.body ?? ''} templateKey={currentAnnex.template_key} />
        </PaperFrame>
      )}

      {currentStep?.kind === 'contract' && (
        <div className="space-y-4">
          {contractPages.map((page, pageIndex) => {
            const isLastPage = pageIndex === contractPages.length - 1

            return (
              <PaperFrame
                key={page.pageNumber}
                title={contractTitle}
                subtitle={`Contrato ${contractNumber} - Pagina ${page.pageNumber} de ${contractPages.length}`}
                footer={
                  <div className="space-y-4">
                    {contractPages.length > 1 && (
                      <SignaturePad
                        label={`Antefirma - Pagina ${page.pageNumber}`}
                        value={initialsData[pageIndex] ?? null}
                        onChange={(value) => setInitialsData(prev => prev.map((item, index) => (index === pageIndex ? value : item)))}
                        variant="initial"
                        hintText="Antefirma aqui para validar esta pagina."
                      />
                    )}

                    {isLastPage && (
                      <div className="rounded-lg border border-brand-stone/70 bg-white p-3">
                        <SignaturePad
                          label="Firma final del contrato"
                          value={signature}
                          onChange={setSignature}
                          variant="document-signature"
                          hintText="Firma aqui para cerrar y aceptar el contrato completo."
                        />
                      </div>
                    )}
                  </div>
                }
              >
                <ContractPageBody lines={page.lines} />
              </PaperFrame>
            )
          })}
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <button
        type="button"
        onClick={currentStep?.kind === 'annex' ? handleSignAnnex : handleSignContract}
        disabled={loading}
        className="w-full rounded-xl bg-brand-navy py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-navy-light disabled:opacity-50"
      >
        {loading
          ? 'Firmando...'
          : currentStep?.kind === 'annex'
            ? 'Firmar anexo y continuar'
            : 'Firmar contrato y finalizar'}
      </button>

      <Link
        href={`/portal/${token}/documents`}
        className="block text-center text-xs text-gray-500 underline hover:text-brand-navy"
      >
        Volver a documentos
      </Link>
    </div>
  )
}