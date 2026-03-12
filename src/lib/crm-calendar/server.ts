import { createClient } from '@/lib/supabase/server'
import type { PostgrestError } from '@supabase/supabase-js'

type InternalRole = 'admin' | 'project_manager' | 'operator'

export interface CalendarActor {
  userId: string
  role: InternalRole
  fullName: string | null
  email: string | null
}

export interface NormalizedEventPayload {
  title: string
  description: string | null
  location: string | null
  video_url: string | null
  contact_id: string
  deal_id: string | null
  all_day: boolean
  start_at: string
  end_at: string
  attendee_user_ids: string[]
}

export interface CalendarEventRow {
  id: string
  type: 'meeting' | 'production_session'
  status: 'tentative' | 'confirmed' | 'cancelled'
  title: string
  description: string | null
  location: string | null
  video_url: string | null
  start_at: string
  end_at: string
  all_day: boolean
  contact_id: string | null
  deal_id: string | null
  created_by: string
}

export interface ReminderInsertRow {
  event_id: string
  channel: 'in_app' | 'email'
  send_at: string
  offset_minutes: number
  recipient_user_id: string | null
  recipient_email: string | null
}

export interface EventPermissionResult {
  allowed: boolean
  reason?: string
}

function asUnknownTableClient<T extends string>(supabase: Awaited<ReturnType<typeof createClient>>, table: T) {
  return supabase.from(table as never)
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

export function isInternalRole(role: string | null | undefined): role is InternalRole {
  return role === 'admin' || role === 'project_manager' || role === 'operator'
}

export async function getCalendarActor(): Promise<{ actor: CalendarActor | null; error: PostgrestError | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { actor: null, error: null }
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', user.id)
    .single()

  if (error) return { actor: null, error }

  if (!isInternalRole(profile?.role)) {
    return { actor: null, error: null }
  }

  return {
    actor: {
      userId: user.id,
      role: profile.role,
      fullName: profile.full_name ?? null,
      email: profile.email ?? user.email ?? null,
    },
    error: null,
  }
}

export async function getEventById(eventId: string): Promise<{
  event: CalendarEventRow | null
  attendeeUserIds: string[]
  error: PostgrestError | null
}> {
  const supabase = await createClient()
  const { data: event, error } = await supabase
    .from('calendar_events')
    .select('id, type, status, title, description, location, video_url, start_at, end_at, all_day, contact_id, deal_id, created_by')
    .eq('id', eventId)
    .eq('type', 'meeting')
    .single()

  if (error || !event) return { event: null, attendeeUserIds: [], error }

  const { data: attendees } = await supabase
    .from('event_attendees')
    .select('user_id')
    .eq('event_id', eventId)
    .not('user_id', 'is', null)

  return {
    event: event as CalendarEventRow,
    attendeeUserIds: dedupe((attendees ?? []).map(row => row.user_id).filter((value): value is string => Boolean(value))),
    error: null,
  }
}

export function validateEventPayload(rawPayload: unknown): { payload: NormalizedEventPayload | null; error: string | null } {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return { payload: null, error: 'Payload inválido.' }
  }

  const payload = rawPayload as Record<string, unknown>
  const title = String(payload.title ?? '').trim()
  const contactId = String(payload.contact_id ?? '').trim()
  const startAt = String(payload.start_at ?? '').trim()
  const endAt = String(payload.end_at ?? '').trim()

  if (!title) return { payload: null, error: 'El título es obligatorio.' }
  if (!contactId) return { payload: null, error: 'La cita CRM requiere un contacto.' }

  const startDate = new Date(startAt)
  const endDate = new Date(endAt)
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { payload: null, error: 'Rango horario inválido.' }
  }
  if (endDate <= startDate) {
    return { payload: null, error: 'La hora de fin debe ser mayor a la hora de inicio.' }
  }

  const attendeeUserIds = Array.isArray(payload.attendee_user_ids)
    ? dedupe(payload.attendee_user_ids.map(value => String(value)).filter(Boolean))
    : []

  return {
    payload: {
      title,
      description: String(payload.description ?? '').trim() || null,
      location: String(payload.location ?? '').trim() || null,
      video_url: String(payload.video_url ?? '').trim() || null,
      contact_id: contactId,
      deal_id: String(payload.deal_id ?? '').trim() || null,
      all_day: Boolean(payload.all_day),
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
      attendee_user_ids: attendeeUserIds,
    },
    error: null,
  }
}

export async function canManageEvent(actor: CalendarActor, eventId: string): Promise<EventPermissionResult> {
  if (actor.role === 'admin' || actor.role === 'project_manager') {
    return { allowed: true }
  }

  const { event, attendeeUserIds } = await getEventById(eventId)
  if (!event) {
    return { allowed: false, reason: 'Evento no encontrado.' }
  }

  if (event.created_by === actor.userId) {
    return { allowed: true }
  }

  if (attendeeUserIds.includes(actor.userId)) {
    return { allowed: true }
  }

  return { allowed: false, reason: 'Sin permisos para gestionar esta cita.' }
}

export async function replaceEventAttendees(eventId: string, attendeeUserIds: string[]): Promise<PostgrestError | null> {
  const supabase = await createClient()
  const uniqueIds = dedupe(attendeeUserIds)

  const { error: deleteError } = await supabase
    .from('event_attendees')
    .delete()
    .eq('event_id', eventId)

  if (deleteError) return deleteError

  if (uniqueIds.length === 0) return null

  const { data: users, error: usersError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', uniqueIds)

  if (usersError) return usersError

  const rows = (users ?? []).map(user => ({
    event_id: eventId,
    user_id: user.id,
    name: user.full_name ?? null,
    email: user.email ?? null,
    rsvp: 'pending' as const,
  }))

  if (rows.length === 0) return null

  const { error: insertError } = await supabase
    .from('event_attendees')
    .insert(rows)

  return insertError
}

export async function detectEventConflict(input: {
  startAtIso: string
  endAtIso: string
  collaboratorIds: string[]
  ignoreEventId?: string
}): Promise<{ conflict: { id: string; title: string; start_at: string; end_at: string } | null; error: PostgrestError | null }> {
  const supabase = await createClient()
  const collaboratorIds = dedupe(input.collaboratorIds)
  if (collaboratorIds.length === 0) return { conflict: null, error: null }

  let query = supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, created_by, event_attendees(user_id)')
    .eq('type', 'meeting')
    .neq('status', 'cancelled')
    .lt('start_at', input.endAtIso)
    .gt('end_at', input.startAtIso)

  if (input.ignoreEventId) {
    query = query.neq('id', input.ignoreEventId)
  }

  const { data, error } = await query
  if (error) return { conflict: null, error }

  const conflict = (data ?? []).find(event => {
    const attendeeIds = (event.event_attendees ?? [])
      .map(row => row.user_id)
      .filter((value): value is string => Boolean(value))

    const participants = new Set<string>([event.created_by, ...attendeeIds].filter(Boolean))
    return collaboratorIds.some(id => participants.has(id))
  })

  if (!conflict) return { conflict: null, error: null }

  return {
    conflict: {
      id: String(conflict.id),
      title: String(conflict.title),
      start_at: String(conflict.start_at),
      end_at: String(conflict.end_at),
    },
    error: null,
  }
}

export async function replaceEventReminders(input: {
  eventId: string
  startAtIso: string
  collaboratorUserIds: string[]
  contactEmail: string | null
}): Promise<PostgrestError | null> {
  const supabase = await createClient()
  const reminders = asUnknownTableClient(supabase, 'crm_event_reminders')
  const sendAt = new Date(input.startAtIso)

  if (Number.isNaN(sendAt.getTime())) {
    return null
  }

  const minus24h = new Date(sendAt)
  minus24h.setHours(minus24h.getHours() - 24)
  const minus1h = new Date(sendAt)
  minus1h.setHours(minus1h.getHours() - 1)

  const { error: cancelError } = await reminders
    .update({ status: 'cancelled' })
    .eq('event_id', input.eventId)
    .eq('status', 'pending')

  if (cancelError) return cancelError

  const rows: ReminderInsertRow[] = []
  const collaboratorIds = dedupe(input.collaboratorUserIds)
  for (const userId of collaboratorIds) {
    rows.push(
      {
        event_id: input.eventId,
        channel: 'in_app',
        send_at: minus24h.toISOString(),
        offset_minutes: -1440,
        recipient_user_id: userId,
        recipient_email: null,
      },
      {
        event_id: input.eventId,
        channel: 'in_app',
        send_at: minus1h.toISOString(),
        offset_minutes: -60,
        recipient_user_id: userId,
        recipient_email: null,
      },
    )
  }

  if (input.contactEmail) {
    rows.push(
      {
        event_id: input.eventId,
        channel: 'email',
        send_at: minus24h.toISOString(),
        offset_minutes: -1440,
        recipient_user_id: null,
        recipient_email: input.contactEmail,
      },
      {
        event_id: input.eventId,
        channel: 'email',
        send_at: minus1h.toISOString(),
        offset_minutes: -60,
        recipient_user_id: null,
        recipient_email: input.contactEmail,
      },
    )
  }

  if (rows.length === 0) return null

  const { error: insertError } = await reminders.insert(rows as unknown as Record<string, unknown>[])
  return insertError
}
