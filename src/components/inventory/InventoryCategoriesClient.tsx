'use client'

import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import type { EquipmentCategory } from '@/types/inventory'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

interface Props {
  initialCategories: EquipmentCategory[]
}

export function InventoryCategoriesClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState(initialCategories)
  const [editId, setEditId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newForm, setNewForm] = useState({ name: '', description: '', icon: '', color: '' })
  const [editForm, setEditForm] = useState({ name: '', description: '', icon: '', color: '' })
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const res = await fetch('/api/inventory/categories')
    if (res.ok) setCategories(await res.json())
  }, [])

  async function handleAdd(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/inventory/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newForm, sort_order: categories.length + 1 }),
      })
      if (res.ok) {
        await reload()
        setShowAdd(false)
        setNewForm({ name: '', description: '', icon: '', color: '' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/inventory/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        await reload()
        setEditId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteCategoryId) return
    setActionError(null)

    const res = await fetch(`/api/inventory/categories/${deleteCategoryId}`, { method: 'DELETE' })
    if (res.ok) {
      setCategories(prev => prev.filter(c => c.id !== deleteCategoryId))
      setDeleteCategoryId(null)
      return
    }

    const err = await res.json().catch(() => ({ error: 'No se pudo eliminar' }))
    setActionError(err.error ?? 'No se pudo eliminar')
  }

  const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
        >
          <Plus className="h-4 w-4" /> Nueva Categoría
        </button>
      </div>

      {actionError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Icono</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {categories.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Sin categorias</td></tr>
            )}
            {categories.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50/50">
                {editId === cat.id ? (
                  <>
                    <td className="px-4 py-2">
                      <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
                    </td>
                    <td className="px-4 py-2">
                      <input value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
                    </td>
                    <td className="px-4 py-2">
                      <input value={editForm.icon} onChange={e => setEditForm(p => ({ ...p, icon: e.target.value }))} className={`${inputClass} w-16`} placeholder="📦" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(cat.id)} disabled={saving} className="rounded-md p-1.5 bg-brand-gold text-white hover:bg-brand-gold-light">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setEditId(null)} className="rounded-md p-1.5 border border-gray-200 text-gray-500 hover:bg-gray-50">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium text-gray-800">{cat.name}</td>
                    <td className="px-4 py-3 text-gray-500">{cat.description ?? '-'}</td>
                    <td className="px-4 py-3 text-lg">{cat.icon ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => { setEditId(cat.id); setEditForm({ name: cat.name, description: cat.description ?? '', icon: cat.icon ?? '', color: cat.color ?? '' }) }}
                          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-navy"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => setDeleteCategoryId(cat.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">Nueva Categoría</h2>
              <button onClick={() => setShowAdd(false)} className="rounded-md p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Nombre *</label>
                <input required value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Descripción</label>
                <input value={newForm.description} onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Icono (emoji)</label>
                <input value={newForm.icon} onChange={e => setNewForm(p => ({ ...p, icon: e.target.value }))} placeholder="📦" className={inputClass} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmationDialog
        open={Boolean(deleteCategoryId)}
        title="Eliminar categoría"
        description="Esta acción eliminará la categoría de forma permanente."
        confirmLabel="Eliminar"
        confirmVariant="danger"
        onClose={() => setDeleteCategoryId(null)}
        onConfirm={async () => {
          await confirmDeleteCategory()
        }}
      />
    </div>
  )
}
