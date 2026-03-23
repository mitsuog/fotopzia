import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  detectEventConflict,
  getCalendarActor,
  replaceEventAttendees,
  replaceEventReminders,
  validateEventPayload,
} from '@/lib/crm-calendar/server'

interface EventListItem {
  id: string
  title: string
  start_at: string
  end_at: string
  all_day: boolean
  location: string | null
  video_url: string | null
  description: string | null
  status: 'tentative' | 'confirmed' | 'cancelled'
  contact_id: string | null
  deal_id: string | null
  created_by: string
  contact: {
    id: string
    first_name: string
    last_name: string
    company_name: string | null
    email: string | null
  } | null
  deal: {
    id: string
    title: string
  } | null
  collaborators: Array<{
    user_id: string
    full_name: string | null
    email: string | null
    role: string | null
  }>
}

function parseIso(value: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export async function GET(request: Request) {
  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const start = parseIso(url.searchParams.get('start'))
  const end = parseIso(url.searchParams.get('end'))
  const view = url.searchParams.get('view')
  const assigneeId = url.searchParams.get('assigneeId')?.trim() ?? ''
  const contactId = url.searchParams.get('contactId')?.trim() ?? ''
  const mine = url.searchParams.get('mine') === '1'
  const includeCancelled = url.searchParams.get('includeCancelled') === '1'

  if (view && view !== 'day' && view !== 'week' && view !== 'month') {
    return NextResponse.json({ error: 'Parámetro de vista inválido. Usa day, week o month.' }, { status: 400 })
  }

  const rangeStart = start ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString()
  const rangeEnd = end ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 45).toISOString()

  const supabase = await createClient()

  let query = supabase
    .from('calendar_events')
    .select('id, title, start_at, end_at, all_day, location, video_url, description, status, contact_id, deal_id, created_by, contacts(id, first_name, last_name, company_name, email), deals(id, title)')
    .eq('type', 'meeting')
    .lt('start_at', rangeEnd)
    .gt('end_at', rangeStart)
    .order('start_at', { ascending: true })

  if (!includeCancelled) {
    query = query.neq('status', 'cancelled')
  }
  if (contactId) {
    query = query.eq('contact_id', contactId)
  }

  const { data: events, error: eventsError } = await query
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 400 })

  const eventIds = (events ?? []).map(event => event.id)
  const { data: attendees, error: attendeesError } = eventIds.length
    ? await supabase
      .from('event_attendees')
      .select('event_id, user_id')
      .in('event_id', eventIds)
      .not('user_id', 'is', null)
    : { data: [], error: null }

  if (attendeesError) return NextResponse.json({ error: attendeesError.message }, { status: 400 })

  const userIds = Array.from(new Set((attendees ?? []).map(row => row.user_id).filter((value): value is string => Boolean(value))))
  const { data: profiles, error: profilesError } = userIds.length
    ? await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', userIds)
    : { data: [], error: null }

  if (profilesError) return NextResponse.json({ error: profilesError.message }, { status: 400 })

  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]))
  const attendeesByEvent = new Map<string, string[]>()
  for (const attendee of attendees ?? []) {
    if (!attendee.user_id) continue
    const current = attendeesByEvent.get(attendee.event_id) ?? []
    current.push(attendee.user_id)
    attendeesByEvent.set(attendee.event_id, current)
  }

  const mapped: EventListItem[] = (events ?? []).map(event => {
    const attendeeIds = attendeesByEvent.get(event.id) ?? []
    const collaborators = attendeeIds.map(userId => {
      const profile = profileMap.get(userId)
      return {
        user_id: userId,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        role: profile?.role ?? null,
      }
    })

    return {
      id: event.id,
      title: event.title,
      start_at: event.start_at,
      end_at: event.end_at,
      all_day: event.all_day,
      location: event.location,
      video_url: event.video_url,
      description: event.description,
      status: event.status,
      contact_id: event.contact_id,
      deal_id: event.deal_id,
      created_by: event.created_by,
      contact: event.contacts
        ? {
          id: event.contacts.id,
          first_name: event.contacts.first_name,
          last_name: event.contacts.last_name,
          company_name: event.contacts.company_name,
          email: event.contacts.email,
        }
        : null,
      deal: event.deals
        ? {
          id: event.deals.id,
          title: event.deals.title,
        }
        : null,
      collaborators,
    }
  })

  const filtered = mapped.filter(event => {
    const participants = new Set<string>([event.created_by, ...event.collaborators.map(collaborator => collaborator.user_id)])
    if (mine && !participants.has(actor.userId)) return false
    if (assigneeId && !participants.has(assigneeId)) return false
    return true
  })

  return NextResponse.json({ data: filtered })
}

export async function POST(request: Request) {
  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const rawPayload = await request.json().catch(() => null)
  const { payload, error } = validateEventPayload(rawPayload)
  const requestedActivityType = typeof (rawPayload as { activity_type?: unknown } | null)?.activity_type === 'string'
    ? String((rawPayload as { activity_type?: unknown }).activity_type)
    : ''
  const activityType = requestedActivityType === 'call' ? 'call' : 'meeting'
  if (error || !payload) return NextResponse.json({ error: error ?? 'Payload inválido.' }, { status: 400 })

  const supabase = await createClient()
  const collaboratorIds = Array.from(new Set([actor.userId, ...payload.attendee_user_ids]))

  if (payload.attendee_user_ids.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, role, is_active')
      .in('id', payload.attendee_user_ids)

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 })

    const validUserIds = (users ?? [])
      .filter(user => user.is_active && (user.role === 'admin' || user.role === 'project_manager' || user.role === 'operator'))
      .map(user => user.id)

    const missing = payload.attendee_user_ids.filter(id => !validUserIds.includes(id))
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Hay colaboradores inválidos o inactivos en la cita.' }, { status: 400 })
    }
  }

  const { conflict, error: conflictError } = await detectEventConflict({
    startAtIso: payload.start_at,
    endAtIso: payload.end_at,
    collaboratorIds,
  })
  if (conflictError) return NextResponse.json({ error: conflictError.message }, { status: 400 })
  if (conflict) {
    return NextResponse.json(
      {
        error: 'Conflicto de agenda detectado para el colaborador.',
        conflict,
      },
      { status: 409 },
    )
  }

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('id, email')
    .eq('id', payload.contact_id)
    .single()

  if (contactError || !contact) {
    return NextResponse.json({ error: 'El contacto asociado no existe.' }, { status: 400 })
  }

  const { data: insertedEvent, error: eventError } = await supabase
    .from('calendar_events')
    .insert({
      type: 'meeting',
      title: payload.title,
      description: payload.description,
      location: payload.location,
      video_url: payload.video_url,
      contact_id: payload.contact_id,
      deal_id: payload.deal_id,
      start_at: payload.start_at,
      end_at: payload.end_at,
      all_day: payload.all_day,
      status: 'confirmed',
      created_by: actor.userId,
      color: '#2E3F5E',
    })
    .select('id, title, start_at, end_at, status')
    .single()

  if (eventError || !insertedEvent) {
    return NextResponse.json({ error: eventError?.message ?? 'No fue posible crear la cita.' }, { status: 400 })
  }

  const attendeesError = await replaceEventAttendees(insertedEvent.id, payload.attendee_user_ids)
  if (attendeesError) return NextResponse.json({ error: attendeesError.message }, { status: 400 })

  const remindersError = await replaceEventReminders({
    eventId: insertedEvent.id,
    startAtIso: payload.start_at,
    collaboratorUserIds: collaboratorIds,
    contactEmail: contact.email ?? null,
  })
  if (remindersError) return NextResponse.json({ error: remindersError.message }, { status: 400 })

  await supabase.from('activities').insert({
    type: activityType,
    contact_id: payload.contact_id,
    deal_id: payload.deal_id,
    subject: payload.title,
    body: payload.description ?? null,
    due_at: payload.start_at,
    created_by: actor.userId,
  })

  return NextResponse.json({
    data: {
      id: insertedEvent.id,
      title: insertedEvent.title,
      start_at: insertedEvent.start_at,
      end_at: insertedEvent.end_at,
      status: insertedEvent.status,
    },
  })
}

