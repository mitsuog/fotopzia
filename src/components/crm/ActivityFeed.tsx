'use client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  StickyNote,
  Phone,
  Mail,
  Video,
  CheckSquare,
  ArrowRight,
  Paperclip,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Activity, ActivityType } from '@/types/crm'

const ACTIVITY_CONFIG: Record<ActivityType, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  note:         { icon: StickyNote,  color: 'text-amber-600',  bgColor: 'bg-amber-50',   label: 'Nota' },
  call:         { icon: Phone,       color: 'text-blue-600',   bgColor: 'bg-blue-50',    label: 'Llamada' },
  email:        { icon: Mail,        color: 'text-indigo-600', bgColor: 'bg-indigo-50',  label: 'Email' },
  meeting:      { icon: Video,       color: 'text-purple-600', bgColor: 'bg-purple-50',  label: 'Reunion' },
  task:         { icon: CheckSquare, color: 'text-green-600',  bgColor: 'bg-green-50',   label: 'Tarea' },
  stage_change: { icon: ArrowRight,  color: 'text-gray-500',   bgColor: 'bg-gray-100',   label: 'Cambio de etapa' },
  file:         { icon: Paperclip,   color: 'text-slate-600',  bgColor: 'bg-slate-100',  label: 'Archivo' },
}

interface ActivityFeedProps {
  activities: Activity[]
  className?: string
  onComplete?: (activityId: string) => void
}

function ActivityItem({ activity, onComplete }: { activity: Activity; onComplete?: (id: string) => void }) {
  const config = ACTIVITY_CONFIG[activity.type]
  const Icon = config.icon

  return (
    <div className="flex gap-3">
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', config.bgColor)}>
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>

      <div className="flex-1 min-w-0 pb-4 border-b border-gray-100 last:border-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <span className={cn('text-xs font-semibold uppercase tracking-wide', config.color)}>
              {config.label}
            </span>
            {activity.subject && (
              <p className="text-sm font-medium text-gray-800 mt-0.5 truncate">{activity.subject}</p>
            )}
            {activity.body && (
              <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{activity.body}</p>
            )}
            {activity.due_at && (
              <p className="text-xs text-gray-400 mt-1">
                Vence: {format(new Date(activity.due_at), "d 'de' MMMM, HH:mm", { locale: es })}
              </p>
            )}
            {activity.type === 'task' && !activity.completed && onComplete && (
              <button
                type="button"
                onClick={() => onComplete(activity.id)}
                className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-green-700 border border-green-200 bg-green-50 hover:bg-green-100 transition-colors"
              >
                <CheckSquare className="h-3 w-3" /> Completar
              </button>
            )}
          </div>
          <time className="text-xs text-gray-400 shrink-0">
            {format(new Date(activity.created_at), 'd MMM', { locale: es })}
          </time>
        </div>
      </div>
    </div>
  )
}

export function ActivityFeed({ activities, className, onComplete }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <StickyNote className="w-10 h-10 text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Sin actividades aun. Agrega una nota o seguimiento para registrar el historial del contacto.</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-0', className)}>
      {activities.map(activity => (
        <ActivityItem key={activity.id} activity={activity} onComplete={onComplete} />
      ))}
    </div>
  )
}
