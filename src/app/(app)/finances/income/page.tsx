import { createClient } from '@/lib/supabase/server'
import { IncomePageClient } from '@/components/finances/IncomePageClient'
import type { ProjectPayment } from '@/types/finances'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

interface Project { id: string; title: string }

export default async function IncomePage() {
  const supabase = await createClient()
  const db = supabase as AnyTable

  const [paymentsRes, projectsRes] = await Promise.all([
    db.from('project_payments').select('*, project:projects(id,title)').order('paid_at', { ascending: false }),
    supabase.from('projects').select('id, title').order('title'),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Ingresos</h1>
        <p className="text-sm text-gray-400">Pagos y anticipos recibidos por proyecto</p>
      </div>
      <IncomePageClient
        initialPayments={(paymentsRes.data ?? []) as ProjectPayment[]}
        projects={(projectsRes.data ?? []) as unknown as Project[]}
      />
    </div>
  )
}
