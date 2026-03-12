import type { ContractAnnex } from '@/types/quotes'

export interface ContractContentPayload {
  body: string
  include_quote_document: boolean
  source_pdf_path: string | null
  annexes: ContractAnnex[]
}

export function getDefaultContractBody(): string {
  return [
    'CONTRATO DE PRESTACION DE SERVICIOS FOTOGRAFICOS Y VIDEO',
    '',
    'I. PARTES',
    'Comparecen por una parte Fotopzia Mexico (en adelante, "EL PRESTADOR"), y por la otra la persona cliente (en adelante, "EL CLIENTE").',
    '',
    'II. OBJETO',
    'EL PRESTADOR se obliga a realizar los servicios profesionales de fotografia y/o video descritos en la cotizacion y/o anexos incorporados a este contrato.',
    '',
    'III. ALCANCE DEL SERVICIO',
    'El alcance, entregables, tiempos, ubicaciones y condiciones tecnicas seran los definidos en la cotizacion aprobada y en los anexos firmados por EL CLIENTE.',
    '',
    'IV. HONORARIOS Y FORMA DE PAGO',
    'EL CLIENTE pagara los montos pactados conforme a la cotizacion vigente. Los pagos extemporaneos podran generar reprogramacion y/o cargos adicionales.',
    '',
    'V. REPROGRAMACIONES Y CANCELACIONES',
    'Toda reprogramacion o cancelacion debera solicitarse por escrito. Las penalizaciones aplicables se regiran por lo indicado en anexos y/o cotizacion.',
    '',
    'VI. PROPIEDAD INTELECTUAL Y USO DE MATERIAL',
    'EL PRESTADOR conserva derechos morales y de autoria sobre el material creado, otorgando a EL CLIENTE los derechos de uso acordados en este contrato.',
    '',
    'VII. LIMITACION DE RESPONSABILIDAD',
    'EL PRESTADOR no sera responsable por causas de fuerza mayor, restricciones de sede, actos de terceros o situaciones fuera de su control razonable.',
    '',
    'VIII. CONFIDENCIALIDAD Y DATOS PERSONALES',
    'Ambas partes se obligan a tratar con confidencialidad la informacion compartida y a cumplir la normativa aplicable en materia de datos personales.',
    '',
    'IX. ACEPTACION',
    'EL CLIENTE declara haber leido, comprendido y aceptado el contenido del contrato, sus anexos y la cotizacion relacionada.',
    '',
    'X. JURISDICCION',
    'Para la interpretacion y cumplimiento de este contrato, las partes se someten a las leyes y tribunales competentes de Veracruz, Veracruz, Mexico.',
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
  annexesFromRow?: ContractAnnex[] | null,
): ContractContentPayload {
  if (!content) {
    return {
      body: getDefaultContractBody(),
      include_quote_document: true,
      source_pdf_path: null,
      annexes: annexesFromRow ?? [],
    }
  }

  try {
    const parsed = JSON.parse(content) as Partial<ContractContentPayload>
    return {
      body: typeof parsed.body === 'string' && parsed.body.trim() ? parsed.body : getDefaultContractBody(),
      include_quote_document: Boolean(parsed.include_quote_document),
      source_pdf_path: typeof parsed.source_pdf_path === 'string' ? parsed.source_pdf_path : null,
      annexes: Array.isArray(parsed.annexes) ? parsed.annexes as ContractAnnex[] : (annexesFromRow ?? []),
    }
  } catch {
    return {
      body: content,
      include_quote_document: true,
      source_pdf_path: null,
      annexes: annexesFromRow ?? [],
    }
  }
}

export function serializeContractContent(payload: ContractContentPayload): string {
  return JSON.stringify(payload)
}
