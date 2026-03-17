'use client'

import { useEffect, useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import type { ProjectTask, ProjectDeliverable, TeamProfile } from '@/hooks/useProject'

const PRIORITY_COLORS: Record<ProjectTask['priority'], string> = {
  urgent:  '#ef4444',
  high:    '#f59e0b',
  medium:  '#1C2B4A',
  low:     '#94a3b8',
}

interface ProjectCalendarTabProps {
  tasks: ProjectTask[]
  deliverables: ProjectDeliverable[]
  profiles: TeamProfile[]
  onNewTask: (date: string) => void
  onOpenTask: (task: ProjectTask) => void
}

export function ProjectCalendarTab({
  tasks,
  deliverables,
  profiles,
  onNewTask,
  onOpenTask,
}: ProjectCalendarTabProps) {
  const [filterAssignee, setFilterAssignee] = useState('')
  const [view, setView] = useState<'dayGridMonth' | 'timeGridWeek' | 'listMonth'>('dayGridMonth')

  useEffect(() => {
    if (window.innerWidth < 768) setView('listMonth')
  }, [])

  const events = useMemo(() => {
    const filteredTasks = filterAssignee
      ? tasks.filter(t => t.assigned_to === filterAssignee)
      : tasks

    const taskEvents = filteredTasks
      .filter(t => t.due_at || t.start_at)
      .map(t => ({
        id: `task-${t.id}`,
        title: t.title,
        start: t.start_at ?? t.due_at!,
        end: t.due_at ?? undefined,
        backgroundColor: t.status === 'done' ? '#10b981' : (PRIORITY_COLORS[t.priority] ?? '#1C2B4A'),
        borderColor: t.status === 'done' ? '#10b981' : (PRIORITY_COLORS[t.priority] ?? '#1C2B4A'),
        extendedProps: { type: 'task', taskId: t.id },
      }))

    const deliverableEvents = deliverables
      .filter(d => d.due_at)
      .map(d => ({
        id: `del-${d.id}`,
        title: `📦 ${d.name}`,
        start: d.due_at!,
        backgroundColor: '#C49A2A',
        borderColor: '#C49A2A',
        extendedProps: { type: 'deliverable' },
      }))

    return [...taskEvents, ...deliverableEvents]
  }, [tasks, deliverables, filterAssignee])

  const activeBtn = 'bg-brand-navy px-3 py-1.5 text-white'
  const inactiveBtn = 'px-3 py-1.5 text-gray-600 hover:bg-brand-canvas'

  return (
    <div className="space-y-3">
      {/* Control bar: filter (left) + view toggles (right) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {profiles.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Responsable:</span>
            <select
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
              className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy outline-none"
            >
              <option value="">Todos</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
              ))}
            </select>
          </div>
        )}

        {/* Mobile view toggle: Lista | Mes */}
        <div className="flex gap-0 overflow-hidden rounded-lg border border-brand-stone text-xs md:hidden">
          <button type="button" onClick={() => setView('listMonth')} className={view === 'listMonth' ? activeBtn : inactiveBtn}>
            Lista
          </button>
          <button type="button" onClick={() => setView('dayGridMonth')} className={view === 'dayGridMonth' ? activeBtn : inactiveBtn}>
            Mes
          </button>
        </div>

        {/* Desktop view toggle: Mes | Semana */}
        <div className="hidden gap-0 overflow-hidden rounded-lg border border-brand-stone text-xs md:flex">
          <button type="button" onClick={() => setView('dayGridMonth')} className={view === 'dayGridMonth' ? activeBtn : inactiveBtn}>
            Mes
          </button>
          <button type="button" onClick={() => setView('timeGridWeek')} className={view === 'timeGridWeek' ? activeBtn : inactiveBtn}>
            Semana
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Urgente</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Alta</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#1C2B4A' }} />Media</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />Baja</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Completada</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-gold" />Entregable</span>
      </div>

      <div className="rounded-xl border border-brand-stone bg-white p-3">
        <FullCalendar
          key={view}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={view}
          locale="es"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          buttonText={{ today: 'Hoy' }}
          events={events}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          nowIndicator
          dateClick={info => onNewTask(info.dateStr)}
          eventClick={info => {
            const { type, taskId } = info.event.extendedProps as { type: string; taskId?: string }
            if (type === 'task' && taskId) {
              const task = tasks.find(t => t.id === taskId)
              if (task) onOpenTask(task)
            }
          }}
          eventContent={renderInfo => (
            <div className="truncate px-1 text-xs font-medium leading-tight text-white">
              {renderInfo.event.title}
            </div>
          )}
        />
      </div>
    </div>
  )
}
