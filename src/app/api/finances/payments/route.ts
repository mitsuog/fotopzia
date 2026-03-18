import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const project_id = searchParams.get('project_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('project_payments')
    .select('*, project:projects(id,title)')
    .order('paid_at', { ascending: false })

  if (project_id) query = query.eq('project_id', project_id)
  if (from) query = query.gte('paid_at', from)
  if (to) query = query.lte('paid_at', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('project_payments')
    .insert({ ...body, created_by: user.id })
    .select('*, project:projects(id,title)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
