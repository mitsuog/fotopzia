import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface ProjectRow { id: string; title: string }
interface PaymentRow { project_id: string; amount: number }
interface ExpenseRow { project_id: string | null; amount: number }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, title')
    .neq('is_archived', true)
    .order('created_at', { ascending: false })

  if (projError) return NextResponse.json({ error: projError.message }, { status: 500 })

  const [paymentsRes, expensesRes] = await Promise.all([
    supabase.from('project_payments' as never).select('project_id, amount'),
    supabase.from('expenses' as never).select('project_id, amount').not('project_id', 'is', null),
  ])

  if (paymentsRes.error) return NextResponse.json({ error: paymentsRes.error.message }, { status: 500 })
  if (expensesRes.error) return NextResponse.json({ error: expensesRes.error.message }, { status: 500 })

  const payments = (paymentsRes.data ?? []) as unknown as PaymentRow[]
  const expenses = (expensesRes.data ?? []) as unknown as ExpenseRow[]

  const paymentsByProject: Record<string, number> = {}
  for (const p of payments) {
    paymentsByProject[p.project_id] = (paymentsByProject[p.project_id] ?? 0) + Number(p.amount)
  }

  const expensesByProject: Record<string, number> = {}
  for (const e of expenses) {
    if (e.project_id) {
      expensesByProject[e.project_id] = (expensesByProject[e.project_id] ?? 0) + Number(e.amount)
    }
  }

  const result = (projects ?? []).map(proj => {
    const id = proj.id as string
    const received = paymentsByProject[id] ?? 0
    const direct_costs = expensesByProject[id] ?? 0
    const margin = received - direct_costs
    const margin_pct = received > 0 ? (margin / received) * 100 : 0

    return {
      project_id: id,
      project_title: proj.title as string,
      received,
      direct_costs,
      margin,
      margin_pct,
    }
  })

  return NextResponse.json(result)
}

