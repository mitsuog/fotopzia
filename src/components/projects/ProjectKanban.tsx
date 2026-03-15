'use client'

import type { ProjectTask, TeamProfile } from '@/hooks/useProject'

function hashColor(id: string): string {
  const palette = [
    '#1C2B4A', '#2563EB', '#7C3AED', '#059669',
    '#D97706', '#DC2626', '#0891B2', '#BE185D',
  ]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

const STATUS_ORDER: ProjectTask['status'][] = ['pending', 'in_progress', 'blocked', 'done']
const STATUS_LABELS: Record<ProjectTask['status'], string> = {
  pending:     'Pendiente',
  in_progress: 'En progreso',
  blocked:     'Bloqueado',
  done:        'Completado',
}
const STATUS_HEADER: Record<ProjectTask['status'], string> = {
  pending:     'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  blocked:     'bg-red-100 text-red-700',
  done:        'bg-emerald-100 text-emerald-700',
}

const PRIORITY_COLORS: Record<ProjectTask['priority'], string> = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low:    'bg-gray-100 text-gray-500',
}
const PRIORITY_LABELS: Record<ProjectTask['priority'], string> = {
  urgent: 'URGENTE', high: 'ALTA', medium: 'MEDIA', low: 'BAJA',
}

function nextStatus(s: ProjectTask['status']): ProjectTask['status'] {
  const i = STATUS_ORDER.indexOf(s)
  return STATUS_ORDER[Math.min(i + 1, STATUS_ORDER.length - 1)]
}
function prevStatus(s: ProjectTask['status']): ProjectTask['status'] {
  const i = STATUS_ORDER.indexOf(s)
  return STATUS_ORDER[Math.max(i - 1, 0)]
}

interface TaskCardProps {
  task: ProjectTask
  profiles: TeamProfile[]
  onUpdate: (updates: Partial<ProjectTask>) => void
  onClick: () => void
}

function TaskCard({ task, profiles, onUpdate, onClick }: TaskCardProps) {
  const profile = profiles.find(p => p.id === task.assigned_to)
  const now = new Date()
  const isOverdue = task.due_at && new Date(task.due_at) < now && task.status !== 'done'
  const statusIdx = STATUS_ORDER.indexOf(task.status)
  const canGoLeft = statusIdx > 0
  const canGoRight = statusIdx < STATUS_ORDER.length - 1

  return (
    <div className="rounded-lg border border-brand-stone/60 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
      <button
        type="button"
        onClick={onClick}
        className="mb-2 block text-left text-sm font-medium text-brand-navy hover:text-brand-gold w-full"
      >
        {task.title}
      </button>

      <div className="flex items-center justify-between gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${PRIORITY_COLORS[task.priority]}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
        {task.due_at && (
          <span className={`text-[11px] ${isOverdue ? 'font-semibold text-red-600' : 'text-gray-400'}`}>
            {new Date(task.due_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-1">
        {profile ? (
          <div title={profile.full_name ?? ''} className="flex items-center gap-1">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: hashColor(profile.id) }}
            >
              {initials(profile.full_name)}
            </span>
            <span className="text-[11px] text-gray-500 truncate max-w-[80px]">{profile.full_name ?? profile.email}</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-300">Sin asignar</span>
        )}

        <div className="flex gap-1">
          {canGoLeft && (
            <button
              type="button"
              title={`← ${STATUS_LABELS[prevStatus(task.status)]}`}
              onClick={() => onUpdate({ status: prevStatus(task.status) })}
              className="rounded border border-brand-stone px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-brand-canvas"
            >
              ←
            </button>
          )}
          {canGoRight && (
            <button
              type="button"
              title={`→ ${STATUS_LABELS[nextStatus(task.status)]}`}
              onClick={() => onUpdate({ status: nextStatus(task.status) })}
              className="rounded border border-brand-stone px-1.5 py-0.5 text-[10px] text-gray-500 hover:bg-brand-canvas"
            >
              →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ProjectKanbanProps {
  tasks: ProjectTask[]
  profiles: TeamProfile[]
  groupBy: 'status' | 'assignee'
  onUpdateTask: (taskId: string, updates: Partial<ProjectTask>) => Promise<unknown>
  onOpenTask: (task: ProjectTask) => void
}

export function ProjectKanban({ tasks, profiles, groupBy, onUpdateTask, onOpenTask }: ProjectKanbanProps) {
  if (groupBy === 'status') {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATUS_ORDER.map(status => {
          const col = tasks.filter(t => t.status === status)
          return (
            <div key={status} className="flex flex-col gap-2">
              <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${STATUS_HEADER[status]}`}>
                <span className="text-xs font-semibold">{STATUS_LABELS[status]}</span>
                <span className="text-xs opacity-70">({col.length})</span>
              </div>
              <div className="flex flex-col gap-2 min-h-[80px]">
                {col.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    profiles={profiles}
                    onUpdate={upd => onUpdateTask(task.id, upd)}
                    onClick={() => onOpenTask(task)}
                  />
                ))}
                {col.length === 0 && (
                  <div className="rounded-lg border border-dashed border-brand-stone/40 py-6 text-center text-xs text-gray-300">
                    Sin tareas
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // groupBy === 'assignee'
  const groups: { key: string; label: string; tasks: ProjectTask[] }[] = [
    ...profiles
      .map(p => ({ key: p.id, label: p.full_name ?? p.email ?? p.id, tasks: tasks.filter(t => t.assigned_to === p.id) }))
      .filter(g => g.tasks.length > 0),
    { key: '__unassigned', label: 'Sin asignar', tasks: tasks.filter(t => !t.assigned_to) },
  ].filter(g => g.tasks.length > 0)

  return (
    <div className="space-y-6">
      {groups.map(group => {
        const profile = profiles.find(p => p.id === group.key)
        return (
          <div key={group.key}>
            <div className="mb-3 flex items-center gap-2">
              {profile && (
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: hashColor(profile.id) }}
                >
                  {initials(profile.full_name)}
                </span>
              )}
              <span className="text-sm font-semibold text-brand-navy">{group.label}</span>
              <span className="text-xs text-gray-400">({group.tasks.length})</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  profiles={profiles}
                  onUpdate={upd => onUpdateTask(task.id, upd)}
                  onClick={() => onOpenTask(task)}
                />
              ))}
            </div>
          </div>
        )
      })}
      {tasks.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-400">Sin tareas en este proyecto.</div>
      )}
    </div>
  )
}
