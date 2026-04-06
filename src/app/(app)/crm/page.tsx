import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { CrmWorkspaceClient } from '@/components/crm/CrmWorkspaceClient'
import { createClient } from '@/lib/supabase/server'
import type { Deal } from '@/types/crm'

export const dynamic = 'force-dynamic'

export default async function CRMPage() {
  const supabase = await createClient()

  const [{ data: deals }, { data: profiles }] = await Promise.all([
    supabase
      .from('deals')
      .select('*, contact:contacts(id, first_name, last_name, email, company_name, source, tags)')
      .order('position'),
    supabase
      .from('profiles')
      .select('id, full_name, email')
      .neq('role', 'client')
      .order('full_name'),
  ])

  return (
    <div className="space-y-5">
      <PageHeader
        title="CRM Workspace"
        subtitle="Opera pipeline, seguimiento y siguiente accion sin salir de contexto"
        badge="Pipeline"
        actions={
          <>
            <Link
              href="/crm/list?newContact=1"
              className="inline-flex items-center rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold/60"
            >
              + Nuevo Contacto
            </Link>
            <Link
              href="/crm?view=kanban"
              className="inline-flex items-center rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white"
            >
              Workspace
            </Link>
            <Link
              href="/crm/list"
              className="inline-flex items-center rounded-lg border border-brand-stone bg-brand-paper px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-stone/50"
            >
              Contactos
            </Link>
          </>
        }
      />

      <CrmWorkspaceClient
        initialDeals={(deals ?? []) as Deal[]}
        profiles={(profiles ?? []) as { id: string; full_name: string | null; email: string | null }[]}
      />
    </div>
  )
}
