import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category_id = searchParams.get('category_id')
  const period = searchParams.get('period')
  const project_id = searchParams.get('project_id')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('expenses')
    .select('*, category:expense_categories(*), project:projects(id,title)')
    .order('date', { ascending: false })

  if (category_id) query = query.eq('category_id', category_id)
  if (period) query = query.eq('period', period)
  if (project_id) query = query.eq('project_id', project_id)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // Auto-set period from date
  const period = body.date ? body.date.slice(0, 7) : undefined

  const { data, error } = await supabase
    .from('expenses')
    .insert({ ...body, period: period ?? body.period, created_by: user.id })
    .select('*, category:expense_categories(*), project:projects(id,title)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
