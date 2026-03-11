import { CalendarView } from '@/components/calendar/CalendarView'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const EVENT_COLORS: Record<string, string> = {
  meeting: '#2E3F5E',
  production_session: '#C49A2A',
}

export default async function CrmCalendarPage() {
  const supabase = await createClient()
  const [{ data: events }, { data: contacts }, { data: resources }] = await Promise.all([
    supabase
      .from('calendar_events')
      .select('id, title, start_at, end_at, type, description, color, location, event_resources(resource:resources(name))')
      .eq('type', 'meeting')
      .order('start_at'),
    supabase.from('contacts').select('id, first_name, last_name, company_name').order('first_name'),
    supabase.from('resources').select('id, name, type, is_active').eq('is_active', true).order('name'),
  ])

  const calendarEvents = (events ?? []).map(ev => {
    const resourceNames = ((ev.event_resources ?? []) as { resource?: { name?: string } }[])
      .map(item => item.resource?.name)
      .filter((name): name is string => Boolean(name))

    return {
      id: ev.id,
      title: ev.title,
      start: ev.start_at,
      end: ev.end_at ?? undefined,
      color: ev.color ?? EVENT_COLORS[ev.type] ?? '#4f7cbf',
      extendedProps: { type: ev.type, description: ev.description, location: ev.location, resourceNames },
    }
  })

  return (
    <div>
      <PageHeader
        title="Calendario CRM"
        subtitle="Reuniones con clientes y proveedores separadas de la agenda operativa"
        badge="CRM Agenda"
      />
      <CalendarView
        mode="crm"
        initialEvents={calendarEvents}
        initialContacts={(contacts ?? []) as { id: string; first_name: string; last_name: string; company_name: string | null }[]}
        initialResources={(resources ?? []) as { id: string; name: string; type: string }[]}
      />
    </div>
  )
}
