import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { logEquipmentActivity, normalizeNullable } from '@/lib/inventory/server'

export const dynamic = 'force-dynamic'

const listQuerySchema = z.object({
  status: z.string().trim().optional(),
  condition: z.string().trim().optional(),
  category_id: z.string().trim().optional(),
  location: z.string().trim().optional(),
  q: z.string().trim().optional(),
  decommissioned: z.enum(['all', 'active', 'decommissioned']).optional(),
})

const createItemSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del equipo es obligatorio.'),
  brand: z.string().trim().nullable().optional(),
  model: z.string().trim().nullable().optional(),
  serial_number: z.string().trim().nullable().optional(),
  category_id: z.string().trim().nullable().optional(),
  condition: z.enum(['excelente', 'bueno', 'regular', 'malo', 'fuera_de_servicio']).default('bueno'),
  status: z.enum(['disponible', 'en_uso', 'mantenimiento', 'retirado']).default('disponible'),
  location: z.enum(['estudio', 'almacen', 'en_campo', 'prestado']).default('estudio'),
  purchase_date: z.string().trim().nullable().optional(),
  purchase_cost: z.number().nullable().optional(),
  currency: z.string().trim().min(1).default('MXN'),
  depreciation_method: z.enum(['linea_recta', 'ninguno']).default('ninguno'),
  useful_life_years: z.number().int().nullable().optional(),
  salvage_value: z.number().nullable().optional(),
  warranty_expires_at: z.string().trim().nullable().optional(),
  insurance_policy_number: z.string().trim().nullable().optional(),
  insurance_expires_at: z.string().trim().nullable().optional(),
  insurance_provider: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  photo_url: z.string().trim().nullable().optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const validation = listQuerySchema.safeParse({
    status: searchParams.get('status') ?? undefined,
    condition: searchParams.get('condition') ?? undefined,
    category_id: searchParams.get('category_id') ?? undefined,
    location: searchParams.get('location') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    decommissioned: searchParams.get('decommissioned') ?? undefined,
  })

  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Parametros de consulta invalidos.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const queryParams = validation.data

  let query = supabase
    .from('equipment_items')
    .select('*, category:equipment_categories(*)')
    .order('created_at', { ascending: false })

  if (queryParams.status) query = query.eq('status', queryParams.status)
  if (queryParams.condition) query = query.eq('condition', queryParams.condition)
  if (queryParams.category_id) query = query.eq('category_id', queryParams.category_id)
  if (queryParams.location) query = query.eq('location', queryParams.location)
  if (queryParams.q) query = query.or(`name.ilike.%${queryParams.q}%,asset_tag.ilike.%${queryParams.q}%,serial_number.ilike.%${queryParams.q}%`)

  const decommissionedFilter = queryParams.decommissioned ?? 'active'
  if (decommissionedFilter === 'active') query = query.eq('is_decommissioned', false)
  if (decommissionedFilter === 'decommissioned') query = query.eq('is_decommissioned', true)

  const { data, error } = await query
  if (error) return apiError('SERVER_ERROR', error.message, { status: 500 })

  return apiSuccess(data ?? [], { total: data?.length ?? 0 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const rawPayload = await request.json().catch(() => null)
  const validation = createItemSchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de equipo invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data

  const { data, error } = await supabase
    .from('equipment_items')
    .insert({
      name: payload.name.trim(),
      brand: normalizeNullable(payload.brand),
      model: normalizeNullable(payload.model),
      serial_number: normalizeNullable(payload.serial_number),
      category_id: normalizeNullable(payload.category_id),
      condition: payload.condition,
      status: payload.status,
      location: payload.location,
      purchase_date: normalizeNullable(payload.purchase_date),
      purchase_cost: payload.purchase_cost ?? null,
      currency: payload.currency,
      depreciation_method: payload.depreciation_method,
      useful_life_years: payload.useful_life_years ?? null,
      salvage_value: payload.salvage_value ?? null,
      warranty_expires_at: normalizeNullable(payload.warranty_expires_at),
      insurance_policy_number: normalizeNullable(payload.insurance_policy_number),
      insurance_expires_at: normalizeNullable(payload.insurance_expires_at),
      insurance_provider: normalizeNullable(payload.insurance_provider),
      notes: normalizeNullable(payload.notes),
      photo_url: normalizeNullable(payload.photo_url),
      created_by: auth.user.id,
    })
    .select('*, category:equipment_categories(*)')
    .single()

  if (error || !data) return apiError('SERVER_ERROR', error?.message ?? 'No se pudo crear el equipo.', { status: 500 })

  await logEquipmentActivity(supabase, {
    equipmentId: String(data.id),
    eventType: 'created',
    actorId: auth.user.id,
    payload: { name: data.name, asset_tag: data.asset_tag },
  })

  return apiSuccess(data, { created: true })
}
