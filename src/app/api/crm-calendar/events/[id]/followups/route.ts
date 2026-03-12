import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageEvent, getCalendarActor, getEventById } from '@/lib/crm-calendar/server'

type FollowupStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
type FollowupPriority = 'low' | 'medium' | 'high' | 'critical'

function isValidStatus(value: string): value is FollowupStatus {
  return value === 'todo' || value === 'in_progress' || value === 'blocked' || value === 'done'
}

function isValidPriority(value: string): value is FollowupPriority {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { event, error: eventError } = await getEventById(id)
  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 400 })
  if (!event) return NextResponse.json({ error: 'Evento no encontrado.' }, { status: 404 })

  const supabase = await createClient()

  const followupTable = supabase.from('crm_event_followups' as never)
  const commentTable = supabase.from('crm_event_followup_comments' as never)
  const logTable = supabase.from('crm_event_followup_log' as never)

  const { data: followups, error: followupsError } = await followupTable
    .select('id, event_id, title, description, status, priority, assignee_id, due_at, closed_at, created_by, created_at, updated_at')
    .eq('event_id', id)
    .order('created_at', { ascending: false })

  if (followupsError) return NextResponse.json({ error: followupsError.message }, { status: 400 })

  const followupRows = (followups ?? []) as Array<{
    id: string
    event_id: string
    title: string
    description: string | null
    status: FollowupStatus
    priority: FollowupPriority
    assignee_id: string | null
    due_at: string | null
    closed_at: string | null
    created_by: string
    created_at: string
    updated_at: string
  }>

  const followupIds = followupRows.map(row => row.id)
  const profileIds = Array.from(
    new Set(
      followupRows
        .flatMap(row => [row.created_by, row.assignee_id])
        .filter((value): value is string => Boolean(value)),
    ),
  )

  const [{ data: profiles }, { data: comments, error: commentsError }, { data: logs, error: logsError }] = await Promise.all([
    profileIds.length
      ? supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('id', profileIds)
      : Promise.resolve({ data: [] }),
    followupIds.length
      ? commentTable
        .select('id, followup_id, body, created_by, created_at')
        .in('followup_id', followupIds)
        .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as unknown[], error: null }),
    followupIds.length
      ? logTable
        .select('id, followup_id, event_id, action, payload, actor_id, created_at')
        .in('followup_id', followupIds)
        .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as unknown[], error: null }),
  ])

  if (commentsError) return NextResponse.json({ error: commentsError.message }, { status: 400 })
  if (logsError) return NextResponse.json({ error: logsError.message }, { status: 400 })

  const commentsRows = (comments ?? []) as Array<{
    id: string
    followup_id: string
    body: string
    created_by: string
    created_at: string
  }>

  const logsRows = (logs ?? []) as Array<{
    id: string
    followup_id: string
    event_id: string
    action: string
    payload: Record<string, unknown>
    actor_id: string | null
    created_at: string
  }>

  const allProfileIds = Array.from(
    new Set([
      ...profileIds,
      ...commentsRows.map(row => row.created_by),
      ...logsRows.map(row => row.actor_id).filter((value): value is string => Boolean(value)),
    ]),
  )

  let profileMap = new Map<string, { id: string; full_name: string | null; email: string | null; role: string | null }>()
  if (allProfileIds.length > 0) {
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .in('id', allProfileIds)
    if (allProfilesError) return NextResponse.json({ error: allProfilesError.message }, { status: 400 })
    profileMap = new Map((allProfiles ?? []).map(profile => [profile.id, profile]))
  } else {
    profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]))
  }

  const commentsByFollowup = new Map<string, typeof commentsRows>()
  for (const row of commentsRows) {
    const current = commentsByFollowup.get(row.followup_id) ?? []
    current.push(row)
    commentsByFollowup.set(row.followup_id, current)
  }

  const logsByFollowup = new Map<string, typeof logsRows>()
  for (const row of logsRows) {
    const current = logsByFollowup.get(row.followup_id) ?? []
    current.push(row)
    logsByFollowup.set(row.followup_id, current)
  }

  const data = followupRows.map(row => ({
    ...row,
    assignee: row.assignee_id ? profileMap.get(row.assignee_id) ?? null : null,
    creator: profileMap.get(row.created_by) ?? null,
    comments: (commentsByFollowup.get(row.id) ?? []).map(comment => ({
      ...comment,
      author: profileMap.get(comment.created_by) ?? null,
    })),
    logs: (logsByFollowup.get(row.id) ?? []).map(log => ({
      ...log,
      actor: log.actor_id ? profileMap.get(log.actor_id) ?? null : null,
    })),
  }))

  return NextResponse.json({
    data,
    history: logsRows
      .map(log => ({
        ...log,
        actor: log.actor_id ? profileMap.get(log.actor_id) ?? null : null,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
  })
}

export async function POST(
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

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  const title = String(payload?.title ?? '').trim()
  const status = String(payload?.status ?? 'todo').trim()
  const priority = String(payload?.priority ?? 'medium').trim()
  const dueAt = payload?.due_at ? String(payload.due_at) : null
  const description = String(payload?.description ?? '').trim() || null
  const assigneeId = String(payload?.assignee_id ?? '').trim() || null

  if (!title) return NextResponse.json({ error: 'El título del seguimiento es obligatorio.' }, { status: 400 })
  if (!isValidStatus(status)) return NextResponse.json({ error: 'Estado de seguimiento inválido.' }, { status: 400 })
  if (!isValidPriority(priority)) return NextResponse.json({ error: 'Prioridad inválida.' }, { status: 400 })

  if (dueAt && Number.isNaN(new Date(dueAt).getTime())) {
    return NextResponse.json({ error: 'Fecha límite inválida.' }, { status: 400 })
  }

  const supabase = await createClient()

  if (assigneeId) {
    const { data: assignee, error: assigneeError } = await supabase
      .from('profiles')
      .select('id, role, is_active')
      .eq('id', assigneeId)
      .single()
    if (assigneeError || !assignee) {
      return NextResponse.json({ error: 'Responsable no encontrado.' }, { status: 400 })
    }
    if (
      !assignee.is_active ||
      (assignee.role !== 'admin' && assignee.role !== 'project_manager' && assignee.role !== 'operator')
    ) {
      return NextResponse.json({ error: 'Responsable inválido para agenda CRM.' }, { status: 400 })
    }
  }

  const followupTable = supabase.from('crm_event_followups' as never)
  const { data, error } = await followupTable
    .insert({
      event_id: id,
      title,
      description,
      status,
      priority,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      assignee_id: assigneeId,
      created_by: actor.userId,
    })
    .select('id, event_id, title, description, status, priority, due_at, assignee_id, created_at, updated_at, closed_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No fue posible crear el seguimiento.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}
