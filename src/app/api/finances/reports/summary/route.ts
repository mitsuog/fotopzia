import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') // YYYY-MM
  const to = searchParams.get('to')     // YYYY-MM

  const fromDate = from ? `${from}-01` : undefined
  const toDate = to ? `${to}-31` : undefined

  // Income: project payments
  let paymentsQuery = supabase
    .from('project_payments')
    .select('amount, paid_at')
    .order('paid_at')
  if (fromDate) paymentsQuery = paymentsQuery.gte('paid_at', fromDate)
  if (toDate)   paymentsQuery = paymentsQuery.lte('paid_at', toDate)

  // Operational expenses with fixed/variable flag
  let expensesQuery = supabase
    .from('expenses')
    .select('amount, date, category:expense_categories(is_fixed)')
    .order('date')
  if (fromDate) expensesQuery = expensesQuery.gte('date', fromDate)
  if (toDate)   expensesQuery = expensesQuery.lte('date', toDate)

  // Payroll
  let payrollQuery = supabase
    .from('payroll_entries')
    .select('net_total, paid_at, period_end')
    .order('paid_at')
  if (fromDate) payrollQuery = payrollQuery.gte('paid_at', fromDate)
  if (toDate)   payrollQuery = payrollQuery.lte('paid_at', toDate)

  const [paymentsRes, expensesRes, payrollRes] = await Promise.all([
    paymentsQuery,
    expensesQuery,
    payrollQuery,
  ])

  if (paymentsRes.error) return NextResponse.json({ error: paymentsRes.error.message }, { status: 500 })
  if (expensesRes.error) return NextResponse.json({ error: expensesRes.error.message }, { status: 500 })
  if (payrollRes.error)  return NextResponse.json({ error: payrollRes.error.message }, { status: 500 })

  // Aggregate by period (YYYY-MM)
  const byPeriod: Record<string, { income: number; op_fixed: number; op_variable: number; payroll: number }> = {}

  function ensurePeriod(p: string) {
    if (!byPeriod[p]) byPeriod[p] = { income: 0, op_fixed: 0, op_variable: 0, payroll: 0 }
  }

  for (const p of paymentsRes.data ?? []) {
    const period = (p.paid_at as string).slice(0, 7)
    ensurePeriod(period)
    byPeriod[period].income += Number(p.amount)
  }

  for (const e of expensesRes.data ?? []) {
    const period = (e.date as string).slice(0, 7)
    ensurePeriod(period)
    const cat = e.category as unknown as { is_fixed: boolean } | null
    const isFixed = cat?.is_fixed ?? false
    if (isFixed) {
      byPeriod[period].op_fixed += Number(e.amount)
    } else {
      byPeriod[period].op_variable += Number(e.amount)
    }
  }

  for (const pr of payrollRes.data ?? []) {
    // Use paid_at when available, otherwise period_end
    const dateStr = (pr.paid_at ?? pr.period_end) as string | null
    if (!dateStr) continue
    const period = dateStr.slice(0, 7)
    ensurePeriod(period)
    byPeriod[period].payroll += Number(pr.net_total)
  }

  const periods = Object.keys(byPeriod).sort()
  let cumulative = 0
  const summary = periods.map(period => {
    const { income, op_fixed, op_variable, payroll } = byPeriod[period]
    const expenses = op_fixed + op_variable + payroll
    const net = income - expenses
    cumulative += net
    return { period, income, expenses, op_fixed, op_variable, payroll, net, cumulative_net: cumulative }
  })

  const totalIncome    = summary.reduce((s, r) => s + r.income, 0)
  const totalOpFixed   = summary.reduce((s, r) => s + r.op_fixed, 0)
  const totalOpVar     = summary.reduce((s, r) => s + r.op_variable, 0)
  const totalPayroll   = summary.reduce((s, r) => s + r.payroll, 0)
  const totalExpenses  = totalOpFixed + totalOpVar + totalPayroll

  return NextResponse.json({
    summary,
    totals: {
      income:      totalIncome,
      expenses:    totalExpenses,
      op_fixed:    totalOpFixed,
      op_variable: totalOpVar,
      payroll:     totalPayroll,
      net:         totalIncome - totalExpenses,
      margin_pct:  totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0,
    },
  })
}
