import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseContractContent, sanitizeStorageFileName, serializeContractContent } from '@/lib/documents/contracts'
import type { ContractAnnex } from '@/types/quotes'

type CreateContractPayload = {
  contact_id: string
  quote_id?: string | null
  title: string
  body: string
  page_count?: number
  include_quote_document?: boolean
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
  const quoteId = payload.quote_id?.trim() || null
  const title = payload.title?.trim()
  const body = payload.body?.trim()
  const pageCount = Number(payload.page_count ?? 1)
  const includeQuoteDocument = Boolean(payload.include_quote_document)

  if (!contactId) return NextResponse.json({ error: 'Selecciona un contacto.' }, { status: 400 })
  if (!title) return NextResponse.json({ error: 'El titulo es obligatorio.' }, { status: 400 })
  if (!body) return NextResponse.json({ error: 'El contenido del contrato es obligatorio.' }, { status: 400 })
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    return NextResponse.json({ error: 'El numero de paginas para antefirma debe ser mayor a 0.' }, { status: 400 })
  }

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('id', contactId)
    .single()
  if (!contact) return NextResponse.json({ error: 'El contacto no existe.' }, { status: 400 })

  let quoteDealId: string | null = null
  if (quoteId) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('id, contact_id, deal_id')
      .eq('id', quoteId)
      .single()
    if (!quote) return NextResponse.json({ error: 'La cotizacion seleccionada no existe.' }, { status: 400 })
    if (quote.contact_id !== contactId) {
      return NextResponse.json({ error: 'La cotizacion no corresponde al contacto seleccionado.' }, { status: 400 })
    }
    quoteDealId = quote.deal_id
  }

  const mainContractFile = formData.get('main_contract_file')
  let sourcePdfPath: string | null = null

  if (mainContractFile instanceof File && mainContractFile.size > 0) {
    const safeName = sanitizeStorageFileName(mainContractFile.name || 'contrato-base.pdf')
    const path = `contracts/${contactId}/drafts/main-${Date.now()}-${safeName}`
    const fileBuffer = await mainContractFile.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('contracts-signed')
      .upload(path, fileBuffer, {
        contentType: mainContractFile.type || 'application/pdf',
        upsert: false,
      })
    if (uploadError) {
      return NextResponse.json({ error: `No fue posible subir el contrato base: ${uploadError.message}` }, { status: 400 })
    }
    sourcePdfPath = path
  }

  const annexFiles = formData
    .getAll('annex_files')
    .filter((file): file is File => file instanceof File && file.size > 0)

  const annexes: ContractAnnex[] = []
  for (const annexFile of annexFiles) {
    const annexId = crypto.randomUUID()
    const safeName = sanitizeStorageFileName(annexFile.name || `${annexId}.pdf`)
    const path = `contracts/${contactId}/drafts/annex-${annexId}-${safeName}`
    const fileBuffer = await annexFile.arrayBuffer()
    const { error: uploadError } = await supabase.storage
      .from('contracts-signed')
      .upload(path, fileBuffer, {
        contentType: annexFile.type || 'application/pdf',
        upsert: false,
      })
    if (uploadError) {
      return NextResponse.json({ error: `No fue posible subir anexo: ${uploadError.message}` }, { status: 400 })
    }

    annexes.push({
      id: annexId,
      title: annexFile.name,
      storage_path: path,
      mime_type: annexFile.type || 'application/pdf',
      requires_signature: true,
      signed_at: null,
      signed_by: null,
      signature_data: null,
    })
  }

  const content = serializeContractContent({
    ...parseContractContent(body),
    body,
    include_quote_document: includeQuoteDocument,
    source_pdf_path: sourcePdfPath,
    annexes,
  })

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .insert({
      contact_id: contactId,
      quote_id: quoteId,
      title,
      content,
      status: 'draft',
      created_by: user.id,
      page_count: pageCount,
      annexes,
      signature_ip: getClientIp(request),
    })
    .select('id, contract_number, contact_id')
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: contractError?.message ?? 'No fue posible crear el contrato.' }, { status: 400 })
  }

  const portalUrl = await getPortalLinkForContact(supabase, contactId, user.id, request)

  const { error: activityError } = await supabase.from('activities').insert({
    type: 'stage_change',
    contact_id: contactId,
    deal_id: quoteDealId,
    subject: 'Contrato creado',
    body: `Se creo el contrato ${contract.contract_number} (${title}).`,
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
