import { cn } from '@/lib/utils'
import type { QuoteStatus } from '@/types/quotes'

const STATUS_CONFIG: Record<QuoteStatus, { label: string; className: string }> = {
  draft:    { label: 'Borrador', className: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Enviada',  className: 'bg-blue-100 text-blue-700' },
  viewed:   { label: 'Vista',    className: 'bg-purple-100 text-purple-700' },
  approved: { label: 'Aprobada', className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-600' },
  expired:  { label: 'Vencida',  className: 'bg-orange-100 text-orange-600' },
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
