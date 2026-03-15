'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Calendar, User, Flag, AlignLeft, CheckSquare } from 'lucide-react'
import type { ProjectTask, TeamProfile } from '@/hooks/useProject'

const STATUS_OPTIONS: { value: ProjectTask['status']; label: string; dot: string }[] = [
  { value: 'pending',     label: 'Pendiente',   dot: 'bg-gray-400' },
  { value: 'in_progress', label: 'En progreso', dot: 'bg-blue-500' },
  { value: 'blocked',     label: 'Bloqueado',   dot: 'bg-red-500' },
  { value: 'done',        label: 'Completado',  dot: 'bg-emerald-500' },
]

const PRIORITY_OPTIONS: { value: ProjectTask['priority']; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' },
  { value: 'high',   label: 'Alta',    color: 'text-orange-500' },
  { value: 'medium', label: 'Media',   color: 'text-blue-600' },
  { value: 'low',    label: 'Baja',    color: 'text-gray-400' },
]

interface TaskSidePanelProps {
  open: boolean
  task: ProjectTask | null
  isNew?: boolean
  profiles: TeamProfile[]
  onClose: () => void
  onSave: (data: Partial<ProjectTask> & { title: string }) => Promise<void>
  onDelete?: (taskId: string) => Promise<void>
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="mt-0.5 shrink-0 text-gray-400">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">{label}</p>
        {children}
      </div>
    </div>
  )
}

export function TaskSidePanel({
  open,
  task,
  isNew,
  profiles,
  onClose,
  onSave,
  onDelete,
}: TaskSidePanelProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectTask['status']>('pending')
  const [priority, setPriority] = useState<ProjectTask['priority']>('medium')
  const [assignedTo, setAssignedTo] = useState('')
  const [startAt, setStartAt] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(task?.title ?? '')
      setDescription(task?.description ?? '')
      setStatus(task?.status ?? 'pending')
      setPriority(task?.priority ?? 'medium')
      setAssignedTo(task?.assigned_to ?? '')
      setStartAt(task?.start_at ? task.start_at.slice(0, 10) : '')
      setDueAt(task?.due_at ? task.due_at.slice(0, 10) : '')
      setError(null)
      setConfirmDelete(false)
    }
  }, [open, task])

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        assigned_to: assignedTo || null,
        start_at: startAt ? new Date(startAt).toISOString() : null,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!task || !onDelete) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await onDelete(task.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const selectedStatus = STATUS_OPTIONS.find(o => o.value === status)
  const selectedPriority = PRIORITY_OPTIONS.find(o => o.value === priority)
  const profile = profiles.find(p => p.id === assignedTo)

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-brand-navy" />
            <span className="text-sm font-semibold text-brand-navy">
              {isNew ? 'Nueva tarea' : 'Editar tarea'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-2">
          {/* Title */}
          <div className="py-3 border-b border-gray-100">
            <textarea
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Nombre de la tarea..."
              rows={2}
              className="w-full resize-none rounded-lg border-0 bg-gray-50 px-3 py-2 text-base font-semibold text-brand-navy placeholder:font-normal placeholder:text-gray-300 outline-none focus:bg-gray-100 transition-colors"
            />
          </div>

          {/* Status */}
          <Field icon={<span className={`mt-0.5 h-2.5 w-2.5 rounded-full ${selectedStatus?.dot}`} />} label="Estado">
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setStatus(o.value)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    status === o.value
                      ? 'ring-2 ring-brand-navy/20 shadow-sm scale-105'
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  } ${
                    o.value === 'pending'     && status === o.value ? 'bg-gray-200 text-gray-700' : ''
                  }${
                    o.value === 'in_progress' && status === o.value ? 'bg-blue-100 text-blue-700' : ''
                  }${
                    o.value === 'blocked'     && status === o.value ? 'bg-red-100 text-red-700' : ''
                  }${
                    o.value === 'done'        && status === o.value ? 'bg-emerald-100 text-emerald-700' : ''
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${o.dot}`} />
                  {o.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Priority */}
          <Field icon={<Flag className="h-3.5 w-3.5" />} label="Prioridad">
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPriority(o.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                    priority === o.value
                      ? `${o.color} bg-current/10 ring-2 ring-current/20 scale-105`
                      : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}
                  style={priority === o.value ? {
                    backgroundColor: o.value === 'urgent' ? '#fee2e2'
                      : o.value === 'high' ? '#ffedd5'
                      : o.value === 'medium' ? '#dbeafe'
                      : '#f3f4f6',
                  } : undefined}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Responsable */}
          <Field icon={<User className="h-3.5 w-3.5" />} label="Responsable">
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-navy focus:bg-white transition-colors"
            >
              <option value="">Sin asignar</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
              ))}
            </select>
            {profile && (
              <p className="mt-1 text-xs text-gray-400">{profile.email}</p>
            )}
          </Field>

          {/* Dates */}
          <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Periodo">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1 text-[10px] text-gray-400">Inicio</p>
                <input
                  type="date"
                  value={startAt}
                  onChange={e => setStartAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-brand-navy focus:bg-white transition-colors"
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] text-gray-400">Vencimiento</p>
                <input
                  type="date"
                  value={dueAt}
                  onChange={e => setDueAt(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-sm text-gray-700 outline-none focus:border-brand-navy focus:bg-white transition-colors"
                />
              </div>
            </div>
          </Field>

          {/* Description */}
          <Field icon={<AlignLeft className="h-3.5 w-3.5" />} label="Descripción">
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={4}
              placeholder="Agrega detalles, instrucciones, links..."
              className="w-full resize-none rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-300 outline-none focus:border-brand-navy focus:bg-white transition-colors"
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4 space-y-3">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Delete */}
            {task && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                  confirmDelete
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500'
                }`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deleting ? 'Eliminando...' : confirmDelete ? 'Confirmar' : 'Eliminar'}
              </button>
            )}

            <div className="flex flex-1 justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !title.trim()}
                className="rounded-lg bg-brand-navy px-5 py-2 text-sm font-semibold text-white hover:bg-brand-navy-light disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
