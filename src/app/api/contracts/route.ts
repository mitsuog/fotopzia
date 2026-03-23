import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serializeContractContent } from '@/lib/documents/contracts'
import { buildContractDraftData, type ContractDraftPayload } from '@/lib/contracts/build-contract-draft'
import type { ContractAnnex } from '@/types/quotes'
import type { Json } from '@/lib/supabase/types'

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip')
}

async function getPortalLinkForContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
  createdBy: string,
  request: Request,
) {
  const { data: tokens } = await supabase
    .from('client_portal_tokens')
    .select('id, token, expires_at')
    .eq('contact_id', contactId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const now = Date.now()
  let selectedToken = tokens?.find(token => !token.expires_at || new Date(token.expires_at).getTime() > now)

  if (!selectedToken) {
    const expiresAt = new Date(now + 1000 * 60 * 60 * 24 * 30).toISOString()
    const { data: inserted, error: tokenError } = await supabase
      .from('client_portal_tokens')
      .insert({
        contact_id: contactId,
        label: 'Firma de documentos',
        is_active: true,
        expires_at: expiresAt,
        created_by: createdBy,
      })
      .select('id, token, expires_at')
      .single()

    if (tokenError || !inserted) {
      throw new Error(tokenError?.message ?? 'No fue posible crear token de portal.')
    }
    selectedToken = inserted
  }

  const origin = new URL(request.url).origin
  return `${origin}/portal/${selectedToken.token}/documents`
}

export async function POST(request: Request) {
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

  const formData = await request.formData()
  const payloadRaw = formData.get('payload')
  if (typeof payloadRaw !== 'string') {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  let payload: ContractDraftPayload
  try {
    payload = JSON.parse(payloadRaw) as ContractDraftPayload
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  try {
    const draft = await buildContractDraftData(supabase, payload)

    await supabase
      .from('quotes')
      .update({
        client_entity_type: draft.normalizedSource.entityType,
        client_legal_name: draft.normalizedSource.clientLegalName,
        client_representative_name: draft.normalizedSource.representativeName,
        client_representative_role: draft.normalizedSource.entityType === 'persona_moral' ? draft.normalizedSource.representativeRole : null,
        client_legal_address: draft.normalizedSource.clientAddress,
        service_type: draft.normalizedSource.serviceType,
        service_description: draft.normalizedSource.serviceDescription,
        service_location: draft.normalizedSource.serviceLocation,
        service_date: draft.normalizedSource.serviceDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.latestApprovedQuote.id)

    await supabase
      .from('contacts')
      .update({
        legal_entity_type: draft.normalizedSource.entityType,
        legal_name: draft.normalizedSource.clientLegalName,
        legal_representative_name: draft.normalizedSource.entityType === 'persona_moral' ? draft.normalizedSource.representativeName : null,
        legal_representative_role: draft.normalizedSource.entityType === 'persona_moral' ? draft.normalizedSource.representativeRole : null,
        legal_address: draft.normalizedSource.clientAddress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.contactId)

    const initialContent = serializeContractContent({
      body: draft.body,
      include_quote_document: draft.includeQuoteDocument,
      source_pdf_path: null,
      template_data: draft.templateData,
      annexes: [],
    })

    const { data: contract, error: contractError } = await supabase
      .from('contracts')
      .insert({
        contact_id: draft.contactId,
        quote_id: draft.latestApprovedQuote.id,
        title: draft.title,
        content: initialContent,
        status: 'draft',
        created_by: user.id,
        page_count: draft.computedPageCount,
        annexes: [] as Json,
        signature_ip: getClientIp(request),
      })
      .select('id, contract_number, contact_id')
      .single()

    if (contractError || !contract) {
      return NextResponse.json({ error: contractError?.message ?? 'No fue posible crear el contrato.' }, { status: 400 })
    }

    const annexes: ContractAnnex[] = draft.annexTemplates.map(template => {
      const annexId = crypto.randomUUID()
      return {
        id: annexId,
        title: template.title,
        storage_path: `contracts/${contract.id}/annexes/${template.key}-${annexId}.pdf`,
        mime_type: 'application/pdf',
        requires_signature: template.requires_signature,
        template_key: template.key,
        body: template.body,
        signed_at: null,
        signed_by: null,
        signature_data: null,
      }
    })

    const updatedContent = serializeContractContent({
      body: draft.body,
      include_quote_document: draft.includeQuoteDocument,
      source_pdf_path: null,
      template_data: draft.templateData,
      annexes,
    })

    const { error: updateContractError } = await supabase
      .from('contracts')
      .update({
        content: updatedContent,
        annexes: annexes as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id)

    if (updateContractError) {
      return NextResponse.json({ error: updateContractError.message }, { status: 400 })
    }

    const portalUrl = await getPortalLinkForContact(supabase, draft.contactId, user.id, request)

    const { error: activityError } = await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: draft.contactId,
      deal_id: draft.latestApprovedQuote.deal_id,
      subject: 'Contrato creado',
      body: `Se creo el contrato ${contract.contract_number} con ${annexes.length} anexo(s) desde la cotizacion aprobada ${draft.latestApprovedQuote.quote_number}.`,
      created_by: user.id,
    })

    if (activityError) {
      console.error('[contracts] No se pudo registrar actividad de creacion:', activityError.message)
    }

    return NextResponse.json({
      data: {
        id: contract.id,
        contract_number: contract.contract_number,
        portal_url: portalUrl,
        computed_page_count: draft.computedPageCount,
      },
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No fue posible crear el contrato.',
    }, { status: 400 })
  }
}
