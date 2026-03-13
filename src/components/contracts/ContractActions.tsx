'use client'

import { useState } from 'react'
import { WorkflowCommentDialog } from '@/components/ui/WorkflowCommentDialog'

interface ContractActionsProps {
  contractId: string
  status: string
  initialPortalUrl?: string | null
  zipUrl?: string | null
  approvalStatus?: string | null
  canApprove: boolean
}

export function ContractActions({
  contractId,
  status,
  initialPortalUrl,
  zipUrl,
  approvalStatus,
  canApprove,
}: ContractActionsProps) {
  const [portalUrl, setPortalUrl] = useState(initialPortalUrl ?? '')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showReturnDialog, setShowReturnDialog] = useState(false)

  async function runApprovalWorkflow(
    action: 'submit_approval' | 'approve' | 'reject' | 'return_to_review',
    comment?: string,
  ) {
    setError(null)
    setSuccess(null)
    setLoadingAction(action)
    try {
      const response = await fetch(`/api/contracts/${contractId}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment }),
      })
      const payload = await response.json().catch(() => ({ error: 'No fue posible ejecutar el workflow.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible ejecutar el workflow.')

      if (action === 'submit_approval') setSuccess('Contrato enviado a aprobacion interna.')
      if (action === 'approve') setSuccess('Contrato aprobado internamente.')
      if (action === 'reject') setSuccess('Contrato rechazado internamente.')
      if (action === 'return_to_review') setSuccess('Contrato regresado a revision con comentario.')
      window.location.reload()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No fue posible ejecutar el workflow.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function sendForSignature() {
    setError(null)
    setSuccess(null)
    setLoadingAction('send_signature')
    try {
      const response = await fetch(`/api/contracts/${contractId}/send`, { method: 'POST' })
      const payload = await response.json().catch(() => ({ error: 'No fue posible enviar a firma.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible enviar a firma.')
      if (payload.data?.portal_url) setPortalUrl(payload.data.portal_url)
      setSuccess('Contrato enviado a firma correctamente.')
      window.location.reload()
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No fue posible enviar a firma.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function copyPortalLink() {
    if (!portalUrl) return
    await navigator.clipboard.writeText(portalUrl)
    setSuccess('Enlace de firma copiado al portapapeles.')
  }

  const isApprovedFlow = approvalStatus === 'approved'
  const isInApproval = approvalStatus === 'in_progress' || approvalStatus === 'pending'
  const canReturnToReview = status === 'sent' || status === 'viewed' || isApprovedFlow

  return (
    <div className="space-y-3 rounded-xl border border-brand-stone bg-white p-4">
      <h3 className="text-sm font-semibold text-brand-navy">Acciones de contrato</h3>

      <div className="flex flex-wrap gap-2">
        <a
          href={`/contracts/${contractId}/print`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper"
        >
          Ver machote / imprimir
        </a>
        <a
          href={`/api/contracts/${contractId}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper"
        >
          Descargar PDF
        </a>
        {zipUrl && (
          <a
            href={zipUrl}
            className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper"
          >
            Descargar ZIP firmados
          </a>
        )}
      </div>

      {canApprove && (
        <div className="flex flex-wrap gap-2">
          {!isInApproval && !isApprovedFlow && status !== 'signed' && (
            <button
              type="button"
              onClick={() => runApprovalWorkflow('submit_approval')}
              disabled={Boolean(loadingAction)}
              className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper disabled:opacity-50"
            >
              {loadingAction === 'submit_approval' ? 'Enviando...' : 'Enviar a aprobacion'}
            </button>
          )}

          {isInApproval && (
            <>
              <button
                type="button"
                onClick={() => runApprovalWorkflow('approve')}
                disabled={Boolean(loadingAction)}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {loadingAction === 'approve' ? 'Aprobando...' : 'Aprobar workflow'}
              </button>
              <button
                type="button"
                onClick={() => runApprovalWorkflow('reject')}
                disabled={Boolean(loadingAction)}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loadingAction === 'reject' ? 'Rechazando...' : 'Rechazar workflow'}
              </button>
            </>
          )}

          {isApprovedFlow && status !== 'sent' && status !== 'signed' && (
            <button
              type="button"
              onClick={sendForSignature}
              disabled={Boolean(loadingAction)}
              className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
            >
              {loadingAction === 'send_signature' ? 'Enviando...' : 'Enviar a firma electronica'}
            </button>
          )}

          {canReturnToReview && status !== 'signed' && (
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
      )}

      <p className="text-[11px] text-gray-500">
        Estado de aprobacion interna: {approvalStatus ? approvalStatus.replace('_', ' ') : 'sin flujo'}
      </p>

      {portalUrl && (
        <div className="space-y-2 rounded-lg border border-brand-stone bg-brand-paper p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Enlace unico para cliente</p>
          <p className="break-all text-[11px] text-gray-500">{portalUrl}</p>
          <div className="flex flex-wrap gap-2">
            <a
              href={portalUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light"
            >
              Abrir portal
            </a>
            <button
              type="button"
              onClick={copyPortalLink}
              className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas"
            >
              Copiar enlace
            </button>
          </div>
        </div>
      )}

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      {success && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{success}</p>}

      <WorkflowCommentDialog
        open={showReturnDialog}
        title="Regresar contrato a revision"
        description="Este paso reabre el workflow y requiere nueva revision antes de enviar a firma."
        confirmLabel="Regresar a revision"
        loading={loadingAction === 'return_to_review'}
        onClose={() => setShowReturnDialog(false)}
        onConfirm={async (comment) => {
          await runApprovalWorkflow('return_to_review', comment)
          setShowReturnDialog(false)
        }}
      />
    </div>
  )
}
