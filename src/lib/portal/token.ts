import { supabaseAdmin } from '@/lib/supabase/admin'

export interface PortalAccessContext {
  id: string
  contact_id: string
  expires_at: string | null
  access_count: number
  contacts: {
    id: string
    first_name: string
    last_name: string
    email: string | null
  } | null
}

export async function getPortalAccessByToken(token: string): Promise<{ access: PortalAccessContext | null; error?: string }> {
  const cleanToken = token.trim()
  if (!cleanToken) return { access: null, error: 'Token de portal invalido.' }

  const { data } = await supabaseAdmin
    .from('client_portal_tokens')
    .select('id, contact_id, expires_at, access_count, contacts(id, first_name, last_name, email)')
    .eq('token', cleanToken)
    .eq('is_active', true)
    .single()

  if (!data) return { access: null, error: 'Token de portal no encontrado.' }
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { access: null, error: 'Token de portal expirado.' }
  }

  return { access: data as unknown as PortalAccessContext }
}

export async function touchPortalAccess(access: PortalAccessContext) {
  await supabaseAdmin
    .from('client_portal_tokens')
    .update({
      last_accessed_at: new Date().toISOString(),
      access_count: (access.access_count ?? 0) + 1,
    })
    .eq('id', access.id)
}
