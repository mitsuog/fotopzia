import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import {
  getUserRole,
  isAdminRole,
  isAdminOrPmRole,
  logEquipmentActivity,
  normalizeNullable,
} from '@/lib/inventory/server'

export const dynamic = 'force-dynamic'

const patchItemSchema = z.object({
  name: z.string().trim().min(1).optional(),
  brand: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  serial_number: z.string().trim().nullable().optional(),
  category_id: z.string().trim().nullable().optional(),
  condition: z.enum(['excelente', 'bueno', 'regular', 'malo', 'fuera_de_servicio']).optional(),
  status: z.enum(['disponible', 'en_uso', 'mantenimiento', 'retirado']).optional(),
  location: z.enum(['estudio', 'almacen', 'en_campo', 'prestado']).optional(),
  purchase_date: z.string().trim().nullable().optional(),
  purchase_cost: z.number().nullable().optional(),
  currency: z.string().trim().min(1).optional(),
  depreciation_method: z.enum(['linea_recta', 'ninguno']).optional(),
  useful_life_years: z.number().int().nullable().optional(),
  salvage_value: z.number().nullable().optional(),
  warranty_expires_at: z.string().trim().nullable().optional(),
  insurance_policy_number: z.string().trim().nullable().optional(),
  insurance_expires_at: z.string().trim().nullable().optional(),
  insurance_provider: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  photo_url: z.string().trim().nullable().optional(),
}).passthrough()

const deletePayloadSchema = z.object({
  confirmationText: z.string().trim(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('equipment_items')
    .select('*, category:equipment_categories(*)')
    .eq('id', id)
    .single()

  if (error) return apiError('NOT_FOUND', error.message, { status: 404 })
  return apiSuccess(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const role = await getUserRole(supabase, auth.user.id)
  if (!isAdminOrPmRole(role)) return apiError('FORBIDDEN', 'Forbidden', { status: 403 })

  const rawPayload = await request.json().catch(() => null)
  const validation = patchItemSchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de actualizacion invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data
  const updates: Record<string, unknown> = {}

  if ('name' in payload) updates.name = payload.name?.trim()
  if ('brand' in payload) updates.brand = normalizeNullable(payload.brand)
  if ('model' in payload) updates.model = normalizeNullable(payload.model)
  if ('serial_number' in payload) updates.serial_number = normalizeNullable(payload.serial_number)
  if ('category_id' in payload) updates.category_id = normalizeNullable(payload.category_id)
  if ('condition' in payload) updates.condition = payload.condition
  if ('status' in payload) updates.status = payload.status
  if ('location' in payload) updates.location = payload.location
  if ('purchase_date' in payload) updates.purchase_date = normalizeNullable(payload.purchase_date)
  if ('purchase_cost' in payload) updates.purchase_cost = payload.purchase_cost ?? null
  if ('currency' in payload) updates.currency = payload.currency
  if ('depreciation_method' in payload) updates.depreciation_method = payload.depreciation_method
  if ('useful_life_years' in payload) updates.useful_life_years = payload.useful_life_years ?? null
  if ('salvage_value' in payload) updates.salvage_value = payload.salvage_value ?? null
  if ('warranty_expires_at' in payload) updates.warranty_expires_at = normalizeNullable(payload.warranty_expires_at)
  if ('insurance_policy_number' in payload) updates.insurance_policy_number = normalizeNullable(payload.insurance_policy_number)
  if ('insurance_expires_at' in payload) updates.insurance_expires_at = normalizeNullable(payload.insurance_expires_at)
  if ('insurance_provider' in payload) updates.insurance_provider = normalizeNullable(payload.insurance_provider)
  if ('notes' in payload) updates.notes = normalizeNullable(payload.notes)
  if ('photo_url' in payload) updates.photo_url = normalizeNullable(payload.photo_url)

  if (Object.keys(updates).length === 0) {
    return apiError('BAD_REQUEST', 'No hay cambios para aplicar.', { status: 400 })
  }

  const { data, error } = await supabase
    .from('equipment_items')
    .update(updates)
    .eq('id', id)
    .select('*, category:equipment_categories(*)')
    .single()

  if (error || !data) return apiError('SERVER_ERROR', error?.message ?? 'No se pudo actualizar el equipo.', { status: 500 })

  await logEquipmentActivity(supabase, {
    equipmentId: id,
    eventType: 'updated',
    actorId: auth.user.id,
    payload: {
      fields: Object.keys(updates),
      status: data.status,
      condition: data.condition,
      location: data.location,
    },
  })

  return apiSuccess(data)
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const role = await getUserRole(supabase, auth.user.id)
  if (!isAdminRole(role)) return apiError('FORBIDDEN', 'Solo admin puede eliminar permanentemente.', { status: 403 })

  const rawPayload = await request.json().catch(() => null)
  const payloadValidation = deletePayloadSchema.safeParse(rawPayload)
  if (!payloadValidation.success || payloadValidation.data.confirmationText !== 'ELIMINAR') {
    return apiError('VALIDATION_ERROR', 'Confirmacion invalida. Escribe ELIMINAR.', { status: 400 })
  }

  const { data: item, error: itemError } = await supabase
    .from('equipment_items')
    .select('id, name, asset_tag')
    .eq('id', id)
    .single()

  if (itemError || !item) return apiError('NOT_FOUND', 'Equipo no encontrado.', { status: 404 })

  const [{ count: openAssignments }, { count: assignmentsTotal }, { count: maintenanceTotal }, { count: relevantEvents }] = await Promise.all([
    supabase
      .from('equipment_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', id)
      .is('returned_at', null),
    supabase
      .from('equipment_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', id),
    supabase
      .from('equipment_maintenance')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', id),
    supabase
      .from('equipment_activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', id)
      .neq('event_type', 'created')
      .neq('event_type', 'updated'),
  ])

  if ((openAssignments ?? 0) > 0) {
    return apiError('CONFLICT', 'No se puede eliminar un equipo con asignaciones abiertas.', { status: 409 })
  }

  if ((assignmentsTotal ?? 0) > 0 || (maintenanceTotal ?? 0) > 0 || (relevantEvents ?? 0) > 0) {
    return apiError('CONFLICT', 'No se puede eliminar: el equipo tiene historial operativo relevante.', { status: 409 })
  }

  const { error: deleteError } = await supabase
    .from('equipment_items')
    .delete()
    .eq('id', id)

  if (deleteError) return apiError('SERVER_ERROR', deleteError.message, { status: 500 })

  return apiSuccess({ id, deleted: true, name: item.name, asset_tag: item.asset_tag })
}
