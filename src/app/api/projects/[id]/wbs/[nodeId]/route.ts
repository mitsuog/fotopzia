import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_UPDATES = [
  'title', 'description', 'status', 'priority', 'start_at', 'due_at',
  'assigned_to', 'is_milestone', 'progress_mode', 'progress_pct',
  'completed_at', 'position',
] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const { id, nodeId } = await params
  const payload = await request.json()
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED_UPDATES) {
    if (key in payload) updates[key] = payload[key]
  }

  // Auto-set completed_at when marking done
  if (updates.status === 'done' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString()
  } else if (updates.status && updates.status !== 'done') {
    updates.completed_at = null
  }

  const { data, error } = await supabase
    .from('project_wbs_nodes')
    .update(updates)
    .eq('id', nodeId)
    .eq('project_id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> },
) {
  const { id, nodeId } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('project_wbs_nodes')
    .delete()
    .eq('id', nodeId)
    .eq('project_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('project_activity_log').insert({
    project_id: id,
    actor_id: auth.user.id,
    event_type: 'wbs_node_deleted',
    payload: { node_id: nodeId },
  })

  return NextResponse.json({ ok: true })
}
