'use client'

import { useState, useCallback } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import type { Expense, ExpenseCategory } from '@/types/finances'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

interface Project { id: string; title: string }

interface Props {
  initialExpenses: Expense[]
  categories: ExpenseCategory[]
  projects: Project[]
}

export function ExpensesPageClient({ initialExpenses, categories, projects }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showModal, setShowModal] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [saving, setSaving] = useState(false)
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null)
  const [form, setForm] = useState({
    category_id: '',
    description: '',
    amount: 0,
    date: new Date().toISOString().slice(0, 10),
    reference: '',
    project_id: '',
    notes: '',
    currency: 'MXN',
  })

  const reload = useCallback(async () => {
    const res = await fetch('/api/finances/expenses')
    if (res.ok) setExpenses(await res.json())
  }, [])

  const filtered = filterCat ? expenses.filter(e => e.category_id === filterCat) : expenses
  const total = filtered.reduce((s, e) => s + Number(e.amount), 0)

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/finances/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          project_id: form.project_id || null,
        }),
      })
      if (res.ok) {
        await reload()
        setShowModal(false)
        setForm(p => ({ ...p, description: '', amount: 0, reference: '', notes: '', project_id: '' }))
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteExpense() {
    if (!expenseToDelete) return
    await fetch(`/api/finances/expenses/${expenseToDelete.id}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== expenseToDelete.id))
    setExpenseToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="">Todas las categorÃ­as</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
          <span className="text-sm text-gray-500">Total: <strong className="text-red-600">{fmt(total)}</strong></span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
        >
          <Plus className="h-4 w-4" /> Registrar Gasto
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left">CategorÃ­a</th>
              <th className="px-4 py-3 text-left">DescripciÃ³n</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Proyecto</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Sin gastos registrados</td>
              </tr>
            )}
            {filtered.map(e => (
              <tr key={e.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {e.category?.name ?? 'â€”'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">{e.description}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt(e.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(e.date)}</td>
                <td className="px-4 py-3 text-gray-400">{e.project?.title ?? 'â€”'}</td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => setExpenseToDelete(e)}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">Registrar Gasto</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">CategorÃ­a *</label>
                <select
                  required
                  value={form.category_id}
                  onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                >
                  <option value="">Seleccionar...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">DescripciÃ³n *</label>
                <input
                  required
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Monto *</label>
                  <input
                    type="number" required min={0.01} step={0.01}
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Fecha *</label>
                  <input
                    type="date" required value={form.date}
                    onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Proyecto (opcional)</label>
                <select
                  value={form.project_id}
                  onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                >
                  <option value="">Sin proyecto</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Referencia</label>
                <input
                  value={form.reference}
                  onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light disabled:opacity-60">
                  {saving ? 'Guardandoâ€¦' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(expenseToDelete)}
        title="Eliminar gasto"
        description="Esta acción eliminará el gasto de forma permanente."
        confirmLabel="Eliminar"
        confirmVariant="danger"
        onClose={() => setExpenseToDelete(null)}
        onConfirm={async () => {
          await confirmDeleteExpense()
        }}
      />
    </div>
  )
}