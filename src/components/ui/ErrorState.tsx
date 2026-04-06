'use client'

import { AlertTriangle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  description?: string
  actionLabel?: string
  onAction?: () => void
}

export function ErrorState({
  title = 'Ocurrio un problema',
  description = 'No se pudo completar esta accion. Intenta nuevamente.',
  actionLabel = 'Reintentar',
  onAction,
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/60 px-4 text-center">
      <div className="rounded-full bg-red-100 p-2 text-red-700">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-red-800">{title}</p>
      <p className="mt-1 max-w-md text-xs text-red-700/80">{description}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-800"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
