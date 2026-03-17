'use client'

import { useState, useEffect } from 'react'
import { X, Trash2, Diamond, Link2, Unlink } from 'lucide-react'
import type { WBSNode, Dependency, DependencyType } from '@/types/wbs'
import type { TeamProfile } from '@/hooks/useProject'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'done', label: 'Hecho' },
  { value: 'blocked', label: 'Bloqueado' },
] as const

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
] as const

const DEP_TYPE_OPTIONS: { value: DependencyType; label: string; desc: string }[] = [
  { value: 'FS', label: 'FS', desc: 'Fin a Inicio (predeterminado)' },
  { value: 'SS', label: 'SS', desc: 'Inicio a Inicio' },
  { value: 'FF', label: 'FF', desc: 'Fin a Fin' },
  { value: 'SF', label: 'SF', desc: 'Inicio a Fin' },
]

const DEP_TYPE_COLORS: Record<DependencyType, string> = {
  FS: 'bg-brand-navy/10 text-brand-navy',
  SS: 'bg-brand-gold/10 text-brand-gold',
  FF: 'bg-slate-100 text-slate-600',
  SF: 'bg-amber-100 text-amber-700',
}

interface WBSNodePanelProps {
  node: WBSNode | null
  allNodes: WBSNode[]
  deps: Dependency[]
  profiles: TeamProfile[]
  onClose: () => void
  onUpdate: (nodeId: string, updates: Partial<WBSNode>) => Promise<unknown>
  onDelete: (nodeId: string) => Promise<unknown>
  onCreateDependency: (payload: { predecessor_id: string; successor_id: string; dep_type: DependencyType; lag_days: number }) => Promise<unknown>
  onDeleteDependency: (depId: string) => Promise<unknown>
}

function formatISOToLocal(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 16)  // 'YYYY-MM-DDTHH:mm'
}

export function WBSNodePanel({
  node,
  allNodes,
  deps,
  profiles,
  onClose,
  onUpdate,
  onDelete,
  onCreateDependency,
  onDeleteDependency,
}: WBSNodePanelProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    status: 'pending' as WBSNode['status'],
    priority: 'medium' as WBSNode['priority'],
    assigned_to: '',
    start_at: '',
    due_at: '',
    is_milestone: false,
    progress_mode: 'computed' as WBSNode['progress_mode'],
    progress_pct: 0,
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addDepMode, setAddDepMode] = useState(false)
  const [newDepNode, setNewDepNode] = useState('')
  const [newDepType, setNewDepType] = useState<DependencyType>('FS')
  const [newDepLag, setNewDepLag] = useState(0)
  const [newDepDirection, setNewDepDirection] = useState<'predecessor' | 'successor'>('predecessor')
  const [depError, setDepError] = useState<string | null>(null)
  const [addingDep, setAddingDep] = useState(false)

  useEffect(() => {
    if (node) {
      setForm({
        title: node.title,
        description: node.description ?? '',
        status: node.status,
        priority: node.priority,
        assigned_to: node.assigned_to ?? '',
        start_at: formatISOToLocal(node.start_at),
        due_at: formatISOToLocal(node.due_at),
        is_milestone: node.is_milestone,
        progress_mode: node.progress_mode,
        progress_pct: node.progress_pct ?? 0,
      })
      setConfirmDelete(false)
    }
  }, [node?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!node) return null

  // Dependencies involving this node
  const nodeDeps = deps.filter(d => d.predecessor_id === node.id || d.successor_id === node.id)

  // Candidate nodes for new dependency (exclude self, already-linked, children/parents)
  const candidateNodes = allNodes.filter(n =>
    n.id !== node.id &&
    n.level === 'task' &&
    !deps.some(d =>
      (d.predecessor_id === node.id && d.successor_id === n.id) ||
      (d.predecessor_id === n.id && d.successor_id === node.id),
    ),
  )

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await onUpdate(node!.id, {
        title: form.title.trim(),
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
        is_milestone: form.is_milestone,
        progress_mode: form.progress_mode,
        progress_pct: form.progress_mode === 'manual' ? form.progress_pct : null,
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleAddDependency() {
    if (!newDepNode) return
    setDepError(null)
    setAddingDep(true)
    try {
      const payload =
        newDepDirection === 'predecessor'
          ? { predecessor_id: node!.id, successor_id: newDepNode, dep_type: newDepType, lag_days: newDepLag }
          : { predecessor_id: newDepNode, successor_id: node!.id, dep_type: newDepType, lag_days: newDepLag }
      await onCreateDependency(payload)
      setAddDepMode(false)
      setNewDepNode('')
      setNewDepLag(0)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al agregar dependencia'
      setDepError(msg.includes('duplicate') || msg.includes('unique') ? 'Esa dependencia ya existe.' : msg)
    } finally {
      setAddingDep(false)
    }
  }

  const levelLabel = node.level === 'macro' ? 'Macroactividad' : node.level === 'activity' ? 'Actividad' : 'Tarea'

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-brand-stone px-5 py-4">
        <div>
          <span className="inline-flex rounded-full bg-brand-canvas px-2 py-0.5 text-[11px] font-medium text-brand-navy">
            {levelLabel}
          </span>
          {node.is_milestone && (
            <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-brand-gold/10 px-2 py-0.5 text-[11px] font-medium text-brand-gold">
              <Diamond className="h-3 w-3" />
              Hito
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:text-brand-navy">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {/* Title */}
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Título</label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-gold"
          />
        </div>

        {/* Status + Priority row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Estado</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as WBSNode['status'] }))}
              className="w-full rounded-lg border border-brand-stone px-2 py-2 text-sm text-brand-navy outline-none focus:border-brand-gold"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Prioridad</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as WBSNode['priority'] }))}
              className="w-full rounded-lg border border-brand-stone px-2 py-2 text-sm text-brand-navy outline-none focus:border-brand-gold"
            >
              {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Dates row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Inicio</label>
            <input
              type="datetime-local"
              value={form.start_at}
              onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))}
              className="w-full rounded-lg border border-brand-stone px-2 py-2 text-sm text-brand-navy outline-none focus:border-brand-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-brand-navy">Vencimiento</label>
            <input
              type="datetime-local"
              value={form.due_at}
              onChange={e => setForm(f => ({ ...f, due_at: e.target.value }))}
              className="w-full rounded-lg border border-brand-stone px-2 py-2 text-sm text-brand-navy outline-none focus:border-brand-gold"
            />
          </div>
        </div>

        {/* Assignee */}
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Responsable</label>
          <select
            value={form.assigned_to}
            onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))}
            className="w-full rounded-lg border border-brand-stone px-2 py-2 text-sm text-brand-navy outline-none focus:border-brand-gold"
          >
            <option value="">Sin asignar</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
            ))}
          </select>
        </div>

        {/* Milestone toggle (only for tasks) */}
        {node.level === 'task' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_milestone}
              onChange={e => setForm(f => ({ ...f, is_milestone: e.target.checked }))}
              className="h-4 w-4 rounded border-brand-stone accent-brand-gold"
            />
            <span className="text-sm text-brand-navy">Es un hito (milestone)</span>
            <Diamond className="h-4 w-4 text-brand-gold" />
          </label>
        )}

        {/* Progress mode */}
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Modo de avance</label>
          <div className="flex gap-2">
            {(['computed', 'manual'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setForm(f => ({ ...f, progress_mode: mode }))}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                  form.progress_mode === mode
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-brand-stone text-brand-navy hover:border-brand-navy'
                }`}
              >
                {mode === 'computed' ? 'Automático' : 'Manual'}
              </button>
            ))}
          </div>
          {form.progress_mode === 'manual' && (
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                value={form.progress_pct}
                onChange={e => setForm(f => ({ ...f, progress_pct: Number(e.target.value) }))}
                className="flex-1 accent-brand-gold"
              />
              <span className="w-10 text-right text-sm font-semibold text-brand-navy">{form.progress_pct}%</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium text-brand-navy">Descripción</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full resize-none rounded-lg border border-brand-stone px-3 py-2 text-sm text-brand-navy outline-none focus:border-brand-gold"
            placeholder="Notas, contexto, criterios de aceptación..."
          />
        </div>

        {/* Dependencies section (only for tasks) */}
        {node.level === 'task' && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-navy/70">Dependencias</h3>
              <button
                type="button"
                onClick={() => { setAddDepMode(v => !v); setDepError(null) }}
                className="flex items-center gap-1 rounded-md border border-brand-stone px-2 py-0.5 text-xs text-brand-navy hover:border-brand-gold"
              >
                <Link2 className="h-3 w-3" />
                Agregar
              </button>
            </div>

            {nodeDeps.length === 0 && !addDepMode && (
              <p className="text-xs text-gray-400">Sin dependencias configuradas.</p>
            )}

            <div className="space-y-1.5">
              {nodeDeps.map(dep => {
                const isPredecessor = dep.predecessor_id === node.id
                const otherId = isPredecessor ? dep.successor_id : dep.predecessor_id
                const other = allNodes.find(n => n.id === otherId)
                return (
                  <div
                    key={dep.id}
                    className="flex items-center gap-2 rounded-lg border border-brand-stone/70 bg-brand-paper/50 px-3 py-2"
                  >
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${DEP_TYPE_COLORS[dep.dep_type as DependencyType]}`}>
                      {dep.dep_type}
                    </span>
                    <span className="flex-1 truncate text-xs text-gray-700">
                      {isPredecessor ? '→' : '←'} {other?.title ?? otherId}
                    </span>
                    {dep.lag_days !== 0 && (
                      <span className="text-xs text-gray-500">
                        {dep.lag_days > 0 ? `+${dep.lag_days}d` : `${dep.lag_days}d`}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteDependency(dep.id)}
                      className="rounded p-0.5 text-gray-400 hover:text-red-500"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}

              {addDepMode && (
                <div className="rounded-lg border border-brand-gold/40 bg-brand-canvas/50 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium text-brand-navy">Dirección</label>
                      <select
                        value={newDepDirection}
                        onChange={e => setNewDepDirection(e.target.value as 'predecessor' | 'successor')}
                        className="w-full rounded border border-brand-stone px-1.5 py-1 text-xs text-brand-navy outline-none"
                      >
                        <option value="predecessor">Esta → Nodo (yo precedo)</option>
                        <option value="successor">Nodo → Esta (yo sucedo)</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium text-brand-navy">Tipo</label>
                      <select
                        value={newDepType}
                        onChange={e => setNewDepType(e.target.value as DependencyType)}
                        className="w-full rounded border border-brand-stone px-1.5 py-1 text-xs text-brand-navy outline-none"
                      >
                        {DEP_TYPE_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium text-brand-navy">Tarea relacionada</label>
                    <select
                      value={newDepNode}
                      onChange={e => setNewDepNode(e.target.value)}
                      className="w-full rounded border border-brand-stone px-1.5 py-1 text-xs text-brand-navy outline-none"
                    >
                      <option value="">Seleccionar tarea...</option>
                      {candidateNodes.map(n => (
                        <option key={n.id} value={n.id}>{n.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium text-brand-navy">
                      Desfase (días, + = retraso, - = adelanto)
                    </label>
                    <input
                      type="number"
                      value={newDepLag}
                      onChange={e => setNewDepLag(Number(e.target.value))}
                      className="w-full rounded border border-brand-stone px-1.5 py-1 text-xs text-brand-navy outline-none"
                    />
                  </div>
                  {depError && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{depError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddDependency}
                      disabled={!newDepNode || addingDep}
                      className="flex-1 rounded bg-brand-navy px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    >
                      {addingDep ? '...' : 'Agregar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddDepMode(false); setDepError(null) }}
                      className="rounded border border-brand-stone px-2 py-1 text-xs text-brand-navy"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t border-brand-stone px-5 py-4">
        {confirmDelete ? (
          <>
            <span className="flex-1 text-xs text-red-600">¿Confirmar eliminación?</span>
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
            >
              Eliminar
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-lg border border-brand-stone px-3 py-1.5 text-xs text-brand-navy"
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-brand-stone px-4 py-1.5 text-sm text-brand-navy"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="rounded-lg bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 hover:bg-brand-navy-light"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
