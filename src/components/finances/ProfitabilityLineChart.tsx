'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { MonthlyFinancialSummary } from '@/types/finances'

function fmtMonth(period: string) {
  const [y, m] = period.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
}

interface Props {
  data: MonthlyFinancialSummary[]
}

export function ProfitabilityLineChart({ data }: Props) {
  const chartData = data.map(d => ({
    name: fmtMonth(d.period),
    'Neto Acumulado': d.cumulative_net,
    'Neto Mes': d.net,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#C49A2A" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#C49A2A" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
        <Area type="monotone" dataKey="Neto Acumulado" stroke="#C49A2A" fill="url(#gradNet)" strokeWidth={2} />
        <Area type="monotone" dataKey="Neto Mes" stroke="#2E3F5E" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
