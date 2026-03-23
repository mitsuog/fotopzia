import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  buildContractBodyFromTemplate,
  getContractAnnexTemplates,
  getDefaultContractTemplateData,
  type ContractAnnexTemplate,
  type ContractTemplateData,
} from '@/lib/documents/contracts'
import { estimateContractPageCount } from '@/lib/documents/contract-pagination'

export type ContractDraftPayload = {
  contact_id: string
  page_count?: number
  include_quote_document?: boolean
  quote_id?: string | null
  advance_percentage?: number
  participants_description?: string
  special_restrictions?: string
  include_annexo_c?: boolean
  annexo_c_authorizations?: string[]
  annexo_c_restrictions?: string
  annexo_c_signer_role?: string
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

type QuoteLineItem = {
  description: string | null
}

type ContactRow = {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
  legal_entity_type: string | null
  legal_name: string | null
  legal_representative_name: string | null
  legal_representative_role: string | null
  legal_address: string | null
}

type ApprovedQuoteRow = {
  id: string
  deal_id: string | null
  quote_number: string
  title: string | null
  total: number | null
  currency: string | null
  approved_at: string | null
  updated_at: string | null
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

type ProjectDeliverableRow = {
  name: string | null
  due_at: string | null
  status: string | null
}

export type ContractDraftBuildResult = {
  contactId: string
  title: string
  includeQuoteDocument: boolean
  latestApprovedQuote: ApprovedQuoteRow
  normalizedSource: NormalizedContractSource
  templateData: ContractTemplateData
  body: string
  annexTemplates: ContractAnnexTemplate[]
  computedPageCount: number
}

function normalizeText(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function buildServiceDescriptionFallback(rawLineItems: QuoteLineItem[] | null | undefined): string {
  const descriptions = (rawLineItems ?? [])
    .map(item => normalizeText(item.description))
    .filter(Boolean)
  if (!descriptions.length) return ''
  return descriptions.slice(0, 6).join(' | ')
}

function formatMXN(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function integerToSpanishWords(n: number): string {
  if (n === 0) return 'cero'
  if (n < 0) return `menos ${integerToSpanishWords(-n)}`

  const unidades = [
    '', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
    'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve',
  ]
  const veintis = ['', 'veintiun', 'veintidos', 'veintitres', 'veinticuatro', 'veinticinco', 'veintiseis', 'veintisiete', 'veintiocho', 'veintinueve']
  const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
  const centenas = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

  const parts: string[] = []

  if (n >= 1_000_000) {
    const m = Math.floor(n / 1_000_000)
    parts.push(m === 1 ? 'un millon' : `${integerToSpanishWords(m)} millones`)
    n %= 1_000_000
  }
  if (n >= 1000) {
    const t = Math.floor(n / 1000)
    parts.push(t === 1 ? 'mil' : `${integerToSpanishWords(t)} mil`)
    n %= 1000
  }
  if (n >= 100) {
    const c = Math.floor(n / 100)
    const remainder = n % 100
    if (n === 100) parts.push('cien')
    else parts.push(centenas[c])
    n = remainder
  }
  if (n >= 20) {
    const d = Math.floor(n / 10)
    const u = n % 10
    if (n >= 21 && n <= 29) parts.push(veintis[u])
    else if (u === 0) parts.push(decenas[d])
    else parts.push(`${decenas[d]} y ${unidades[u]}`)
  } else if (n > 0) {
    parts.push(unidades[n])
  }

  return parts.filter(Boolean).join(' ')
}

function numberToMXNWords(amount: number): string {
  const integer = Math.floor(amount)
  const cents = Math.round((amount - integer) * 100)
  const centsStr = cents.toString().padStart(2, '0')
  return `${integerToSpanishWords(integer)} pesos ${centsStr}/100 M.N.`
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
  contact: ContactRow
  lineItems: QuoteLineItem[] | null
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

export async function buildContractDraftData(
  supabase: SupabaseClient<Database>,
  payload: ContractDraftPayload,
): Promise<ContractDraftBuildResult> {
  const contactId = payload.contact_id?.trim()
  const includeQuoteDocument = Boolean(payload.include_quote_document)
  const advancePercentage = Math.max(1, Math.min(100, Number(payload.advance_percentage ?? 50)))
  const participantsDescription = payload.participants_description?.trim() ?? ''
  const specialRestrictions = payload.special_restrictions?.trim() ?? ''
  const includeAnexoC = Boolean(payload.include_annexo_c)
  const anexoCAuthorizations = Array.isArray(payload.annexo_c_authorizations) ? payload.annexo_c_authorizations : []
  const anexoCRestrictions = payload.annexo_c_restrictions?.trim() ?? ''
  const anexoCSigner = payload.annexo_c_signer_role?.trim() || 'Titular'
  const title = 'Contrato de prestacion de servicios creativos - Fotopzia Mexico'

  if (!contactId) throw new Error('Selecciona un contacto.')

  const { data: contact } = await supabase
    .from('contacts')
    .select('id, first_name, last_name, company_name, legal_entity_type, legal_name, legal_representative_name, legal_representative_role, legal_address')
    .eq('id', contactId)
    .single<ContactRow>()

  if (!contact) throw new Error('El contacto no existe.')

  const { data: latestApprovedQuote, error: latestQuoteError } = await supabase
    .from('quotes')
    .select('id, deal_id, quote_number, title, total, currency, approved_at, updated_at, client_entity_type, client_legal_name, client_representative_name, client_representative_role, client_legal_address, service_type, service_description, service_date, service_location')
    .eq('contact_id', contactId)
    .eq('status', 'approved')
    .order('approved_at', { ascending: false })
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<ApprovedQuoteRow>()

  if (latestQuoteError) throw new Error(latestQuoteError.message)

  if (!latestApprovedQuote) {
    throw new Error('El contacto no tiene cotizacion aprobada. Debes aprobar una cotizacion con datos legales y del servicio.')
  }

  const lineItemsResult = await supabase
    .from('quote_line_items')
    .select('description')
    .eq('quote_id', latestApprovedQuote.id)
    .order('sort_order', { ascending: true })

  if (lineItemsResult.error) throw new Error(lineItemsResult.error.message)
  const lineItems = (lineItemsResult.data ?? []) as QuoteLineItem[]

  const { data: activeProject } = await supabase
    .from('projects')
    .select('id')
    .eq('contact_id', contactId)
    .neq('stage', 'cierre')
    .neq('is_archived', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>()

  let deliverableRows: Array<{ milestone: string; date: string; notes: string }> = []

  if (activeProject?.id) {
    const { data: pdRows, error: pdError } = await supabase
      .from('project_deliverables')
      .select('name, due_at, status')
      .eq('project_id', activeProject.id)
      .order('due_at', { ascending: true })
      .limit(10)

    if (pdError) throw new Error(pdError.message)

    if (pdRows && pdRows.length > 0) {
      deliverableRows = (pdRows as ProjectDeliverableRow[]).map(pd => ({
        milestone: typeof pd.name === 'string' ? pd.name : '',
        date: typeof pd.due_at === 'string' && pd.due_at
          ? new Date(pd.due_at).toLocaleDateString('es-MX')
          : 'Por definir',
        notes: typeof pd.status === 'string' ? pd.status : '',
      }))
    }
  }

  if (deliverableRows.length === 0 && lineItems.length > 0) {
    deliverableRows = lineItems
      .filter(li => li.description)
      .map(li => ({
        milestone: li.description ?? '',
        date: latestApprovedQuote.service_date
          ? new Date(latestApprovedQuote.service_date).toLocaleDateString('es-MX')
          : 'Por definir',
        notes: '',
      }))
  }

  const totalRaw = Number(latestApprovedQuote.total ?? 0)
  const advanceRaw = totalRaw * (advancePercentage / 100)
  const balanceRaw = totalRaw - advanceRaw

  const normalizedSource = resolveContractSourceData({
    quote: latestApprovedQuote,
    contact,
    lineItems,
  })

  if (normalizedSource.missingFields.length > 0) {
    throw new Error(`Faltan campos obligatorios para contrato: ${normalizedSource.missingFields.join(', ')}.`)
  }

  const templateData = getDefaultContractTemplateData({
    client_legal_name: normalizedSource.clientLegalName,
    client_representative_name: normalizedSource.representativeName,
    client_representative_role: normalizedSource.representativeRole,
    client_address: normalizedSource.clientAddress,
    service_type: normalizedSource.serviceType,
    service_description: normalizedSource.serviceDescription,
    event_date: normalizedSource.serviceDate,
    event_location: normalizedSource.serviceLocation,
    total_amount: formatMXN(totalRaw),
    total_amount_text: numberToMXNWords(totalRaw),
    advance_percentage: advancePercentage,
    advance_amount: formatMXN(advanceRaw),
    balance_amount: formatMXN(balanceRaw),
    participants_description: participantsDescription,
    special_restrictions: specialRestrictions,
    deliverables: deliverableRows,
    include_annexo_c: includeAnexoC,
    annexo_c_authorizations: anexoCAuthorizations,
    annexo_c_restrictions: anexoCRestrictions,
    annexo_c_signer_role: anexoCSigner,
  })

  const body = buildContractBodyFromTemplate(templateData)
  const annexTemplates = getContractAnnexTemplates(templateData)
  const computedPageCount = estimateContractPageCount(body)

  return {
    contactId,
    title,
    includeQuoteDocument,
    latestApprovedQuote,
    normalizedSource,
    templateData,
    body,
    annexTemplates,
    computedPageCount,
  }
}
