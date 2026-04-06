import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getUserRole, isAdminOrPmRole, logEquipmentActivity, normalizeNullable } from '@/lib/inventory/server'

export const dynamic = 'force-dynamic'

const maintenanceSchema = z.object({
  type: z.enum(['preventivo', 'correctivo', 'calibracion', 'limpieza']),
  description: z.string().trim().min(1, 'La descripcion es obligatoria.'),
  performed_by: z.string().trim().nullable().optional(),
  cost: z.number().nullable().optional(),
  performed_at: z.string().trim().min(1),
  next_due_at: z.string().trim().nullable().optional(),
  vendor: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('equipment_maintenance')
    .select('*')
    .eq('equipment_id', id)
    .order('performed_at', { ascending: false })

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
  const validation = maintenanceSchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de mantenimiento invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data

  const { data, error } = await supabase
    .from('equipment_maintenance')
    .insert({
      equipment_id: id,
      type: payload.type,
      description: payload.description.trim(),
      performed_by: normalizeNullable(payload.performed_by),
      cost: payload.cost ?? null,
      performed_at: payload.performed_at,
      next_due_at: normalizeNullable(payload.next_due_at),
      vendor: normalizeNullable(payload.vendor),
      notes: normalizeNullable(payload.notes),
      created_by: auth.user.id,
    })
    .select('*')
    .single()

  if (error || !data) return apiError('SERVER_ERROR', error?.message ?? 'No se pudo registrar mantenimiento.', { status: 500 })

  await logEquipmentActivity(supabase, {
    equipmentId: id,
    eventType: 'maintenance_created',
    actorId: auth.user.id,
    payload: {
      maintenance_id: data.id,
      type: data.type,
      performed_at: data.performed_at,
      next_due_at: data.next_due_at,
      cost: data.cost,
    },
  })

  return apiSuccess(data, { created: true })
}
