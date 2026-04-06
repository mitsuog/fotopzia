import type { ComponentType } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type AlertVariant = 'info' | 'success' | 'warning' | 'error'

const alertStyles: Record<AlertVariant, { root: string; icon: string }> = {
  info: {
    root: 'border-sky-200 bg-sky-50 text-sky-800',
    icon: 'text-sky-600',
  },
  success: {
    root: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: 'text-emerald-600',
  },
  warning: {
    root: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: 'text-amber-600',
  },
  error: {
    root: 'border-red-200 bg-red-50 text-red-800',
    icon: 'text-red-600',
  },
}

const alertIcons: Record<AlertVariant, ComponentType<{ className?: string }>> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
}

interface InlineAlertProps {
  title?: string
  description: string
  variant?: AlertVariant
  className?: string
}

export function InlineAlert({
  title,
  description,
  variant = 'info',
  className,
}: InlineAlertProps) {
  const Icon = alertIcons[variant]

  return (
    <div className={cn('rounded-lg border px-3 py-2 text-xs', alertStyles[variant].root, className)} role="alert">
      <div className="flex items-start gap-2">
        <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', alertStyles[variant].icon)} />
        <div>
          {title && <p className="font-semibold">{title}</p>}
          <p>{description}</p>
        </div>
      </div>
    </div>
  )
}
