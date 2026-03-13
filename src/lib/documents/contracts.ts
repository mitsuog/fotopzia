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
  // Financial
  total_amount: string
  total_amount_text: string
  advance_percentage: number
  advance_amount: string
  balance_amount: string
  // Operational
  participants_description: string
  special_restrictions: string
  deliverables: Array<{ milestone: string; date: string; notes: string }>
  // Annexo C
  include_annexo_c: boolean
  annexo_c_authorizations: string[]
  annexo_c_restrictions: string
  annexo_c_signer_role: string
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
const DEFAULT_COMPANY_REPRESENTATIVE = 'Fernando Villanueva'
const DEFAULT_COMPANY_ROLE = 'Representante legal'

function buildAnexoABody(d: ContractTemplateData): string {
  const eventDateLabel = d.event_date
    ? new Date(d.event_date).toLocaleDateString('es-MX', { dateStyle: 'long' })
    : 'Pendiente por definir'
  const deliverablesList = d.deliverables.length > 0
    ? d.deliverables.map(del => del.milestone).filter(Boolean).join(', ')
    : 'Según cotización vigente'

  return [
    'Completar este anexo para cada proyecto. Este anexo forma parte integral del contrato.',
    '',
    `TIPO DE SERVICIO: ${d.service_type || 'Por definir'}`,
    `OBJETIVO DEL PROYECTO: ${d.service_description || 'Por definir'}`,
    `FECHA(S) Y HORARIO: ${eventDateLabel}`,
    `LOCACIÓN(ES): ${d.event_location || 'Por definir'}`,
    `PARTICIPANTES / MASCOTAS / PRODUCTOS: ${d.participants_description || 'Por definir'}`,
    `ENTREGABLES INCLUIDOS: ${deliverablesList}`,
    `HONORARIOS: $${d.total_amount || 'Por definir'} MXN`,
    `ANTICIPO Y SALDO: Anticipo ${d.advance_percentage}% = $${d.advance_amount || 'Por definir'} MXN / Saldo = $${d.balance_amount || 'Por definir'} MXN`,
    `RESTRICCIONES ESPECIALES: ${d.special_restrictions || 'Ninguna'}`,
    '',
    'Opciones sugeridas en "Tipo de servicio": Retrato esencial / Retrato conceptual / Retrato de mascotas / Comercial de producto / Comercial de marca / Cobertura audiovisual / Curaduría / Venta o adquisición de obra / Otro.',
  ].join('\n')
}

function buildAnexoBBody(d: ContractTemplateData): string {
  const rows: string[] = [
    'Hito | Fecha compromiso | Observaciones',
  ]
  if (d.deliverables.length > 0) {
    for (const del of d.deliverables) {
      rows.push(`${del.milestone || '—'} | ${del.date || 'Por definir'} | ${del.notes || '—'}`)
    }
  } else {
    rows.push('Entrega de material | Según cotización | Conforme a especificaciones pactadas')
  }
  rows.push('')
  rows.push('Notas útiles: Indicar aquí si habrá una revisión incluida, fecha de retroalimentación del cliente, fecha de entrega de galería, video final, impresiones, montaje, envío, publicación o embargo.')
  return rows.join('\n')
}

function buildAnexoCBody(d: ContractTemplateData): string {
  const authList = d.annexo_c_authorizations.length > 0
    ? d.annexo_c_authorizations.join(' / ')
    : 'Portafolio / Web / Redes sociales'
  const restrictions = d.annexo_c_restrictions || 'Ninguna'
  const signerRole = d.annexo_c_signer_role || 'Titular'

  return [
    'Utilizar solo cuando aplique. Puede firmarlo el titular, tutor, representante legal o responsable autorizado.',
    '',
    `Yo, ${d.client_legal_name || '_______________'}, en mi carácter de titular / tutor / representante, autorizo a Fotopzia a captar y utilizar imagen, voz, nombre, presencia, mascota, obra, productos o elementos visuales vinculados al proyecto descrito en el Anexo A, exclusivamente para las finalidades ahí descritas y las autorizadas expresamente en este anexo.`,
    '',
    'Autorizo / No autorizo el uso del material con fines de portafolio, redes sociales, sitio web, exposiciones, presentaciones comerciales, materiales impresos y concursos. En caso de restricciones, deberán especificarse por escrito.',
    '',
    'Entiendo que la presente autorización no transfiere titularidad patrimonial del material autoral a mi favor ni sustituye las licencias de uso pactadas entre las partes en el contrato principal.',
    '',
    `NOMBRE COMPLETO: ${d.client_legal_name || '_______________'}`,
    `CARÁCTER CON EL QUE FIRMA: ${signerRole}`,
    `USO AUTORIZADO: ${authList}`,
    `RESTRICCIONES: ${restrictions}`,
  ].join('\n')
}

export function getContractAnnexTemplates(templateData: ContractTemplateData): ContractAnnexTemplate[] {
  const templates: ContractAnnexTemplate[] = [
    {
      key: 'anexo-a',
      title: 'Anexo A. Orden de Servicio',
      requires_signature: true,
      body: buildAnexoABody(templateData),
    },
    {
      key: 'anexo-b',
      title: 'Anexo B. Entregables y Calendario',
      requires_signature: true,
      body: buildAnexoBBody(templateData),
    },
  ]

  if (templateData.include_annexo_c) {
    templates.push({
      key: 'anexo-c',
      title: 'Anexo C. Autorización de Uso de Imagen / Voz / Mascota / Obra',
      requires_signature: true,
      body: buildAnexoCBody(templateData),
    })
  }

  return templates
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
    total_amount: overrides.total_amount ?? '',
    total_amount_text: overrides.total_amount_text ?? '',
    advance_percentage: overrides.advance_percentage ?? 50,
    advance_amount: overrides.advance_amount ?? '',
    balance_amount: overrides.balance_amount ?? '',
    participants_description: overrides.participants_description ?? '',
    special_restrictions: overrides.special_restrictions ?? '',
    deliverables: overrides.deliverables ?? [],
    include_annexo_c: overrides.include_annexo_c ?? false,
    annexo_c_authorizations: overrides.annexo_c_authorizations ?? [],
    annexo_c_restrictions: overrides.annexo_c_restrictions ?? '',
    annexo_c_signer_role: overrides.annexo_c_signer_role ?? 'Titular',
  }
}

export function toContractTemplateData(
  value: unknown,
  defaults: Partial<ContractTemplateData> = {},
): ContractTemplateData {
  const safeDefaults = getDefaultContractTemplateData(defaults)
  if (!isRecord(value)) return safeDefaults

  const deliverables: Array<{ milestone: string; date: string; notes: string }> = Array.isArray(value.deliverables)
    ? (value.deliverables as unknown[]).map((d: unknown) => {
        if (!isRecord(d)) return { milestone: '', date: '', notes: '' }
        return {
          milestone: typeof d.milestone === 'string' ? d.milestone : '',
          date: typeof d.date === 'string' ? d.date : '',
          notes: typeof d.notes === 'string' ? d.notes : '',
        }
      })
    : safeDefaults.deliverables

  const annexo_c_authorizations: string[] = Array.isArray(value.annexo_c_authorizations)
    ? (value.annexo_c_authorizations as unknown[]).filter((a): a is string => typeof a === 'string')
    : safeDefaults.annexo_c_authorizations

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
    total_amount: readString(value.total_amount, safeDefaults.total_amount),
    total_amount_text: readString(value.total_amount_text, safeDefaults.total_amount_text),
    advance_percentage: typeof value.advance_percentage === 'number' ? value.advance_percentage : safeDefaults.advance_percentage,
    advance_amount: readString(value.advance_amount, safeDefaults.advance_amount),
    balance_amount: readString(value.balance_amount, safeDefaults.balance_amount),
    participants_description: readString(value.participants_description, safeDefaults.participants_description),
    special_restrictions: readString(value.special_restrictions, safeDefaults.special_restrictions),
    deliverables,
    include_annexo_c: typeof value.include_annexo_c === 'boolean' ? value.include_annexo_c : safeDefaults.include_annexo_c,
    annexo_c_authorizations,
    annexo_c_restrictions: readString(value.annexo_c_restrictions, safeDefaults.annexo_c_restrictions),
    annexo_c_signer_role: readString(value.annexo_c_signer_role, safeDefaults.annexo_c_signer_role),
  }
}

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

export function buildContractBodyFromTemplate(templateData: ContractTemplateData): string {
  const eventDateLabel = templateData.event_date
    ? new Date(templateData.event_date).toLocaleDateString('es-MX', { dateStyle: 'long' })
    : 'Pendiente por definir'
  const totalAmount = templateData.total_amount || '________________'
  const totalAmountText = templateData.total_amount_text || '______________________________'
  const advancePct = templateData.advance_percentage || 50

  const isMoral = templateData.client_representative_role &&
    templateData.client_representative_role !== 'No aplica (persona fisica)'

  const clientPartyDesc = isMoral
    ? `${templateData.client_legal_name}, representado por ${templateData.client_representative_name} en su carácter de ${templateData.client_representative_role}`
    : (templateData.client_legal_name || '_______________')

  return [
    'CONTRATO DE PRESTACIÓN DE SERVICIOS CREATIVOS',
    '',
    'Proyecto / servicio',
    `${templateData.service_type || '_______________________________________________'}`,
    '',
    'Cliente',
    `${clientPartyDesc}`,
    '',
    'Fecha y lugar de firma',
    '_______________________________________________',
    '',
    `El presente contrato de prestación de servicios creativos se celebra por una parte entre Fotopzia, representado por Fernando Villanueva (en lo sucesivo, "EL PRESTADOR"), y por la otra parte ${clientPartyDesc} (en lo sucesivo, "EL CLIENTE"), al tenor de las siguientes declaraciones y cláusulas.`,
    '',
    'I. Declaraciones',
    '',
    '1. EL PRESTADOR declara que EL PRESTADOR es un estudio creativo dedicado a fotografía, video, retrato, producción visual, cobertura comercial, fotografía de mascotas, obra fotográfica y servicios relacionados, con capacidad profesional y técnica para ejecutar el proyecto descrito en el Anexo A.',
    '',
    '2. EL CLIENTE declara que cuenta con facultades suficientes para contratar el servicio, que los datos proporcionados para facturación, contacto, agenda y autorizaciones son correctos, y que conoce el alcance general del proyecto solicitado.',
    '',
    '3. Ambas partes declaran que ambas partes reconocen como parte integrante del presente instrumento el Anexo A (Orden de Servicio), el Anexo B (Entregables y Calendario), y en su caso el Anexo C (Autorización de Uso de Imagen, Voz, Obra o Mascota), cuando resulten aplicables al tipo de servicio contratado.',
    '',
    'II. Objeto',
    '',
    '4. EL PRESTADOR se obliga a desarrollar en favor de EL CLIENTE el servicio creativo descrito en el Anexo A, pudiendo consistir, entre otros, en retrato esencial, retrato conceptual, retrato de mascotas, producción comercial, cobertura audiovisual, fotografía de producto, dirección creativa, curaduría visual, adquisición de obra o entrega de licencias de uso sobre materiales fotográficos o audiovisuales.',
    '',
    '5. El servicio se ejecutará exclusivamente dentro del alcance, número de personas, mascotas, productos, locaciones, tiempos de cobertura, formato de entrega y objetivos narrativos expresamente indicados en los anexos. Cualquier actividad adicional se cotizará por separado y deberá autorizarse por escrito.',
    '',
    'III. Agenda, tiempos y ejecución',
    '',
    '6. La fecha de sesión, producción o cobertura quedará reservada únicamente una vez recibido el anticipo pactado y la confirmación expresa del servicio. Sin anticipo no existe bloqueo de agenda.',
    '',
    '7. EL CLIENTE deberá presentarse puntualmente, proporcionar accesos, permisos, brief, referencias, datos de contacto, productos, talento, mascotas o responsables necesarios para el desarrollo del servicio. Los retrasos imputables a EL CLIENTE reducen el tiempo efectivo de ejecución sin obligación de reposición automática.',
    '',
    '8. Cuando el proyecto incluya mascotas, menores de edad, locaciones ajenas, recintos privados, marcas registradas, obras de terceros, música, utilería o personal externo, EL CLIENTE será responsable de gestionar previamente las autorizaciones necesarias, salvo que en el Anexo A se establezca expresamente que dicha gestión corre a cargo de EL PRESTADOR.',
    '',
    '9. Si por condiciones climáticas, riesgos de seguridad, enfermedad, fallas técnicas graves, fuerza mayor o causas ajenas razonables el servicio no puede realizarse en condiciones adecuadas, las partes acordarán una nueva fecha procurando conservar el valor ya pagado conforme a las reglas de reagendación previstas en la cláusula de pagos y cancelaciones.',
    '',
    'IV. Honorarios, anticipos y forma de pago',
    '',
    `10. EL CLIENTE pagará a EL PRESTADOR la cantidad total de $${totalAmount} MXN (${totalAmountText}), más impuestos en caso de aplicar, conforme al desglose económico señalado en el Anexo A.`,
    '',
    `11. Para reservar fecha, EL CLIENTE cubrirá un anticipo no reembolsable equivalente al ${advancePct}% del valor total del servicio. El saldo restante deberá liquidarse a más tardar en la fecha indicada en el Anexo A; si no se especifica, será exigible antes de la entrega final del material.`,
    '',
    '12. Los pagos efectuados cubren exclusivamente el alcance contratado. Horas extra, personal adicional, edición extraordinaria, retoque no contemplado, urgencias, viáticos, renta de equipo, locación, escenografía, styling, maquillaje, grooming especial, impresiones, marcos, montaje, envíos o licencias ampliadas se cotizarán y cobrarán por separado.',
    '',
    '13. En servicios comerciales o corporativos, la cesión o licencia de uso del material podrá limitarse por tiempo, territorio, medio, campaña, edición o industria. Cualquier ampliación de uso posterior generará una contraprestación adicional.',
    '',
    'V. Cancelaciones y reagendaciones',
    '',
    '14. Si EL CLIENTE cancela el servicio, el anticipo quedará en favor de EL PRESTADOR por concepto de bloqueo de agenda, preparación, preproducción y costos hundidos, salvo pacto distinto por escrito.',
    '',
    '15. Si EL CLIENTE solicita reagendar con al menos 72 horas naturales de anticipación, EL PRESTADOR hará su mejor esfuerzo por ofrecer una nueva fecha, pudiendo aplicar una sola reprogramación sin penalización operativa adicional cuando la causa sea razonable y exista disponibilidad.',
    '',
    '16. Las reagendaciones solicitadas con menos de 72 horas naturales, así como las inasistencias o retrasos severos, podrán generar cargos adicionales y/o la pérdida del anticipo, en atención a la afectación operativa del calendario.',
    '',
    '17. Si EL PRESTADOR cancela por causa imputable a sí mismo y no ofrece fecha alternativa aceptable, devolverá a EL CLIENTE las cantidades efectivamente recibidas por el servicio no prestado, sin que ello implique responsabilidad por daños indirectos, lucro cesante o expectativas comerciales.',
    '',
    'VI. Entregables, edición y tiempos de entrega',
    '',
    '18. Los entregables se describen en el Anexo B e incluyen, según corresponda: selección de fotografías, galería digital, archivos en alta o media resolución, video editado, clips, reels, impresiones, obra montada, archivos para redes, contacto de hojas, versiones en blanco y negro, material para revisión o cualquier otro producto expresamente pactado.',
    '',
    '19. Salvo pacto distinto, EL PRESTADOR realizará la curaduría y selección final del material entregable. Los archivos descartados, pruebas técnicas, duplicados, tomas fallidas, RAW, proyectos abiertos, líneas de tiempo editables o material no finalizado no forman parte del servicio.',
    '',
    '20. Los tiempos de entrega comenzarán a correr a partir de la fecha de realización del servicio y una vez que EL CLIENTE haya cubierto los pagos exigibles y entregado cualquier retroalimentación indispensable. Las revisiones incluidas y sus ventanas de respuesta deberán respetarse para no alterar el calendario global.',
    '',
    '21. Las solicitudes de entrega urgente estarán sujetas a disponibilidad y costo adicional. Una vez entregado el material final y transcurridos 30 días naturales sin observaciones sustanciales, se considerará aceptado para todos los efectos contractuales.',
    '',
    'VII. Propiedad intelectual y uso del material',
    '',
    '22. EL PRESTADOR conserva en todo momento la titularidad moral y patrimonial sobre las fotografías, videos, composiciones, conceptos creativos, layouts, obra visual y demás materiales autorales generados, salvo cesión expresa y por escrito en sentido distinto.',
    '',
    '23. EL CLIENTE recibe únicamente la propiedad material de los soportes entregados y/o la licencia de uso específicamente indicada en el Anexo A o Anexo B. En ausencia de precisión expresa, la licencia será no exclusiva, intransferible, revocable por incumplimiento y limitada al fin originalmente contratado.',
    '',
    '24. EL CLIENTE no podrá alterar sustancialmente, sublicenciar, revender, explotar en terceros países, usar en campañas distintas, ceder a terceros, registrar como propia, retirar créditos autorales o utilizar el material fuera del alcance pactado sin autorización previa y por escrito de EL PRESTADOR.',
    '',
    '25. EL PRESTADOR podrá usar muestras razonables del resultado final en portafolio, sitio web, presentaciones, concursos, exposiciones o redes sociales con fines de promoción profesional, salvo que en el Anexo A se marque expresamente una restricción de confidencialidad, embargo temporal o no publicación.',
    '',
    'VIII. Autorizaciones especiales',
    '',
    '26. Cuando el servicio implique retratar personas identificables, menores, mascotas, instalaciones privadas, productos protegidos, artistas, modelos o personal de una empresa, EL CLIENTE y/o los responsables correspondientes deberán firmar las autorizaciones aplicables. Si dichas autorizaciones no se entregan, EL PRESTADOR podrá limitar usos, pausar entregas comerciales o negar explotación pública del material.',
    '',
    '27. En sesiones con mascotas, EL CLIENTE declara que es tutor, responsable o persona autorizada; que la mascota no presenta una condición no revelada que haga riesgosa la sesión; y que asumirá la supervisión y contención necesarias, salvo que se haya contratado manejo especializado.',
    '',
    'IX. Responsabilidad y limitación',
    '',
    '28. EL PRESTADOR se obliga a actuar con diligencia profesional ordinaria. No obstante, no será responsable por pérdidas derivadas de actos u omisiones de terceros, fallas de servicios externos, restricciones del recinto, clima adverso, comportamiento imprevisible de mascotas, negativa de acceso, incumplimientos del talento o daños indirectos.',
    '',
    '29. En cualquier caso, la responsabilidad total de EL PRESTADOR frente a EL CLIENTE, por cualquier causa relacionada con este contrato, no excederá del monto efectivamente pagado por el servicio específico que origine la reclamación.',
    '',
    '30. EL CLIENTE responderá por daños ocasionados al equipo, utilería, impresiones, obra o personal de EL PRESTADOR cuando deriven de mal uso, negligencia, información falsa u omisiones relevantes atribuibles a EL CLIENTE, sus invitados, empleados, proveedores o mascotas.',
    '',
    'X. Confidencialidad y datos',
    '',
    '31. Ambas partes guardarán confidencialidad respecto de información estratégica, financiera, técnica, comercial o sensible conocida con motivo del servicio, salvo cuando su divulgación sea necesaria para ejecutar el proyecto o sea exigida por autoridad competente.',
    '',
    '32. Los datos personales de contacto, facturación y operación serán tratados únicamente para fines relacionados con la prestación del servicio, seguimiento comercial, archivo contractual y cumplimiento de obligaciones legales, conforme a la normativa aplicable.',
    '',
    'XI. Terminación anticipada',
    '',
    '33. Cualquiera de las partes podrá dar por terminado el contrato por incumplimiento grave de la otra parte, previa notificación por escrito. En tal supuesto, EL PRESTADOR conservará el derecho a cobrar el trabajo efectivamente realizado, gastos comprometidos y materiales ya producidos.',
    '',
    '34. La terminación anticipada no extingue obligaciones ya causadas ni las cláusulas que por su naturaleza deban subsistir, incluyendo pagos pendientes, confidencialidad, propiedad intelectual, limitación de responsabilidad y solución de controversias.',
    '',
    'XII. Disposiciones generales',
    '',
    '35. Toda modificación al presente contrato deberá constar por escrito, incluyendo ampliaciones de uso, nuevos entregables, cambios de alcance, fechas o revisiones extraordinarias.',
    '',
    '36. La tolerancia respecto de un incumplimiento aislado no implica renuncia de derechos. Si alguna cláusula se considera inválida, las demás conservarán plena vigencia.',
    '',
    `37. Para la interpretación y cumplimiento del presente instrumento, las partes se someten a las leyes aplicables de los Estados Unidos Mexicanos y a la jurisdicción de los tribunales competentes de ${templateData.jurisdiction_city}, ${templateData.jurisdiction_state}, renunciando al fuero que por razón de domicilio presente o futuro pudiera corresponderles.`,
    '',
    'Firmas',
    '',
    'Leído que fue el presente contrato y enteradas las partes de su contenido y alcance legal, lo firman por duplicado en la fecha y lugar indicados.',
    '',
    'EL PRESTADOR',
    `Nombre: ${templateData.company_representative_name}`,
    `Cargo / representación: ${templateData.company_legal_name}`,
    '',
    'EL CLIENTE',
    `Nombre: ${templateData.client_legal_name || '_______________'}`,
    `Cargo / representación: ${templateData.client_representative_role && templateData.client_representative_role !== 'No aplica (persona fisica)' ? templateData.client_representative_role : 'Titular'}`,
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
      annexes: rowAnnexes.length > 0 ? rowAnnexes : toContractAnnexes(parsed.annexes),
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
