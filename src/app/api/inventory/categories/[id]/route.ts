import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

const patchCategorySchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  icon: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
}).passthrough()

function normalizeNullable(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const rawPayload = await request.json().catch(() => null)
  const validation = patchCategorySchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de categoria invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data
  const updates: Record<string, unknown> = {}

  if ('name' in payload) updates.name = payload.name?.trim()
  if ('description' in payload) updates.description = normalizeNullable(payload.description)
  if ('icon' in payload) updates.icon = normalizeNullable(payload.icon)
  if ('color' in payload) updates.color = normalizeNullable(payload.color)
  if ('sort_order' in payload) updates.sort_order = payload.sort_order

  if (Object.keys(updates).length === 0) {
    return apiError('BAD_REQUEST', 'No hay cambios para aplicar.', { status: 400 })
  }

  const { data, error } = await supabase
    .from('equipment_categories')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return apiError('SERVER_ERROR', error.message, { status: 500 })
  return apiSuccess(data)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { count } = await supabase
    .from('equipment_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)

  if ((count ?? 0) > 0) {
    return apiError('CONFLICT', 'No se puede eliminar una categoria que tiene equipos asignados.', { status: 409 })
  }

  const { error } = await supabase.from('equipment_categories').delete().eq('id', id)
  if (error) return apiError('SERVER_ERROR', error.message, { status: 500 })

  return apiSuccess({ id, deleted: true })
}
