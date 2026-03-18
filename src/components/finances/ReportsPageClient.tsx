'use client'

import { useState, useEffect, useCallback } from 'react'
import { MonthlyBarChart } from './MonthlyBarChart'
import { ProfitabilityLineChart } from './ProfitabilityLineChart'
import type { MonthlyFinancialSummary } from '@/types/finances'

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

interface ProjectRow {
  project_id: string
  project_title: string
  received: number
  direct_costs: number
  margin: number
  margin_pct: number
}

export function ReportsPageClient() {
  const year = new Date().getFullYear()
  const [from, setFrom] = useState(`${year}-01`)
  const [to, setTo] = useState(`${year}-12`)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<MonthlyFinancialSummary[]>([])
  const [totals, setTotals] = useState<{ income: number; expenses: number; net: number; margin_pct: number } | null>(null)
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [sortKey, setSortKey] = useState<keyof ProjectRow>('margin_pct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sumRes, projRes] = await Promise.all([
        fetch(`/api/finances/reports/summary?from=${from}&to=${to}`),
        fetch('/api/finances/reports/projects'),
      ])
      if (sumRes.ok) {
        const d = await sumRes.json()
        setSummary(d.summary ?? [])
        setTotals(d.totals ?? null)
      }
      if (projRes.ok) setProjects(await projRes.json())
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  function toggleSort(key: keyof ProjectRow) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const sortedProjects = [...projects].sort((a, b) => {
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'asc' ? av - bv : bv - av
  })

  function SortBtn({ col }: { col: keyof ProjectRow }) {
    return (
      <button onClick={() => toggleSort(col)} className="inline-flex items-center gap-1 hover:text-brand-navy">
        {col === 'project_title' ? 'Proyecto' : col === 'received' ? 'Ingresos' : col === 'direct_costs' ? 'Costos directos' : col === 'margin' ? 'Margen' : 'Margen %'}
        {sortKey === col && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Desde</label>
          <input type="month" value={from} onChange={e => setFrom(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Hasta</label>
          <input type="month" value={to} onChange={e => setTo(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40" />
        </div>
        {loading && <span className="text-xs text-gray-400">Cargando…</span>}
      </div>

      {/* P&L Statement */}
      {totals && (
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-bold text-brand-navy">Estado de Resultados</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-4 py-2">
              <span className="text-sm font-semibold text-emerald-700">Ingresos totales</span>
              <span className="font-bold text-emerald-700">{fmt(totals.income)}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-red-50 px-4 py-2">
              <span className="text-sm font-semibold text-red-600">Egresos totales</span>
              <span className="font-bold text-red-600">({fmt(totals.expenses)})</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-brand-navy/5 px-4 py-3">
              <span className="text-sm font-bold text-brand-navy">Utilidad Neta</span>
              <div className="text-right">
                <span className={`block font-bold ${totals.net >= 0 ? 'text-brand-navy' : 'text-red-600'}`}>{fmt(totals.net)}</span>
                <span className="text-xs text-gray-400">Margen: {totals.margin_pct.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Ingresos vs Egresos</h3>
          <MonthlyBarChart data={summary} />
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Neto acumulado</h3>
          <ProfitabilityLineChart data={summary} />
        </div>
      </div>

      {/* Project margin table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-3">
          <h3 className="text-sm font-bold text-brand-navy">Margen por Proyecto</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 text-left"><SortBtn col="project_title" /></th>
              <th className="px-4 py-3 text-right"><SortBtn col="received" /></th>
              <th className="px-4 py-3 text-right"><SortBtn col="direct_costs" /></th>
              <th className="px-4 py-3 text-right"><SortBtn col="margin" /></th>
              <th className="px-4 py-3 text-right"><SortBtn col="margin_pct" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sortedProjects.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Sin datos</td></tr>
            )}
            {sortedProjects.map(p => (
              <tr key={p.project_id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-medium text-gray-800">{p.project_title}</td>
                <td className="px-4 py-3 text-right text-emerald-600">{fmt(p.received)}</td>
                <td className="px-4 py-3 text-right text-red-500">{fmt(p.direct_costs)}</td>
                <td className={`px-4 py-3 text-right font-semibold ${p.margin >= 0 ? 'text-brand-navy' : 'text-red-600'}`}>{fmt(p.margin)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.margin_pct >= 30 ? 'bg-emerald-100 text-emerald-700' : p.margin_pct >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {p.margin_pct.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
