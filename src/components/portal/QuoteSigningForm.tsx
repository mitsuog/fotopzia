'use client'

import { useState } from 'react'
import { SignaturePad } from '@/components/signature/SignaturePad'

interface QuoteSigningFormProps {
  token: string
  quoteId: string
  defaultSignerName: string
}

export function QuoteSigningForm({ token, quoteId, defaultSignerName }: QuoteSigningFormProps) {
  const [signerName, setSignerName] = useState(defaultSignerName)
  const [signatureData, setSignatureData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setSuccess(null)
    if (!signerName.trim()) {
      setError('Ingresa el nombre del firmante.')
      return
    }
    if (!signatureData) {
      setError('La firma autógrafa es obligatoria.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/portal/${token}/quotes/${quoteId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signature_data: signatureData,
        }),
      })
      const payload = await response.json().catch(() => ({ error: 'No fue posible firmar la cotización.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible firmar la cotización.')

      setSuccess('Cotización firmada correctamente.')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No fue posible firmar la cotización.')
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

      <SignaturePad
        label="Firma autógrafa de cotización"
        value={signatureData}
        onChange={setSignatureData}
      />

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Firmando...' : 'Firmar cotización'}
      </button>
    </div>
  )
}
