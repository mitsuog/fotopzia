'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, X, Plus } from 'lucide-react'
import type { EquipmentItem, EquipmentAssignment, EquipmentMaintenance, EquipmentCondition, MaintenanceType } from '@/types/inventory'
import { CONDITION_CONFIG, STATUS_CONFIG, LOCATION_LABELS, MAINTENANCE_TYPE_LABELS } from '@/types/inventory'

function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

type Tab = 'info' | 'assignments' | 'maintenance'

interface Project { id: string; title: string }

interface Props {
  item: EquipmentItem
  initialAssignments: EquipmentAssignment[]
  initialMaintenance: EquipmentMaintenance[]
  projects: Project[]
}

export function EquipmentDetailClient({ item: initialItem, initialAssignments, initialMaintenance, projects }: Props) {
  const [item, setItem] = useState(initialItem)
  const [tab, setTab] = useState<Tab>('info')
  const [assignments, setAssignments] = useState(initialAssignments)
  const [maintenance, setMaintenance] = useState(initialMaintenance)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState<string | null>(null)
  const [showMaintModal, setShowMaintModal] = useState(false)
  const [saving, setSaving] = useState(false)

  const [assignForm, setAssignForm] = useState({
    project_id: '',
    assigned_at: new Date().toISOString().slice(0, 10),
    expected_return_at: '',
    condition_out: item.condition as EquipmentCondition,
    notes: '',
  })

  const [returnForm, setReturnForm] = useState({
    condition_in: item.condition as EquipmentCondition,
    notes: '',
  })

  const [maintForm, setMaintForm] = useState({
    type: 'preventivo' as MaintenanceType,
    description: '',
    performed_by: '',
    cost: '',
    performed_at: new Date().toISOString().slice(0, 10),
    next_due_at: '',
    vendor: '',
    notes: '',
  })

  const reloadItem = useCallback(async () => {
    const res = await fetch(`/api/inventory/items/${item.id}`)
    if (res.ok) setItem(await res.json())
  }, [item.id])

  const reloadAssignments = useCallback(async () => {
    const res = await fetch(`/api/inventory/items/${item.id}/assignments`)
    if (res.ok) setAssignments(await res.json())
  }, [item.id])

  const reloadMaintenance = useCallback(async () => {
    const res = await fetch(`/api/inventory/items/${item.id}/maintenance`)
    if (res.ok) setMaintenance(await res.json())
  }, [item.id])

  async function handleAssign(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const body = {
        ...assignForm,
        project_id: assignForm.project_id || null,
        expected_return_at: assignForm.expected_return_at || null,
      }
      const res = await fetch(`/api/inventory/items/${item.id}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        await Promise.all([reloadItem(), reloadAssignments()])
        setShowAssignModal(false)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleReturn(ev: React.FormEvent, aid: string) {
    ev.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/items/${item.id}/assignments/${aid}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnForm),
      })
      if (res.ok) {
        await Promise.all([reloadItem(), reloadAssignments()])
        setShowReturnModal(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleMaint(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const body = {
        ...maintForm,
        cost: maintForm.cost ? Number(maintForm.cost) : null,
        next_due_at: maintForm.next_due_at || null,
      }
      const res = await fetch(`/api/inventory/items/${item.id}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        await reloadMaintenance()
        setShowMaintModal(false)
        setMaintForm(p => ({ ...p, description: '', performed_by: '', cost: '', next_due_at: '', vendor: '', notes: '' }))
      }
    } finally {
      setSaving(false)
    }
  }

  const condition = CONDITION_CONFIG[item.condition]
  const status = STATUS_CONFIG[item.status]
  const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
  const activeAssignment = assignments.find(a => !a.returned_at)
  const today = new Date().toISOString().slice(0, 10)

  // Depreciation progress
  const showDepreciation = item.depreciation_method === 'linea_recta' && item.purchase_cost && item.purchase_date && item.useful_life_years

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-gray-400">{item.asset_tag}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.badge}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${condition.badge}`}>
                {condition.label}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-brand-navy">{item.name}</h1>
            {(item.brand || item.model) && (
              <p className="text-sm text-gray-500">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>{item.category?.name ?? '—'}</p>
            <p>{LOCATION_LABELS[item.location]}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'info' as Tab, label: 'Información' },
          { id: 'assignments' as Tab, label: `Historial de uso (${assignments.length})` },
          { id: 'maintenance' as Tab, label: `Mantenimiento (${maintenance.length})` },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative pb-2.5 px-1 text-sm font-medium transition-colors mr-4 ${
              tab === t.id
                ? 'text-brand-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-brand-navy'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {tab === 'info' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-gray-700">Datos del equipo</h3>
            <dl className="space-y-2 text-sm">
              {item.serial_number && <div className="flex justify-between"><dt className="text-gray-400">N° Serie</dt><dd className="font-mono text-gray-700">{item.serial_number}</dd></div>}
              {item.purchase_date && <div className="flex justify-between"><dt className="text-gray-400">Fecha de compra</dt><dd className="text-gray-700">{fmtDate(item.purchase_date)}</dd></div>}
              {item.purchase_cost && <div className="flex justify-between"><dt className="text-gray-400">Costo de compra</dt><dd className="font-medium text-gray-700">{fmt(item.purchase_cost)}</dd></div>}
              {item.notes && <div><dt className="mb-1 text-gray-400">Notas</dt><dd className="text-gray-600">{item.notes}</dd></div>}
            </dl>
          </div>

          {showDepreciation && (
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-gray-700">Depreciación (línea recta)</h3>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-gray-400">Vida útil</dt><dd>{item.useful_life_years} años</dd></div>
                <div className="flex justify-between"><dt className="text-gray-400">Valor residual</dt><dd>{fmt(item.salvage_value)}</dd></div>
              </dl>
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-xs text-gray-500">
                  <span>Valor en libros</span>
                  <span className="font-medium text-brand-navy">
                    {/* Approximate client-side calculation */}
                    {(() => {
                      if (!item.purchase_date || !item.useful_life_years || !item.purchase_cost) return '—'
                      const yearsElapsed = (Date.now() - new Date(item.purchase_date).getTime()) / (365.25 * 24 * 3600 * 1000)
                      const depRate = (item.purchase_cost - (item.salvage_value ?? 0)) / item.useful_life_years
                      const bookValue = Math.max(item.salvage_value ?? 0, item.purchase_cost - depRate * yearsElapsed)
                      return fmt(bookValue)
                    })()}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-brand-gold"
                    style={{
                      width: (() => {
                        if (!item.purchase_date || !item.useful_life_years) return '0%'
                        const yearsElapsed = (Date.now() - new Date(item.purchase_date).getTime()) / (365.25 * 24 * 3600 * 1000)
                        return `${Math.min(100, (yearsElapsed / item.useful_life_years) * 100).toFixed(0)}%`
                      })()
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Alerts */}
          <div className="space-y-2 lg:col-span-2">
            {item.warranty_expires_at && new Date(item.warranty_expires_at) > new Date() && new Date(item.warranty_expires_at) < new Date(Date.now() + 30 * 86400000) && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Garantía vence el {fmtDate(item.warranty_expires_at)}
              </div>
            )}
            {item.insurance_expires_at && new Date(item.insurance_expires_at) < new Date() && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Seguro vencido desde {fmtDate(item.insurance_expires_at)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Assignments Tab */}
      {tab === 'assignments' && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            {activeAssignment && (
              <button
                onClick={() => setShowReturnModal(activeAssignment.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-navy px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-navy hover:text-white"
              >
                Registrar Devolución
              </button>
            )}
            {!activeAssignment && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
              >
                <Plus className="h-4 w-4" /> Registrar Salida
              </button>
            )}
          </div>
          <div className="space-y-2">
            {assignments.length === 0 && (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">Sin historial de uso</div>
            )}
            {assignments.map(a => (
              <div key={a.id} className={`rounded-xl border bg-white p-4 shadow-sm ${!a.returned_at ? 'border-brand-gold/40' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.project?.title ?? 'Sin proyecto'}</p>
                    <p className="text-xs text-gray-400">Salida: {fmtDate(a.assigned_at)}</p>
                    {a.returned_at && <p className="text-xs text-gray-400">Devolución: {fmtDate(a.returned_at)}</p>}
                    {a.notes && <p className="mt-1 text-xs text-gray-500">{a.notes}</p>}
                  </div>
                  <div className="text-right text-xs">
                    {a.condition_out && <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${CONDITION_CONFIG[a.condition_out].badge}`}>Salida: {CONDITION_CONFIG[a.condition_out].label}</span>}
                    {a.condition_in && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 font-medium ${CONDITION_CONFIG[a.condition_in].badge}`}>Regreso: {CONDITION_CONFIG[a.condition_in].label}</span>}
                    {!a.returned_at && <span className="mt-1 inline-flex rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">En uso</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Maintenance Tab */}
      {tab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowMaintModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
            >
              <Plus className="h-4 w-4" /> Registrar Mantenimiento
            </button>
          </div>
          <div className="space-y-2">
            {maintenance.length === 0 && (
              <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">Sin registros de mantenimiento</div>
            )}
            {maintenance.map(m => {
              const overdue = m.next_due_at && new Date(m.next_due_at) < new Date()
              return (
                <div key={m.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-800">{MAINTENANCE_TYPE_LABELS[m.type]}</span>
                        {overdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            <AlertTriangle className="h-3 w-3" /> Vencido
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{m.description}</p>
                      {m.performed_by && <p className="text-xs text-gray-400">Por: {m.performed_by}</p>}
                    </div>
                    <div className="text-right text-xs text-gray-400">
                      <p>{fmtDate(m.performed_at)}</p>
                      {m.cost && <p className="font-medium text-gray-600">{fmt(m.cost)}</p>}
                      {m.next_due_at && <p className={overdue ? 'text-red-500' : ''}>Próximo: {fmtDate(m.next_due_at)}</p>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Registrar Salida</h2>
              <button onClick={() => setShowAssignModal(false)} className="rounded-md p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleAssign} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Proyecto</label>
                <select value={assignForm.project_id} onChange={e => setAssignForm(p => ({ ...p, project_id: e.target.value }))} className={inputClass}>
                  <option value="">Sin proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Fecha salida *</label>
                  <input type="date" required value={assignForm.assigned_at} onChange={e => setAssignForm(p => ({ ...p, assigned_at: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Retorno estimado</label>
                  <input type="date" value={assignForm.expected_return_at} onChange={e => setAssignForm(p => ({ ...p, expected_return_at: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Condición al salir</label>
                <select value={assignForm.condition_out} onChange={e => setAssignForm(p => ({ ...p, condition_out: e.target.value as EquipmentCondition }))} className={inputClass}>
                  {(Object.keys(CONDITION_CONFIG) as EquipmentCondition[]).map(k => (
                    <option key={k} value={k}>{CONDITION_CONFIG[k].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notas</label>
                <textarea rows={2} value={assignForm.notes} onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAssignModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Registrar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Registrar Devolución</h2>
              <button onClick={() => setShowReturnModal(null)} className="rounded-md p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={ev => handleReturn(ev, showReturnModal)} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Condición al regresar</label>
                <select value={returnForm.condition_in} onChange={e => setReturnForm(p => ({ ...p, condition_in: e.target.value as EquipmentCondition }))} className={inputClass}>
                  {(Object.keys(CONDITION_CONFIG) as EquipmentCondition[]).map(k => (
                    <option key={k} value={k}>{CONDITION_CONFIG[k].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notas</label>
                <textarea rows={2} value={returnForm.notes} onChange={e => setReturnForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowReturnModal(null)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Confirmar devolución'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">Registrar Mantenimiento</h2>
              <button onClick={() => setShowMaintModal(false)} className="rounded-md p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleMaint} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tipo *</label>
                  <select value={maintForm.type} onChange={e => setMaintForm(p => ({ ...p, type: e.target.value as MaintenanceType }))} className={inputClass}>
                    {(Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map(k => (
                      <option key={k} value={k}>{MAINTENANCE_TYPE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Fecha *</label>
                  <input type="date" required value={maintForm.performed_at} onChange={e => setMaintForm(p => ({ ...p, performed_at: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Descripción *</label>
                <textarea required rows={2} value={maintForm.description} onChange={e => setMaintForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Realizado por</label>
                  <input value={maintForm.performed_by} onChange={e => setMaintForm(p => ({ ...p, performed_by: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Costo</label>
                  <input type="number" min={0} step={0.01} value={maintForm.cost} onChange={e => setMaintForm(p => ({ ...p, cost: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Próximo mantenimiento</label>
                <input type="date" value={maintForm.next_due_at} onChange={e => setMaintForm(p => ({ ...p, next_due_at: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowMaintModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
