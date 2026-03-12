import type { ContractAnnex } from '@/types/quotes'

export interface ContractTemplateData {
  client_legal_name: string
  client_representative_name: string
  client_representative_role: string
  client_address: string
  service_type: string
  service_description: string
  event_date: string | null
  event_location: string
  company_legal_name: string
  company_representative_name: string
  company_representative_role: string
  jurisdiction_city: string
  jurisdiction_state: string
}

export interface ContractAnnexTemplate {
  key: string
  title: string
  body: string
  requires_signature: boolean
}

export interface ContractContentPayload {
  body: string
  include_quote_document: boolean
  source_pdf_path: string | null
  template_data: ContractTemplateData
  annexes: ContractAnnex[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const DEFAULT_COMPANY_LEGAL_NAME = 'Fotopzia Mexico'
const DEFAULT_COMPANY_REPRESENTATIVE = 'Representante autorizado'
const DEFAULT_COMPANY_ROLE = 'Representante legal'

const CONTRACT_ANNEX_TEMPLATES: ContractAnnexTemplate[] = [
  {
    key: 'anexo-a',
    title: 'Anexo A - Condiciones economicas y forma de pago',
    requires_signature: true,
    body: [
      '1. El cliente reconoce que los importes, anticipos y fechas de pago son los definidos en la cotizacion vigente.',
      '2. Los pagos se consideran aplicados una vez acreditados en los medios oficiales de cobro de Fotopzia Mexico.',
      '3. El incumplimiento de pago puede suspender entregables, cobertura o reprogramacion hasta regularizar el saldo.',
    ].join('\n'),
  },
  {
    key: 'anexo-b',
    title: 'Anexo B - Reprogramacion, cancelacion y fuerza mayor',
    requires_signature: true,
    body: [
      '1. Toda reprogramacion debe solicitarse por escrito y esta sujeta a disponibilidad de agenda.',
      '2. Las cancelaciones pueden generar cargos conforme al avance operativo ya comprometido por Fotopzia Mexico.',
      '3. En caso de fuerza mayor se procurara una nueva fecha; si no es viable, aplicaran terminos de liquidacion pactados.',
    ].join('\n'),
  },
  {
    key: 'anexo-c',
    title: 'Anexo C - Entregables, propiedad intelectual y uso de imagen',
    requires_signature: true,
    body: [
      '1. Los entregables, formatos y tiempos de entrega seran los pactados en cotizacion y este contrato.',
      '2. Fotopzia Mexico conserva derechos de autoria, salvo cesion expresa por escrito.',
      '3. El cliente autoriza el uso de material con fines de portafolio, salvo oposicion expresa por escrito.',
    ].join('\n'),
  },
]

export function toContractAnnexes(value: unknown): ContractAnnex[] {
  if (!Array.isArray(value)) return []

  const annexes: ContractAnnex[] = []
  for (const item of value) {
    if (!isRecord(item)) continue
    const id = typeof item.id === 'string' ? item.id : ''
    const title = typeof item.title === 'string' ? item.title : ''
    const storagePath = typeof item.storage_path === 'string' ? item.storage_path : ''
    if (!id || !title || !storagePath) continue

    annexes.push({
      id,
      title,
      storage_path: storagePath,
      mime_type: typeof item.mime_type === 'string' ? item.mime_type : 'application/pdf',
      requires_signature: Boolean(item.requires_signature),
      template_key: typeof item.template_key === 'string' ? item.template_key : null,
      body: typeof item.body === 'string' ? item.body : null,
      signed_at: typeof item.signed_at === 'string' ? item.signed_at : null,
      signed_by: typeof item.signed_by === 'string' ? item.signed_by : null,
      signature_data: typeof item.signature_data === 'string' ? item.signature_data : null,
    })
  }

  return annexes
}

export function getDefaultContractBody(): string {
  return buildContractBodyFromTemplate(getDefaultContractTemplateData())
}

export function getDefaultContractTemplateData(
  overrides: Partial<ContractTemplateData> = {},
): ContractTemplateData {
  return {
    client_legal_name: overrides.client_legal_name ?? '',
    client_representative_name: overrides.client_representative_name ?? '',
    client_representative_role: overrides.client_representative_role ?? '',
    client_address: overrides.client_address ?? '',
    service_type: overrides.service_type ?? '',
    service_description: overrides.service_description ?? '',
    event_date: overrides.event_date ?? null,
    event_location: overrides.event_location ?? '',
    company_legal_name: overrides.company_legal_name ?? DEFAULT_COMPANY_LEGAL_NAME,
    company_representative_name: overrides.company_representative_name ?? DEFAULT_COMPANY_REPRESENTATIVE,
    company_representative_role: overrides.company_representative_role ?? DEFAULT_COMPANY_ROLE,
    jurisdiction_city: overrides.jurisdiction_city ?? 'Veracruz',
    jurisdiction_state: overrides.jurisdiction_state ?? 'Veracruz',
  }
}

export function toContractTemplateData(
  value: unknown,
  defaults: Partial<ContractTemplateData> = {},
): ContractTemplateData {
  const safeDefaults = getDefaultContractTemplateData(defaults)
  if (!isRecord(value)) return safeDefaults

  return {
    client_legal_name: readString(value.client_legal_name, safeDefaults.client_legal_name),
    client_representative_name: readString(value.client_representative_name, safeDefaults.client_representative_name),
    client_representative_role: readString(value.client_representative_role, safeDefaults.client_representative_role),
    client_address: readString(value.client_address, safeDefaults.client_address),
    service_type: readString(value.service_type, safeDefaults.service_type),
    service_description: readString(value.service_description, safeDefaults.service_description),
    event_date: readNullableString(value.event_date) ?? safeDefaults.event_date,
    event_location: readString(value.event_location, safeDefaults.event_location),
    company_legal_name: readString(value.company_legal_name, safeDefaults.company_legal_name),
    company_representative_name: readString(value.company_representative_name, safeDefaults.company_representative_name),
    company_representative_role: readString(value.company_representative_role, safeDefaults.company_representative_role),
    jurisdiction_city: readString(value.jurisdiction_city, safeDefaults.jurisdiction_city),
    jurisdiction_state: readString(value.jurisdiction_state, safeDefaults.jurisdiction_state),
  }
}

export function getContractAnnexTemplates(): ContractAnnexTemplate[] {
  return CONTRACT_ANNEX_TEMPLATES.map(template => ({ ...template }))
}

export function buildContractBodyFromTemplate(templateData: ContractTemplateData): string {
  const eventDateLabel = templateData.event_date || 'Pendiente por definir'
  const eventLocation = templateData.event_location || 'Pendiente por definir'

  return [
    'CONTRATO DE PRESTACION DE SERVICIOS FOTOGRAFICOS Y/O VIDEO',
    '',
    'I. PARTES',
    `Comparecen por una parte ${templateData.company_legal_name}, representada por ${templateData.company_representative_name} (${templateData.company_representative_role}), en adelante "EL PRESTADOR"; y por la otra ${templateData.client_legal_name}, representada por ${templateData.client_representative_name} (${templateData.client_representative_role}), en adelante "EL CLIENTE".`,
    '',
    'II. OBJETO',
    `EL PRESTADOR se obliga a realizar el servicio tipo "${templateData.service_type}" para EL CLIENTE, conforme a la descripcion operativa siguiente: ${templateData.service_description}.`,
    '',
    'III. DATOS OPERATIVOS',
    `Fecha del servicio: ${eventDateLabel}.`,
    `Ubicacion del servicio: ${eventLocation}.`,
    `Domicilio legal del cliente: ${templateData.client_address || 'Pendiente por definir'}.`,
    '',
    'IV. ALCANCE Y ENTREGABLES',
    'Los entregables, formatos, tiempos y alcances tecnicos aplicables son los definidos en la cotizacion vigente y anexos de este contrato.',
    '',
    'V. HONORARIOS Y FORMA DE PAGO',
    'EL CLIENTE pagara los importes pactados conforme a la cotizacion vinculada y condiciones del Anexo A.',
    '',
    'VI. REPROGRAMACION, CANCELACION Y FUERZA MAYOR',
    'Aplicaran las reglas definidas en el Anexo B, incluyendo politicas de reprogramacion y gastos no recuperables.',
    '',
    'VII. PROPIEDAD INTELECTUAL, USO DE IMAGEN Y ENTREGA',
    'Aplicaran las reglas definidas en el Anexo C respecto a derechos de uso, autoria y publicacion de material.',
    '',
    'VIII. ACEPTACION',
    'EL CLIENTE declara haber leido, comprendido y aceptado el presente contrato, asi como sus anexos y la cotizacion relacionada.',
    '',
    'IX. JURISDICCION',
    `Para todo lo relativo a este contrato, las partes se someten a las leyes y tribunales competentes de ${templateData.jurisdiction_city}, ${templateData.jurisdiction_state}, Mexico.`,
  ].join('\n')
}

export function sanitizeStorageFileName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}

export function parseContractContent(
  content: string | null | undefined,
  annexesFromRow?: unknown,
): ContractContentPayload {
  const rowAnnexes = toContractAnnexes(annexesFromRow)
  const defaultTemplate = getDefaultContractTemplateData()

  if (!content) {
    const body = buildContractBodyFromTemplate(defaultTemplate)
    return {
      body,
      include_quote_document: true,
      source_pdf_path: null,
      template_data: defaultTemplate,
      annexes: rowAnnexes,
    }
  }

  try {
    const parsed = JSON.parse(content) as Partial<ContractContentPayload> & { template_data?: unknown }
    const templateData = toContractTemplateData(parsed.template_data, defaultTemplate)
    const parsedBody = typeof parsed.body === 'string' && parsed.body.trim()
      ? parsed.body
      : buildContractBodyFromTemplate(templateData)
    return {
      body: parsedBody,
      include_quote_document: Boolean(parsed.include_quote_document),
      source_pdf_path: typeof parsed.source_pdf_path === 'string' ? parsed.source_pdf_path : null,
      template_data: templateData,
      annexes: toContractAnnexes(parsed.annexes ?? rowAnnexes),
    }
  } catch {
    const templateData = defaultTemplate
    return {
      body: content || buildContractBodyFromTemplate(templateData),
      include_quote_document: true,
      source_pdf_path: null,
      template_data: templateData,
      annexes: rowAnnexes,
    }
  }
}

export function serializeContractContent(payload: ContractContentPayload): string {
  return JSON.stringify(payload)
}
