'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Percent, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { CashFlowChart } from './CashFlowChart'
import { ProfitabilityLineChart } from './ProfitabilityLineChart'
import { SankeyChart } from './SankeyChart'
import { cn } from '@/lib/utils'
import type { MonthlyFinancialSummary } from '@/types/finances'

type Period = 'month' | 'quarter' | 'semester' | 'year'

const PERIOD_LABELS: Record<Period, string> = {
  month:    'Mes',
  quarter:  'Trimestre',
  semester: 'Semestre',
  year:     'Año',
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n)
}

/** Compute from/to YYYY-MM for a given period, year, and reference month */
function periodRange(period: Period, year: number, month: number): { from: string; to: string } {
  const mm = (n: number) => String(n).padStart(2, '0')
  switch (period) {
    case 'month':
      return { from: `${year}-${mm(month)}`, to: `${year}-${mm(month)}` }
    case 'quarter': {
      const q = Math.ceil(month / 3)
      const qStart = (q - 1) * 3 + 1
      return { from: `${year}-${mm(qStart)}`, to: `${year}-${mm(qStart + 2)}` }
    }
    case 'semester': {
      const h = month <= 6 ? 1 : 2
      return h === 1
        ? { from: `${year}-01`, to: `${year}-06` }
        : { from: `${year}-07`, to: `${year}-12` }
    }
    case 'year':
    default:
      return { from: `${year}-01`, to: `${year}-12` }
  }
}

interface KPI {
  label: string
  value: string
  sub?: string
  positive?: boolean
  icon: React.ReactNode
}

function KpiCard({ label, value, sub, positive, icon }: KPI) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg',
        positive === undefined ? 'bg-brand-navy/10 text-brand-navy'
          : positive ? 'bg-emerald-100 text-emerald-600'
          : 'bg-red-100 text-red-600',
      )}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

interface SummaryState {
  summary: MonthlyFinancialSummary[]
  totals: {
    income: number
    expenses: number
    op_fixed: number
    op_variable: number
    payroll: number
    net: number
    margin_pct: number
  }
}

interface Props {
  initialSummary: SummaryState | null
}

export function FinancesOverviewClient({ initialSummary }: Props) {
  const now = new Date()
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('year')
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear())
  const currentMonth = now.getMonth() + 1

  // Full-year data cache per year
  const [yearCache, setYearCache] = useState<Record<number, SummaryState>>(() =>
    initialSummary ? { [now.getFullYear()]: initialSummary } : {}
  )
  const [loading, setLoading] = useState(false)

  const fetchYear = useCallback(async (year: number) => {
    if (yearCache[year]) return
    setLoading(true)
    try {
      const res = await fetch(`/api/finances/reports/summary?from=${year}-01&to=${year}-12`)
      if (res.ok) {
        const data = await res.json()
        setYearCache(prev => ({ ...prev, [year]: data }))
      }
    } finally {
      setLoading(false)
    }
  }, [yearCache])

  useEffect(() => { fetchYear(selectedYear) }, [selectedYear, fetchYear])

  const yearData = yearCache[selectedYear] ?? null

  // Filter summary to selected period
  const filteredSummary = useMemo<MonthlyFinancialSummary[]>(() => {
    if (!yearData) return []
    const { from, to } = periodRange(selectedPeriod, selectedYear, currentMonth)
    return yearData.summary.filter(s => s.period >= from && s.period <= to)
  }, [yearData, selectedPeriod, selectedYear, currentMonth])

  // Recalculate totals from filtered data
  const filteredTotals = useMemo(() => {
    const income      = filteredSummary.reduce((s, r) => s + r.income, 0)
    const op_fixed    = filteredSummary.reduce((s, r) => s + r.op_fixed, 0)
    const op_variable = filteredSummary.reduce((s, r) => s + r.op_variable, 0)
    const payroll     = filteredSummary.reduce((s, r) => s + r.payroll, 0)
    const expenses    = op_fixed + op_variable + payroll
    const net         = income - expenses
    return { income, expenses, op_fixed, op_variable, payroll, net, margin_pct: income > 0 ? (net / income) * 100 : 0 }
  }, [filteredSummary])

  // GroupBy for chart: quarter when showing semester/year with many periods
  const chartGroupBy: 'month' | 'quarter' =
    selectedPeriod === 'year' && filteredSummary.length > 8 ? 'quarter' : 'month'

  // Period label for KPIs
  const periodLabel = selectedPeriod === 'month' ? 'del mes' : 'del período'

  return (
    <div className="space-y-6">
      {/* Period + year selector */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Period tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                selectedPeriod === p
                  ? 'bg-brand-navy text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Year navigation */}
        <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 shadow-sm">
          <button
            onClick={() => setSelectedYear(y => y - 1)}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[3.5rem] text-center text-sm font-semibold text-gray-700">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear(y => Math.min(y + 1, now.getFullYear()))}
            disabled={selectedYear >= now.getFullYear()}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <span className="text-xs text-gray-400">Cargando...</span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label={`Ingresos ${periodLabel}`}
          value={fmt(filteredTotals.income)}
          icon={<TrendingUp className="h-5 w-5" />}
          positive={true}
        />
        <KpiCard
          label={`Egresos ${periodLabel}`}
          value={fmt(filteredTotals.expenses)}
          sub={filteredTotals.payroll > 0 ? `Nómina: ${fmt(filteredTotals.payroll)}` : undefined}
          icon={<TrendingDown className="h-5 w-5" />}
          positive={false}
        />
        <KpiCard
          label={`Utilidad neta ${periodLabel}`}
          value={fmt(filteredTotals.net)}
          icon={<DollarSign className="h-5 w-5" />}
          positive={filteredTotals.net >= 0}
        />
        <KpiCard
          label="Margen del período"
          value={`${filteredTotals.margin_pct.toFixed(1)}%`}
          icon={<Percent className="h-5 w-5" />}
          positive={filteredTotals.margin_pct >= 30}
        />
      </div>

      {/* Desglose de egresos — mini chips */}
      {(filteredTotals.op_fixed > 0 || filteredTotals.op_variable > 0 || filteredTotals.payroll > 0) && (
        <div className="flex flex-wrap gap-2">
          {filteredTotals.op_fixed > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              Fijos: {fmt(filteredTotals.op_fixed)}
            </span>
          )}
          {filteredTotals.op_variable > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy/10 px-3 py-1 text-xs font-medium text-brand-navy">
              <span className="h-2 w-2 rounded-full bg-brand-navy" />
              Variables: {fmt(filteredTotals.op_variable)}
            </span>
          )}
          {filteredTotals.payroll > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              <Users className="h-3 w-3" />
              Nómina: {fmt(filteredTotals.payroll)}
            </span>
          )}
        </div>
      )}

      {/* Flujo de dinero — Sankey */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Flujo de dinero</h3>
          <p className="text-[11px] text-gray-400">Distribución de ingresos por categoría de egreso</p>
        </div>
        <SankeyChart
          income={filteredTotals.income}
          op_fixed={filteredTotals.op_fixed}
          op_variable={filteredTotals.op_variable}
          payroll={filteredTotals.payroll}
          net={filteredTotals.net}
        />
      </div>

      {/* Tendencia por período */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Tendencia mensual</h3>
            <p className="text-[11px] text-gray-400">Ingresos · Egresos · Neto por período</p>
          </div>
          {selectedPeriod === 'year' && (
            <span className="text-[11px] text-gray-400">agrupado por trimestre</span>
          )}
        </div>
        <CashFlowChart data={filteredSummary} groupBy={chartGroupBy} />
      </div>

      {/* Neto acumulado */}
      <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Neto acumulado en el período</h3>
        <ProfitabilityLineChart data={filteredSummary} />
      </div>
    </div>
  )
}
