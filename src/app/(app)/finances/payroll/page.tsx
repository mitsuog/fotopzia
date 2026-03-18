import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PayrollPageClient } from '@/components/finances/PayrollPageClient'
import type { PayrollEntry } from '@/types/finances'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

export default async function PayrollPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/finances')

  const db = supabase as AnyTable
  const { data: entries } = await db.from('payroll_entries').select('*').order('period_start', { ascending: false })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Nóminas</h1>
        <p className="text-sm text-gray-400">Registro de pagos a empleados y colaboradores</p>
      </div>
      <PayrollPageClient initialEntries={(entries ?? []) as PayrollEntry[]} />
    </div>
  )
}
