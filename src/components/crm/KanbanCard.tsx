'use client'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Deal } from '@/types/crm'

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

interface KanbanCardProps {
  deal: Deal
  onClick?: () => void
  isDragOverlay?: boolean
}

export function KanbanCard({ deal, onClick, isDragOverlay }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { deal },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const contact = deal.contact
  const fullName = contact ? `${contact.first_name} ${contact.last_name}` : 'Sin contacto'
  const initials = contact ? getInitials(contact.first_name, contact.last_name) : '??'
  const avatarColor = getAvatarColor(fullName)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-brand-paper border border-brand-stone rounded-lg p-3 cursor-grab active:cursor-grabbing',
        onClick && 'ring-0 hover:ring-1 hover:ring-brand-gold/50',
        'hover:shadow-md hover:-translate-y-0.5 transition-all',
        isDragging && !isDragOverlay && 'opacity-40',
        isDragOverlay && 'shadow-xl rotate-1 cursor-grabbing',
      )}
    >
      <p className="font-semibold text-brand-navy text-sm leading-snug mb-2">{deal.title}</p>

      <div className="flex items-center gap-1.5 mb-2">
        <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', avatarColor)}>
          {initials}
        </div>
        <span className="text-xs text-gray-500 truncate">{fullName}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="font-medium text-gray-600">
          {deal.value ? `$${Number(deal.value).toLocaleString('es-MX')} ${deal.currency}` : 'Sin valor'}
        </span>
        {deal.expected_close && (
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-3 h-3" />
            {format(new Date(deal.expected_close), 'd MMM', { locale: es })}
          </span>
        )}
      </div>

      {contact?.source && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
            {contact.source}
          </span>
        </div>
      )}
    </div>
  )
}
