import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageEvent, getCalendarActor } from '@/lib/crm-calendar/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  const body = String(payload?.body ?? '').trim()
  if (!body) return NextResponse.json({ error: 'El comentario no puede estar vacío.' }, { status: 400 })

  const supabase = await createClient()
  const followupTable = supabase.from('crm_event_followups' as never)
  const commentTable = supabase.from('crm_event_followup_comments' as never)
  const logTable = supabase.from('crm_event_followup_log' as never)

  const { data: followup, error: followupError } = await followupTable
    .select('id, event_id')
    .eq('id', id)
    .single()

  if (followupError || !followup) {
    return NextResponse.json({ error: 'Seguimiento no encontrado.' }, { status: 404 })
  }

  const eventId = String((followup as { event_id: string }).event_id)
  const permission = await canManageEvent(actor, eventId)
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason ?? 'Forbidden' }, { status: 403 })
  }

  const { data: insertedComment, error: commentError } = await commentTable
    .insert({
      followup_id: id,
      body,
      created_by: actor.userId,
    })
    .select('id, followup_id, body, created_by, created_at')
    .single()

  if (commentError || !insertedComment) {
    return NextResponse.json({ error: commentError?.message ?? 'No fue posible guardar el comentario.' }, { status: 400 })
  }

  await logTable.insert({
    followup_id: id,
    event_id: eventId,
    action: 'commented',
    payload: {
      body_preview: body.slice(0, 140),
    },
    actor_id: actor.userId,
  })

  const { data: author } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('id', actor.userId)
    .single()

  return NextResponse.json({
    data: {
      ...(insertedComment as {
        id: string
        followup_id: string
        body: string
        created_by: string
        created_at: string
      }),
      author: author ?? null,
    },
  })
}
