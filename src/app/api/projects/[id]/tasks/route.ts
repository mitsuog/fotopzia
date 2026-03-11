import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('project_tasks')
    .select('id, title, status, priority, due_at, assigned_to, created_at')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
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
    .from('project_tasks')
    .insert({
      project_id: id,
      title: payload.title,
      description: payload.description ?? null,
      priority: payload.priority ?? 'medium',
      status: payload.status ?? 'pending',
      due_at: payload.due_at ?? null,
      assigned_to: payload.assigned_to ?? null,
      created_by: auth.user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await supabase.from('project_activity_log').insert({
    project_id: id,
    task_id: data.id,
    actor_id: auth.user.id,
    event_type: 'task_created',
    payload: { title: data.title, priority: data.priority },
  })

  return NextResponse.json({ data })
}
