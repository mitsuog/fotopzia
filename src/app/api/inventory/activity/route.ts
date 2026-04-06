import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  equipment_id: z.string().trim().optional(),
  limit: z.number().int().min(1).max(200).optional(),
})

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return apiError('UNAUTHORIZED', 'Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const validation = querySchema.safeParse({
    equipment_id: searchParams.get('equipment_id') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  })

  if (!validation.success) {
    return apiError('VALIDATION_ERROR', 'Parametros de consulta invalidos.', {
      status: 400,
      details: validation.error.flatten(),
    })
  }

  const { equipment_id, limit = 80 } = validation.data

  let query = supabase
    .from('equipment_activity_log')
    .select('*, equipment:equipment_items(id,name,asset_tag), actor:profiles(id,full_name,email)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (equipment_id) query = query.eq('equipment_id', equipment_id)

  const { data, error } = await query
  if (error) return apiError('SERVER_ERROR', error.message, { status: 500 })

  return apiSuccess(data ?? [], { total: data?.length ?? 0 })
}
