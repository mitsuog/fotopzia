import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { apiError, apiSuccess } from '@/lib/api/response'

const projectPatchSchema = z.object({
  stage: z.enum(['preproduccion', 'primera_revision', 'produccion', 'segunda_revision', 'entrega', 'cierre']).optional(),
  due_date: z.string().trim().nullable().optional(),
  start_date: z.string().trim().nullable().optional(),
  assigned_to: z.string().trim().nullable().optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  is_archived: z.boolean().optional(),
}).passthrough()

const deletePayloadSchema = z.object({
  confirmationText: z.string().trim(),
})

function isAdminOrPm(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'project_manager'
}

function normalizeNullable(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*, contact:contacts(first_name, last_name, email)')
    .eq('id', id)
    .single()

  if (error) return apiError('SERVER_ERROR', error.message, { status: 400 })
  if (!data) return apiError('NOT_FOUND', 'Proyecto no encontrado.', { status: 404 })

  return apiSuccess(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const rawPayload = await request.json().catch(() => null)
  if (!rawPayload || typeof rawPayload !== 'object') {
    return apiError('BAD_REQUEST', 'No se recibio un payload valido.', { status: 400 })
  }

  const validation = projectPatchSchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de actualizacion invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data
  const updates: Record<string, unknown> = {}

  if ('stage' in payload) updates.stage = payload.stage
  if ('due_date' in payload) updates.due_date = normalizeNullable(payload.due_date)
  if ('start_date' in payload) updates.start_date = normalizeNullable(payload.start_date)
  if ('assigned_to' in payload) updates.assigned_to = normalizeNullable(payload.assigned_to)
  if ('title' in payload) updates.title = payload.title?.trim()
  if ('description' in payload) updates.description = normalizeNullable(payload.description)

  if ('is_archived' in payload) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single()

    if (!isAdminOrPm(profile?.role)) {
      return apiError('FORBIDDEN', 'Forbidden', { status: 403 })
    }

    const archived = Boolean(payload.is_archived)
    updates.is_archived = archived
    updates.archived_at = archived ? new Date().toISOString() : null
  }

  if (Object.keys(updates).length === 0) {
    return apiError('BAD_REQUEST', 'No hay cambios para aplicar.', { status: 400 })
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return apiError('SERVER_ERROR', error.message, { status: 400 })
  return apiSuccess(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single()

  if (!isAdminOrPm(profile?.role)) {
    return apiError('FORBIDDEN', 'Forbidden', { status: 403 })
  }

  const rawPayload = await request.json().catch(() => null)
  const payloadValidation = deletePayloadSchema.safeParse(rawPayload)
  if (!payloadValidation.success || payloadValidation.data.confirmationText !== 'ELIMINAR') {
    return apiError('VALIDATION_ERROR', 'Confirmacion invalida. Escribe ELIMINAR.', { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (projectError || !project) {
    return apiError('NOT_FOUND', 'Proyecto no encontrado.', { status: 404 })
  }

  await supabase.from('project_activity_log').insert({
    project_id: project.id,
    actor_id: auth.user.id,
    event_type: 'project_deleted',
    payload: { title: project.title },
  })

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (deleteError) return apiError('SERVER_ERROR', deleteError.message, { status: 400 })

  const activityPayload: Database['public']['Tables']['activities']['Insert'] = {
    type: 'stage_change',
    contact_id: (project.contact_id as string | null) ?? null,
    deal_id: (project.deal_id as string | null) ?? null,
    subject: 'Proyecto eliminado',
    body: `Se elimino permanentemente el proyecto ${project.title}.`,
    created_by: auth.user.id,
  }

  await supabase.from('activities').insert(activityPayload)

  return apiSuccess({ id, deleted: true })
}
