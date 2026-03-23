'use client'

import { useState, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import type { PayrollEntry } from '@/types/finances'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { dateStyle: 'short' })
}

interface Props {
  initialEntries: PayrollEntry[]
}

export function PayrollPageClient({ initialEntries }: Props) {
  const [entries, setEntries] = useState<PayrollEntry[]>(initialEntries)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<PayrollEntry | null>(null)
  const today = new Date()
  const firstDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [form, setForm] = useState({
    employee_name: '',
    employee_role: '',
    period_start: firstDay,
    period_end: lastDay,
    base_salary: 0,
    bonuses: 0,
    deductions: 0,
    notes: '',
    paid_at: '',
  })

  const reload = useCallback(async () => {
    const res = await fetch('/api/finances/payroll')
    if (res.ok) setEntries(await res.json())
  }, [])

  const totalNet = entries.reduce((s, e) => s + Number(e.net_total), 0)

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const body = { ...form, paid_at: form.paid_at || null }
      const res = await fetch('/api/finances/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        await reload()
        setShowModal(false)
        setForm(p => ({ ...p, employee_name: '', employee_role: '', base_salary: 0, bonuses: 0, deductions: 0, notes: '', paid_at: '' }))
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeleteEntry() {
    if (!entryToDelete) return
    await fetch(`/api/finances/payroll/${entryToDelete.id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== entryToDelete.id))
    setEntryToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Total neto: <strong className="text-brand-navy">{fmt(totalNet)}</strong></p>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
        >
          <Plus className="h-4 w-4" /> Agregar Entrada
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left">Empleado</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">PerÃ­odo</th>
              <th className="px-4 py-3 text-right">Base</th>
              <th className="px-4 py-3 text-right">Bonos</th>
              <th className="px-4 py-3 text-right">Deducc.</th>
              <th className="px-4 py-3 text-right">Neto</th>
              <th className="px-4 py-3 text-left">Pagado</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {entries.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">Sin entradas</td></tr>
            )}
            {entries.map(e => (
              <tr key={e.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{e.employee_name}</td>
                <td className="px-4 py-3 text-gray-500">{e.employee_role ?? 'â€”'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(e.period_start)} â€“ {fmtDate(e.period_end)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{fmt(e.base_salary)}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{fmt(e.bonuses)}</td>
                <td className="px-4 py-3 text-right text-red-500">{fmt(e.deductions)}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand-navy">{fmt(e.net_total)}</td>
                <td className="px-4 py-3 text-xs text-gray-400">{e.paid_at ? fmtDate(e.paid_at) : <span className="text-amber-500">Pendiente</span>}</td>
                <td className="px-2 py-3">
                  <button onClick={() => setEntryToDelete(e)} className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500">
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
              <h2 className="text-base font-bold text-gray-800">Nueva Entrada de NÃ³mina</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Nombre *</label>
                  <input required value={form.employee_name} onChange={e => setForm(p => ({ ...p, employee_name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Rol</label>
                  <input value={form.employee_role} onChange={e => setForm(p => ({ ...p, employee_role: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">PerÃ­odo inicio *</label>
                  <input type="date" required value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">PerÃ­odo fin *</label>
                  <input type="date" required value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Salario base</label>
                  <input type="number" min={0} step={0.01} value={form.base_salary} onChange={e => setForm(p => ({ ...p, base_salary: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Bonos</label>
                  <input type="number" min={0} step={0.01} value={form.bonuses} onChange={e => setForm(p => ({ ...p, bonuses: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Deducciones</label>
                  <input type="number" min={0} step={0.01} value={form.deductions} onChange={e => setForm(p => ({ ...p, deductions: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Fecha de pago</label>
                <input type="date" value={form.paid_at} onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light disabled:opacity-60">
                  {saving ? 'Guardandoâ€¦' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(entryToDelete)}
        title="Eliminar entrada de nómina"
        description="Esta acción eliminará la entrada de nómina de forma permanente."
        confirmLabel="Eliminar"
        confirmVariant="danger"
        onClose={() => setEntryToDelete(null)}
        onConfirm={async () => {
          await confirmDeleteEntry()
        }}
      />
    </div>
  )
}