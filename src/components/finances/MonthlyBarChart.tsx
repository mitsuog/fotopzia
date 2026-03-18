'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { MonthlyFinancialSummary } from '@/types/finances'

function fmtMonth(period: string) {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'short', year: '2-digit' })
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v)
}

interface Props {
  data: MonthlyFinancialSummary[]
}

export function MonthlyBarChart({ data }: Props) {
  const chartData = data.map(d => ({
    name: fmtMonth(d.period),
    Ingresos: d.income,
    Egresos: d.expenses,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(v) => fmtCurrency(Number(v))} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Ingresos" fill="#C49A2A" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Egresos" fill="#2E3F5E" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
