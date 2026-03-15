import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await request.json()

  const { data, error } = await supabase
    .from('project_deliverables')
    .insert({
      project_id: id,
      name: payload.name,
      description: payload.description ?? null,
      status: payload.status ?? 'pending',
      due_at: payload.due_at ?? null,
      notes: payload.notes ?? null,
      created_by: auth.user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
