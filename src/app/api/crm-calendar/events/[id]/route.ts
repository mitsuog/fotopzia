import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  canManageEvent,
  detectEventConflict,
  getCalendarActor,
  getEventById,
  replaceEventAttendees,
  replaceEventReminders,
  validateEventPayload,
} from '@/lib/crm-calendar/server'

function parsePatchPayload(rawPayload: unknown, previous: {
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
}) {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return validateEventPayload(previous)
  }

  const source = rawPayload as Record<string, unknown>

  const nextRaw = {
    title: source.title ?? previous.title,
    description: source.description ?? previous.description ?? '',
    location: source.location ?? previous.location ?? '',
    video_url: source.video_url ?? previous.video_url ?? '',
    contact_id: source.contact_id ?? previous.contact_id,
    deal_id: source.deal_id ?? previous.deal_id ?? '',
    all_day: source.all_day ?? previous.all_day,
    start_at: source.start_at ?? previous.start_at,
    end_at: source.end_at ?? previous.end_at,
    attendee_user_ids: source.attendee_user_ids ?? previous.attendee_user_ids,
  }

  return validateEventPayload(nextRaw)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const permission = await canManageEvent(actor, id)
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason ?? 'Forbidden' }, { status: 403 })
  }

  const { event, attendeeUserIds, error: eventError } = await getEventById(id)
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 400 })
  if (!event) return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 })

  const rawPayload = await request.json().catch(() => null)
  const { payload, error: payloadError } = parsePatchPayload(rawPayload, {
    title: event.title,
    description: event.description,
    location: event.location,
    video_url: event.video_url,
    contact_id: event.contact_id ?? '',
    deal_id: event.deal_id,
    all_day: event.all_day,
    start_at: event.start_at,
    end_at: event.end_at,
    attendee_user_ids: attendeeUserIds,
  })

  if (payloadError || !payload) {
    return NextResponse.json({ error: payloadError ?? 'Payload inválido.' }, { status: 400 })
  }

  const supabase = await createClient()

  if (payload.attendee_user_ids.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, role, is_active')
      .in('id', payload.attendee_user_ids)
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 })

    const validUserIds = (users ?? [])
      .filter(user => user.is_active && (user.role === 'admin' || user.role === 'project_manager' || user.role === 'operator'))
      .map(user => user.id)

    const missing = payload.attendee_user_ids.filter(userId => !validUserIds.includes(userId))
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Hay colaboradores inválidos o inactivos en la cita.' }, { status: 400 })
    }
  }

  const collaboratorIds = Array.from(new Set([event.created_by, ...payload.attendee_user_ids]))
  const { conflict, error: conflictError } = await detectEventConflict({
    startAtIso: payload.start_at,
    endAtIso: payload.end_at,
    collaboratorIds,
    ignoreEventId: id,
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

  const { data: updatedEvent, error: updateError } = await supabase
    .from('calendar_events')
    .update({
      title: payload.title,
      description: payload.description,
      location: payload.location,
      video_url: payload.video_url,
      contact_id: payload.contact_id,
      deal_id: payload.deal_id,
      all_day: payload.all_day,
      start_at: payload.start_at,
      end_at: payload.end_at,
    })
    .eq('id', id)
    .eq('type', 'meeting')
    .select('id, title, start_at, end_at, status')
    .single()

  if (updateError || !updatedEvent) {
    return NextResponse.json({ error: updateError?.message ?? 'No fue posible actualizar la cita.' }, { status: 400 })
  }

  const attendeesError = await replaceEventAttendees(id, payload.attendee_user_ids)
  if (attendeesError) return NextResponse.json({ error: attendeesError.message }, { status: 400 })

  const remindersError = await replaceEventReminders({
    eventId: id,
    startAtIso: payload.start_at,
    collaboratorUserIds: collaboratorIds,
    contactEmail: contact.email ?? null,
  })
  if (remindersError) return NextResponse.json({ error: remindersError.message }, { status: 400 })

  return NextResponse.json({ data: updatedEvent })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const permission = await canManageEvent(actor, id)
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason ?? 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  const { data: updatedEvent, error: cancelError } = await supabase
    .from('calendar_events')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('type', 'meeting')
    .select('id, title, status')
    .single()

  if (cancelError || !updatedEvent) {
    return NextResponse.json({ error: cancelError?.message ?? 'No fue posible cancelar la cita.' }, { status: 400 })
  }

  const remindersTable = supabase.from('crm_event_reminders' as never)
  const { error: reminderError } = await remindersTable
    .update({ status: 'cancelled' })
    .eq('event_id', id)
    .eq('status', 'pending')

  if (reminderError) return NextResponse.json({ error: reminderError.message }, { status: 400 })

  return NextResponse.json({ data: updatedEvent })
}
