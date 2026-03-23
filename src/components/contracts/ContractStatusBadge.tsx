import { cn } from '@/lib/utils'
import type { ContractStatus } from '@/types/quotes'

const STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  draft:    { label: 'Borrador', className: 'bg-gray-100 text-gray-600' },
  sent:     { label: 'Enviado',  className: 'bg-blue-100 text-blue-700' },
  viewed:   { label: 'Visto',    className: 'bg-purple-100 text-purple-700' },
  signed:   { label: 'Firmado',  className: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rechazado', className: 'bg-red-100 text-red-600' },
  voided:   { label: 'Archivado', className: 'bg-gray-200 text-gray-500' },
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
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

