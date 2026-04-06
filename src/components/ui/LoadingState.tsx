import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  title?: string
  description?: string
  compact?: boolean
}

export function LoadingState({
  title = 'Cargando...',
  description = 'Estamos preparando la informacion para ti.',
  compact = false,
}: LoadingStateProps) {
  return (
    <div className={compact ? 'flex items-center gap-2 text-sm text-gray-500' : 'flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-brand-stone/80 bg-white/75 text-center'}>
      <Loader2 className={compact ? 'h-4 w-4 animate-spin' : 'h-6 w-6 animate-spin text-brand-navy'} />
      <div className={compact ? '' : 'mt-3'}>
        <p className={compact ? '' : 'text-sm font-semibold text-brand-navy'}>{title}</p>
        {!compact && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      </div>
    </div>
  )
}
