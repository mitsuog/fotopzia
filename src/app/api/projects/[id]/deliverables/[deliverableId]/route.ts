import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; deliverableId: string }> },
) {
  const { id, deliverableId } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await request.json()
  const allowed = ['status', 'notes', 'delivered_at', 'approved_at', 'due_at', 'name', 'description']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in payload) updates[key] = payload[key]
  }

  if (payload.status === 'delivered' && !('delivered_at' in payload)) {
    updates.delivered_at = new Date().toISOString()
  }
  if (payload.status === 'approved' && !('approved_at' in payload)) {
    updates.approved_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('project_deliverables')
    .update(updates)
    .eq('id', deliverableId)
    .eq('project_id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
