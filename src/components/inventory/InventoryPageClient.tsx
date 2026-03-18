'use client'

import { useState, useCallback } from 'react'
import { Plus, X, LayoutGrid, List, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { EquipmentCard } from './EquipmentCard'
import type { EquipmentItem, EquipmentCategory, EquipmentCondition, EquipmentStatus, EquipmentLocation, DepreciationMethod } from '@/types/inventory'
import { CONDITION_CONFIG, STATUS_CONFIG, LOCATION_LABELS } from '@/types/inventory'

interface Props {
  initialItems: EquipmentItem[]
  categories: EquipmentCategory[]
}

export function InventoryPageClient({ initialItems, categories }: Props) {
  const [items, setItems] = useState<EquipmentItem[]>(initialItems)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCondition, setFilterCondition] = useState('')
  const [filterLocation, setFilterLocation] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<{
    name: string
    brand: string
    model: string
    serial_number: string
    category_id: string
    condition: EquipmentCondition
    status: EquipmentStatus
    location: EquipmentLocation
    purchase_date: string
    purchase_cost: string
    currency: string
    depreciation_method: DepreciationMethod
    useful_life_years: string
    salvage_value: string
    notes: string
  }>({
    name: '',
    brand: '',
    model: '',
    serial_number: '',
    category_id: '',
    condition: 'bueno',
    status: 'disponible',
    location: 'estudio',
    purchase_date: '',
    purchase_cost: '',
    currency: 'MXN',
    depreciation_method: 'ninguno',
    useful_life_years: '',
    salvage_value: '',
    notes: '',
  })

  const reload = useCallback(async () => {
    const res = await fetch('/api/inventory/items')
    if (res.ok) setItems(await res.json())
  }, [])

  const filtered = items.filter(item => {
    if (filterCat && item.category_id !== filterCat) return false
    if (filterStatus && item.status !== filterStatus) return false
    if (filterCondition && item.condition !== filterCondition) return false
    if (filterLocation && item.location !== filterLocation) return false
    return true
  })

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const body = {
        ...form,
        category_id: form.category_id || null,
        purchase_cost: form.purchase_cost ? Number(form.purchase_cost) : null,
        useful_life_years: form.useful_life_years ? Number(form.useful_life_years) : null,
        salvage_value: form.salvage_value ? Number(form.salvage_value) : null,
        purchase_date: form.purchase_date || null,
      }
      const res = await fetch('/api/inventory/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        await reload()
        setShowModal(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const selectClass = "h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
  const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className={selectClass}>
              <option value="">Todas las categorías</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectClass}>
              <option value="">Todos los estados</option>
              {(Object.keys(STATUS_CONFIG) as EquipmentStatus[]).map(k => (
                <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
          <div className="relative">
            <select value={filterLocation} onChange={e => setFilterLocation(e.target.value)} className={selectClass}>
              <option value="">Todas las ubicaciones</option>
              {(Object.keys(LOCATION_LABELS) as EquipmentLocation[]).map(k => (
                <option key={k} value={k}>{LOCATION_LABELS[k]}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 bg-white p-1">
            <button onClick={() => setView('grid')} className={`rounded-md p-1.5 ${view === 'grid' ? 'bg-brand-navy text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setView('list')} className={`rounded-md p-1.5 ${view === 'list' ? 'bg-brand-navy text-white' : 'text-gray-400 hover:text-gray-600'}`}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
          >
            <Plus className="h-4 w-4" /> Agregar Equipo
          </button>
        </div>
      </div>

      {/* Items */}
      {filtered.length === 0 && (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
          Sin equipos registrados
        </div>
      )}

      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map(item => <EquipmentCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-left">Nombre</th>
                <th className="px-4 py-3 text-left">Categoría</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Condición</th>
                <th className="px-4 py-3 text-left">Ubicación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.asset_tag}</td>
                  <td className="px-4 py-3">
                    <Link href={`/inventory/${item.id}`} className="font-medium text-brand-navy hover:underline">
                      {item.name}
                    </Link>
                    {(item.brand || item.model) && (
                      <p className="text-xs text-gray-400">{[item.brand, item.model].filter(Boolean).join(' · ')}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.category?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CONFIG[item.status].badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_CONFIG[item.status].dot}`} />
                      {STATUS_CONFIG[item.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${CONDITION_CONFIG[item.condition].badge}`}>
                      {CONDITION_CONFIG[item.condition].label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{LOCATION_LABELS[item.location]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Equipment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" style={{ maxHeight: '90vh' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">Agregar Equipo</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Nombre *</label>
                <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Marca</label>
                  <input value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Modelo</label>
                  <input value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Número de serie</label>
                  <input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Categoría</label>
                  <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))} className={inputClass}>
                    <option value="">Sin categoría</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Condición</label>
                  <select value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value as EquipmentCondition }))} className={inputClass}>
                    {(Object.keys(CONDITION_CONFIG) as EquipmentCondition[]).map(k => (
                      <option key={k} value={k}>{CONDITION_CONFIG[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Estado</label>
                  <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as EquipmentStatus }))} className={inputClass}>
                    {(Object.keys(STATUS_CONFIG) as EquipmentStatus[]).map(k => (
                      <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Ubicación</label>
                  <select value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value as EquipmentLocation }))} className={inputClass}>
                    {(Object.keys(LOCATION_LABELS) as EquipmentLocation[]).map(k => (
                      <option key={k} value={k}>{LOCATION_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Fecha de compra</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Costo de compra</label>
                  <input type="number" min={0} step={0.01} value={form.purchase_cost} onChange={e => setForm(p => ({ ...p, purchase_cost: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Depreciación</label>
                  <select value={form.depreciation_method} onChange={e => setForm(p => ({ ...p, depreciation_method: e.target.value as DepreciationMethod }))} className={inputClass}>
                    <option value="ninguno">Ninguno</option>
                    <option value="linea_recta">Línea recta</option>
                  </select>
                </div>
                {form.depreciation_method === 'linea_recta' && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Vida útil (años)</label>
                      <input type="number" min={1} value={form.useful_life_years} onChange={e => setForm(p => ({ ...p, useful_life_years: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Valor residual</label>
                      <input type="number" min={0} step={0.01} value={form.salvage_value} onChange={e => setForm(p => ({ ...p, salvage_value: e.target.value }))} className={inputClass} />
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notas</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light disabled:opacity-60">
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
