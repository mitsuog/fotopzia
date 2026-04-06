import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'

const projectTypeSchema = z.enum(['contract', 'internal', 'alliance'])
const projectStageSchema = z.enum(['preproduccion', 'primera_revision', 'produccion', 'segunda_revision', 'entrega', 'cierre'])

const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'El titulo del proyecto es obligatorio.'),
  contact_id: z.string().trim().min(1).nullable().optional(),
  deal_id: z.string().trim().min(1).nullable().optional(),
  project_type: projectTypeSchema.default('contract'),
  stage: projectStageSchema.default('preproduccion'),
  description: z.string().trim().nullable().optional(),
  start_date: z.string().trim().nullable().optional(),
  due_date: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  assigned_to: z.string().trim().nullable().optional(),
})

const listQuerySchema = z.object({
  include_archived: z
    .enum(['true', 'false'])
    .optional()
    .transform(value => value === 'true'),
})

function normalizeNullable(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const queryValidation = listQuerySchema.safeParse({
    include_archived: searchParams.get('include_archived') ?? undefined,
  })

  if (!queryValidation.success) {
    return apiError('VALIDATION_ERROR', 'Parametros de consulta invalidos.', {
      status: 400,
      details: queryValidation.error.flatten(),
    })
  }

  const includeArchived = queryValidation.data.include_archived ?? false

  let query = supabase
    .from('projects')
    .select('id, title, stage, contact_id, deal_id, due_date, created_at, is_archived, archived_at')
    .order('created_at', { ascending: false })

  if (!includeArchived) {
    query = query.neq('is_archived', true)
  }

  const { data, error } = await query

  if (error) {
    return apiError('SERVER_ERROR', error.message, { status: 400 })
  }

  return apiSuccess(data ?? [], { total: data?.length ?? 0 })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const rawPayload = await request.json().catch(() => null)
  if (!rawPayload || typeof rawPayload !== 'object') {
    return apiError('BAD_REQUEST', 'No se recibio un payload valido.', { status: 400 })
  }

  const payloadValidation = createProjectSchema.safeParse(rawPayload)
  if (!payloadValidation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de proyecto invalido.', {
      status: 400,
      details: payloadValidation.error.flatten(),
    })
  }

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const payload = payloadValidation.data

  const projectType = payload.project_type
  const stage = payload.stage ?? 'preproduccion'

  const rawContactId = normalizeNullable(payload.contact_id)
  const rawDealId = normalizeNullable(payload.deal_id)

  // Regla de negocio: proyectos internos no requieren contrato/propuesta.
  // Pueden existir y operar sin contacto o deal vinculados.
  const contactId = projectType === 'internal' ? null : rawContactId
  const dealId = projectType === 'internal' ? null : rawDealId

  const { data, error } = await supabase
    .from('projects')
    .insert({
      title: payload.title.trim(),
      contact_id: contactId,
      deal_id: dealId,
      project_type: projectType,
      stage,
      description: normalizeNullable(payload.description),
      start_date: normalizeNullable(payload.start_date),
      due_date: normalizeNullable(payload.due_date),
      color: normalizeNullable(payload.color),
      assigned_to: normalizeNullable(payload.assigned_to),
      created_by: auth.user.id,
    })
    .select('*')
    .single()

  if (error) {
    return apiError('SERVER_ERROR', error.message, { status: 400 })
  }

  return apiSuccess(data, {
    project_type: projectType,
    stage,
  })
}
