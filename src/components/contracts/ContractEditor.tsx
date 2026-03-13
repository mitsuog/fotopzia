'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

interface ContactOption {
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

interface QuoteOption {
  id: string
  quote_number: string
  title: string
  status: string
  contact_id: string
  deal_id: string | null
  approved_at: string | null
  updated_at: string
  client_entity_type: string | null
  client_legal_name: string | null
  client_representative_name: string | null
  client_representative_role: string | null
  client_legal_address: string | null
  service_type: string | null
  service_description: string | null
  service_date: string | null
  service_location: string | null
  total?: number | null
  currency?: string | null
  line_items?: Array<{ description: string | null }> | null
}

interface ContractEditorProps {
  contacts: ContactOption[]
  quotes: QuoteOption[]
  defaultContactId?: string
}

const AUTHORIZATION_OPTIONS = [
  'Portafolio',
  'Web',
  'Redes sociales',
  'Concurso',
  'Exposicion',
  'Campana',
  'Uso interno',
]

function toDateValue(dateValue: string | null | undefined): number {
  if (!dateValue) return 0
  const parsed = Date.parse(dateValue)
  return Number.isNaN(parsed) ? 0 : parsed
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

export function ContractEditor({
  contacts,
  quotes,
  defaultContactId,
}: ContractEditorProps) {
  const [contactId, setContactId] = useState(defaultContactId ?? '')
  const [pageCount, setPageCount] = useState(5)
  const [includeQuoteDocument, setIncludeQuoteDocument] = useState(true)
  const [advancePercentage, setAdvancePercentage] = useState(50)
  const [participantsDescription, setParticipantsDescription] = useState('')
  const [specialRestrictions, setSpecialRestrictions] = useState('')
  const [includeAnexoC, setIncludeAnexoC] = useState(false)
  const [anexoCAuthorizations, setAnexoCAuthorizations] = useState<string[]>(['Portafolio', 'Web'])
  const [anexoCRestrictions, setAnexoCRestrictions] = useState('')
  const [anexoCSigner, setAnexoCSigner] = useState('Titular')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; contract_number: string; portal_url: string } | null>(null)

  const latestApprovedQuote = useMemo(() => {
    if (!contactId) return null
    const approved = quotes
      .filter(quote => quote.contact_id === contactId && quote.status === 'approved')
      .sort((a, b) => {
        const aTime = toDateValue(a.approved_at) || toDateValue(a.updated_at)
        const bTime = toDateValue(b.approved_at) || toDateValue(b.updated_at)
        return bTime - aTime
      })
    return approved[0] ?? null
  }, [contactId, quotes])

  const selectedContact = useMemo(
    () => contacts.find(contact => contact.id === contactId) ?? null,
    [contacts, contactId],
  )

  const readiness = useMemo(() => {
    if (!selectedContact || !latestApprovedQuote) {
      return { ready: false, missing: [] as string[] }
    }

    const fullName = `${selectedContact.first_name} ${selectedContact.last_name}`.trim()
    const contactEntityType =
      selectedContact.legal_entity_type === 'persona_moral'
        ? 'persona_moral'
        : selectedContact.legal_entity_type === 'persona_fisica'
          ? 'persona_fisica'
          : null
    const quoteEntityType =
      latestApprovedQuote.client_entity_type === 'persona_moral'
        ? 'persona_moral'
        : latestApprovedQuote.client_entity_type === 'persona_fisica'
          ? 'persona_fisica'
          : null
    const entityType = contactEntityType ?? quoteEntityType ?? 'persona_fisica'

    const legalName =
      normalizeText(latestApprovedQuote.client_legal_name)
      || normalizeText(selectedContact.legal_name)
      || (entityType === 'persona_moral'
        ? (normalizeText(selectedContact.company_name) || fullName)
        : fullName)
    const representativeName = entityType === 'persona_moral'
      ? (normalizeText(latestApprovedQuote.client_representative_name) || normalizeText(selectedContact.legal_representative_name))
      : (normalizeText(latestApprovedQuote.client_representative_name) || legalName)
    const representativeRole = entityType === 'persona_moral'
      ? (normalizeText(latestApprovedQuote.client_representative_role) || normalizeText(selectedContact.legal_representative_role))
      : 'No aplica (persona fisica)'
    const legalAddress = normalizeText(latestApprovedQuote.client_legal_address) || normalizeText(selectedContact.legal_address)
    const serviceType = normalizeText(latestApprovedQuote.service_type) || normalizeText(latestApprovedQuote.title)
    const serviceDescription = normalizeText(latestApprovedQuote.service_description)
      || buildServiceDescriptionFallback(latestApprovedQuote.line_items)
      || normalizeText(latestApprovedQuote.title)
    const serviceLocation = normalizeText(latestApprovedQuote.service_location) || normalizeText(selectedContact.legal_address)

    const missing: string[] = []
    if (!legalName) missing.push('Nombre legal del cliente')
    if (!legalAddress) missing.push('Domicilio legal del cliente')
    if (!serviceType) missing.push('Tipo de servicio')
    if (!serviceDescription) missing.push('Descripcion del servicio')
    if (!serviceLocation) missing.push('Ubicacion del servicio')
    if (entityType === 'persona_moral' && !representativeName) missing.push('Representante legal')
    if (entityType === 'persona_moral' && !representativeRole) missing.push('Cargo del representante legal')

    return { ready: missing.length === 0, missing }
  }, [selectedContact, latestApprovedQuote])

  function toggleAuthorization(auth: string) {
    setAnexoCAuthorizations(prev =>
      prev.includes(auth) ? prev.filter(a => a !== auth) : [...prev, auth],
    )
  }

  async function handleSubmit() {
    setError(null)
    setResult(null)

    if (!contactId) {
      setError('Selecciona un contacto.')
      return
    }

    if (!latestApprovedQuote) {
      setError('No existe una cotizacion aprobada para este contacto.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        contact_id: contactId,
        quote_id: latestApprovedQuote.id,
        page_count: pageCount,
        include_quote_document: includeQuoteDocument,
        advance_percentage: advancePercentage,
        participants_description: participantsDescription,
        special_restrictions: specialRestrictions,
        include_annexo_c: includeAnexoC,
        annexo_c_authorizations: anexoCAuthorizations,
        annexo_c_restrictions: anexoCRestrictions,
        annexo_c_signer_role: anexoCSigner,
      }

      const formData = new FormData()
      formData.append('payload', JSON.stringify(payload))

      const response = await fetch('/api/contracts', {
        method: 'POST',
        body: formData,
      })

      const responsePayload = await response.json().catch(() => ({ error: 'No fue posible crear el contrato.' }))
      if (!response.ok) {
        throw new Error(responsePayload.error ?? 'No fue posible crear el contrato.')
      }

      setResult(responsePayload.data)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'No fue posible crear el contrato.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Datos generales */}
      <div className="rounded-xl border border-brand-stone bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-brand-navy">Datos generales</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Contacto</label>
            <select
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
            >
              <option value="">Seleccionar contacto...</option>
              {contacts.map(contact => (
                <option key={contact.id} value={contact.id}>
                  {contact.first_name} {contact.last_name}{contact.company_name ? ` - ${contact.company_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Paginas para antefirma</label>
            <input
              type="number"
              min={1}
              value={pageCount}
              onChange={(event) => setPageCount(Math.max(1, Number(event.target.value || 1)))}
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Anticipo (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={advancePercentage}
              onChange={(event) => setAdvancePercentage(Math.max(1, Math.min(100, Number(event.target.value || 50))))}
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
            />
            <p className="mt-1 text-[11px] text-gray-500">Porcentaje de anticipo no reembolsable para reservar fecha</p>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeQuoteDocument}
                onChange={(event) => setIncludeQuoteDocument(event.target.checked)}
                className="h-4 w-4"
              />
              Incluir cotizacion firmable en paquete documental
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Participantes / mascotas / productos</label>
            <textarea
              value={participantsDescription}
              onChange={(event) => setParticipantsDescription(event.target.value)}
              placeholder="Ej: Maria Garcia, perro labrador Max, producto XYZ"
              rows={2}
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm resize-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Restricciones especiales</label>
            <textarea
              value={specialRestrictions}
              onChange={(event) => setSpecialRestrictions(event.target.value)}
              placeholder="Ej: Confidencial hasta marzo 2026, no publicar en redes hasta diciembre..."
              rows={2}
              className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>
      </div>

      {/* Anexo C */}
      <div className="rounded-xl border border-brand-stone bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-navy">Anexo C — Autorizacion de imagen / voz / mascota</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeAnexoC}
              onChange={(event) => setIncludeAnexoC(event.target.checked)}
              className="h-4 w-4"
            />
            Incluir Anexo C
          </label>
        </div>

        {includeAnexoC && (
          <div className="mt-4 space-y-3 border-t border-brand-stone pt-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Uso autorizado</label>
              <div className="flex flex-wrap gap-2">
                {AUTHORIZATION_OPTIONS.map(auth => (
                  <label
                    key={auth}
                    className={[
                      'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      anexoCAuthorizations.includes(auth)
                        ? 'border-brand-navy bg-brand-navy text-white'
                        : 'border-brand-stone bg-white text-brand-navy hover:bg-brand-paper',
                    ].join(' ')}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={anexoCAuthorizations.includes(auth)}
                      onChange={() => toggleAuthorization(auth)}
                    />
                    {auth}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Caracter del firmante</label>
              <select
                value={anexoCSigner}
                onChange={(event) => setAnexoCSigner(event.target.value)}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm md:w-auto"
              >
                <option value="Titular">Titular</option>
                <option value="Tutor">Tutor</option>
                <option value="Representante legal">Representante legal</option>
                <option value="Responsable autorizado">Responsable autorizado</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Restricciones del Anexo C</label>
              <textarea
                value={anexoCRestrictions}
                onChange={(event) => setAnexoCRestrictions(event.target.value)}
                placeholder="Ej: No usar en campanas internacionales, solo CDMX..."
                rows={2}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm resize-none"
              />
            </div>
          </div>
        )}

        {!includeAnexoC && (
          <p className="mt-2 text-xs text-gray-500">Activa esta opcion si el proyecto incluye uso de imagen de personas, mascotas u obra visual de terceros.</p>
        )}
      </div>

      {/* Fuente automatica */}
      <div className="rounded-xl border border-brand-stone bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-brand-navy">Fuente automatica para contrato</h2>
        <p className="mb-3 text-xs text-gray-600">
          Los datos se toman de la ultima cotizacion aprobada del contacto. El contrato incluye las 37 clausulas del contrato Fotopzia mas los 3 anexos (A, B y C si aplica).
        </p>

        {!contactId && <p className="text-sm text-gray-500">Selecciona un contacto para ver la cotizacion base.</p>}

        {contactId && !latestApprovedQuote && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Este contacto no tiene cotizacion aprobada con datos legales/servicio completos.
          </p>
        )}

        {latestApprovedQuote && (
          <div className="space-y-2 rounded-lg border border-brand-stone bg-brand-paper p-3 text-sm text-gray-700">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <p><strong>Cotizacion base:</strong> {latestApprovedQuote.quote_number}</p>
              <p><strong>Titulo:</strong> {latestApprovedQuote.title}</p>
              <p><strong>Total:</strong> {latestApprovedQuote.total ? Number(latestApprovedQuote.total).toLocaleString('es-MX', { style: 'currency', currency: latestApprovedQuote.currency ?? 'MXN' }) : 'No definido'}</p>
              <p><strong>Aprobacion:</strong> {latestApprovedQuote.approved_at ? new Date(latestApprovedQuote.approved_at).toLocaleDateString('es-MX') : 'No registrada'}</p>
              <p><strong>Tipo cliente:</strong> {latestApprovedQuote.client_entity_type === 'persona_moral' ? 'Persona moral' : 'Persona fisica'}</p>
              <p><strong>Nombre legal:</strong> {latestApprovedQuote.client_legal_name ?? 'No definido'}</p>
              <p><strong>Tipo de servicio:</strong> {latestApprovedQuote.service_type ?? 'No definido'}</p>
              <p><strong>Fecha servicio:</strong> {latestApprovedQuote.service_date ?? 'No definida'}</p>
              <p className="md:col-span-2"><strong>Ubicacion:</strong> {latestApprovedQuote.service_location ?? 'No definida'}</p>
            </div>
            {!readiness.ready && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Faltan campos para contrato: {readiness.missing.join(', ')}.
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Contrato creado: {result.contract_number}</p>
          <a
            href={result.portal_url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block break-all text-xs underline hover:no-underline"
          >
            {result.portal_url}
          </a>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href={`/contracts/${result.id}`}
              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700"
            >
              Ver detalle del contrato
            </Link>
            <a
              href={result.portal_url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700"
            >
              Abrir portal de firma
            </a>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !latestApprovedQuote || !readiness.ready}
          className="rounded-lg bg-brand-navy px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Guardando contrato...' : 'Guardar contrato legal'}
        </button>
      </div>
    </div>
  )
}
