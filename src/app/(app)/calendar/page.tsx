import { CalendarView } from '@/components/calendar/CalendarView'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const EVENT_COLORS: Record<string, string> = {
  meeting: '#2E3F5E',
  production_session: '#C49A2A',
}

export default async function CalendarPage() {
  const supabase = await createClient()
  const { data: events } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, type, description, color')
    .order('start_at')

  const calendarEvents = (events ?? []).map(ev => ({
    id: ev.id,
    title: ev.title,
    start: ev.start_at,
    end: ev.end_at ?? undefined,
    color: ev.color ?? EVENT_COLORS[ev.type] ?? '#4f7cbf',
    extendedProps: { type: ev.type, description: ev.description },
  }))

  return (
    <div>
      <PageHeader title="Calendario" subtitle="Sesiones, reuniones y eventos del estudio" badge="Agenda" />
      <CalendarView initialEvents={calendarEvents} />
    </div>
  )
}
