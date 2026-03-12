'use client'

import { useMemo, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type CalendarViewType = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth'
type FollowupStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
type FollowupPriority = 'low' | 'medium' | 'high' | 'critical'
type DetailTab = 'summary' | 'followups' | 'notes' | 'history'

interface MetaUser {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

interface MetaContact {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
}

interface MetaDeal {
  id: string
  title: string
  contact_id: string
}

interface CrmEvent {
  id: string
  title: string
  start_at: string
  end_at: string
  description: string | null
  status: 'tentative' | 'confirmed' | 'cancelled'
  contact_id: string | null
  deal_id: string | null
  created_by: string
  contact: { first_name: string; last_name: string; company_name: string | null } | null
  collaborators: Array<{ user_id: string; full_name: string | null; email: string | null }>
}

interface FollowupComment {
  id: string
  followup_id: string
  body: string
  created_by: string
  created_at: string
  author: MetaUser | null
}

interface FollowupLog {
  id: string
  followup_id: string
  action: string
  payload: Record<string, unknown>
  created_at: string
  actor: MetaUser | null
}

interface FollowupItem {
  id: string
  title: string
  description: string | null
  status: FollowupStatus
  priority: FollowupPriority
  assignee_id: string | null
  due_at: string | null
  assignee: MetaUser | null
  comments: FollowupComment[]
}

interface FollowupsResponse {
  data: FollowupItem[]
  history: FollowupLog[]
}

interface EventFormState {
  title: string
  contact_id: string
  deal_id: string
  start_local: string
  end_local: string
  description: string
  location: string
  video_url: string
  attendee_user_ids: string[]
}

function toLocalDateTimeInputValue(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16)
}

function emptyForm(): EventFormState {
  const start = new Date()
  start.setMinutes(0, 0, 0)
  const end = new Date(start)
  end.setHours(end.getHours() + 1)
  return {
    title: '',
    contact_id: '',
    deal_id: '',
    start_local: toLocalDateTimeInputValue(start.toISOString()),
    end_local: toLocalDateTimeInputValue(end.toISOString()),
    description: '',
    location: '',
    video_url: '',
    attendee_user_ids: [],
  }
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options)
  const payload = await response.json().catch(() => ({ error: 'Error de respuesta.' })) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'Error inesperado.')
  return payload
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

function hashColor(input: string): string {
  const palette = ['#1E3A8A', '#0F766E', '#7C2D12', '#7E22CE', '#0F4C81', '#166534']
  let hash = 0
  for (let i = 0; i < input.length; i += 1) hash = (hash << 5) - hash + input.charCodeAt(i)
  return palette[Math.abs(hash) % palette.length]
}

export function CrmCalendarWorkspace() {
  const queryClient = useQueryClient()

  const [calendarView, setCalendarView] = useState<CalendarViewType>('timeGridWeek')
  const [rangeStart, setRangeStart] = useState(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  const [rangeEnd, setRangeEnd] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
  const [search, setSearch] = useState('')
  const [contactFilter, setContactFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [teamOverlay, setTeamOverlay] = useState(true)

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('summary')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [form, setForm] = useState<EventFormState>(emptyForm)
  const [eventError, setEventError] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState('')
  const [commentTargetId, setCommentTargetId] = useState('')
  const [commentBody, setCommentBody] = useState('')

  const [newFollowupTitle, setNewFollowupTitle] = useState('')
  const [newFollowupPriority, setNewFollowupPriority] = useState<FollowupPriority>('medium')
  const [newFollowupStatus, setNewFollowupStatus] = useState<FollowupStatus>('todo')

  const metaQuery = useQuery({
    queryKey: ['crm-calendar-meta'],
    queryFn: () => requestJson<{ data: { users: MetaUser[]; contacts: MetaContact[]; deals: MetaDeal[] } }>('/api/crm-calendar/meta'),
  })

  const eventsQuery = useQuery({
    queryKey: ['crm-calendar-events', rangeStart, rangeEnd, contactFilter, assigneeFilter, mineOnly],
    queryFn: () => {
      const params = new URLSearchParams({ start: rangeStart, end: rangeEnd })
      if (contactFilter) params.set('contactId', contactFilter)
      if (assigneeFilter) params.set('assigneeId', assigneeFilter)
      if (mineOnly) params.set('mine', '1')
      return requestJson<{ data: CrmEvent[] }>(`/api/crm-calendar/events?${params.toString()}`)
    },
  })

  const selectedEvent = useMemo(() => (eventsQuery.data?.data ?? []).find(event => event.id === selectedEventId) ?? null, [eventsQuery.data, selectedEventId])

  const followupsQuery = useQuery({
    queryKey: ['crm-followups', selectedEventId],
    enabled: Boolean(selectedEventId),
    queryFn: () => requestJson<FollowupsResponse>(`/api/crm-calendar/events/${selectedEventId}/followups`),
  })

  const createEventMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => requestJson<{ data: { id: string } }>('/api/crm-calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm-calendar-events'] })
      setIsDrawerOpen(false)
      setEditingEventId(null)
      setForm(emptyForm())
      setEventError(null)
    },
    onError: (error: unknown) => setEventError(error instanceof Error ? error.message : 'No fue posible crear la cita.'),
  })

  const patchEventMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => requestJson(`/api/crm-calendar/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['crm-calendar-events'] }),
        queryClient.invalidateQueries({ queryKey: ['crm-followups', selectedEventId] }),
      ])
    },
    onError: (error: unknown) => setEventError(error instanceof Error ? error.message : 'No fue posible actualizar la cita.'),
  })

  const cancelEventMutation = useMutation({
    mutationFn: (id: string) => requestJson(`/api/crm-calendar/events/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm-calendar-events'] })
    },
  })

  const createFollowupMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => requestJson(`/api/crm-calendar/events/${selectedEventId}/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm-followups', selectedEventId] })
      setNewFollowupTitle('')
    },
  })

  const updateFollowupMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) => requestJson(`/api/crm-calendar/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm-followups', selectedEventId] })
    },
  })

  const commentMutation = useMutation({
    mutationFn: ({ followupId, body }: { followupId: string; body: string }) => requestJson(`/api/crm-calendar/followups/${followupId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body }),
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['crm-followups', selectedEventId] })
      setCommentBody('')
    },
  })

  const calendarEvents = useMemo(() => {
    return (eventsQuery.data?.data ?? [])
      .filter(event => {
        if (!search.trim()) return true
        const needle = search.toLowerCase()
        return `${event.title} ${event.contact?.first_name ?? ''} ${event.contact?.last_name ?? ''}`.toLowerCase().includes(needle)
      })
      .map(event => ({
        id: event.id,
        title: event.contact ? `${event.title} · ${event.contact.first_name} ${event.contact.last_name}` : event.title,
        start: event.start_at,
        end: event.end_at,
        backgroundColor: event.status === 'cancelled' ? '#64748B' : (teamOverlay ? hashColor(event.created_by) : '#2E3F5E'),
        borderColor: event.status === 'cancelled' ? '#64748B' : (teamOverlay ? hashColor(event.created_by) : '#2E3F5E'),
      }))
  }, [eventsQuery.data, search, teamOverlay])

  const filteredDeals = useMemo(() => {
    const deals = metaQuery.data?.data.deals ?? []
    if (!form.contact_id) return deals
    return deals.filter(deal => deal.contact_id === form.contact_id)
  }, [metaQuery.data?.data.deals, form.contact_id])

  const allComments = useMemo(() => (followupsQuery.data?.data ?? []).flatMap(followup => followup.comments).sort((a, b) => b.created_at.localeCompare(a.created_at)), [followupsQuery.data?.data])

  function clearSelection() {
    setSelectedEventId(null)
    setActiveTab('summary')
    setNotesDraft('')
    setCommentTargetId('')
    setCommentBody('')
  }

  function openCreate() {
    setEditingEventId(null)
    setForm(emptyForm())
    setEventError(null)
    setIsDrawerOpen(true)
  }

  function openEdit(event: CrmEvent) {
    setEditingEventId(event.id)
    setForm({
      title: event.title,
      contact_id: event.contact_id ?? '',
      deal_id: event.deal_id ?? '',
      start_local: toLocalDateTimeInputValue(event.start_at),
      end_local: toLocalDateTimeInputValue(event.end_at),
      description: event.description ?? '',
      location: '',
      video_url: '',
      attendee_user_ids: event.collaborators.map(collaborator => collaborator.user_id),
    })
    setEventError(null)
    setIsDrawerOpen(true)
  }

  function saveEvent() {
    const payload = {
      title: form.title,
      contact_id: form.contact_id,
      deal_id: form.deal_id || null,
      start_at: new Date(form.start_local).toISOString(),
      end_at: new Date(form.end_local).toISOString(),
      description: form.description || null,
      location: form.location || null,
      video_url: form.video_url || null,
      attendee_user_ids: form.attendee_user_ids,
    }
    if (editingEventId) {
      patchEventMutation.mutate({ id: editingEventId, payload })
      return
    }
    createEventMutation.mutate(payload)
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <section className="rounded-xl border border-brand-stone bg-white p-4 xl:col-span-3">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} className="w-full rounded-lg border border-brand-stone py-2 pl-8 pr-3 text-sm" placeholder="Buscar cita..." />
        </div>
        <select value={contactFilter} onChange={event => setContactFilter(event.target.value)} className="mb-2 w-full rounded-lg border border-brand-stone px-3 py-2 text-sm">
          <option value="">Todos los contactos</option>
          {(metaQuery.data?.data.contacts ?? []).map(contact => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</option>)}
        </select>
        <select value={assigneeFilter} onChange={event => setAssigneeFilter(event.target.value)} className="mb-2 w-full rounded-lg border border-brand-stone px-3 py-2 text-sm">
          <option value="">Todo el equipo</option>
          {(metaQuery.data?.data.users ?? []).map(user => <option key={user.id} value={user.id}>{user.full_name ?? user.email ?? user.id}</option>)}
        </select>
        <label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={mineOnly} onChange={event => setMineOnly(event.target.checked)} />Solo mis citas</label>
        <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={teamOverlay} onChange={event => setTeamOverlay(event.target.checked)} />Overlay por colaborador</label>
        <button type="button" onClick={openCreate} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-navy px-3 py-2 text-sm text-white"><CalendarPlus className="h-4 w-4" />Nueva cita</button>
      </section>

      <section className="rounded-xl border border-brand-stone bg-white p-4 xl:col-span-6">
        <div className="mb-2 flex gap-2">
          {(['timeGridDay', 'timeGridWeek', 'dayGridMonth'] as CalendarViewType[]).map(view => (
            <button key={view} type="button" onClick={() => setCalendarView(view)} className={cn('rounded-md px-3 py-1 text-xs', calendarView === view ? 'bg-brand-navy text-white' : 'bg-brand-paper text-gray-600')}>
              {view === 'timeGridDay' ? 'Día' : view === 'timeGridWeek' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
        <FullCalendar
          key={calendarView}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={calendarView}
          locale="es"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          events={calendarEvents}
          height={620}
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          nowIndicator
          datesSet={(arg) => {
            setRangeStart(arg.start.toISOString())
            setRangeEnd(arg.end.toISOString())
            setCalendarView(arg.view.type as CalendarViewType)
          }}
          dateClick={() => {
            clearSelection()
          }}
          eventClick={(info) => {
            setSelectedEventId(info.event.id)
            setActiveTab('summary')
            const sourceEvent = (eventsQuery.data?.data ?? []).find(item => item.id === info.event.id)
            setNotesDraft(sourceEvent?.description ?? '')
          }}
        />
      </section>

      <section className="rounded-xl border border-brand-stone bg-white p-4 xl:col-span-3">
        {selectedEvent && (
          <div className="space-y-3">
            <div className="rounded-lg border border-brand-stone p-3">
              <p className="text-sm font-semibold text-brand-navy">{selectedEvent.title}</p>
              <p className="text-xs text-gray-600">{formatDateTime(selectedEvent.start_at)} - {formatDateTime(selectedEvent.end_at)}</p>
            </div>
            <div className="flex gap-1 rounded-lg border border-brand-stone bg-brand-paper p-1">
              {(['summary', 'followups', 'notes', 'history'] as DetailTab[]).map(tab => (
                <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={cn('flex-1 rounded-md px-2 py-1 text-[11px]', activeTab === tab ? 'bg-brand-navy text-white' : 'text-gray-600')}>{tab}</button>
              ))}
            </div>
            {activeTab === 'summary' && (
              <div className="space-y-2 text-xs">
                <p><strong>Cliente:</strong> {selectedEvent.contact ? `${selectedEvent.contact.first_name} ${selectedEvent.contact.last_name}` : 'N/A'}</p>
                <p><strong>Estado:</strong> {selectedEvent.status}</p>
                <button type="button" onClick={() => openEdit(selectedEvent)} className="mr-2 rounded-md border border-brand-stone px-2 py-1">Editar</button>
                <button type="button" onClick={() => cancelEventMutation.mutate(selectedEvent.id)} className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700">Cancelar</button>
              </div>
            )}
            {activeTab === 'followups' && (
              <div className="space-y-2">
                <div className="rounded-md border border-brand-stone p-2">
                  <input value={newFollowupTitle} onChange={event => setNewFollowupTitle(event.target.value)} placeholder="Nuevo seguimiento" className="mb-1 w-full rounded border border-brand-stone px-2 py-1 text-xs" />
                  <div className="mb-1 grid grid-cols-2 gap-1">
                    <select value={newFollowupStatus} onChange={event => setNewFollowupStatus(event.target.value as FollowupStatus)} className="rounded border border-brand-stone px-2 py-1 text-xs"><option value="todo">To Do</option><option value="in_progress">En progreso</option><option value="blocked">Bloqueado</option><option value="done">Done</option></select>
                    <select value={newFollowupPriority} onChange={event => setNewFollowupPriority(event.target.value as FollowupPriority)} className="rounded border border-brand-stone px-2 py-1 text-xs"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select>
                  </div>
                  <button type="button" onClick={() => createFollowupMutation.mutate({ title: newFollowupTitle, status: newFollowupStatus, priority: newFollowupPriority })} className="w-full rounded bg-brand-navy px-2 py-1 text-xs text-white">Crear</button>
                </div>
                {(followupsQuery.data?.data ?? []).map(followup => (
                  <div key={followup.id} className="rounded-md border border-brand-stone p-2">
                    <p className="text-xs font-semibold">{followup.title}</p>
                    <div className="mt-1 grid grid-cols-2 gap-1">
                      <select value={followup.status} onChange={event => updateFollowupMutation.mutate({ id: followup.id, payload: { status: event.target.value } })} className="rounded border border-brand-stone px-2 py-1 text-xs"><option value="todo">To Do</option><option value="in_progress">En progreso</option><option value="blocked">Bloqueado</option><option value="done">Done</option></select>
                      <select value={followup.priority} onChange={event => updateFollowupMutation.mutate({ id: followup.id, payload: { priority: event.target.value } })} className="rounded border border-brand-stone px-2 py-1 text-xs"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'notes' && (
              <div className="space-y-2">
                <textarea value={notesDraft} onChange={event => setNotesDraft(event.target.value)} rows={3} className="w-full rounded border border-brand-stone px-2 py-1 text-xs" />
                <button type="button" onClick={() => patchEventMutation.mutate({ id: selectedEvent.id, payload: { description: notesDraft } })} className="w-full rounded bg-brand-navy px-2 py-1 text-xs text-white">Guardar notas</button>
                <select value={commentTargetId} onChange={event => setCommentTargetId(event.target.value)} className="w-full rounded border border-brand-stone px-2 py-1 text-xs">
                  <option value="">Seguimiento objetivo</option>
                  {(followupsQuery.data?.data ?? []).map(followup => <option key={followup.id} value={followup.id}>{followup.title}</option>)}
                </select>
                <textarea value={commentBody} onChange={event => setCommentBody(event.target.value)} rows={2} className="w-full rounded border border-brand-stone px-2 py-1 text-xs" />
                <button type="button" onClick={() => commentMutation.mutate({ followupId: commentTargetId, body: commentBody })} className="w-full rounded border border-brand-stone px-2 py-1 text-xs">Comentar</button>
                {allComments.map(comment => <p key={comment.id} className="rounded border border-brand-stone p-1 text-[11px]">{comment.author?.full_name ?? comment.created_by}: {comment.body}</p>)}
              </div>
            )}
            {activeTab === 'history' && (
              <div className="space-y-1">
                {(followupsQuery.data?.history ?? []).map(item => (
                  <p key={item.id} className="rounded border border-brand-stone p-1 text-[11px]">{item.action} · {item.actor?.full_name ?? 'Sistema'} · {formatDateTime(item.created_at)}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsDrawerOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l border-brand-stone bg-white shadow-xl">
            <div className="border-b border-brand-stone px-5 py-4">
              <h3 className="text-lg font-semibold text-brand-navy">{editingEventId ? 'Editar cita' : 'Nueva cita CRM'}</h3>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
              <input value={form.title} onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))} placeholder="Título" className="w-full rounded border border-brand-stone px-3 py-2 text-sm" />
              <select value={form.contact_id} onChange={event => setForm(prev => ({ ...prev, contact_id: event.target.value, deal_id: '' }))} className="w-full rounded border border-brand-stone px-3 py-2 text-sm">
                <option value="">Contacto</option>
                {(metaQuery.data?.data.contacts ?? []).map(contact => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</option>)}
              </select>
              <select value={form.deal_id} onChange={event => setForm(prev => ({ ...prev, deal_id: event.target.value }))} className="w-full rounded border border-brand-stone px-3 py-2 text-sm">
                <option value="">Sin deal</option>
                {filteredDeals.map(deal => <option key={deal.id} value={deal.id}>{deal.title}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="datetime-local" value={form.start_local} onChange={event => setForm(prev => ({ ...prev, start_local: event.target.value }))} className="w-full rounded border border-brand-stone px-3 py-2 text-sm" />
                <input type="datetime-local" value={form.end_local} onChange={event => setForm(prev => ({ ...prev, end_local: event.target.value }))} className="w-full rounded border border-brand-stone px-3 py-2 text-sm" />
              </div>
              <textarea value={form.description} onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))} rows={3} className="w-full rounded border border-brand-stone px-3 py-2 text-sm" placeholder="Notas" />
              <div className="max-h-36 space-y-1 overflow-y-auto rounded border border-brand-stone p-2">
                {(metaQuery.data?.data.users ?? []).map(user => (
                  <label key={user.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={form.attendee_user_ids.includes(user.id)}
                      onChange={() => setForm(prev => ({ ...prev, attendee_user_ids: prev.attendee_user_ids.includes(user.id) ? prev.attendee_user_ids.filter(id => id !== user.id) : [...prev.attendee_user_ids, user.id] }))}
                    />
                    {user.full_name ?? user.email ?? user.id}
                  </label>
                ))}
              </div>
              {eventError && <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">{eventError}</p>}
            </div>
            <div className="flex gap-2 border-t border-brand-stone px-5 py-4">
              <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 rounded border border-brand-stone px-3 py-2 text-sm">Cerrar</button>
              <button type="button" onClick={saveEvent} disabled={createEventMutation.isPending || patchEventMutation.isPending} className="flex-1 rounded bg-brand-navy px-3 py-2 text-sm text-white disabled:opacity-50">
                {(createEventMutation.isPending || patchEventMutation.isPending) ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (editingEventId ? 'Guardar' : 'Crear')}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
