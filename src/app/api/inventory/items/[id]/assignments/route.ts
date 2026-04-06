import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getUserRole, isAdminOrPmRole, logEquipmentActivity, normalizeNullable } from '@/lib/inventory/server'

export const dynamic = 'force-dynamic'

const createAssignmentSchema = z.object({
  project_id: z.string().trim().nullable().optional(),
  assigned_to: z.string().trim().min(1, 'Debe seleccionar responsable.'),
  assigned_at: z.string().trim().min(1).optional(),
  expected_return_at: z.string().trim().nullable().optional(),
  condition_out: z.enum(['excelente', 'bueno', 'regular', 'malo', 'fuera_de_servicio']).nullable().optional(),
  notes: z.string().trim().nullable().optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('equipment_assignments')
    .select('*, project:projects(id,title), assignee:profiles!assigned_to(id,full_name)')
    .eq('equipment_id', id)
    .order('assigned_at', { ascending: false })

  if (error) return apiError('SERVER_ERROR', error.message, { status: 500 })
  return apiSuccess(data ?? [], { total: data?.length ?? 0 })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const role = await getUserRole(supabase, auth.user.id)
  if (!isAdminOrPmRole(role)) return apiError('FORBIDDEN', 'Forbidden', { status: 403 })

  const rawPayload = await request.json().catch(() => null)
  const validation = createAssignmentSchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de asignacion invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data

  const [{ data: item, error: itemError }, { count: openCount }] = await Promise.all([
    supabase
      .from('equipment_items')
      .select('id, name, status, condition, is_decommissioned, asset_tag')
      .eq('id', id)
      .single(),
    supabase
      .from('equipment_assignments')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', id)
      .is('returned_at', null),
  ])

  if (itemError || !item) return apiError('NOT_FOUND', 'Equipo no encontrado.', { status: 404 })
  if (item.is_decommissioned || item.status === 'retirado') {
    return apiError('CONFLICT', 'El equipo esta dado de baja y no puede asignarse.', { status: 409 })
  }
  if ((openCount ?? 0) > 0) {
    return apiError('CONFLICT', 'El equipo ya tiene una asignacion abierta.', { status: 409 })
  }

  const assignedAt = payload.assigned_at?.trim() || new Date().toISOString()

  const { data, error } = await supabase
    .from('equipment_assignments')
    .insert({
      equipment_id: id,
      project_id: normalizeNullable(payload.project_id),
      assigned_to: payload.assigned_to.trim(),
      assigned_at: assignedAt,
      expected_return_at: normalizeNullable(payload.expected_return_at),
      condition_out: payload.condition_out ?? item.condition,
      notes: normalizeNullable(payload.notes),
      created_by: auth.user.id,
    })
    .select('*, project:projects(id,title), assignee:profiles!assigned_to(id,full_name)')
    .single()

  if (error || !data) return apiError('SERVER_ERROR', error?.message ?? 'No se pudo crear la asignacion.', { status: 500 })

  await supabase
    .from('equipment_items')
    .update({
      status: 'en_uso',
      is_decommissioned: false,
      decommissioned_at: null,
      decommissioned_by: null,
      decommission_reason: null,
    })
    .eq('id', id)

  await logEquipmentActivity(supabase, {
    equipmentId: id,
    eventType: 'assignment_created',
    actorId: auth.user.id,
    payload: {
      assignment_id: data.id,
      assigned_to: data.assigned_to,
      assigned_at: data.assigned_at,
      expected_return_at: data.expected_return_at,
      project_id: data.project_id,
      condition_out: data.condition_out,
      asset_tag: item.asset_tag,
    },
  })

  return apiSuccess(data, { created: true })
}
