import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await request.json()
  const allowed = ['status', 'priority', 'title', 'description', 'assigned_to', 'due_at', 'start_at', 'completed_at']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in payload) updates[key] = payload[key]
  }

  if (payload.status === 'done' && !('completed_at' in payload)) {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('project_tasks')
    .update(updates)
    .eq('id', taskId)
    .eq('project_id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  const { id, taskId } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: task } = await supabase
    .from('project_tasks')
    .select('title')
    .eq('id', taskId)
    .single()

  const { error } = await supabase
    .from('project_tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('project_activity_log').insert({
    project_id: id,
    actor_id: auth.user.id,
    event_type: 'task_deleted',
    payload: { title: task?.title ?? '' },
  })

  return NextResponse.json({ success: true })
}
