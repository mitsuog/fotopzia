'use client'
import { createClient } from '@/lib/supabase/client'
import { useQuery } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  color: string
  extendedProps: { type: string; description: string | null }
}

const EVENT_COLORS: Record<string, string> = {
  meeting: '#2E3F5E',
  production_session: '#C49A2A',
}

export function CalendarView({ initialEvents }: { initialEvents: CalendarEvent[] }) {
  const { data: events = initialEvents } = useQuery({
    queryKey: ['calendar_events'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, type, description, color')
        .order('start_at')
      return (data ?? []).map(ev => ({
        id: ev.id,
        title: ev.title,
        start: ev.start_at,
        end: ev.end_at ?? undefined,
        color: ev.color ?? EVENT_COLORS[ev.type] ?? '#4f7cbf',
        extendedProps: { type: ev.type, description: ev.description },
      }))
    },
    initialData: initialEvents,
  })

  return (
    <div className="bg-brand-paper border border-brand-stone rounded-xl overflow-hidden p-4">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale="es"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Día' }}
        events={events}
        height="auto"
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={true}
        weekends={true}
        nowIndicator={true}
        eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
      />
    </div>
  )
}
