'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { Plus } from 'lucide-react'

type CalendarMode = 'operations' | 'crm'

interface CalendarEvent {
  id: string
  title: string
  start: string
  end?: string
  color: string
  extendedProps: {
    type: string
    description: string | null
    location?: string | null
    resourceNames?: string[]
  }
}

interface ContactOption {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
}

export interface ResourceOption {
  id: string
  name: string
  type: string
  equipment_item_id?: string | null
  equipment_item?: { id: string; status: string } | null
}

interface CalendarEventRow {
  id: string
  title: string
  start_at: string
  end_at: string | null
  type: string
  description: string | null
  color: string | null
  location: string | null
  event_resources?: { resource?: { name?: string } }[]
}

interface CalendarViewProps {
  mode: CalendarMode
  initialEvents: CalendarEvent[]
  initialContacts?: ContactOption[]
  initialResources?: ResourceOption[]
}

const EVENT_COLORS: Record<string, string> = {
  meeting: '#2E3F5E',
  production_session: '#C49A2A',
}

function mapEvents(data: CalendarEventRow[]): CalendarEvent[] {
  return data.map(ev => {
    const resources = ((ev.event_resources ?? []) as { resource?: { name?: string } }[])
      .map(item => item.resource?.name)
      .filter((name): name is string => Boolean(name))

    return {
      id: ev.id,
      title: ev.title,
      start: ev.start_at,
      end: ev.end_at ?? undefined,
      color: ev.color ?? EVENT_COLORS[ev.type] ?? '#4f7cbf',
      extendedProps: {
        type: ev.type,
        description: ev.description ?? null,
        location: ev.location ?? null,
        resourceNames: resources,
      },
    }
  })
}

export function CalendarView({ mode, initialEvents, initialContacts = [], initialResources = [] }: CalendarViewProps) {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    date: '',
    startTime: '10:00',
    endTime: '11:00',
    location: '',
    description: '',
    contactId: '',
    resourceIds: [] as string[],
  })

  const targetType = mode === 'crm' ? 'meeting' : 'production_session'

  const { data: events = initialEvents } = useQuery({
    queryKey: ['calendar_events', mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, start_at, end_at, type, description, color, location, event_resources(resource:resources(name))')
        .eq('type', targetType)
        .order('start_at')

      if (error) throw error
      return mapEvents(data ?? [])
    },
    initialData: initialEvents,
  })

  const { data: contacts = initialContacts } = useQuery({
    queryKey: ['calendar_contacts', mode],
    enabled: mode === 'crm',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, company_name')
        .order('first_name')
      if (error) throw error
      return (data ?? []) as ContactOption[]
    },
    initialData: initialContacts,
  })

  const { data: resources = initialResources } = useQuery({
    queryKey: ['calendar_resources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('id, name, type, is_active, equipment_item_id, equipment_item:equipment_items(id, status)')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as ResourceOption[]
    },
    initialData: initialResources,
  })

  const sortedResources = useMemo(() => {
    return [...resources].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name, 'es')
      if (a.type === 'personnel') return -1
      if (b.type === 'personnel') return 1
      return a.type.localeCompare(b.type, 'es')
    })
  }, [resources])

  const createEvent = useMutation({
    mutationFn: async () => {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) throw new Error('No autenticado.')

      if (!form.title.trim()) throw new Error('El titulo es obligatorio.')
      if (!form.date) throw new Error('Selecciona una fecha.')

      const start = new Date(`${form.date}T${form.startTime}:00`)
      const end = new Date(`${form.date}T${form.endTime}:00`)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Horario invalido.')
      }
      if (end <= start) throw new Error('La hora de fin debe ser mayor a la de inicio.')

      const { data: eventData, error: eventError } = await supabase
        .from('calendar_events')
        .insert({
          type: targetType,
          title: form.title.trim(),
          description: form.description || null,
          location: form.location || null,
          contact_id: mode === 'crm' && form.contactId ? form.contactId : null,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          status: 'confirmed',
          color: EVENT_COLORS[targetType],
          created_by: authData.user.id,
        })
        .select('id')
        .single()

      if (eventError || !eventData) throw new Error(eventError?.message ?? 'No fue posible crear el evento.')

      if (form.resourceIds.length > 0) {
        const payload = form.resourceIds.map(resourceId => ({
          event_id: eventData.id,
          resource_id: resourceId,
        }))
        const { error: resourceError } = await supabase.from('event_resources').insert(payload)
        if (resourceError) throw new Error(resourceError.message)
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['calendar_events', mode] })
      setIsCreateOpen(false)
      setErrorMsg(null)
      setForm({
        title: '',
        date: '',
        startTime: '10:00',
        endTime: '11:00',
        location: '',
        description: '',
        contactId: '',
        resourceIds: [],
      })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'No se pudo crear el evento.'
      setErrorMsg(message)
    },
  })

  function toggleResource(resourceId: string) {
    setForm(prev => {
      const exists = prev.resourceIds.includes(resourceId)
      return {
        ...prev,
        resourceIds: exists
          ? prev.resourceIds.filter(id => id !== resourceId)
          : [...prev.resourceIds, resourceId],
      }
    })
  }

  return (
    <div className="rounded-xl border border-brand-stone bg-brand-paper p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {mode === 'crm' ? 'Agenda comercial (clientes/proveedores)' : 'Agenda operativa del estudio'}
        </p>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null)
            setIsCreateOpen(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo evento
        </button>
      </div>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale="es"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        buttonText={{ today: 'Hoy', month: 'Mes', week: 'Semana', day: 'Dia' }}
        events={events}
        height="auto"
        slotMinTime="07:00:00"
        slotMaxTime="22:00:00"
        allDaySlot
        weekends
        nowIndicator
        eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short' }}
      />

      {isCreateOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsCreateOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-brand-stone bg-white shadow-xl">
            <div className="border-b border-brand-stone px-6 py-4">
              <h2 className="text-lg font-semibold text-brand-navy">
                {mode === 'crm' ? 'Nuevo evento CRM' : 'Nuevo evento operativo'}
              </h2>
              <p className="mt-1 text-xs text-gray-500">Asigna recursos para definir quien atendera la sesion.</p>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Titulo *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>

              {mode === 'crm' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Cliente</label>
                  <select
                    value={form.contactId}
                    onChange={e => setForm(prev => ({ ...prev, contactId: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  >
                    <option value="">Sin cliente asociado</option>
                    {contacts.map(contact => (
                      <option key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                        {contact.company_name ? ` - ${contact.company_name}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3 sm:col-span-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fecha *</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Inicio</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Fin</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ubicacion</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notas</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Recursos asignados</p>
                <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-brand-stone bg-brand-paper p-3">
                  {sortedResources.length === 0 ? (
                    <p className="text-xs text-gray-500">No hay recursos activos disponibles.</p>
                  ) : (
                    sortedResources.map(resource => {
                      const isLinked = !!resource.equipment_item_id
                      const isInUse = isLinked && resource.equipment_item?.status === 'en_uso'
                      return (
                        <label key={resource.id} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={form.resourceIds.includes(resource.id)}
                            onChange={() => toggleResource(resource.id)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-gold"
                          />
                          {isLinked && (
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${isInUse ? 'bg-amber-400' : 'bg-emerald-500'}`}
                              title={isInUse ? 'En uso' : 'Disponible'}
                            />
                          )}
                          <span>{resource.name}</span>
                          <span className="text-[11px] uppercase text-gray-400">({resource.type})</span>
                        </label>
                      )
                    }))
                  )}
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-brand-stone p-4">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => createEvent.mutate()}
                disabled={createEvent.isPending}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-navy-light disabled:opacity-50"
              >
                {createEvent.isPending ? 'Guardando...' : 'Guardar evento'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
