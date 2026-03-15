'use client'

import { useState } from 'react'
import type { ProjectTask, TeamProfile } from '@/hooks/useProject'

const PRIORITY_COLORS: Record<ProjectTask['priority'], string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-400',
  medium: 'bg-brand-navy',
  low:    'bg-gray-400',
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function hashColor(id: string): string {
  const palette = ['#1C2B4A', '#2563EB', '#7C3AED', '#059669', '#D97706', '#DC2626']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff
  return palette[Math.abs(h) % palette.length]
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

const WINDOW = 21 // days visible

interface ProjectGanttProps {
  tasks: ProjectTask[]
  profiles: TeamProfile[]
  onOpenTask: (task: ProjectTask) => void
}

export function ProjectGantt({ tasks, profiles, onOpenTask }: ProjectGanttProps) {
  const [windowStart, setWindowStart] = useState<Date>(() => {
    // Start at the earliest task start or today
    const dates = tasks
      .map(t => t.start_at ?? t.due_at)
      .filter(Boolean)
      .map(d => new Date(d!))
    if (dates.length === 0) return startOfDay(new Date())
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())))
    return startOfDay(earliest)
  })

  const today = startOfDay(new Date())
  const days = Array.from({ length: WINDOW }, (_, i) => addDays(windowStart, i))
  const windowEnd = addDays(windowStart, WINDOW)

  function prev() { setWindowStart(d => addDays(d, -7)) }
  function next() { setWindowStart(d => addDays(d, 7)) }

  function getBarStyle(task: ProjectTask) {
    if (!task.due_at) return null
    const totalMs = WINDOW * 24 * 60 * 60 * 1000
    const winStartMs = windowStart.getTime()

    if (task.start_at) {
      const start = Math.max(new Date(task.start_at).getTime(), winStartMs)
      const end = Math.min(new Date(task.due_at).getTime(), windowEnd.getTime())
      if (end < winStartMs || start > windowEnd.getTime()) return null
      const left = ((start - winStartMs) / totalMs) * 100
      const width = Math.max(0.5, ((end - start) / totalMs) * 100)
      return { left: `${left}%`, width: `${width}%` }
    }

    // Point marker for tasks without start
    const dueMs = new Date(task.due_at).getTime()
    if (dueMs < winStartMs || dueMs > windowEnd.getTime()) return null
    const left = ((dueMs - winStartMs) / totalMs) * 100
    return { left: `${left}%`, width: null } // null width = diamond marker
  }

  const rangeLabel = `${windowStart.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} — ${addDays(windowStart, WINDOW - 1).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // Columns: name (200px) + day grid (flex)
  return (
    <div className="overflow-x-auto rounded-xl border border-brand-stone/80 bg-white">
      {/* Navigation */}
      <div className="flex items-center gap-3 border-b border-brand-stone px-4 py-3">
        <button
          type="button"
          onClick={prev}
          className="rounded border border-brand-stone px-2 py-1 text-xs text-gray-500 hover:bg-brand-canvas"
        >
          ← Sem anterior
        </button>
        <span className="flex-1 text-center text-xs font-medium text-brand-navy">{rangeLabel}</span>
        <button
          type="button"
          onClick={next}
          className="rounded border border-brand-stone px-2 py-1 text-xs text-gray-500 hover:bg-brand-canvas"
        >
          Sem siguiente →
        </button>
      </div>

      <div className="min-w-[600px]">
        {/* Header row: day labels */}
        <div className="flex border-b border-brand-stone">
          <div className="w-[200px] shrink-0 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Tarea
          </div>
          <div className="relative flex flex-1">
            {days.map(day => {
              const isToday = day.getTime() === today.getTime()
              return (
                <div
                  key={day.toISOString()}
                  className={`flex-1 border-l border-brand-stone/30 py-1.5 text-center text-[10px] ${isToday ? 'bg-yellow-50 font-bold text-brand-navy' : 'text-gray-400'}`}
                >
                  {day.getDate()}
                </div>
              )
            })}
          </div>
        </div>

        {/* Task rows */}
        {tasks.length === 0 && (
          <div className="py-16 text-center text-sm text-gray-400">Sin tareas con fechas asignadas.</div>
        )}

        {tasks.map(task => {
          const barStyle = getBarStyle(task)
          const profile = profiles.find(p => p.id === task.assigned_to)

          return (
            <div key={task.id} className="flex border-b border-brand-stone/20 hover:bg-brand-canvas/20">
              {/* Left: name + owner */}
              <div className="flex w-[200px] shrink-0 items-center gap-2 px-3 py-2">
                {profile && (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: hashColor(profile.id) }}
                  >
                    {initials(profile.full_name)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onOpenTask(task)}
                  className="truncate text-left text-xs font-medium text-brand-navy hover:text-brand-gold"
                  title={task.title}
                >
                  {task.title}
                </button>
              </div>

              {/* Right: Gantt bar */}
              <div className="relative flex flex-1 items-center">
                {/* Background grid lines */}
                {days.map(day => {
                  const isToday = day.getTime() === today.getTime()
                  return (
                    <div
                      key={day.toISOString()}
                      className={`flex-1 self-stretch border-l border-brand-stone/20 ${isToday ? 'bg-yellow-50/60' : ''}`}
                    />
                  )
                })}

                {/* Bar or diamond */}
                {barStyle && (
                  barStyle.width ? (
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className={`absolute h-5 rounded-full opacity-90 hover:opacity-100 transition-opacity ${PRIORITY_COLORS[task.priority]}`}
                      style={{ left: barStyle.left, width: barStyle.width }}
                      title={task.title}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenTask(task)}
                      className={`absolute h-3 w-3 rotate-45 ${PRIORITY_COLORS[task.priority]} hover:scale-125 transition-transform`}
                      style={{ left: `calc(${barStyle.left} - 6px)` }}
                      title={task.title}
                    />
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
