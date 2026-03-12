'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer } from 'lucide-react'
import { WorkflowCommentDialog } from '@/components/ui/WorkflowCommentDialog'

interface QuoteActionsProps {
  quoteId: string
  status: string
  dealId?: string | null
  approvalStatus?: string | null
  canApprove: boolean
  supersededByQuoteNumber?: string | null
}

export function QuoteActions({
  quoteId,
  status,
  dealId,
  approvalStatus,
  canApprove,
  supersededByQuoteNumber,
}: QuoteActionsProps) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showReturnDialog, setShowReturnDialog] = useState(false)

  async function runWorkflow(
    action: 'submit_approval' | 'approve' | 'reject' | 'return_to_review' | 'send_signature',
    direct = false,
    comment?: string,
  ) {
    setError(null)
    setSuccess(null)
    setLoadingAction(action + (direct ? '_direct' : ''))
    try {
      const response = await fetch(`/api/quotes/${quoteId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, direct, comment }),
      })

      const payload = await response.json().catch(() => ({ error: 'No fue posible ejecutar el workflow.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible ejecutar el workflow.')

      if (action === 'submit_approval') setSuccess('Cotizacion enviada a aprobacion interna.')
      if (action === 'approve') setSuccess('Cotizacion aprobada internamente.')
      if (action === 'reject') setSuccess('Cotizacion rechazada internamente.')
      if (action === 'return_to_review') setSuccess('Cotizacion regresada a revision con comentario.')
      if (action === 'send_signature' && direct) setSuccess('Cotizacion aprobada y enviada a firma en un solo paso.')
      if (action === 'send_signature' && !direct) setSuccess('Cotizacion enviada a firma del cliente.')
      router.refresh()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible ejecutar el workflow.')
    } finally {
      setLoadingAction(null)
    }
  }

  const isApprovedFlow = approvalStatus === 'approved'
  const isInApproval = approvalStatus === 'in_progress' || approvalStatus === 'pending'
  const canReturnToReview = status === 'sent' || status === 'viewed' || isApprovedFlow
  const isSuperseded = Boolean(supersededByQuoteNumber)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`/quotes/${quoteId}/print`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-canvas"
        >
          <Printer className="h-3.5 w-3.5" />
          Ver machote / PDF
        </a>

        {dealId && (
          <a
            href="/crm/kanban"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-canvas"
          >
            Ver Deal
          </a>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canApprove && !isInApproval && !isApprovedFlow && (
          <button
            type="button"
            onClick={() => runWorkflow('submit_approval')}
            disabled={Boolean(loadingAction)}
            className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper disabled:opacity-50"
          >
            {loadingAction === 'submit_approval' ? 'Enviando...' : 'Enviar a aprobacion'}
          </button>
        )}

        {canApprove && isInApproval && (
          <>
            <button
              type="button"
              onClick={() => runWorkflow('approve')}
              disabled={Boolean(loadingAction)}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {loadingAction === 'approve' ? 'Aprobando...' : 'Aprobar workflow'}
            </button>
            <button
              type="button"
              onClick={() => runWorkflow('reject')}
              disabled={Boolean(loadingAction)}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loadingAction === 'reject' ? 'Rechazando...' : 'Rechazar workflow'}
            </button>
          </>
        )}

        {canApprove && isApprovedFlow && status !== 'sent' && status !== 'viewed' && status !== 'approved' && (
          <button
            type="button"
            onClick={() => runWorkflow('send_signature')}
            disabled={Boolean(loadingAction) || isSuperseded}
            className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
          >
            {loadingAction === 'send_signature' ? 'Enviando...' : 'Enviar a firma'}
          </button>
        )}

        {canApprove && !isApprovedFlow && status !== 'sent' && status !== 'viewed' && status !== 'approved' && (
          <button
            type="button"
            onClick={() => runWorkflow('send_signature', true)}
            disabled={Boolean(loadingAction) || isSuperseded}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {loadingAction === 'send_signature_direct' ? 'Procesando...' : 'Aprobar y enviar directo a firma'}
          </button>
        )}

        {canApprove && canReturnToReview && status !== 'approved' && (
          <button
            type="button"
            onClick={() => setShowReturnDialog(true)}
            disabled={Boolean(loadingAction)}
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {loadingAction === 'return_to_review' ? 'Regresando...' : 'Regresar a revision'}
          </button>
        )}
      </div>

      <p className="text-[11px] text-gray-500">
        Estado de aprobacion interna: {approvalStatus ? approvalStatus.replace('_', ' ') : 'sin flujo'}
      </p>

      {isSuperseded && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Esta cotizacion fue reemplazada por la version mas reciente ({supersededByQuoteNumber}). Revisa esa version para enviarla a firma.
        </p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {success && <p className="text-xs text-emerald-700">{success}</p>}

      <WorkflowCommentDialog
        open={showReturnDialog}
        title="Regresar cotizacion a revision"
        description="Este paso reabre el workflow y obliga a revisar antes de reenviar a firma."
        confirmLabel="Regresar a revision"
        loading={loadingAction === 'return_to_review'}
        onClose={() => setShowReturnDialog(false)}
        onConfirm={async (comment) => {
          await runWorkflow('return_to_review', false, comment)
          setShowReturnDialog(false)
        }}
      />
    </div>
  )
}
