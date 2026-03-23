'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Link2, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StudioResource } from '@/types/inventory'

interface EquipmentItemOption {
  id: string
  name: string
  asset_tag: string
  status: string
}

interface ResourcesPageClientProps {
  initialResources: StudioResource[]
  equipmentItems: EquipmentItemOption[]
}

const TYPE_LABELS: Record<string, string> = {
  studio: 'Estudio',
  equipment: 'Equipo',
  personnel: 'Personal',
}

const TYPE_ORDER = ['studio', 'equipment', 'personnel']

const EMPTY_FORM = {
  name: '',
  type: 'equipment' as StudioResource['type'],
  color: '',
  is_active: true,
  equipment_item_id: '',
}

export function ResourcesPageClient({ initialResources, equipmentItems }: ResourcesPageClientProps) {
  const [resources, setResources] = useState<StudioResource[]>(initialResources)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StudioResource | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const grouped = TYPE_ORDER.map(type => ({
    type,
    label: TYPE_LABELS[type] ?? type,
    items: resources.filter(r => r.type === type),
  })).filter(g => g.items.length > 0)

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError(null)
    setDeleteError(null)
    setModalOpen(true)
  }

  function openEdit(resource: StudioResource) {
    setEditing(resource)
    setForm({
      name: resource.name,
      type: resource.type,
      color: resource.color ?? '',
      is_active: resource.is_active,
      equipment_item_id: resource.equipment_item_id ?? '',
    })
    setError(null)
    setDeleteError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        color: form.color || null,
        is_active: form.is_active,
        equipment_item_id: form.equipment_item_id || null,
      }

      let res: Response
      if (editing) {
        res = await fetch(`/api/settings/resources/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch('/api/settings/resources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error desconocido')
      }

      const saved: StudioResource = await res.json()

      if (editing) {
        setResources(prev => prev.map(r => r.id === saved.id ? saved : r))
      } else {
        setResources(prev => [...prev, saved])
      }
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleteError(null)
    setDeleting(true)
    try {
      const res = await fetch(`/api/settings/resources/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al eliminar')
      }
      setResources(prev => prev.filter(r => r.id !== id))
      setDeleteConfirm(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setDeleting(false)
    }
  }

  const linkedEquipmentIds = new Set(
    resources
      .filter(r => r.equipment_item_id && (!editing || r.id !== editing.id))
      .map(r => r.equipment_item_id as string)
  )

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {resources.length} recurso{resources.length !== 1 ? 's' : ''} registrado{resources.length !== 1 ? 's' : ''}
        </p>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-navy-light"
        >
          <Plus className="h-4 w-4" />
          Agregar Recurso
        </button>
      </div>

      {deleteError && (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{deleteError}</p>
      )}

      <div className="space-y-8">
        {grouped.map(({ type, label, items }) => (
          <div key={type}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}s</h3>
            <div className="overflow-hidden rounded-xl border border-brand-stone">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-stone bg-brand-canvas text-xs font-medium text-gray-500">
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Equipo vinculado</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-brand-stone">
                  {items.map(r => {
                    const eq = r.equipment_item
                    const isLinked = !!r.equipment_item_id
                    const isInUse = isLinked && eq?.status === 'en_uso'

                    return (
                      <tr key={r.id} className="hover:bg-brand-paper/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {r.color && (
                              <span
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: r.color }}
                              />
                            )}
                            <span className="font-medium text-gray-800">{r.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {isLinked && eq ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                              <Link2 className="h-3 w-3" />
                              {eq.name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Ã¢â‚¬â€</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {!r.is_active && (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">
                                Inactivo
                              </span>
                            )}
                            {isLinked && (
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                  isInUse
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-emerald-100 text-emerald-700',
                                )}
                              >
                                {isInUse ? 'En uso' : 'Disponible'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEdit(r)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(r.id)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {resources.length === 0 && (
          <div className="rounded-xl border border-dashed border-brand-stone bg-brand-paper py-16 text-center">
            <p className="text-sm text-gray-500">No hay recursos registrados.</p>
            <button onClick={openCreate} className="mt-3 text-sm font-medium text-brand-gold hover:underline">
              Agregar el primero
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm dialog */}
      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-xl">
            <h3 className="font-semibold text-gray-800">Ã‚Â¿Eliminar recurso?</h3>
            <p className="mt-1 text-sm text-gray-500">
              Esta acciÃƒÂ³n no se puede deshacer. Si el recurso estÃƒÂ¡ asignado a eventos futuros, no se permitirÃƒÂ¡.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={closeModal} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-brand-stone bg-white shadow-xl">
            <div className="border-b border-brand-stone px-6 py-4">
              <h2 className="text-lg font-semibold text-brand-navy">
                {editing ? 'Editar Recurso' : 'Agregar Recurso'}
              </h2>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Tipo *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as StudioResource['type'], equipment_item_id: '' }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                >
                  <option value="studio">Estudio</option>
                  <option value="equipment">Equipo</option>
                  <option value="personnel">Personal</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Color (hex)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color || '#C49A2A'}
                    onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded border border-gray-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={form.color}
                    onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                    placeholder="#C49A2A"
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                  {form.color && (
                    <button
                      onClick={() => setForm(p => ({ ...p, color: '' }))}
                      className="text-xs text-gray-400 hover:text-gray-600"
                      title="Quitar color"
                    >
                      <Unlink className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {form.type === 'equipment' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Equipo del inventario vinculado
                  </label>
                  <select
                    value={form.equipment_item_id}
                    onChange={e => setForm(p => ({ ...p, equipment_item_id: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  >
                    <option value="">Sin vincular</option>
                    {equipmentItems
                      .filter(eq => !linkedEquipmentIds.has(eq.id) || eq.id === form.equipment_item_id)
                      .map(eq => (
                        <option key={eq.id} value={eq.id}>
                          {eq.name} ({eq.asset_tag}) Ã¢â‚¬â€ {eq.status}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Al asignar este recurso a un evento, el equipo se marcarÃƒÂ¡ como "en uso" automÃƒÂ¡ticamente.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-gold"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">Activo (visible en el calendario)</label>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-brand-stone p-4">
              <button
                onClick={closeModal}
                className="flex-1 rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
