'use client'

import { useMemo, useState } from 'react'
import { SignaturePad } from '@/components/signature/SignaturePad'
import type { ContractAnnex } from '@/types/quotes'

interface ContractSigningFormProps {
  token: string
  contractId: string
  defaultSignerName: string
  pageCount: number
  initialAnnexes: ContractAnnex[]
}

export function ContractSigningForm({
  token,
  contractId,
  defaultSignerName,
  pageCount,
  initialAnnexes,
}: ContractSigningFormProps) {
  const [signerName, setSignerName] = useState(defaultSignerName)
  const [finalSignature, setFinalSignature] = useState<string | null>(null)
  const [initialsData, setInitialsData] = useState<(string | null)[]>(
    Array.from({ length: pageCount }, () => null),
  )
  const [annexes, setAnnexes] = useState<ContractAnnex[]>(initialAnnexes)
  const [annexDraftSignatures, setAnnexDraftSignatures] = useState<Record<string, string | null>>({})
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const pendingAnnexes = useMemo(
    () => annexes.filter(annex => annex.requires_signature && !annex.signed_at),
    [annexes],
  )

  function updateInitial(index: number, value: string | null) {
    setInitialsData(prev => prev.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  async function signAnnex(annex: ContractAnnex) {
    setError(null)
    setSuccess(null)
    const signatureData = annexDraftSignatures[annex.id]
    if (!signerName.trim()) {
      setError('Ingresa el nombre del firmante para continuar.')
      return
    }
    if (!signatureData) {
      setError(`Registra la firma del anexo "${annex.title}".`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/portal/${token}/contracts/${contractId}/annexes/${annex.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signature_data: signatureData,
        }),
      })
      const payload = await response.json().catch(() => ({ error: 'No fue posible firmar el anexo.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible firmar el anexo.')

      setAnnexes(prev => prev.map(item => (item.id === annex.id
        ? { ...item, signed_at: payload.data?.signed_at ?? new Date().toISOString(), signed_by: signerName.trim(), signature_data: signatureData }
        : item)))
      setAnnexDraftSignatures(prev => ({ ...prev, [annex.id]: null }))
      setSuccess(`Anexo "${annex.title}" firmado correctamente.`)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No fue posible firmar el anexo.')
    } finally {
      setLoading(false)
    }
  }

  async function signContract() {
    setError(null)
    setSuccess(null)
    if (!signerName.trim()) {
      setError('Ingresa el nombre del firmante.')
      return
    }
    if (!finalSignature) {
      setError('Registra la firma final del contrato.')
      return
    }
    if (pendingAnnexes.length > 0) {
      setError('Debes firmar todos los anexos antes de firmar el contrato.')
      return
    }
    if (initialsData.some(initial => !initial)) {
      setError('Debes registrar antefirma en todas las páginas del contrato.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/portal/${token}/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signature_data: finalSignature,
          initials_data: initialsData.filter((initial): initial is string => Boolean(initial)),
        }),
      })
      const payload = await response.json().catch(() => ({ error: 'No fue posible firmar el contrato.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible firmar el contrato.')

      setSuccess('Contrato firmado correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No fue posible firmar el contrato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-stone bg-white p-4">
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre del firmante</label>
        <input
          value={signerName}
          onChange={event => setSignerName(event.target.value)}
          className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          placeholder="Nombre completo"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-brand-stone p-3">
        <p className="text-sm font-semibold text-brand-navy">Anexos (firma individual)</p>
        {annexes.length === 0 && <p className="text-xs text-gray-500">Sin anexos para firma.</p>}
        {annexes.map(annex => (
          <div key={annex.id} className="rounded-md border border-brand-stone/70 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-brand-navy">{annex.title}</p>
              {annex.signed_at ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Firmado</span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">Pendiente</span>
              )}
            </div>
            {!annex.signed_at && annex.requires_signature && (
              <div className="space-y-2">
                <SignaturePad
                  label={`Firma del anexo: ${annex.title}`}
                  value={annexDraftSignatures[annex.id] ?? null}
                  onChange={(value) => setAnnexDraftSignatures(prev => ({ ...prev, [annex.id]: value }))}
                  height={120}
                />
                <button
                  type="button"
                  onClick={() => signAnnex(annex)}
                  disabled={loading}
                  className="rounded-md border border-brand-stone bg-brand-paper px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas disabled:opacity-50"
                >
                  Firmar anexo
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-brand-stone p-3">
        <p className="text-sm font-semibold text-brand-navy">Antefirma por página (obligatoria)</p>
        <div className="space-y-2">
          {initialsData.map((initial, index) => (
            <SignaturePad
              key={`initial-${index + 1}`}
              label={`Antefirma página ${index + 1}`}
              value={initial}
              onChange={(value) => updateInitial(index, value)}
              height={90}
            />
          ))}
        </div>
      </div>

      <SignaturePad
        label="Firma final del contrato"
        value={finalSignature}
        onChange={setFinalSignature}
      />

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}

      <button
        type="button"
        onClick={signContract}
        disabled={loading}
        className="w-full rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Procesando firma...' : 'Firmar contrato completo'}
      </button>
    </div>
  )
}
