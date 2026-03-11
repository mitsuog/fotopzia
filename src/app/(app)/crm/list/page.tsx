import Link from 'next/link'
import { ContactsTable } from '@/components/crm/ContactsTable'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'
import type { Contact } from '@/types/crm'

export const dynamic = 'force-dynamic'

export default async function ContactsListPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase.from('contacts').select('*').order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="Contactos"
        subtitle={`${contacts?.length ?? 0} contactos registrados`}
        badge="CRM"
        actions={
          <>
            <Link href="/crm/list?newContact=1" className="inline-flex items-center rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white">
              + Nuevo Contacto
            </Link>
            <Link
              href="/crm/kanban"
              className="inline-flex items-center rounded-lg border border-brand-stone bg-brand-paper px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-stone/50"
            >
              Kanban
            </Link>
            <Link href="/crm/list" className="inline-flex items-center rounded-lg bg-brand-navy-light px-3 py-1.5 text-xs font-medium text-white">
              Lista
            </Link>
          </>
        }
      />
      <ContactsTable initialContacts={(contacts ?? []) as Contact[]} />
    </div>
  )
}
