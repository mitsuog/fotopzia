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
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let canEditContact = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    canEditContact = profile?.role === 'admin'
  }

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

  const nowIso = new Date().toISOString()

  const [quotesResult, contractsResult, eventsResult, projectsResult] = await Promise.all([
    supabase
      .from('quotes')
      .select('id, quote_number, title, status, updated_at, deal_id')
      .eq('contact_id', contactId)
      .in('status', ['draft', 'sent', 'viewed', 'approved'])
      .order('updated_at', { ascending: false }),
    supabase
      .from('contracts')
      .select('id, contract_number, title, status, updated_at, quote_id')
      .eq('contact_id', contactId)
      .neq('status', 'voided')
      .order('updated_at', { ascending: false }),
    supabase
      .from('calendar_events')
      .select('id, title, start_at, end_at, status, deal_id')
      .eq('contact_id', contactId)
      .neq('status', 'cancelled')
      .gte('end_at', nowIso)
      .order('start_at', { ascending: true }),
    supabase
      .from('projects')
      .select('id, title, stage, due_date, deal_id, created_at')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false }),
  ])

  const activeQuotes = quotesResult.data ?? []
  const contracts = contractsResult.data ?? []
  const upcomingEvents = eventsResult.data ?? []
  const projects = projectsResult.data ?? []

  const [quoteApprovalsResult, contractApprovalsResult, projectTasksResult, followupsResult] = await Promise.all([
    activeQuotes.length
      ? supabase
        .from('approval_flows')
        .select('id, title, status, entity_type, entity_id, updated_at')
        .eq('entity_type', 'quote')
        .in('entity_id', activeQuotes.map(item => item.id))
        .in('status', ['pending', 'in_progress'])
        .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    contracts.length
      ? supabase
        .from('approval_flows')
        .select('id, title, status, entity_type, entity_id, updated_at')
        .eq('entity_type', 'contract')
        .in('entity_id', contracts.map(item => item.id))
        .in('status', ['pending', 'in_progress'])
        .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    projects.length
      ? supabase
        .from('project_tasks')
        .select('id, project_id, title, status, priority, due_at')
        .in('project_id', projects.map(project => project.id))
        .neq('status', 'done')
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    upcomingEvents.length
      ? supabase
        .from('crm_event_followups' as never)
        .select('id, event_id, title, status, priority, due_at')
        .in('event_id', upcomingEvents.map(event => event.id))
        .neq('status', 'done')
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  const pendingApprovals = [
    ...(quoteApprovalsResult.data ?? []),
    ...(contractApprovalsResult.data ?? []),
  ]

  return (
    <ContactDetail
      contact={contact as Contact}
      initialDeals={(deals ?? []) as Deal[]}
      initialActivities={(activities ?? []) as Activity[]}
      activeQuotes={activeQuotes as Array<{
        id: string
        quote_number: string
        title: string
        status: string
        updated_at: string
        deal_id: string | null
      }>}
      contracts={contracts as Array<{
        id: string
        contract_number: string
        title: string
        status: string
        updated_at: string
        quote_id: string | null
      }>}
      upcomingEvents={upcomingEvents as Array<{
        id: string
        title: string
        start_at: string
        end_at: string
        status: string
        deal_id: string | null
      }>}
      openFollowups={(followupsResult.data ?? []) as Array<{
        id: string
        event_id: string
        title: string
        status: string
        priority: string
        due_at: string | null
      }>}
      pendingApprovals={pendingApprovals as Array<{
        id: string
        title: string
        status: string
        entity_type: string
        entity_id: string
        updated_at: string
      }>}
      projects={projects as Array<{
        id: string
        title: string
        stage: string
        due_date: string | null
        deal_id: string | null
        created_at: string
      }>}
      openProjectTasks={(projectTasksResult.data ?? []) as Array<{
        id: string
        project_id: string
        title: string
        status: string
        priority: string
        due_at: string | null
      }>}
      canEditContact={canEditContact}
    />
  )
}
