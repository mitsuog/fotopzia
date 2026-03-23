'use client'

import { useEffect, useMemo, useState } from 'react'

interface ConfirmationDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  confirmVariant?: 'primary' | 'danger'
  requireText?: string
  requireTextLabel?: string
  requireTextPlaceholder?: string
  loading?: boolean
  onClose: () => void
  onConfirm: (typedText: string) => Promise<void> | void
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmVariant = 'primary',
  requireText,
  requireTextLabel,
  requireTextPlaceholder,
  loading = false,
  onClose,
  onConfirm,
}: ConfirmationDialogProps) {
  const [typedText, setTypedText] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setTypedText('')
      setLocalError(null)
    }
  }, [open])

  const normalizedTypedText = typedText.trim()
  const textRequired = Boolean(requireText)
  const canConfirm = useMemo(() => {
    if (!textRequired) return true
    return normalizedTypedText === requireText
  }, [normalizedTypedText, requireText, textRequired])

  if (!open) return null

  async function handleConfirm() {
    if (textRequired && !canConfirm) {
      setLocalError(`Debes escribir ${requireText} exactamente para continuar.`)
      return
    }
    setLocalError(null)
    await onConfirm(normalizedTypedText)
  }

  const confirmButtonClass =
    confirmVariant === 'danger'
      ? 'rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50'
      : 'rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light disabled:opacity-50'

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/35" onClick={loading ? undefined : onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-brand-stone bg-white shadow-2xl">
          <div className="border-b border-brand-stone px-4 py-3">
            <h3 className="text-sm font-semibold text-brand-navy">{title}</h3>
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          </div>

          {textRequired && (
            <div className="space-y-2 px-4 py-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {requireTextLabel ?? `Escribe ${requireText} para confirmar`}
              </label>
              <input
                type="text"
                value={typedText}
                onChange={(event) => setTypedText(event.target.value)}
                placeholder={requireTextPlaceholder ?? requireText}
                className="w-full rounded-md border border-brand-stone px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              {localError && <p className="text-xs text-red-600">{localError}</p>}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-brand-stone px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading || !canConfirm}
              className={confirmButtonClass}
            >
              {loading ? 'Procesando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
