import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('project_dependencies')
    .select('*')
    .eq('project_id', id)

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

  const { predecessor_id, successor_id, dep_type, lag_days } = payload

  if (!predecessor_id || !successor_id) {
    return NextResponse.json({ error: 'predecessor_id y successor_id son requeridos' }, { status: 400 })
  }
  if (predecessor_id === successor_id) {
    return NextResponse.json({ error: 'Una tarea no puede depender de sí misma' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('project_dependencies')
    .insert({
      project_id: id,
      predecessor_id,
      successor_id,
      dep_type: dep_type ?? 'FS',
      lag_days: lag_days ?? 0,
      created_by: auth.user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
