import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('resources')
    .select('*, equipment_item:equipment_items(id, name, status, condition, is_decommissioned)')
    .order('type')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const body = await request.json()
  const { name, type, color, is_active, equipment_item_id } = body

  if (!name || !type) {
    return NextResponse.json({ error: 'name y type son obligatorios' }, { status: 400 })
  }

  if (equipment_item_id) {
    const { data: equipment } = await supabase
      .from('equipment_items')
      .select('id, status, is_decommissioned')
      .eq('id', equipment_item_id)
      .single()

    if (!equipment || equipment.is_decommissioned || equipment.status === 'retirado') {
      return NextResponse.json({ error: 'No se puede vincular equipo retirado o dado de baja.' }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('resources')
    .insert({ name, type, color: color ?? null, is_active: is_active ?? true, equipment_item_id: equipment_item_id ?? null })
    .select('*, equipment_item:equipment_items(id, name, status, condition, is_decommissioned)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
