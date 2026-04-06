'use client'

import { useCallback, useState } from 'react'
import { AlertTriangle, Plus, X } from 'lucide-react'
import type { ApiEnvelope } from '@/types/api'
import type {
  EquipmentAssignment,
  EquipmentCondition,
  EquipmentItem,
  EquipmentMaintenance,
  MaintenanceType,
} from '@/types/inventory'
import {
  CONDITION_CONFIG,
  LOCATION_LABELS,
  MAINTENANCE_TYPE_LABELS,
  STATUS_CONFIG,
} from '@/types/inventory'

interface ProjectOption { id: string; title: string }
interface UserOption { id: string; full_name: string | null; email?: string | null }

interface Props {
  item: EquipmentItem
  initialAssignments: EquipmentAssignment[]
  initialMaintenance: EquipmentMaintenance[]
  projects: ProjectOption[]
  users: UserOption[]
}

type Tab = 'info' | 'assignments' | 'maintenance'

async function parseApiEnvelope<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok) throw new Error(payload?.error?.message ?? fallback)
  if (!payload || payload.data == null) throw new Error(fallback)
  return payload.data
}

function fmtMoney(value: number | null | undefined): string {
  if (value == null) return '-'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(value)
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '-'
  return new Date(value.includes('T') ? value : `${value}T12:00:00`).toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

export function EquipmentDetailClient({ item: initialItem, initialAssignments, initialMaintenance, projects, users }: Props) {
  const [item, setItem] = useState(initialItem)
  const [tab, setTab] = useState<Tab>('info')
  const [assignments, setAssignments] = useState(initialAssignments)
  const [maintenance, setMaintenance] = useState(initialMaintenance)

  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState<string | null>(null)
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)

  const [assignForm, setAssignForm] = useState({
    project_id: '',
    assigned_to: '',
    assigned_at: new Date().toISOString().slice(0, 10),
    expected_return_at: '',
    condition_out: initialItem.condition as EquipmentCondition,
    notes: '',
  })

  const [returnForm, setReturnForm] = useState({
    condition_in: initialItem.condition as EquipmentCondition,
    notes: '',
  })

  const [maintenanceForm, setMaintenanceForm] = useState({
    type: 'preventivo' as MaintenanceType,
    description: '',
    performed_by: '',
    cost: '',
    performed_at: new Date().toISOString().slice(0, 10),
    next_due_at: '',
    vendor: '',
    notes: '',
  })

  const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40'

  const activeAssignment = assignments.find(assignment => !assignment.returned_at) ?? null

  const reloadItem = useCallback(async () => {
    const response = await fetch(`/api/inventory/items/${item.id}`)
    if (!response.ok) return
    setItem(await parseApiEnvelope<EquipmentItem>(response, 'No se pudo cargar el equipo.'))
  }, [item.id])

  const reloadAssignments = useCallback(async () => {
    const response = await fetch(`/api/inventory/items/${item.id}/assignments`)
    if (!response.ok) return
    setAssignments(await parseApiEnvelope<EquipmentAssignment[]>(response, 'No se pudo cargar asignaciones.'))
  }, [item.id])

  const reloadMaintenance = useCallback(async () => {
    const response = await fetch(`/api/inventory/items/${item.id}/maintenance`)
    if (!response.ok) return
    setMaintenance(await parseApiEnvelope<EquipmentMaintenance[]>(response, 'No se pudo cargar mantenimiento.'))
  }, [item.id])

  async function handleAssign(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/inventory/items/${item.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...assignForm,
          project_id: assignForm.project_id || null,
          expected_return_at: assignForm.expected_return_at || null,
          notes: assignForm.notes || null,
        }),
      })

      await parseApiEnvelope(response, 'No se pudo registrar la salida.')
      await Promise.all([reloadItem(), reloadAssignments()])
      setShowAssignModal(false)
      setAssignForm(prev => ({ ...prev, project_id: '', assigned_to: '', expected_return_at: '', notes: '' }))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo registrar la salida.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReturn(event: React.FormEvent, assignmentId: string) {
    event.preventDefault()
    setSaving(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/inventory/items/${item.id}/assignments/${assignmentId}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...returnForm,
          notes: returnForm.notes || null,
        }),
      })

      await parseApiEnvelope(response, 'No se pudo registrar la devolucion.')
      await Promise.all([reloadItem(), reloadAssignments()])
      setShowReturnModal(null)
      setReturnForm({ condition_in: item.condition, notes: '' })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo registrar la devolucion.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMaintenance(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setActionError(null)

    try {
      const response = await fetch(`/api/inventory/items/${item.id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...maintenanceForm,
          cost: maintenanceForm.cost ? Number(maintenanceForm.cost) : null,
          next_due_at: maintenanceForm.next_due_at || null,
          notes: maintenanceForm.notes || null,
          vendor: maintenanceForm.vendor || null,
          performed_by: maintenanceForm.performed_by || null,
        }),
      })

      await parseApiEnvelope(response, 'No se pudo registrar mantenimiento.')
      await reloadMaintenance()
      setShowMaintenanceModal(false)
      setMaintenanceForm(prev => ({ ...prev, description: '', performed_by: '', cost: '', next_due_at: '', vendor: '', notes: '' }))
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo registrar mantenimiento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-500">{item.asset_tag}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CONFIG[item.status].badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[item.status].dot}`} />
                {STATUS_CONFIG[item.status].label}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-brand-navy">{item.name}</h1>
            <p className="text-sm text-gray-500">{[item.brand, item.model].filter(Boolean).join(' | ') || item.category?.name || 'Sin categoria'}</p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{LOCATION_LABELS[item.location]}</p>
            <p>Serie: {item.serial_number ?? '-'}</p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'info' as Tab, label: 'Informacion' },
          { id: 'assignments' as Tab, label: `Historial de uso (${assignments.length})` },
          { id: 'maintenance' as Tab, label: `Mantenimiento (${maintenance.length})` },
        ] as const).map(option => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTab(option.id)}
            className={tab === option.id ? 'border-b-2 border-brand-navy px-2 py-2 text-sm font-semibold text-brand-navy' : 'px-2 py-2 text-sm text-gray-500 hover:text-gray-700'}
          >
            {option.label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Datos principales</h3>
            <dl className="space-y-1 text-sm text-gray-600">
              <div className="flex justify-between"><dt>Costo</dt><dd>{fmtMoney(item.purchase_cost)}</dd></div>
              <div className="flex justify-between"><dt>Compra</dt><dd>{fmtDate(item.purchase_date)}</dd></div>
              <div className="flex justify-between"><dt>Garantia</dt><dd>{fmtDate(item.warranty_expires_at)}</dd></div>
              <div className="flex justify-between"><dt>Seguro</dt><dd>{fmtDate(item.insurance_expires_at)}</dd></div>
            </dl>
            {item.notes && <p className="mt-3 text-xs text-gray-600">{item.notes}</p>}
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Alertas</h3>
            {item.insurance_expires_at && new Date(item.insurance_expires_at) < new Date() ? (
              <p className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700"><AlertTriangle className="h-3 w-3" /> Seguro vencido</p>
            ) : (
              <p className="text-xs text-gray-500">Sin alertas criticas.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            {activeAssignment ? (
              <button onClick={() => setShowReturnModal(activeAssignment.id)} className="rounded-lg border border-brand-navy px-3 py-2 text-xs font-semibold text-brand-navy">Registrar devolucion</button>
            ) : (
              <button onClick={() => setShowAssignModal(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Registrar salida</button>
            )}
          </div>

          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">Sin historial de uso</div>
          ) : (
            <div className="space-y-2">
              {assignments.map(assignment => (
                <div key={assignment.id} className={assignment.returned_at ? 'rounded-xl border border-gray-200 bg-white p-4' : 'rounded-xl border border-brand-navy/30 bg-white p-4'}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{assignment.project?.title ?? 'Sin proyecto'}</p>
                      <p className="text-xs text-gray-500">Responsable: {assignment.assignee?.full_name ?? 'Sin responsable'}</p>
                      <p className="text-xs text-gray-500">Salida: {fmtDate(assignment.assigned_at)}</p>
                      {assignment.returned_at && <p className="text-xs text-gray-500">Devolucion: {fmtDate(assignment.returned_at)}</p>}
                    </div>
                    {!assignment.returned_at && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">En uso</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowMaintenanceModal(true)} className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" /> Registrar mantenimiento</button>
          </div>

          {maintenance.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-sm text-gray-500">Sin mantenimiento registrado</div>
          ) : (
            <div className="space-y-2">
              {maintenance.map(entry => (
                <div key={entry.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{MAINTENANCE_TYPE_LABELS[entry.type]}</p>
                      <p className="text-xs text-gray-500">{entry.description}</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <p>{fmtDate(entry.performed_at)}</p>
                      <p>{fmtMoney(entry.cost)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Registrar salida</h3><button onClick={() => setShowAssignModal(false)}><X className="h-4 w-4" /></button></div>
            <form onSubmit={handleAssign} className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs text-gray-500">Responsable *</span><select required value={assignForm.assigned_to} onChange={event => setAssignForm(prev => ({ ...prev, assigned_to: event.target.value }))} className={inputClass}><option value="">Selecciona responsable</option>{users.map(user => <option key={user.id} value={user.id}>{user.full_name ?? user.email ?? user.id}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs text-gray-500">Proyecto</span><select value={assignForm.project_id} onChange={event => setAssignForm(prev => ({ ...prev, project_id: event.target.value }))} className={inputClass}><option value="">Sin proyecto</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1 block text-xs text-gray-500">Fecha salida *</span><input type="date" required value={assignForm.assigned_at} onChange={event => setAssignForm(prev => ({ ...prev, assigned_at: event.target.value }))} className={inputClass} /></label>
                <label><span className="mb-1 block text-xs text-gray-500">Retorno estimado</span><input type="date" value={assignForm.expected_return_at} onChange={event => setAssignForm(prev => ({ ...prev, expected_return_at: event.target.value }))} className={inputClass} /></label>
              </div>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowAssignModal(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white">Registrar</button></div>
            </form>
          </div>
        </div>
      )}

      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Registrar devolucion</h3><button onClick={() => setShowReturnModal(null)}><X className="h-4 w-4" /></button></div>
            <form onSubmit={event => handleReturn(event, showReturnModal)} className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs text-gray-500">Condicion regreso</span><select value={returnForm.condition_in} onChange={event => setReturnForm(prev => ({ ...prev, condition_in: event.target.value as EquipmentCondition }))} className={inputClass}>{(Object.keys(CONDITION_CONFIG) as EquipmentCondition[]).map(condition => <option key={condition} value={condition}>{CONDITION_CONFIG[condition].label}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs text-gray-500">Notas</span><textarea rows={2} value={returnForm.notes} onChange={event => setReturnForm(prev => ({ ...prev, notes: event.target.value }))} className={inputClass} /></label>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowReturnModal(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white">Registrar</button></div>
            </form>
          </div>
        </div>
      )}

      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Registrar mantenimiento</h3><button onClick={() => setShowMaintenanceModal(false)}><X className="h-4 w-4" /></button></div>
            <form onSubmit={handleMaintenance} className="space-y-3">
              <label className="block"><span className="mb-1 block text-xs text-gray-500">Tipo</span><select value={maintenanceForm.type} onChange={event => setMaintenanceForm(prev => ({ ...prev, type: event.target.value as MaintenanceType }))} className={inputClass}>{(Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map(type => <option key={type} value={type}>{MAINTENANCE_TYPE_LABELS[type]}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs text-gray-500">Descripcion *</span><input required value={maintenanceForm.description} onChange={event => setMaintenanceForm(prev => ({ ...prev, description: event.target.value }))} className={inputClass} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1 block text-xs text-gray-500">Fecha *</span><input type="date" required value={maintenanceForm.performed_at} onChange={event => setMaintenanceForm(prev => ({ ...prev, performed_at: event.target.value }))} className={inputClass} /></label>
                <label><span className="mb-1 block text-xs text-gray-500">Costo</span><input type="number" min={0} step={0.01} value={maintenanceForm.cost} onChange={event => setMaintenanceForm(prev => ({ ...prev, cost: event.target.value }))} className={inputClass} /></label>
              </div>
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowMaintenanceModal(false)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs">Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white">Registrar</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
