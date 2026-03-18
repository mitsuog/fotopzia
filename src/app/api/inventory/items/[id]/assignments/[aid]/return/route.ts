import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { condition_in, notes } = body

  const { data: assignment, error: assignError } = await supabase
    .from('equipment_assignments')
    .update({ returned_at: new Date().toISOString(), condition_in, notes })
    .eq('id', aid)
    .eq('equipment_id', id)
    .select()
    .single()

  if (assignError) return NextResponse.json({ error: assignError.message }, { status: 500 })

  const newStatus = condition_in === 'malo' || condition_in === 'fuera_de_servicio'
    ? 'mantenimiento'
    : 'disponible'

  await supabase
    .from('equipment_items')
    .update({ status: newStatus, condition: condition_in ?? undefined })
    .eq('id', id)

  return NextResponse.json(assignment)
}
