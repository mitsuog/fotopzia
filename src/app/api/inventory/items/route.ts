import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const condition = searchParams.get('condition')
  const category_id = searchParams.get('category_id')
  const location = searchParams.get('location')
  const q = searchParams.get('q')

  let query = supabase
    .from('equipment_items')
    .select('*, category:equipment_categories(*)')
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (condition) query = query.eq('condition', condition)
  if (category_id) query = query.eq('category_id', category_id)
  if (location) query = query.eq('location', location)
  if (q) query = query.ilike('name', `%${q}%`)

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
    .from('equipment_items')
    .insert({ ...body, created_by: user.id })
    .select('*, category:equipment_categories(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
