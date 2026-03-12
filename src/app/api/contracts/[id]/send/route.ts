import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseContractContent } from '@/lib/documents/contracts'

async function ensurePortalLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
  createdBy: string,
  request: Request,
) {
  const { data: tokens } = await supabase
    .from('client_portal_tokens')
    .select('token, expires_at')
    .eq('contact_id', contactId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const validToken = tokens?.find(token => !token.expires_at || new Date(token.expires_at) > new Date())
  const origin = new URL(request.url).origin
  if (validToken) return `${origin}/portal/${validToken.token}/documents`

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  const { data: inserted, error } = await supabase
    .from('client_portal_tokens')
    .insert({
      contact_id: contactId,
      label: 'Firma de documentos',
      is_active: true,
      expires_at: expiresAt,
      created_by: createdBy,
    })
    .select('token')
    .single()

  if (error || !inserted) {
    throw new Error(error?.message ?? 'No fue posible crear token de portal.')
  }

  return `${origin}/portal/${inserted.token}/documents`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'project_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, contact_id, quote_id, status, content, contract_number, title')
    .eq('id', id)
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
  }

  if (contract.status === 'signed') {
    return NextResponse.json({ error: 'El contrato ya esta firmado.' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('contracts')
    .update({
      status: 'sent',
      sent_at: nowIso,
      viewed_at: contract.status === 'draft' ? null : undefined,
      updated_at: nowIso,
    })
    .eq('id', contract.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const parsedContent = parseContractContent(contract.content)
  if (parsedContent.include_quote_document && contract.quote_id) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('status')
      .eq('id', contract.quote_id)
      .single()
    if (quote && (quote.status === 'draft' || quote.status === 'expired')) {
      await supabase
        .from('quotes')
        .update({
          status: 'sent',
          sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', contract.quote_id)
    }
  }

  const portalUrl = await ensurePortalLink(supabase, contract.contact_id, user.id, request)

  const { error: activityError } = await supabase.from('activities').insert({
    type: 'stage_change',
    contact_id: contract.contact_id,
    deal_id: contract.quote_id ? null : null,
    subject: 'Contrato enviado a firma',
    body: `Se envio a firma el contrato ${contract.contract_number}.`,
    created_by: user.id,
  })

  if (activityError) {
    console.error('[contracts] No se pudo registrar actividad de envio:', activityError.message)
  }

  return NextResponse.json({
    data: {
      id: contract.id,
      status: 'sent',
      portal_url: portalUrl,
    },
  })
}
