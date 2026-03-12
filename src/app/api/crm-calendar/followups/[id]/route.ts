import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { canManageEvent, getCalendarActor } from '@/lib/crm-calendar/server'

type FollowupStatus = 'todo' | 'in_progress' | 'blocked' | 'done'
type FollowupPriority = 'low' | 'medium' | 'high' | 'critical'

function isValidStatus(value: string): value is FollowupStatus {
  return value === 'todo' || value === 'in_progress' || value === 'blocked' || value === 'done'
}

function isValidPriority(value: string): value is FollowupPriority {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'critical'
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()
  const followupTable = supabase.from('crm_event_followups' as never)

  const { data: currentRow, error: currentError } = await followupTable
    .select('id, event_id, title, description, status, priority, assignee_id, due_at')
    .eq('id', id)
    .single()

  if (currentError || !currentRow) {
    return NextResponse.json({ error: 'Seguimiento no encontrado.' }, { status: 404 })
  }

  const current = currentRow as {
    id: string
    event_id: string
    title: string
    description: string | null
    status: FollowupStatus
    priority: FollowupPriority
    assignee_id: string | null
    due_at: string | null
  }

  const permission = await canManageEvent(actor, current.event_id)
  if (!permission.allowed) {
    return NextResponse.json({ error: permission.reason ?? 'Forbidden' }, { status: 403 })
  }

  const payload = await request.json().catch(() => null) as Record<string, unknown> | null
  const title = String(payload?.title ?? current.title).trim()
  const description = String(payload?.description ?? current.description ?? '').trim() || null
  const status = String(payload?.status ?? current.status).trim()
  const priority = String(payload?.priority ?? current.priority).trim()
  const dueAtRaw = payload?.due_at ?? current.due_at
  const assigneeId = String(payload?.assignee_id ?? current.assignee_id ?? '').trim() || null

  if (!title) return NextResponse.json({ error: 'El título del seguimiento es obligatorio.' }, { status: 400 })
  if (!isValidStatus(status)) return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 })
  if (!isValidPriority(priority)) return NextResponse.json({ error: 'Prioridad inválida.' }, { status: 400 })

  const dueAt = dueAtRaw ? new Date(String(dueAtRaw)) : null
  if (dueAtRaw && (!dueAt || Number.isNaN(dueAt.getTime()))) {
    return NextResponse.json({ error: 'Fecha límite inválida.' }, { status: 400 })
  }

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

  const { data, error } = await followupTable
    .update({
      title,
      description,
      status,
      priority,
      due_at: dueAt ? dueAt.toISOString() : null,
      assignee_id: assigneeId,
    })
    .eq('id', id)
    .select('id, event_id, title, description, status, priority, assignee_id, due_at, closed_at, created_at, updated_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'No fue posible actualizar el seguimiento.' }, { status: 400 })
  }

  return NextResponse.json({ data })
}
