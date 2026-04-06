import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getUserRole, isAdminRole, logEquipmentActivity } from '@/lib/inventory/server'

export const dynamic = 'force-dynamic'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const role = await getUserRole(supabase, auth.user.id)
  if (!isAdminRole(role)) return apiError('FORBIDDEN', 'Solo admin puede reactivar equipo.', { status: 403 })

  const { data: currentItem, error: currentError } = await supabase
    .from('equipment_items')
    .select('id, condition, status, is_decommissioned, decommission_reason')
    .eq('id', id)
    .single()

  if (currentError || !currentItem) return apiError('NOT_FOUND', 'Equipo no encontrado.', { status: 404 })

  const nextStatus = currentItem.condition === 'malo' || currentItem.condition === 'fuera_de_servicio'
    ? 'mantenimiento'
    : 'disponible'

  const { data, error } = await supabase
    .from('equipment_items')
    .update({
      is_decommissioned: false,
      decommissioned_at: null,
      decommissioned_by: null,
      decommission_reason: null,
      status: nextStatus,
    })
    .eq('id', id)
    .select('*, category:equipment_categories(*)')
    .single()

  if (error || !data) return apiError('SERVER_ERROR', error?.message ?? 'No se pudo reactivar el equipo.', { status: 500 })

  await logEquipmentActivity(supabase, {
    equipmentId: id,
    eventType: 'reactivated',
    actorId: auth.user.id,
    payload: {
      previous_status: currentItem.status,
      restored_status: nextStatus,
      previous_reason: currentItem.decommission_reason,
    },
  })

  return apiSuccess(data, { reactivated: true })
}
