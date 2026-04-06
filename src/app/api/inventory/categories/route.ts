import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio.'),
  description: z.string().trim().nullable().optional(),
  icon: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
})

function normalizeNullable(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function GET() {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('equipment_categories')
    .select('*')
    .order('sort_order')

  if (error) return apiError('SERVER_ERROR', error.message, { status: 500 })
  return apiSuccess(data ?? [], { total: data?.length ?? 0 })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const rawPayload = await request.json().catch(() => null)
  const validation = createCategorySchema.safeParse(rawPayload)
  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Payload de categoria invalido.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const payload = validation.data

  const { data, error } = await supabase
    .from('equipment_categories')
    .insert({
      name: payload.name.trim(),
      description: normalizeNullable(payload.description),
      icon: normalizeNullable(payload.icon),
      color: normalizeNullable(payload.color),
      sort_order: payload.sort_order ?? 0,
    })
    .select('*')
    .single()

  if (error) return apiError('SERVER_ERROR', error.message, { status: 500 })
  return apiSuccess(data, { created: true })
}
