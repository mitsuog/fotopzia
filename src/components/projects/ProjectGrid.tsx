'use client'

import { Fragment, useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { ProjectTask, TeamProfile } from '@/hooks/useProject'

// ── helpers ──────────────────────────────────────────────────────────────────

function hashColor(id: string): string {
  const palette = ['#1C2B4A', '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0891B2', '#BE185D']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

const STATUS_CONFIG = {
  pending:     { label: 'Pendiente',   dot: 'bg-gray-400',    pill: 'bg-gray-100 text-gray-600' },
  in_progress: { label: 'En progreso', dot: 'bg-blue-500',    pill: 'bg-blue-100 text-blue-700' },
  done:        { label: 'Completado',  dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
  blocked:     { label: 'Bloqueado',   dot: 'bg-red-500',     pill: 'bg-red-100 text-red-700' },
} as const

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgente', border: 'border-l-red-500',    badge: 'bg-red-100 text-red-700' },
  high:   { label: 'Alta',    border: 'border-l-orange-400', badge: 'bg-orange-100 text-orange-700' },
  medium: { label: 'Media',   border: 'border-l-blue-400',   badge: 'bg-blue-100 text-blue-700' },
  low:    { label: 'Baja',    border: 'border-l-gray-200',   badge: 'bg-gray-100 text-gray-500' },
} as const

const STATUS_ORDER: ProjectTask['status'][] = ['pending', 'in_progress', 'blocked', 'done']

const GROUP_HEADER_COLORS: Record<ProjectTask['status'], string> = {
  pending:     'text-gray-600  before:bg-gray-400',
  in_progress: 'text-blue-700  before:bg-blue-500',
  blocked:     'text-red-700   before:bg-red-500',
  done:        'text-emerald-700 before:bg-emerald-500',
}

// ── inline status dropdown ────────────────────────────────────────────────────

function StatusChip({ status, onChange }: { status: ProjectTask['status']; onChange: (s: ProjectTask['status']) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[status]
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${cfg.pill}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl">
          {STATUS_ORDER.map(s => {
            const c = STATUS_CONFIG[s]
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false) }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 ${status === s ? 'font-semibold' : ''}`}
              >
                <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                {c.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── inline "add task" row ─────────────────────────────────────────────────────

function AddRow({ onAdd }: { onAdd: (title: string) => void }) {
  const [active, setActive] = useState(false)
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  function activate() { setActive(true); setTimeout(() => ref.current?.focus(), 0) }
  function commit() {
    if (value.trim()) { onAdd(value.trim()); setValue('') }
    setActive(false)
  }

  if (!active) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-1.5">
          <button
            type="button"
            onClick={activate}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-brand-navy transition-colors"
          >
            <Plus className="h-3 w-3" /> Agregar tarea
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="bg-blue-50/40">
      <td colSpan={7} className="px-4 py-1.5">
        <input
          ref={ref}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setActive(false); setValue('') } }}
          onBlur={commit}
          placeholder="Nombre de la tarea — Enter para guardar"
          className="w-full rounded-lg border border-brand-navy/30 bg-white px-3 py-1.5 text-xs text-gray-800 outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/10"
        />
      </td>
    </tr>
  )
}

// ── main grid ─────────────────────────────────────────────────────────────────

interface ProjectGridProps {
  tasks: ProjectTask[]
  profiles: TeamProfile[]
  projectStart: string | null
  projectEnd: string | null
  groupBy: 'status' | 'assignee'
  onUpdateTask: (taskId: string, updates: Partial<ProjectTask>) => Promise<unknown>
  onDeleteTask: (taskId: string) => Promise<unknown>
  onCreateTask: (data: Partial<ProjectTask> & { title: string }) => Promise<unknown>
  onOpenTask: (task: ProjectTask) => void
}

export function ProjectGrid({
  tasks,
  profiles,
  groupBy,
  onUpdateTask,
  onCreateTask,
  onOpenTask,
}: ProjectGridProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const now = new Date()

  function toggle(key: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  type Group = { key: string; label: string; tasks: ProjectTask[] }
  let groups: Group[]

  if (groupBy === 'status') {
    groups = STATUS_ORDER.map(s => ({
      key: s,
      label: STATUS_CONFIG[s].label,
      tasks: tasks.filter(t => t.status === s),
    }))
  } else {
    groups = [
      ...profiles
        .map(p => ({ key: p.id, label: p.full_name ?? p.email ?? p.id, tasks: tasks.filter(t => t.assigned_to === p.id) }))
        .filter(g => g.tasks.length > 0),
      ...(tasks.filter(t => !t.assigned_to).length > 0
        ? [{ key: '__unassigned', label: 'Sin asignar', tasks: tasks.filter(t => !t.assigned_to) }]
        : []),
    ]
  }

  return (
    <div>
      {/* Mobile: card stack */}
      <div className="block sm:hidden space-y-1">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="text-sm text-gray-400">Sin tareas todavía.</p>
          </div>
        ) : (
          groups.map(group => {
            const statusCfg = groupBy === 'status' ? STATUS_CONFIG[group.key as ProjectTask['status']] : null
            if (group.tasks.length === 0) return null
            return (
              <div key={group.key}>
                <p className={`px-1 py-1.5 text-xs font-bold ${statusCfg ? GROUP_HEADER_COLORS[group.key as ProjectTask['status']] : 'text-gray-700'}`}>
                  {group.label} · {group.tasks.length}
                </p>
                {group.tasks.map(task => {
                  const priorityCfg = PRIORITY_CONFIG[task.priority]
                  const profile = profiles.find(p => p.id === task.assigned_to)
                  const isOverdue = task.due_at && new Date(task.due_at) < now && task.status !== 'done'
                  const statusCfgTask = STATUS_CONFIG[task.status]
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className={`w-full text-left rounded-xl border-l-4 ${priorityCfg.border} border border-gray-200 bg-white p-3 mb-1 shadow-sm`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium flex-1 ${task.status === 'done' ? 'text-gray-300 line-through' : 'text-gray-800'}`}>
                          {task.title}
                        </p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusCfgTask.pill}`}>
                          {statusCfgTask.label}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-400">
                        {profile && (
                          <span
                            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{ backgroundColor: hashColor(profile.id) }}
                          >
                            {initials(profile.full_name)}
                          </span>
                        )}
                        {task.due_at && (
                          <span className={isOverdue ? 'font-semibold text-red-500' : ''}>
                            Vence: {fmtDate(task.due_at)}
                          </span>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${priorityCfg.badge}`}>{priorityCfg.label}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full min-w-[740px]">
        {/* Column headers */}
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="w-10 px-3 py-2.5" />
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tarea</th>
            <th className="w-36 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Responsable</th>
            <th className="w-32 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Estado</th>
            <th className="w-40 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Periodo</th>
            <th className="w-24 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Prioridad</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-50">
          {groups.map(group => {
            const isCollapsed = collapsed.has(group.key)
            const statusCfg = groupBy === 'status' ? STATUS_CONFIG[group.key as ProjectTask['status']] : null
            const groupProfile = groupBy === 'assignee' && group.key !== '__unassigned'
              ? profiles.find(p => p.id === group.key)
              : null

            return (
              <Fragment key={group.key}>
                {/* ── group header ── */}
                <tr
                  className="cursor-pointer select-none bg-gray-50/80 hover:bg-gray-100/60 transition-colors"
                  onClick={() => toggle(group.key)}
                >
                  <td colSpan={6} className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                        : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                      }
                      {statusCfg && (
                        <span className={`h-2.5 w-2.5 rounded-sm ${statusCfg.dot}`} />
                      )}
                      {groupProfile && (
                        <span
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: hashColor(groupProfile.id) }}
                        >
                          {initials(groupProfile.full_name)}
                        </span>
                      )}
                      <span className={`text-xs font-bold ${statusCfg ? GROUP_HEADER_COLORS[group.key as ProjectTask['status']] : 'text-gray-700'}`}>
                        {group.label}
                      </span>
                      <span className="rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                        {group.tasks.length}
                      </span>
                    </div>
                  </td>
                </tr>

                {/* ── task rows ── */}
                {!isCollapsed && group.tasks.map(task => {
                  const isOverdue = task.due_at && new Date(task.due_at) < now && task.status !== 'done'
                  const priorityCfg = PRIORITY_CONFIG[task.priority]
                  const profile = profiles.find(p => p.id === task.assigned_to)
                  const start = fmtDate(task.start_at)
                  const due = fmtDate(task.due_at)

                  return (
                    <tr
                      key={task.id}
                      className={`group border-l-4 ${priorityCfg.border} bg-white hover:bg-blue-50/30 transition-colors`}
                    >
                      {/* Checkbox */}
                      <td className="w-10 px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={task.status === 'done'}
                          onChange={e => onUpdateTask(task.id, { status: e.target.checked ? 'done' : 'pending' })}
                          className="h-4 w-4 cursor-pointer rounded accent-brand-navy"
                        />
                      </td>

                      {/* Title */}
                      <td className="px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => onOpenTask(task)}
                          className={`text-left text-sm font-medium transition-colors group-hover:text-brand-navy ${
                            task.status === 'done'
                              ? 'text-gray-300 line-through'
                              : 'text-gray-800 hover:text-brand-navy'
                          }`}
                        >
                          {task.title}
                        </button>
                        {task.description && (
                          <p className="mt-0.5 truncate text-[11px] text-gray-400 max-w-[280px]">{task.description}</p>
                        )}
                      </td>

                      {/* Responsable */}
                      <td className="w-36 px-3 py-2.5">
                        {profile ? (
                          <div className="flex items-center gap-2" title={profile.full_name ?? ''}>
                            <span
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                              style={{ backgroundColor: hashColor(profile.id) }}
                            >
                              {initials(profile.full_name)}
                            </span>
                            <span className="truncate text-xs text-gray-600">{profile.full_name?.split(' ')[0] ?? profile.email}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenTask(task)}
                            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-brand-navy transition-colors"
                          >
                            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-gray-200 text-gray-300">
                              +
                            </span>
                            <span className="hidden sm:inline">Asignar</span>
                          </button>
                        )}
                      </td>

                      {/* Status */}
                      <td className="w-32 px-3 py-2.5">
                        <StatusChip
                          status={task.status}
                          onChange={s => onUpdateTask(task.id, { status: s })}
                        />
                      </td>

                      {/* Periodo (inicio → fin) */}
                      <td className="w-40 px-3 py-2.5">
                        {start || due ? (
                          <button
                            type="button"
                            onClick={() => onOpenTask(task)}
                            className={`flex items-center gap-1 text-xs ${isOverdue ? 'font-semibold text-red-500' : 'text-gray-500'} hover:text-brand-navy transition-colors`}
                          >
                            {start && <span>{start}</span>}
                            {start && due && <span className="text-gray-300">→</span>}
                            {due && (
                              <span className={isOverdue ? 'text-red-500' : ''}>
                                {due}
                              </span>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenTask(task)}
                            className="text-xs text-gray-200 hover:text-gray-400 transition-colors"
                          >
                            — Fijar fechas
                          </button>
                        )}
                      </td>

                      {/* Prioridad */}
                      <td className="w-24 px-3 py-2.5">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${priorityCfg.badge}`}>
                          {priorityCfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {/* ── add row ── */}
                {!isCollapsed && (
                  <AddRow
                    onAdd={title =>
                      onCreateTask({
                        title,
                        status: groupBy === 'status' ? (group.key as ProjectTask['status']) : 'pending',
                        assigned_to: groupBy === 'assignee' && group.key !== '__unassigned' ? group.key : null,
                      })
                    }
                  />
                )}
              </Fragment>
            )
          })}

          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} className="py-16 text-center">
                <p className="text-sm text-gray-400">Sin tareas todavía.</p>
                <p className="mt-1 text-xs text-gray-300">Usa "+ Nueva tarea" para comenzar.</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  )
}
