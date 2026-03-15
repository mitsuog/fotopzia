'use client'

import { useState } from 'react'
import type { ProjectDeliverable } from '@/hooks/useProject'

const STATUS_CONFIG: Record<
  ProjectDeliverable['status'],
  { label: string; bg: string; text: string }
> = {
  pending:     { label: 'Pendiente',   bg: 'bg-gray-100',    text: 'text-gray-600' },
  in_progress: { label: 'En progreso', bg: 'bg-blue-100',    text: 'text-blue-700' },
  ready:       { label: 'Listo',       bg: 'bg-amber-100',   text: 'text-amber-700' },
  delivered:   { label: 'Entregado',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  approved:    { label: 'Aprobado',    bg: 'bg-green-100',   text: 'text-green-700' },
  rejected:    { label: 'Rechazado',   bg: 'bg-red-100',     text: 'text-red-700' },
}

const ALL_STATUSES: ProjectDeliverable['status'][] = [
  'pending', 'in_progress', 'ready', 'delivered', 'approved', 'rejected',
]

interface ProjectDeliverablesProps {
  projectId: string
  deliverables: ProjectDeliverable[]
  onUpdateDeliverable: (id: string, updates: Partial<ProjectDeliverable>) => Promise<unknown>
  onCreateDeliverable: (data: Partial<ProjectDeliverable> & { name: string }) => Promise<unknown>
}

function StatusDropdown({
  status,
  onChange,
}: {
  status: ProjectDeliverable['status']
  onChange: (s: ProjectDeliverable['status']) => void
}) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[status]
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
      >
        {cfg.label} <span className="text-[10px] opacity-60">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-36 rounded-lg border border-brand-stone bg-white py-1 shadow-lg">
          {ALL_STATUSES.map(s => {
            const c = STATUS_CONFIG[s]
            return (
              <button
                key={s}
                type="button"
                onClick={() => { onChange(s); setOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-brand-canvas"
              >
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.bg} ${c.text}`}>
                  {c.label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function InlineForm({ onAdd, onCancel }: { onAdd: (name: string, dueAt: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [dueAt, setDueAt] = useState('')

  return (
    <tr className="border-b border-brand-stone/30 bg-brand-canvas/40">
      <td className="px-4 py-2">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          placeholder="Nombre del entregable..."
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) onAdd(name.trim(), dueAt)
            if (e.key === 'Escape') onCancel()
          }}
          className="w-full rounded border border-brand-navy/30 bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-brand-navy"
        />
      </td>
      <td className="px-4 py-2">
        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Pendiente</span>
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          value={dueAt}
          onChange={e => setDueAt(e.target.value)}
          className="rounded border border-brand-stone bg-white px-2 py-1 text-xs text-gray-800 outline-none focus:border-brand-navy"
        />
      </td>
      <td className="px-4 py-2" />
      <td className="px-4 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => { if (name.trim()) onAdd(name.trim(), dueAt) }}
            disabled={!name.trim()}
            className="rounded bg-brand-navy px-2 py-1 text-[11px] text-white hover:bg-brand-navy-light disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-brand-stone px-2 py-1 text-[11px] text-gray-500 hover:bg-brand-paper"
          >
            Cancelar
          </button>
        </div>
      </td>
    </tr>
  )
}

export function ProjectDeliverables({
  deliverables,
  onUpdateDeliverable,
  onCreateDeliverable,
}: ProjectDeliverablesProps) {
  const [adding, setAdding] = useState(false)

  async function handleAdd(name: string, dueAt: string) {
    await onCreateDeliverable({
      name,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    })
    setAdding(false)
  }

  return (
    <div className="rounded-xl border border-brand-stone/80 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-brand-stone px-4 py-3">
        <h3 className="text-sm font-semibold text-brand-navy">Entregables</h3>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light"
        >
          + Nuevo entregable
        </button>
      </div>

      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-brand-stone bg-brand-canvas/40">
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Nombre</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Estado</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Vence</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Notas</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Actualizar</th>
          </tr>
        </thead>
        <tbody>
          {adding && (
            <InlineForm
              onAdd={handleAdd}
              onCancel={() => setAdding(false)}
            />
          )}

          {deliverables.length === 0 && !adding && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                Sin entregables. Agrega el primero.
              </td>
            </tr>
          )}

          {deliverables.map(d => {
            const now = new Date()
            const isOverdue = d.due_at && new Date(d.due_at) < now && d.status !== 'approved' && d.status !== 'delivered'
            return (
              <tr key={d.id} className="border-b border-brand-stone/30 hover:bg-brand-canvas/20">
                <td className="px-4 py-2.5">
                  <p className="text-sm font-medium text-brand-navy">{d.name}</p>
                  {d.description && (
                    <p className="mt-0.5 text-xs text-gray-500">{d.description}</p>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {(() => {
                    const cfg = STATUS_CONFIG[d.status]
                    return (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                    )
                  })()}
                </td>
                <td className={`px-4 py-2.5 text-xs ${isOverdue ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                  {d.due_at ? new Date(d.due_at).toLocaleDateString('es-MX') : '—'}
                </td>
                <td className="px-4 py-2.5 max-w-[180px]">
                  <p className="truncate text-xs text-gray-500" title={d.notes ?? ''}>{d.notes || '—'}</p>
                </td>
                <td className="px-4 py-2.5">
                  <StatusDropdown
                    status={d.status}
                    onChange={s => onUpdateDeliverable(d.id, { status: s })}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
