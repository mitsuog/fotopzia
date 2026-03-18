'use client'

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { MonthlyFinancialSummary } from '@/types/finances'

function fmtPeriod(period: string, groupBy: 'month' | 'quarter') {
  const [y, m] = period.split('-')
  if (groupBy === 'quarter') {
    const q = Math.ceil(Number(m) / 3)
    return `Q${q} '${y.slice(2)}`
  }
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-MX', {
    month: 'short',
    year: '2-digit',
  })
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(v)
}

interface ChartRow {
  label: string
  Ingresos: number
  'G. Fijos': number
  'G. Variables': number
  'Nómina': number
  Neto: number
}

function buildRows(data: MonthlyFinancialSummary[], groupBy: 'month' | 'quarter'): ChartRow[] {
  if (groupBy === 'month') {
    return data.map(d => ({
      label: fmtPeriod(d.period, 'month'),
      Ingresos: d.income,
      'G. Fijos': d.op_fixed ?? 0,
      'G. Variables': d.op_variable ?? 0,
      'Nómina': d.payroll ?? 0,
      Neto: d.net,
    }))
  }

  // Group by quarter
  const map: Record<string, ChartRow> = {}
  for (const d of data) {
    const [y, m] = d.period.split('-')
    const q = Math.ceil(Number(m) / 3)
    const key = `${y}-Q${q}`
    if (!map[key]) {
      map[key] = { label: `Q${q} '${y.slice(2)}`, Ingresos: 0, 'G. Fijos': 0, 'G. Variables': 0, 'Nómina': 0, Neto: 0 }
    }
    map[key].Ingresos    += d.income
    map[key]['G. Fijos'] += d.op_fixed ?? 0
    map[key]['G. Variables'] += d.op_variable ?? 0
    map[key]['Nómina']   += d.payroll ?? 0
    map[key].Neto        += d.net
  }
  return Object.values(map)
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null

  const income = payload.find(p => p.name === 'Ingresos')?.value ?? 0
  const neto   = payload.find(p => p.name === 'Neto')?.value ?? 0
  const egresos = income - neto

  // Only show lines with non-zero values
  const nonZero = payload.filter(p => p.value !== 0)

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-lg text-xs min-w-[190px]">
      <p className="mb-2 border-b border-gray-100 pb-1.5 font-semibold text-gray-700">{label}</p>
      {nonZero.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-6 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-gray-500">{p.name}</span>
          </div>
          <span className={
            p.name === 'Neto'
              ? p.value >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'
              : 'text-gray-700'
          }>
            {fmtCurrency(p.value)}
          </span>
        </div>
      ))}
      {egresos > 0 && (
        <div className="mt-1.5 flex items-center justify-between border-t border-gray-100 pt-1.5 text-[11px] text-gray-400">
          <span>Total egresos</span>
          <span>{fmtCurrency(egresos)}</span>
        </div>
      )}
    </div>
  )
}

interface Props {
  data: MonthlyFinancialSummary[]
  groupBy?: 'month' | 'quarter'
}

export function CashFlowChart({ data, groupBy = 'month' }: Props) {
  if (!data.length) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
        Sin datos para el período seleccionado
      </div>
    )
  }

  const rows = buildRows(data, groupBy)

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          width={46}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />

        {/* Ingresos — barra independiente */}
        <Bar dataKey="Ingresos" fill="#C49A2A" radius={[3, 3, 0, 0]} maxBarSize={32} />

        {/* Egresos — apilados por categoría */}
        <Bar dataKey="G. Fijos"     stackId="egresos" fill="#64748b" maxBarSize={32} />
        <Bar dataKey="G. Variables" stackId="egresos" fill="#2E3F5E" maxBarSize={32} />
        <Bar dataKey="Nómina"       stackId="egresos" fill="#6366f1" radius={[3, 3, 0, 0]} maxBarSize={32} />

        {/* Neto — línea encima */}
        <Line
          type="monotone"
          dataKey="Neto"
          stroke="#10b981"
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#10b981', strokeWidth: 1.5, stroke: 'white' }}
          activeDot={{ r: 5, fill: '#10b981' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
