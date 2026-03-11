import Link from 'next/link'
import { KanbanBoard } from '@/components/crm/KanbanBoard'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'
import type { Deal } from '@/types/crm'

export const dynamic = 'force-dynamic'

export default async function KanbanPage() {
  const supabase = await createClient()
  const { data: deals } = await supabase
    .from('deals')
    .select('*, contact:contacts(id, first_name, last_name, email, company_name, source, tags)')
    .order('position')

  return (
    <div className="flex min-h-[calc(100vh-180px)] flex-col md:min-h-[calc(100vh-150px)]">
      <PageHeader
        title="CRM Comercial"
        subtitle="Gestiona el pipeline de ventas y da seguimiento a cada oportunidad"
        badge="Pipeline"
        actions={
          <>
            <Link
              href="/crm/list?newContact=1"
              className="inline-flex items-center rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold/60"
            >
              + Nuevo Contacto
            </Link>
            <Link href="/crm/kanban" className="inline-flex items-center rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white">
              Kanban
            </Link>
            <Link
              href="/crm/list"
              className="inline-flex items-center rounded-lg border border-brand-stone bg-brand-paper px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-stone/50"
            >
              Lista
            </Link>
          </>
        }
      />

      <KanbanBoard initialDeals={(deals ?? []) as Deal[]} />
    </div>
  )
}
