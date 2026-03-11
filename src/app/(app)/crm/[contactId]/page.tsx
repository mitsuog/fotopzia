import { createClient } from '@/lib/supabase/server'
import { ContactDetail } from '@/components/crm/ContactDetail'
import { notFound } from 'next/navigation'
import type { Contact, Deal, Activity } from '@/types/crm'

export const dynamic = 'force-dynamic'

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>
}) {
  const { contactId } = await params
  const supabase = await createClient()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .single()

  if (!contact) notFound()

  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  const { data: activities } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })

  return (
    <ContactDetail
      contact={contact as Contact}
      initialDeals={(deals ?? []) as Deal[]}
      initialActivities={(activities ?? []) as Activity[]}
    />
  )
}
