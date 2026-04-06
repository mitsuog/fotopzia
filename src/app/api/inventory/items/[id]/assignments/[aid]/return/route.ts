import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getUserRole, isAdminOrPmRole, logEquipmentActivity, normalizeNullable } from '@/lib/inventory/server'

export const dynamic = 'force-dynamic'

const returnSchema = z.object({
  condition_in: z.enum(['excelente', 'bueno', 'regular', 'malo', 'fuera_de_servicio']).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const role = await getUserRole(supabase, auth.user.id)
  if (!isAdminOrPmRole(role)) return apiError('FORBIDDEN', 'Forbidden', { status: 403 })

  const rawPayload = await request.json().catch(() => null)
  const validation = returnSchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de devolucion invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data

  const { data: assignment, error: assignError } = await supabase
    .from('equipment_assignments')
    .select('*')
    .eq('id', aid)
    .eq('equipment_id', id)
    .single()

  if (assignError || !assignment) return apiError('NOT_FOUND', 'Asignacion no encontrada.', { status: 404 })
  if (assignment.returned_at) return apiError('CONFLICT', 'La asignacion ya fue cerrada.', { status: 409 })

  const { data: updatedAssignment, error: updateError } = await supabase
    .from('equipment_assignments')
    .update({
      returned_at: new Date().toISOString(),
      condition_in: payload.condition_in ?? null,
      notes: normalizeNullable(payload.notes),
    })
    .eq('id', aid)
    .eq('equipment_id', id)
    .select('*, project:projects(id,title), assignee:profiles!assigned_to(id,full_name)')
    .single()

  if (updateError || !updatedAssignment) {
    return apiError('SERVER_ERROR', updateError?.message ?? 'No se pudo cerrar la asignacion.', { status: 500 })
  }

  const { data: item } = await supabase
    .from('equipment_items')
    .select('is_decommissioned')
    .eq('id', id)
    .single()

  const conditionIn = payload.condition_in ?? assignment.condition_out ?? 'bueno'
  const nextStatus = item?.is_decommissioned
    ? 'retirado'
    : (conditionIn === 'malo' || conditionIn === 'fuera_de_servicio')
      ? 'mantenimiento'
      : 'disponible'

  await supabase
    .from('equipment_items')
    .update({
      status: nextStatus,
      condition: payload.condition_in ?? undefined,
    })
    .eq('id', id)

  await logEquipmentActivity(supabase, {
    equipmentId: id,
    eventType: 'assignment_returned',
    actorId: auth.user.id,
    payload: {
      assignment_id: aid,
      condition_in: payload.condition_in ?? null,
      previous_condition_out: assignment.condition_out,
      next_status: nextStatus,
    },
  })

  return apiSuccess(updatedAssignment)
}
