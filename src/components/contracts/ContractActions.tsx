'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { WorkflowCommentDialog } from '@/components/ui/WorkflowCommentDialog'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

interface LinkedProject {
  id: string
  title: string
  stage: string
  due_date: string | null
}

interface ContractActionsProps {
  contractId: string
  status: string
  initialPortalUrl?: string | null
  zipUrl?: string | null
  approvalStatus?: string | null
  canApprove: boolean
  linkedProject?: LinkedProject | null
  contactId?: string
  projectTitle?: string
}

export function ContractActions({
  contractId,
  status,
  initialPortalUrl,
  zipUrl,
  approvalStatus,
  canApprove,
  linkedProject,
  contactId,
  projectTitle,
}: ContractActionsProps) {
  const router = useRouter()
  const [portalUrl, setPortalUrl] = useState(initialPortalUrl ?? '')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showReturnDialog, setShowReturnDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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

  async function runContractAction(action: 'archive' | 'unarchive') {
    setError(null)
    setSuccess(null)
    setLoadingAction(action)
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const payload = await response.json().catch(() => ({ error: 'No fue posible actualizar el contrato.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible actualizar el contrato.')
      setSuccess(action === 'archive' ? 'Contrato archivado.' : 'Contrato desarchivado y regresado a borrador.')
      window.location.reload()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible actualizar el contrato.')
    } finally {
      setLoadingAction(null)
    }
  }

  async function deleteContract(confirmationText: string) {
    setError(null)
    setSuccess(null)
    setLoadingAction('delete')
    try {
      const response = await fetch(`/api/contracts/${contractId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationText }),
      })
      const payload = await response.json().catch(() => ({ error: 'No fue posible eliminar el contrato.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible eliminar el contrato.')
      router.push('/contracts')
      router.refresh()
      return true
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible eliminar el contrato.')
      return false
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

  async function handleCreateProject() {
    if (!contactId) return
    setLoadingAction('create_project')
    setError(null)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, title: projectTitle ?? 'Proyecto sin titulo' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'No fue posible crear el proyecto.')
      router.push(`/projects/${json.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear proyecto')
    } finally {
      setLoadingAction(null)
    }
  }

  const isApprovedFlow = approvalStatus === 'approved'
  const isInApproval = approvalStatus === 'in_progress' || approvalStatus === 'pending'
  const canReturnToReview = status === 'sent' || status === 'viewed' || isApprovedFlow
  const isArchived = status === 'voided'

  return (
    <div className="space-y-3 rounded-xl border border-brand-stone bg-white p-4">
      <h3 className="text-sm font-semibold text-brand-navy">Acciones de contrato</h3>

      <div className="rounded-lg border border-brand-stone bg-brand-paper p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Proyecto</p>
        {linkedProject ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-brand-navy">{linkedProject.title}</p>
            {linkedProject.due_date && (
              <p className="text-xs text-gray-500">
                Vence: {new Date(linkedProject.due_date).toLocaleDateString('es-MX')}
              </p>
            )}
            <Link
              href={`/projects/${linkedProject.id}`}
              className="flex w-full items-center justify-center rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
            >
              Ver proyecto
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500">No hay proyecto activo para este contacto.</p>
            {(status === 'signed' || status === 'sent' || status === 'approved') && contactId && (
              <button
                type="button"
                onClick={handleCreateProject}
                disabled={Boolean(loadingAction)}
                className="flex w-full items-center justify-center rounded-lg border border-brand-navy px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-canvas disabled:opacity-50"
              >
                {loadingAction === 'create_project' ? 'Creando...' : '+ Iniciar Proyecto'}
              </button>
            )}
          </div>
        )}
      </div>

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
          {!isArchived && !isInApproval && !isApprovedFlow && status !== 'signed' && (
            <button
              type="button"
              onClick={() => runApprovalWorkflow('submit_approval')}
              disabled={Boolean(loadingAction)}
              className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper disabled:opacity-50"
            >
              {loadingAction === 'submit_approval' ? 'Enviando...' : 'Enviar a aprobacion'}
            </button>
          )}

          {!isArchived && isInApproval && (
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

          {!isArchived && isApprovedFlow && status !== 'sent' && status !== 'signed' && (
            <button
              type="button"
              onClick={sendForSignature}
              disabled={Boolean(loadingAction)}
              className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
            >
              {loadingAction === 'send_signature' ? 'Enviando...' : 'Enviar a firma electronica'}
            </button>
          )}

          {!isArchived && canReturnToReview && status !== 'signed' && (
            <button
              type="button"
              onClick={() => setShowReturnDialog(true)}
              disabled={Boolean(loadingAction)}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              {loadingAction === 'return_to_review' ? 'Regresando...' : 'Regresar a revision'}
            </button>
          )}

          {!isArchived ? (
            <button
              type="button"
              onClick={() => runContractAction('archive')}
              disabled={Boolean(loadingAction)}
              className="rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {loadingAction === 'archive' ? 'Archivando...' : 'Archivar contrato'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => runContractAction('unarchive')}
              disabled={Boolean(loadingAction)}
              className="rounded-md border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 disabled:opacity-50"
            >
              {loadingAction === 'unarchive' ? 'Desarchivando...' : 'Desarchivar (a borrador)'}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDeleteDialog(true)}
            disabled={Boolean(loadingAction)}
            className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {loadingAction === 'delete' ? 'Eliminando...' : 'Eliminar permanentemente'}
          </button>
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
      <ConfirmationDialog
        open={showDeleteDialog}
        title="Eliminar contrato permanentemente"
        description="Esta accion eliminara el contrato y sus archivos relacionados de forma definitiva."
        confirmLabel="Eliminar permanentemente"
        confirmVariant="danger"
        requireText="ELIMINAR"
        requireTextLabel="Escribe ELIMINAR para confirmar"
        loading={loadingAction === 'delete'}
        onClose={() => {
          if (loadingAction !== 'delete') setShowDeleteDialog(false)
        }}
        onConfirm={async (typedText) => {
          const deleted = await deleteContract(typedText)
          if (deleted) setShowDeleteDialog(false)
        }}
      />
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
