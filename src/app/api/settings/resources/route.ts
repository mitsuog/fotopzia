import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('resources')
    .select('*, equipment_item:equipment_items(id, name, status, condition)')
    .order('type')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  // Verify admin/pm via RLS helper — attempt insert; RLS will reject unauthorized users
  const body = await request.json()
  const { name, type, color, is_active, equipment_item_id } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'name y type son obligatorios' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('resources')
    .insert({ name, type, color: color ?? null, is_active: is_active ?? true, equipment_item_id: equipment_item_id ?? null })
    .select('*, equipment_item:equipment_items(id, name, status, condition)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
