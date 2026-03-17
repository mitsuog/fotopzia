import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const [nodesResult, depsResult] = await Promise.all([
    supabase
      .from('project_wbs_nodes')
      .select('*')
      .eq('project_id', id)
      .order('level', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from('project_dependencies')
      .select('*')
      .eq('project_id', id),
  ])

  if (nodesResult.error) return NextResponse.json({ error: nodesResult.error.message }, { status: 400 })
  if (depsResult.error) return NextResponse.json({ error: depsResult.error.message }, { status: 400 })

  return NextResponse.json({ nodes: nodesResult.data ?? [], dependencies: depsResult.data ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const payload = await request.json()
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('project_wbs_nodes')
    .insert({
      project_id: id,
      parent_id: payload.parent_id ?? null,
      level: payload.level ?? 'task',
      position: payload.position ?? 0,
      title: payload.title,
      description: payload.description ?? null,
      is_milestone: payload.is_milestone ?? false,
      status: payload.status ?? 'pending',
      priority: payload.priority ?? 'medium',
      start_at: payload.start_at ?? null,
      due_at: payload.due_at ?? null,
      assigned_to: payload.assigned_to ?? null,
      progress_mode: payload.progress_mode ?? 'computed',
      progress_pct: payload.progress_pct ?? null,
      created_by: auth.user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('project_activity_log').insert({
    project_id: id,
    actor_id: auth.user.id,
    event_type: 'wbs_node_created',
    payload: { title: data.title, level: data.level, parent_id: data.parent_id },
  })

  return NextResponse.json({ data })
}
