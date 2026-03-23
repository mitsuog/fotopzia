import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const { data: portalToken } = await supabaseAdmin
    .from('client_portal_tokens')
    .select('id, contact_id, expires_at, is_active')
    .eq('token', token)
    .eq('is_active', true)
    .single()

  if (!portalToken) {
    return NextResponse.json({ error: 'Portal token not found' }, { status: 404 })
  }

  if (portalToken.expires_at && new Date(portalToken.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Portal token expired' }, { status: 410 })
  }

  const contactId = portalToken.contact_id

  const [{ count: albumsCount }, { count: quotesCount }, { count: contractsCount }, { count: activeProjectsCount }] =
    await Promise.all([
      supabaseAdmin.from('albums').select('*', { count: 'exact', head: true }).eq('contact_id', contactId).eq('is_published', true),
      supabaseAdmin.from('quotes').select('*', { count: 'exact', head: true }).eq('contact_id', contactId),
      supabaseAdmin.from('contracts').select('*', { count: 'exact', head: true }).eq('contact_id', contactId).neq('status', 'voided'),
      supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).eq('contact_id', contactId).not('stage', 'eq', 'cierre').neq('is_archived', true),
    ])

  return NextResponse.json({
    data: {
      albums: albumsCount ?? 0,
      quotes: quotesCount ?? 0,
      contracts: contractsCount ?? 0,
      active_projects: activeProjectsCount ?? 0,
    },
  })
}

