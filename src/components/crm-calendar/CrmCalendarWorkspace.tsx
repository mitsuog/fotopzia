'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, ChevronLeft, ChevronRight, Loader2, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type CalendarViewType = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth' | 'listWeek'
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

const STATUS_LABELS: Record<CrmEvent['status'], string> = {
  confirmed: 'Confirmada',
  tentative: 'Tentativa',
  cancelled: 'Cancelada',
}

const STATUS_CLASSES: Record<CrmEvent['status'], string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  tentative: 'bg-amber-100 text-amber-700',
  cancelled: 'bg-red-100 text-red-700',
}

export function CrmCalendarWorkspace() {
  const queryClient = useQueryClient()
  const calendarRef = useRef<FullCalendar>(null)

  const [calendarView, setCalendarView] = useState<CalendarViewType>('timeGridWeek')
  const [viewTitle, setViewTitle] = useState('')
  const [rangeStart, setRangeStart] = useState(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
  const [rangeEnd, setRangeEnd] = useState(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [contactFilter, setContactFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [mineOnly, setMineOnly] = useState(false)
  const [teamOverlay, setTeamOverlay] = useState(true)
  const [filterOpen, setFilterOpen] = useState(false)

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

  // Switch to list view on mobile
  useEffect(() => {
    if (window.innerWidth < 1024) setCalendarView('listWeek')
  }, [])

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

  // Tab content only — used in both desktop sidebar and mobile bottom sheet
  function renderTabContent() {
    if (!selectedEvent) return null
    return (
      <>
        {activeTab === 'summary' && (
          <div className="space-y-2 text-xs">
            <p><strong>Cliente:</strong> {selectedEvent.contact ? `${selectedEvent.contact.first_name} ${selectedEvent.contact.last_name}` : 'N/A'}</p>
            <p><strong>Estado:</strong> {STATUS_LABELS[selectedEvent.status]}</p>
            <p><strong>Inicio:</strong> {formatDateTime(selectedEvent.start_at)}</p>
            <p><strong>Fin:</strong> {formatDateTime(selectedEvent.end_at)}</p>
            {selectedEvent.description && <p className="text-gray-500">{selectedEvent.description}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => openEdit(selectedEvent)} className="rounded-md border border-brand-stone px-3 py-1.5 text-xs">Editar</button>
              <button type="button" onClick={() => cancelEventMutation.mutate(selectedEvent.id)} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">Cancelar cita</button>
            </div>
          </div>
        )}
        {activeTab === 'followups' && (
          <div className="space-y-2">
            <div className="rounded-md border border-brand-stone p-2">
              <input value={newFollowupTitle} onChange={event => setNewFollowupTitle(event.target.value)} placeholder="Nuevo seguimiento" className="mb-1 w-full rounded border border-brand-stone px-2 py-1 text-xs" />
              <div className="mb-1 grid grid-cols-2 gap-1">
                <select value={newFollowupStatus} onChange={event => setNewFollowupStatus(event.target.value as FollowupStatus)} className="rounded border border-brand-stone px-2 py-1 text-xs"><option value="todo">Por hacer</option><option value="in_progress">En progreso</option><option value="blocked">Bloqueado</option><option value="done">Listo</option></select>
                <select value={newFollowupPriority} onChange={event => setNewFollowupPriority(event.target.value as FollowupPriority)} className="rounded border border-brand-stone px-2 py-1 text-xs"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option></select>
              </div>
              <button type="button" onClick={() => createFollowupMutation.mutate({ title: newFollowupTitle, status: newFollowupStatus, priority: newFollowupPriority })} className="w-full rounded bg-brand-navy px-2 py-1 text-xs text-white">Crear</button>
            </div>
            {(followupsQuery.data?.data ?? []).map(followup => (
              <div key={followup.id} className="rounded-md border border-brand-stone p-2">
                <p className="text-xs font-semibold">{followup.title}</p>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  <select value={followup.status} onChange={event => updateFollowupMutation.mutate({ id: followup.id, payload: { status: event.target.value } })} className="rounded border border-brand-stone px-2 py-1 text-xs"><option value="todo">Por hacer</option><option value="in_progress">En progreso</option><option value="blocked">Bloqueado</option><option value="done">Listo</option></select>
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
      </>
    )
  }

  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'summary', label: 'Resumen' },
    { key: 'followups', label: 'Seguimientos' },
    { key: 'notes', label: 'Notas' },
    { key: 'history', label: 'Historial' },
  ]

  const hasActiveFilters = Boolean(contactFilter || assigneeFilter || mineOnly)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

      {/* === MOBILE ONLY: top nav bar === */}
      <div className="flex items-center gap-2 lg:hidden">
        <button
          type="button"
          onClick={() => setSearchOpen(v => !v)}
          className="shrink-0 rounded-lg border border-brand-stone bg-white p-2"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4 text-brand-navy" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().prev()}
            className="rounded-lg p-1.5 hover:bg-brand-canvas"
          >
            <ChevronLeft className="h-4 w-4 text-brand-navy" />
          </button>
          <span className="min-w-0 text-center text-sm font-semibold text-brand-navy">{viewTitle}</span>
          <button
            type="button"
            onClick={() => calendarRef.current?.getApi().next()}
            className="rounded-lg p-1.5 hover:bg-brand-canvas"
          >
            <ChevronRight className="h-4 w-4 text-brand-navy" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="relative shrink-0 rounded-lg border border-brand-stone bg-white p-2"
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-4 w-4 text-brand-navy" />
          {hasActiveFilters && (
            <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand-gold" />
          )}
        </button>
      </div>

      {/* === MOBILE ONLY: collapsible search bar === */}
      {searchOpen && (
        <div className="relative lg:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-brand-stone py-2 pl-8 pr-3 text-sm"
            placeholder="Buscar cita..."
            autoFocus
          />
        </div>
      )}

      {/* === MOBILE ONLY: view pills === */}
      <div className="flex overflow-hidden rounded-full border border-brand-stone bg-white text-xs lg:hidden">
        {([
          { view: 'listWeek' as CalendarViewType, label: 'Lista' },
          { view: 'timeGridWeek' as CalendarViewType, label: 'Semana' },
          { view: 'timeGridDay' as CalendarViewType, label: 'Día' },
        ]).map(({ view, label }) => (
          <button
            key={view}
            type="button"
            onClick={() => setCalendarView(view)}
            className={cn(
              'flex-1 py-1.5 font-medium transition-colors',
              calendarView === view ? 'bg-brand-navy text-white' : 'text-gray-600',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* === DESKTOP ONLY: left sidebar === */}
      <section className="hidden rounded-xl border border-brand-stone bg-white p-4 lg:block lg:col-span-3">
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

      {/* === CALENDAR — shared, responsive col-span === */}
      <section className="rounded-xl border border-brand-stone bg-white p-4 lg:col-span-6">
        {/* Desktop view pills */}
        <div className="mb-2 hidden gap-2 lg:flex">
          {(['timeGridDay', 'timeGridWeek', 'dayGridMonth'] as CalendarViewType[]).map(view => (
            <button key={view} type="button" onClick={() => setCalendarView(view)} className={cn('rounded-md px-3 py-1 text-xs', calendarView === view ? 'bg-brand-navy text-white' : 'bg-brand-paper text-gray-600')}>
              {view === 'timeGridDay' ? 'Día' : view === 'timeGridWeek' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
        <FullCalendar
          ref={calendarRef}
          key={calendarView}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={calendarView}
          locale="es"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
          events={calendarEvents}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          nowIndicator
          datesSet={(arg) => {
            setRangeStart(arg.start.toISOString())
            setRangeEnd(arg.end.toISOString())
            setCalendarView(arg.view.type as CalendarViewType)
            setViewTitle(arg.view.title)
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

      {/* === DESKTOP ONLY: right sidebar — event detail === */}
      <section className="hidden rounded-xl border border-brand-stone bg-white p-4 lg:block lg:col-span-3">
        {selectedEvent ? (
          <>
            {/* Event header card */}
            <div className="mb-3 rounded-lg border border-brand-stone p-3">
              <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[selectedEvent.status])}>
                {STATUS_LABELS[selectedEvent.status]}
              </span>
              <p className="mt-1 text-sm font-semibold text-brand-navy">{selectedEvent.title}</p>
              <p className="text-xs text-gray-600">{formatDateTime(selectedEvent.start_at)} — {formatDateTime(selectedEvent.end_at)}</p>
            </div>
            {/* Tab bar */}
            <div className="mb-3 flex gap-1 rounded-lg border border-brand-stone bg-brand-paper p-1">
              {tabs.map(tab => (
                <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={cn('flex-1 rounded-md px-2 py-1 text-[11px]', activeTab === tab.key ? 'bg-brand-navy text-white' : 'text-gray-600')}>
                  {tab.label}
                </button>
              ))}
            </div>
            {renderTabContent()}
          </>
        ) : (
          <p className="text-xs text-gray-400">Selecciona una cita para ver los detalles.</p>
        )}
      </section>

      {/* === MOBILE ONLY: FAB === */}
      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-6 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-navy shadow-xl lg:hidden"
        aria-label="Nueva cita"
      >
        <Plus className="h-6 w-6 text-white" />
      </button>

      {/* === MOBILE ONLY: Filter bottom sheet === */}
      {filterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFilterOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-center py-3">
              <div className="h-1.5 w-10 rounded-full bg-brand-stone" />
            </div>
            <div className="px-4 pb-6 space-y-3">
              <h3 className="font-semibold text-brand-navy">Filtrar citas</h3>
              <select value={contactFilter} onChange={e => setContactFilter(e.target.value)} className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm">
                <option value="">Todos los contactos</option>
                {(metaQuery.data?.data.contacts ?? []).map(contact => <option key={contact.id} value={contact.id}>{contact.first_name} {contact.last_name}</option>)}
              </select>
              <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm">
                <option value="">Todo el equipo</option>
                {(metaQuery.data?.data.users ?? []).map(user => <option key={user.id} value={user.id}>{user.full_name ?? user.email ?? user.id}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mineOnly} onChange={e => setMineOnly(e.target.checked)} />Solo mis citas</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={teamOverlay} onChange={e => setTeamOverlay(e.target.checked)} />Overlay por colaborador</label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setContactFilter(''); setAssigneeFilter(''); setMineOnly(false); setFilterOpen(false) }}
                  className="flex-1 rounded-lg border border-brand-stone py-2 text-sm"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="flex-1 rounded-lg bg-brand-navy py-2 text-sm text-white"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MOBILE ONLY: Event detail bottom sheet === */}
      {selectedEvent && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={clearSelection} />
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[75vh] flex-col rounded-t-2xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-300">
            {/* Drag handle */}
            <div className="flex shrink-0 justify-center py-3">
              <div className="h-1.5 w-10 rounded-full bg-brand-stone" />
            </div>
            {/* Header */}
            <div className="flex shrink-0 items-start gap-3 px-4 pb-3">
              <div className="min-w-0 flex-1">
                <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_CLASSES[selectedEvent.status])}>
                  {STATUS_LABELS[selectedEvent.status]}
                </span>
                <p className="mt-1 text-base font-semibold text-brand-navy">{selectedEvent.title}</p>
                <p className="text-sm text-gray-500">{formatDateTime(selectedEvent.start_at)} — {formatDateTime(selectedEvent.end_at)}</p>
              </div>
              <button type="button" onClick={clearSelection} className="shrink-0 rounded-lg p-1.5 hover:bg-brand-canvas">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            {/* Tab bar — pill style */}
            <div className="shrink-0 px-4 pb-2">
              <div className="flex rounded-xl border border-brand-stone bg-brand-canvas p-1">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                      activeTab === tab.key ? 'bg-white text-brand-navy shadow-sm' : 'text-gray-500',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {renderTabContent()}
            </div>
          </div>
        </div>
      )}

      {/* === Create/Edit Drawer === */}
      {isDrawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsDrawerOpen(false)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-full sm:max-w-lg flex-col border-l border-brand-stone bg-white shadow-xl">
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
