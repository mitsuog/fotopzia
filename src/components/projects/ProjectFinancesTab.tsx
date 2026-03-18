'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import type { ProjectPayment, PaymentType, PaymentMethod } from '@/types/finances'
import { PAYMENT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '@/types/finances'

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

const TYPE_BADGE: Record<PaymentType, string> = {
  anticipo:   'bg-amber-100 text-amber-700',
  abono:      'bg-blue-100 text-blue-700',
  pago_final: 'bg-emerald-100 text-emerald-700',
}

interface Props {
  projectId: string
}

export function ProjectFinancesTab({ projectId }: Props) {
  const [payments, setPayments] = useState<ProjectPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    type: 'anticipo' as PaymentType,
    method: 'transferencia' as PaymentMethod,
    amount: 0,
    paid_at: new Date().toISOString().slice(0, 10),
    reference: '',
    notes: '',
    currency: 'MXN',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/finances/payments?project_id=${projectId}`)
      if (res.ok) setPayments(await res.json())
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const totalReceived = payments.reduce((s, p) => s + Number(p.amount), 0)

  async function handleSave(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/finances/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, project_id: projectId }),
      })
      if (res.ok) {
        await load()
        setShowModal(false)
        setForm(p => ({ ...p, amount: 0, reference: '', notes: '' }))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este pago?')) return
    await fetch(`/api/finances/payments/${id}`, { method: 'DELETE' })
    setPayments(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return <div className="py-8 text-center text-sm text-gray-400">Cargando…</div>

  const inputClass = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Total recibido</p>
            <p className="text-2xl font-bold text-brand-navy">{fmt(totalReceived)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">{payments.length} pago{payments.length !== 1 ? 's' : ''}</span>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold-light"
            >
              <Plus className="h-4 w-4" /> Registrar Pago
            </button>
          </div>
        </div>
      </div>

      {/* Payments list */}
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Método</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Referencia</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {payments.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Sin pagos registrados para este proyecto</td></tr>
            )}
            {payments.map(p => (
              <tr key={p.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[p.type]}`}>
                    {PAYMENT_TYPE_LABELS[p.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{PAYMENT_METHOD_LABELS[p.method]}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-600">{fmt(p.amount)}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(p.paid_at)}</td>
                <td className="px-4 py-3 text-gray-400">{p.reference ?? '—'}</td>
                <td className="px-2 py-3">
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {payments.length > 0 && (
            <tfoot>
              <tr className="border-t border-gray-100 bg-gray-50">
                <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Total</td>
                <td className="px-4 py-2 text-right font-bold text-brand-navy">{fmt(totalReceived)}</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-800">Registrar Pago</h2>
              <button onClick={() => setShowModal(false)} className="rounded-md p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tipo *</label>
                  <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as PaymentType }))} className={inputClass}>
                    {(Object.keys(PAYMENT_TYPE_LABELS) as PaymentType[]).map(k => (
                      <option key={k} value={k}>{PAYMENT_TYPE_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Método *</label>
                  <select value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value as PaymentMethod }))} className={inputClass}>
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map(k => (
                      <option key={k} value={k}>{PAYMENT_METHOD_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Monto *</label>
                  <input type="number" required min={0.01} step={0.01} value={form.amount} onChange={e => setForm(p => ({ ...p, amount: Number(e.target.value) }))} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Fecha *</label>
                  <input type="date" required value={form.paid_at} onChange={e => setForm(p => ({ ...p, paid_at: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Referencia</label>
                <input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="Número de transferencia..." className={inputClass} />
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
