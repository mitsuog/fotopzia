import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('equipment_assignments')
    .select('*, project:projects(id,title), assignee:profiles!assigned_to(id,full_name)')
    .eq('equipment_id', id)
    .order('assigned_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  await supabase
    .from('equipment_items')
    .update({ status: 'en_uso' })
    .eq('id', id)

  const { data, error } = await supabase
    .from('equipment_assignments')
    .insert({ ...body, equipment_id: id, created_by: user.id })
    .select('*, project:projects(id,title), assignee:profiles!assigned_to(id,full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
