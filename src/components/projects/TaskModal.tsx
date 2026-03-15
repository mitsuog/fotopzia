'use client'

import { useState, useEffect } from 'react'
import type { ProjectTask, TeamProfile } from '@/hooks/useProject'

interface TaskModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: Partial<ProjectTask> & { title: string }) => Promise<void>
  initialTask?: ProjectTask | null
  profiles: TeamProfile[]
}

const PRIORITIES: { value: ProjectTask['priority']; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
]

export function TaskModal({ open, onClose, onSave, initialTask, profiles }: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<ProjectTask['priority']>('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [startAt, setStartAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialTask) {
      setTitle(initialTask.title)
      setDescription(initialTask.description ?? '')
      setPriority(initialTask.priority)
      setAssignedTo(initialTask.assigned_to ?? '')
      setStartAt(initialTask.start_at ? initialTask.start_at.slice(0, 10) : '')
      setDueAt(initialTask.due_at ? initialTask.due_at.slice(0, 10) : '')
    } else {
      setTitle('')
      setDescription('')
      setPriority('medium')
      setAssignedTo('')
      setStartAt('')
      setDueAt('')
    }
    setError(null)
  }, [initialTask, open])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        priority,
        assigned_to: assignedTo || null,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-brand-stone bg-white shadow-2xl">
        <div className="border-b border-brand-stone px-5 py-4">
          <h2 className="text-base font-semibold text-brand-navy">
            {initialTask ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nombre de la tarea"
              required
              className="w-full rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Descripción</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalles opcionales..."
              className="w-full rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Prioridad</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as ProjectTask['priority'])}
                className="w-full rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-navy"
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Asignado a</label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-navy"
              >
                <option value="">Sin asignar</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Fecha inicio</label>
              <input
                type="date"
                value={startAt}
                onChange={e => setStartAt(e.target.value)}
                className="w-full rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-navy"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Fecha vencimiento</label>
              <input
                type="date"
                value={dueAt}
                onChange={e => setDueAt(e.target.value)}
                className="w-full rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-sm text-gray-800 outline-none focus:border-brand-navy"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-brand-stone px-4 py-2 text-sm font-medium text-gray-600 hover:bg-brand-paper disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
