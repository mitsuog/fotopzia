import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  buildContractBodyFromTemplate,
  getContractAnnexTemplates,
  getDefaultContractTemplateData,
  serializeContractContent,
} from '@/lib/documents/contracts'
import type { ContractAnnex } from '@/types/quotes'
import type { Json } from '@/lib/supabase/types'

type CreateContractPayload = {
  contact_id: string
  page_count?: number
  include_quote_document?: boolean
  quote_id?: string | null
}

type NormalizedContractSource = {
  entityType: 'persona_fisica' | 'persona_moral'
  clientLegalName: string
  representativeName: string
  representativeRole: string
  clientAddress: string
  serviceType: string
  serviceDescription: string
  serviceLocation: string
  serviceDate: string | null
  missingFields: string[]
}

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

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function buildServiceDescriptionFallback(rawLineItems: Array<{ description: string | null }> | null | undefined): string {
  const descriptions = (rawLineItems ?? [])
    .map(item => normalizeText(item.description))
    .filter(Boolean)
  if (!descriptions.length) return ''
  return descriptions.slice(0, 6).join(' | ')
}

function resolveContractSourceData(input: {
  quote: {
    title: string | null
    client_entity_type: string | null
    client_legal_name: string | null
    client_representative_name: string | null
    client_representative_role: string | null
    client_legal_address: string | null
    service_type: string | null
    service_description: string | null
    service_date: string | null
    service_location: string | null
  }
  contact: {
    first_name: string
    last_name: string
    company_name: string | null
    legal_entity_type: string | null
    legal_name: string | null
    legal_representative_name: string | null
    legal_representative_role: string | null
    legal_address: string | null
  }
  lineItems: Array<{ description: string | null }> | null
}): NormalizedContractSource {
  const fullName = `${input.contact.first_name} ${input.contact.last_name}`.trim()
  const contactCompany = normalizeText(input.contact.company_name)
  const contactEntityType =
    input.contact.legal_entity_type === 'persona_moral'
      ? 'persona_moral'
      : input.contact.legal_entity_type === 'persona_fisica'
        ? 'persona_fisica'
        : null
  const quoteEntityType =
    input.quote.client_entity_type === 'persona_moral'
      ? 'persona_moral'
      : input.quote.client_entity_type === 'persona_fisica'
        ? 'persona_fisica'
        : null
  const entityType: 'persona_fisica' | 'persona_moral' = contactEntityType ?? quoteEntityType ?? 'persona_fisica'

  const clientLegalName = normalizeText(input.quote.client_legal_name)
    || normalizeText(input.contact.legal_name)
    || (entityType === 'persona_moral' ? (contactCompany || fullName) : fullName)

  const representativeName = entityType === 'persona_moral'
    ? (normalizeText(input.quote.client_representative_name) || normalizeText(input.contact.legal_representative_name))
    : (normalizeText(input.quote.client_representative_name) || fullName || clientLegalName)

  const representativeRole = entityType === 'persona_moral'
    ? (normalizeText(input.quote.client_representative_role) || normalizeText(input.contact.legal_representative_role))
    : 'No aplica (persona fisica)'

  const clientAddress = normalizeText(input.quote.client_legal_address)
    || normalizeText(input.contact.legal_address)

  const serviceType = normalizeText(input.quote.service_type)
    || normalizeText(input.quote.title)

  const serviceDescription = normalizeText(input.quote.service_description)
    || buildServiceDescriptionFallback(input.lineItems)
    || normalizeText(input.quote.title)

  const serviceLocation = normalizeText(input.quote.service_location)
    || normalizeText(input.contact.legal_address)

  const serviceDate = input.quote.service_date ?? null

  const missingFields: string[] = []
  if (!clientLegalName) missingFields.push('nombre legal del cliente')
  if (!clientAddress) missingFields.push('domicilio legal del cliente')
  if (!serviceType) missingFields.push('tipo de servicio')
  if (!serviceDescription) missingFields.push('descripcion del servicio')
  if (!serviceLocation) missingFields.push('ubicacion del servicio')
  if (entityType === 'persona_moral' && !representativeName) missingFields.push('representante legal')
  if (entityType === 'persona_moral' && !representativeRole) missingFields.push('cargo del representante legal')

  return {
    entityType,
    clientLegalName,
    representativeName,
    representativeRole,
    clientAddress,
    serviceType,
    serviceDescription,
    serviceLocation,
    serviceDate,
    missingFields,
  }
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

  let payload: CreateContractPayload
  try {
    payload = JSON.parse(payloadRaw) as CreateContractPayload
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })
  }

  const contactId = payload.contact_id?.trim()
  const pageCount = Number(payload.page_count ?? 1)
  const includeQuoteDocument = Boolean(payload.include_quote_document)
  const title = 'Contrato de prestacion de servicios Fotopzia Mexico'

  if (!contactId) return NextResponse.json({ error: 'Selecciona un contacto.' }, { status: 400 })
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return NextResponse.json({ error: 'El numero de paginas para antefirma debe ser mayor a 0.' }, { status: 400 })
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, company_name, legal_entity_type, legal_name, legal_representative_name, legal_representative_role, legal_address')
    .eq('id', contactId)
    .single()

  if (!contact) return NextResponse.json({ error: 'El contacto no existe.' }, { status: 400 })

  const { data: latestApprovedQuote, error: latestQuoteError } = await supabase
    .from('quotes')
    .select('id, deal_id, quote_number, title, approved_at, updated_at, client_entity_type, client_legal_name, client_representative_name, client_representative_role, client_legal_address, service_type, service_description, service_date, service_location')
    .eq('contact_id', contactId)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestQuoteError) {
    return NextResponse.json({ error: latestQuoteError.message }, { status: 400 })
  }

  if (!latestApprovedQuote) {
    return NextResponse.json({
      error: 'El contacto no tiene cotizacion aprobada. Debes aprobar una cotizacion con datos legales y del servicio.',
    }, { status: 400 })
  }

  const { data: lineItems } = await supabase
    .from('quote_line_items')
    .select('description')
    .eq('quote_id', latestApprovedQuote.id)
    .order('sort_order', { ascending: true })

  const normalizedSource = resolveContractSourceData({
    quote: latestApprovedQuote,
    contact,
    lineItems: lineItems ?? [],
  })

  if (normalizedSource.missingFields.length > 0) {
    return NextResponse.json({
      error: `Faltan campos obligatorios para contrato: ${normalizedSource.missingFields.join(', ')}.`,
    }, { status: 400 })
  }

  await supabase
    .from('quotes')
    .update({
      client_entity_type: normalizedSource.entityType,
      client_legal_name: normalizedSource.clientLegalName,
      client_representative_name: normalizedSource.representativeName,
      client_representative_role: normalizedSource.entityType === 'persona_moral' ? normalizedSource.representativeRole : null,
      client_legal_address: normalizedSource.clientAddress,
      service_type: normalizedSource.serviceType,
      service_description: normalizedSource.serviceDescription,
      service_location: normalizedSource.serviceLocation,
      service_date: normalizedSource.serviceDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', latestApprovedQuote.id)

  await supabase
    .from('contacts')
    .update({
      legal_entity_type: normalizedSource.entityType,
      legal_name: normalizedSource.clientLegalName,
      legal_representative_name: normalizedSource.entityType === 'persona_moral' ? normalizedSource.representativeName : null,
      legal_representative_role: normalizedSource.entityType === 'persona_moral' ? normalizedSource.representativeRole : null,
      legal_address: normalizedSource.clientAddress,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)

  const templateData = getDefaultContractTemplateData({
    client_legal_name: normalizedSource.clientLegalName,
    client_representative_name: normalizedSource.representativeName,
    client_representative_role: normalizedSource.representativeRole,
    client_address: normalizedSource.clientAddress,
    service_type: normalizedSource.serviceType,
    service_description: normalizedSource.serviceDescription,
    event_date: normalizedSource.serviceDate,
    event_location: normalizedSource.serviceLocation,
  })

  const body = buildContractBodyFromTemplate(templateData)

  const content = serializeContractContent({
    body,
    include_quote_document: includeQuoteDocument,
    source_pdf_path: null,
    template_data: templateData,
    annexes: [],
  })

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      contact_id: contactId,
      quote_id: latestApprovedQuote.id,
      title,
      content,
      status: 'draft',
      created_by: user.id,
      page_count: pageCount,
      annexes: [] as Json,
      signature_ip: getClientIp(request),
    })
    .select('id, contract_number, contact_id')
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: contractError?.message ?? 'No fue posible crear el contrato.' }, { status: 400 })
  }

  const annexes: ContractAnnex[] = getContractAnnexTemplates().map(template => {
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
    body,
    include_quote_document: includeQuoteDocument,
    source_pdf_path: null,
    template_data: templateData,
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

  const portalUrl = await getPortalLinkForContact(supabase, contactId, user.id, request)

  const { error: activityError } = await supabase.from('activities').insert({
    type: 'stage_change',
    contact_id: contactId,
    deal_id: latestApprovedQuote.deal_id,
    subject: 'Contrato creado',
    body: `Se creo el contrato ${contract.contract_number} desde la cotizacion aprobada ${latestApprovedQuote.quote_number}.`,
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
    },
  })
}
