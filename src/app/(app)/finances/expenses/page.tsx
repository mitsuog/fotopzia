import { createClient } from '@/lib/supabase/server'
import { ExpensesPageClient } from '@/components/finances/ExpensesPageClient'
import type { Expense, ExpenseCategory } from '@/types/finances'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

interface Project { id: string; title: string }

export default async function ExpensesPage() {
  const supabase = await createClient()
  const db = supabase as AnyTable

  const [expensesRes, categoriesRes, projectsRes] = await Promise.all([
    db.from('expenses').select('*, category:expense_categories(*), project:projects(id,title)').order('date', { ascending: false }),
    db.from('expense_categories').select('*').order('sort_order'),
    supabase.from('projects').select('id, title').order('title'),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Egresos</h1>
        <p className="text-sm text-gray-400">Gastos operativos del estudio</p>
      </div>
      <ExpensesPageClient
        initialExpenses={(expensesRes.data ?? []) as Expense[]}
        categories={(categoriesRes.data ?? []) as ExpenseCategory[]}
        projects={(projectsRes.data ?? []) as unknown as Project[]}
      />
    </div>
  )
}
