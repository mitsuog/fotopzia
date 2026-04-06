import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await request.json()

  const { name, type, color, is_active, equipment_item_id } = body
  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (type !== undefined) patch.type = type
  if (color !== undefined) patch.color = color
  if (is_active !== undefined) patch.is_active = is_active
  if ('equipment_item_id' in body) patch.equipment_item_id = equipment_item_id ?? null

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
    .update(patch)
    .eq('id', id)
    .select('*, equipment_item:equipment_items(id, name, status, condition, is_decommissioned)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Check for active (future) event_resources
  const now = new Date().toISOString()
  const { count } = await supabase
    .from('event_resources')
    .select('id', { count: 'exact', head: true })
    .eq('resource_id', id)
    .gte('event:calendar_events(end_at)', now)

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Este recurso esta asignado a eventos futuros. Retiralo primero.' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('resources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
