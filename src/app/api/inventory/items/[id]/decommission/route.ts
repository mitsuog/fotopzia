import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getUserRole, isAdminRole, logEquipmentActivity, normalizeNullable } from '@/lib/inventory/server'

const decommissionSchema = z.object({
  reason: z.string().trim().nullable().optional(),
})

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const role = await getUserRole(supabase, auth.user.id)
  if (!isAdminRole(role)) return apiError('FORBIDDEN', 'Solo admin puede dar de baja equipo.', { status: 403 })

  const rawPayload = await request.json().catch(() => null)
  const validation = decommissionSchema.safeParse(rawPayload ?? {})
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de baja invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const reason = normalizeNullable(validation.data.reason) ?? 'Baja administrativa'

  const { data: item, error: itemError } = await supabase
    .from('equipment_items')
    .select('id, name, asset_tag, status, is_decommissioned')
    .eq('id', id)
    .single()

  if (itemError || !item) return apiError('NOT_FOUND', 'Equipo no encontrado.', { status: 404 })

  const { count: openAssignments } = await supabase
    .from('equipment_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('equipment_id', id)
    .is('returned_at', null)

  if ((openAssignments ?? 0) > 0) {
    return apiError('CONFLICT', 'No se puede dar de baja con asignaciones abiertas.', { status: 409 })
  }

  const { data, error } = await supabase
    .from('equipment_items')
    .update({
      status: 'retirado',
      is_decommissioned: true,
      decommissioned_at: new Date().toISOString(),
      decommissioned_by: auth.user.id,
      decommission_reason: reason,
    })
    .eq('id', id)
    .select('*, category:equipment_categories(*)')
    .single()

  if (error || !data) return apiError('SERVER_ERROR', error?.message ?? 'No se pudo dar de baja el equipo.', { status: 500 })

  await logEquipmentActivity(supabase, {
    equipmentId: id,
    eventType: 'decommissioned',
    actorId: auth.user.id,
    payload: {
      reason,
      previous_status: item.status,
      asset_tag: item.asset_tag,
    },
  })

  return apiSuccess(data, { decommissioned: true })
}
