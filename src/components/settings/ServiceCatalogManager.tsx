'use client'

import { useState } from 'react'
import { Pencil, Trash2, Check, X, ArrowUp, ArrowDown, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import {
  useServiceCatalog,
  useCreateService,
  useUpdateService,
  useDeleteService,
} from '@/hooks/useServiceCatalog'
import { SERVICE_CATEGORIES } from '@/types/catalog'
import type { ServiceCatalogItem } from '@/types/catalog'
import { cn } from '@/lib/utils'

// ─── Inline form (create or edit) ─────────────────────────────────────────────
interface ServiceFormState {
  icon: string
  label: string
  description: string
  unit_price: string
  category: string
  is_active: boolean
}

const EMPTY_FORM: ServiceFormState = {
  icon: '📷',
  label: '',
  description: '',
  unit_price: '',
  category: 'photography',
  is_active: true,
}

function toFormState(item: ServiceCatalogItem): ServiceFormState {
  return {
    icon: item.icon,
    label: item.label,
    description: item.description,
    unit_price: String(item.unit_price),
    category: item.category ?? 'other',
    is_active: item.is_active,
  }
}

interface InlineFormProps {
  initial: ServiceFormState
  onSave: (data: ServiceFormState) => Promise<void>
  onCancel: () => void
  isNew?: boolean
}

function InlineForm({ initial, onSave, onCancel, isNew }: InlineFormProps) {
  const [form, setForm] = useState<ServiceFormState>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: keyof ServiceFormState, value: string | boolean) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.label.trim() || !form.description.trim()) {
      setError('Nombre y descripción son requeridos')
      return
    }
    const price = parseFloat(form.unit_price)
    if (isNaN(price) || price < 0) {
      setError('Precio inválido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...form, unit_price: String(price) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-brand-gold/40 bg-brand-paper p-4 space-y-3">
      <p className="text-xs font-semibold text-brand-navy">{isNew ? 'Nuevo servicio' : 'Editar servicio'}</p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Icon */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Ícono (emoji)</label>
          <input
            value={form.icon}
            onChange={e => set('icon', e.target.value)}
            maxLength={4}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            placeholder="📷"
          />
        </div>

        {/* Label */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nombre *</label>
          <input
            value={form.label}
            onChange={e => set('label', e.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            placeholder="Ej. Fotografía"
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Categoría</label>
          <select
            value={form.category}
            onChange={e => set('category', e.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          >
            {SERVICE_CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">Descripción *</label>
          <input
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            placeholder="Descripción que aparece en la cotización"
          />
        </div>

        {/* Price */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Precio sugerido (MXN)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.unit_price}
              onChange={e => set('unit_price', e.target.value)}
              className="w-full rounded-lg border border-brand-stone pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => set('is_active', !form.is_active)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            form.is_active
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
          )}
        >
          {form.is_active
            ? <><ToggleRight className="h-3.5 w-3.5" /> Activo</>
            : <><ToggleLeft className="h-3.5 w-3.5" /> Inactivo</>
          }
        </button>
        <span className="text-xs text-gray-400">
          {form.is_active ? 'Aparece en cotizaciones' : 'Oculto en cotizaciones'}
        </span>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light transition-colors disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          {saving ? 'Guardando…' : isNew ? 'Crear servicio' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
      </div>
    </form>
  )
}

// ─── Main manager ──────────────────────────────────────────────────────────────
export function ServiceCatalogManager() {
  const { data: services = [], isLoading, error } = useServiceCatalog()
  const createService = useCreateService()
  const updateService = useUpdateService()
  const deleteService = useDeleteService()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  async function handleCreate(form: ServiceFormState) {
    await createService.mutateAsync({
      icon: form.icon.trim() || '📷',
      label: form.label.trim(),
      description: form.description.trim(),
      unit_price: parseFloat(form.unit_price) || 0,
      category: form.category || null,
      is_active: form.is_active,
      sort_order: services.length,
    })
    setShowNewForm(false)
  }

  async function handleUpdate(id: string, form: ServiceFormState) {
    await updateService.mutateAsync({
      id,
      icon: form.icon.trim() || '📷',
      label: form.label.trim(),
      description: form.description.trim(),
      unit_price: parseFloat(form.unit_price) || 0,
      category: form.category || null,
      is_active: form.is_active,
    })
    setEditingId(null)
  }

  async function handleToggleActive(item: ServiceCatalogItem) {
    await updateService.mutateAsync({ id: item.id, is_active: !item.is_active })
  }

  async function handleDelete(id: string) {
    await deleteService.mutateAsync(id)
    setConfirmDeleteId(null)
  }

  async function handleMove(item: ServiceCatalogItem, direction: 'up' | 'down') {
    const sorted = [...services].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(s => s.id === item.id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const swapItem = sorted[swapIdx]
    await Promise.all([
      updateService.mutateAsync({ id: item.id,     sort_order: swapItem.sort_order }),
      updateService.mutateAsync({ id: swapItem.id, sort_order: item.sort_order }),
    ])
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-brand-stone/30" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Error cargando el catálogo: {error instanceof Error ? error.message : 'Error desconocido'}
      </div>
    )
  }

  const sorted = [...services].sort((a, b) => a.sort_order - b.sort_order)
  const activeCount = services.filter(s => s.is_active).length

  return (
    <div className="space-y-4">
      {/* Stats + add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>
            <strong className="text-brand-navy">{services.length}</strong> servicios totales
          </span>
          <span className="text-gray-300">·</span>
          <span>
            <strong className="text-emerald-600">{activeCount}</strong> activos
          </span>
          {services.length - activeCount > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span>
                <strong className="text-gray-400">{services.length - activeCount}</strong> inactivos
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => { setShowNewForm(true); setEditingId(null) }}
          disabled={showNewForm}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light transition-colors disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" /> Agregar servicio
        </button>
      </div>

      {/* New service form */}
      {showNewForm && (
        <InlineForm
          initial={EMPTY_FORM}
          onSave={handleCreate}
          onCancel={() => setShowNewForm(false)}
          isNew
        />
      )}

      {/* Services list */}
      {sorted.length === 0 && !showNewForm && (
        <div className="rounded-xl border border-dashed border-brand-stone bg-brand-paper py-12 text-center">
          <p className="text-sm text-gray-400">El catálogo está vacío.</p>
          <button
            onClick={() => setShowNewForm(true)}
            className="mt-2 text-xs text-brand-navy hover:underline"
          >
            Crear el primer servicio
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-brand-stone bg-brand-paper">
        {sorted.map((item, idx) => (
          <div key={item.id}>
            {/* Row */}
            {editingId !== item.id && (
              <div className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                idx < sorted.length - 1 && 'border-b border-brand-stone/40',
                !item.is_active && 'opacity-60',
              )}>
                {/* Sort controls */}
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => handleMove(item, 'up')}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"
                    title="Subir"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(item, 'down')}
                    disabled={idx === sorted.length - 1}
                    className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition-colors"
                    title="Bajar"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Icon */}
                <span className="text-xl w-8 text-center shrink-0">{item.icon}</span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-navy truncate">{item.label}</p>
                    {item.category && (
                      <span className="text-[10px] rounded-full bg-brand-canvas border border-brand-stone px-2 py-0.5 text-gray-500 capitalize shrink-0">
                        {item.category}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{item.description}</p>
                </div>

                {/* Price */}
                <p className="text-sm font-semibold text-brand-navy tabular-nums shrink-0">
                  ${Number(item.unit_price).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                </p>

                {/* Active toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleActive(item)}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors',
                    item.is_active
                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                  )}
                  title={item.is_active ? 'Desactivar' : 'Activar'}
                >
                  {item.is_active ? 'Activo' : 'Inactivo'}
                </button>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => { setEditingId(item.id); setShowNewForm(false) }}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-brand-canvas hover:text-brand-navy transition-colors"
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>

                  {confirmDeleteId === item.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-md px-2 py-1 text-[10px] font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md p-1 text-gray-400 hover:text-gray-700 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Inline edit form */}
            {editingId === item.id && (
              <div className={idx < sorted.length - 1 ? 'border-b border-brand-stone/40' : ''}>
                <InlineForm
                  initial={toFormState(item)}
                  onSave={(form) => handleUpdate(item.id, form)}
                  onCancel={() => setEditingId(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400">
        Los servicios activos aparecen como accesos rápidos en el editor de cotizaciones. Los precios son sugeridos y siempre editables.
      </p>
    </div>
  )
}
