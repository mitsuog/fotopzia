'use client'

import { useEffect, useState } from 'react'

interface WorkflowCommentDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
  onClose: () => void
  onConfirm: (comment: string) => Promise<void> | void
}

export function WorkflowCommentDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  onClose,
  onConfirm,
}: WorkflowCommentDialogProps) {
  const [comment, setComment] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setComment('')
      setLocalError(null)
    }
  }, [open])

  if (!open) return null

  async function handleConfirm() {
    const trimmed = comment.trim()
    if (!trimmed) {
      setLocalError('Debes escribir un comentario sobre los cambios realizados.')
      return
    }
    setLocalError(null)
    await onConfirm(trimmed)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/35" onClick={loading ? undefined : onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-brand-stone bg-white shadow-2xl">
          <div className="border-b border-brand-stone px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-navy">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          </div>

          <div className="space-y-2 px-4 py-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Comentario de cambios
            </label>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={4}
              placeholder="Describe brevemente que se cambio..."
              className="w-full resize-none rounded-md border border-brand-stone px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
            {localError && <p className="text-xs text-red-600">{localError}</p>}
          </div>

          <div className="flex justify-end gap-2 border-t border-brand-stone px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
            >
              {loading ? 'Guardando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
