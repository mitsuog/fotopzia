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
  line_items?: Array<{ description: string | null }> | null
}

interface ContractEditorProps {
  contacts: ContactOption[]
  quotes: QuoteOption[]
  defaultContactId?: string
}

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
  const [pageCount, setPageCount] = useState(1)
  const [includeQuoteDocument, setIncludeQuoteDocument] = useState(true)
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

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={includeQuoteDocument}
                onChange={(event) => setIncludeQuoteDocument(event.target.checked)}
              />
              Incluir cotizacion firmable en paquete documental
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand-stone bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-brand-navy">Fuente automatica para contrato</h2>
        <p className="mb-3 text-xs text-gray-600">
          El contrato y anexos son plantilla fija. Los datos se toman de la ultima cotizacion aprobada del contacto.
        </p>

        {!contactId && <p className="text-sm text-gray-500">Selecciona un contacto para ver la cotizacion base.</p>}

        {contactId && !latestApprovedQuote && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Este contacto no tiene cotizacion aprobada con datos legales/servicio completos.
          </p>
        )}

        {latestApprovedQuote && (
          <div className="space-y-3 rounded-lg border border-brand-stone bg-brand-paper p-3 text-sm text-gray-700">
            <p>
              <strong>Cotizacion base:</strong> {latestApprovedQuote.quote_number} - {latestApprovedQuote.title}
            </p>
            <p>
              <strong>Fecha aprobacion:</strong>{' '}
              {latestApprovedQuote.approved_at
                ? new Date(latestApprovedQuote.approved_at).toLocaleString('es-MX')
                : 'No registrada'}
            </p>
            <p><strong>Tipo cliente:</strong> {latestApprovedQuote.client_entity_type === 'persona_moral' ? 'Persona moral' : 'Persona fisica'}</p>
            <p><strong>Nombre legal:</strong> {latestApprovedQuote.client_legal_name ?? 'No definido'}</p>
            <p><strong>Representante legal:</strong> {latestApprovedQuote.client_representative_name ?? 'No definido'}</p>
            <p><strong>Cargo representante:</strong> {latestApprovedQuote.client_representative_role ?? 'No aplica'}</p>
            <p><strong>Domicilio legal:</strong> {latestApprovedQuote.client_legal_address ?? 'No definido'}</p>
            <p><strong>Tipo de servicio:</strong> {latestApprovedQuote.service_type ?? 'No definido'}</p>
            <p><strong>Descripcion:</strong> {latestApprovedQuote.service_description ?? 'No definida'}</p>
            <p><strong>Fecha servicio:</strong> {latestApprovedQuote.service_date ?? 'No definida'}</p>
            <p><strong>Ubicacion servicio:</strong> {latestApprovedQuote.service_location ?? 'No definida'}</p>
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
          <p className="mt-1 break-all">Enlace de firma: {result.portal_url}</p>
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
