import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const includeArchived = searchParams.get('include_archived') === 'true'

  let query = supabase
    .from('projects')
    .select('id, title, stage, contact_id, deal_id, due_date, created_at, is_archived, archived_at')
    .order('created_at', { ascending: false })

  if (!includeArchived) {
    query = query.neq('is_archived', true)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const payload = await request.json()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('projects')
    .insert({
      title: payload.title,
      contact_id: payload.contact_id ?? null,
      deal_id: payload.deal_id ?? null,
      project_type: payload.project_type ?? 'contract',
      description: payload.description ?? null,
      start_date: payload.start_date ?? null,
      due_date: payload.due_date ?? null,
      color: payload.color ?? null,
      assigned_to: payload.assigned_to ?? null,
      created_by: auth.user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
}
