'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, ChevronDown } from 'lucide-react'
import type { ProjectPayment, PaymentType, PaymentMethod } from '@/types/finances'
import { PAYMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/types/finances'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

interface Project { id: string; title: string }

interface Props {
  initialPayments: ProjectPayment[]
  projects: Project[]
}

const TYPE_BADGE: Record<PaymentType, string> = {
  anticipo:   'bg-amber-100 text-amber-700',
  abono:      'bg-blue-100 text-blue-700',
  pago_final: 'bg-emerald-100 text-emerald-700',
}

export function IncomePageClient({ initialPayments, projects }: Props) {
  const [payments, setPayments] = useState<ProjectPayment[]>(initialPayments)
  const [showModal, setShowModal] = useState(false)
  const [filterProject, setFilterProject] = useState('')
  const [saving, setSaving] = useState(false)
  const [paymentToDelete, setPaymentToDelete] = useState<ProjectPayment | null>(null)
  const [form, setForm] = useState<Partial<ProjectPayment> & { project_id: string; type: PaymentType; method: PaymentMethod; amount: number; paid_at: string }>({
    project_id: '',
    type: 'anticipo',
    method: 'transferencia',
    amount: 0,
    paid_at: new Date().toISOString().slice(0, 10),
    currency: 'MXN',
  })

  const reload = useCallback(async () => {
    const res = await fetch('/api/finances/payments')
    if (res.ok) setPayments(await res.json())
  }, [])

  const filtered = filterProject
    ? payments.filter(p => p.project_id === filterProject)
    : payments

  const total = filtered.reduce((s, p) => s + Number(p.amount), 0)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/finances/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        await reload()
        setShowModal(false)
        setForm(prev => ({ ...prev, amount: 0, reference: '', notes: '' }))
      }
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeletePayment() {
    if (!paymentToDelete) return
    await fetch(`/api/finances/payments/${paymentToDelete.id}`, { method: 'DELETE' })
    setPayments(prev => prev.filter(p => p.id !== paymentToDelete.id))
    setPaymentToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={filterProject}
              onChange={e => setFilterProject(e.target.value)}
              className="h-9 appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="">Todos los proyectos</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          </div>
          <span className="text-sm text-gray-500">Total: <strong className="text-brand-navy">{fmt(total)}</strong></span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
        >
          <Plus className="h-4 w-4" /> Registrar Pago
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left">Proyecto</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">MÃƒÂ©todo</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Referencia</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  Sin pagos registrados
                </td>
              </tr>
            )}
            {filtered.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.project?.title ?? 'Ã¢â‚¬â€'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[p.type]}`}>
                    {PAYMENT_TYPE_LABELS[p.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{PAYMENT_METHOD_LABELS[p.method]}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(p.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(p.paid_at)}</td>
                <td className="px-4 py-3 text-gray-400">{p.reference ?? 'Ã¢â‚¬â€'}</td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => setPaymentToDelete(p)}
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">Registrar Pago</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Proyecto *</label>
                <select
                  required
                  value={form.project_id}
                  onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                >
                  <option value="">Seleccionar...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tipo *</label>
                  <select
                    value={form.type}
                    onChange={e => setForm(p => ({ ...p, type: e.target.value as PaymentType }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  >
                    {(Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[]).map(k => (
                      <option key={k} value={k}>{PAYMENT_TYPE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">MÃƒÂ©todo *</label>
                  <select
                    value={form.method}
                    onChange={e => setForm(p => ({ ...p, method: e.target.value as PaymentMethod }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  >
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(k => (
                      <option key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Monto *</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step={0.01}
                    value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Fecha *</label>
                  <input
                    type="date"
                    required
                    value={form.paid_at}
                    onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Referencia</label>
                <input
                  type="text"
                  value={form.reference ?? ''}
                  onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
                  placeholder="NÃƒÂºmero de transferencia, folio..."
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Notas</label>
                <textarea
                  rows={2}
                  value={form.notes ?? ''}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light disabled:opacity-60"
                >
                  {saving ? 'GuardandoÃ¢â‚¬Â¦' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(paymentToDelete)}
        title="Eliminar pago"
        description="Esta accion eliminara el pago de forma permanente."
        confirmLabel="Eliminar"
        confirmVariant="danger"
        onClose={() => setPaymentToDelete(null)}
        onConfirm={async () => {
          await confirmDeletePayment()
        }}
      />
    </div>
  )
}