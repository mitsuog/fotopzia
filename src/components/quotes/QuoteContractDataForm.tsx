'use client'

import { useState } from 'react'

type EntityType = 'persona_fisica' | 'persona_moral'

interface QuoteContractDataFormProps {
  quoteId: string
  initialEntityType: EntityType
  initialLegalName: string
  initialRepresentativeName: string
  initialRepresentativeRole: string
  initialLegalAddress: string
  initialServiceType: string
  initialServiceDescription: string
  initialServiceDate: string
  initialServiceLocation: string
}

export function QuoteContractDataForm({
  quoteId,
  initialEntityType,
  initialLegalName,
  initialRepresentativeName,
  initialRepresentativeRole,
  initialLegalAddress,
  initialServiceType,
  initialServiceDescription,
  initialServiceDate,
  initialServiceLocation,
}: QuoteContractDataFormProps) {
  const [entityType, setEntityType] = useState<EntityType>(initialEntityType)
  const [legalName, setLegalName] = useState(initialLegalName)
  const [representativeName, setRepresentativeName] = useState(initialRepresentativeName)
  const [representativeRole, setRepresentativeRole] = useState(initialRepresentativeRole)
  const [legalAddress, setLegalAddress] = useState(initialLegalAddress)
  const [serviceType, setServiceType] = useState(initialServiceType)
  const [serviceDescription, setServiceDescription] = useState(initialServiceDescription)
  const [serviceDate, setServiceDate] = useState(initialServiceDate)
  const [serviceLocation, setServiceLocation] = useState(initialServiceLocation)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function saveDetails() {
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      const response = await fetch(`/api/quotes/${quoteId}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_entity_type: entityType,
          client_legal_name: legalName,
          client_representative_name: representativeName,
          client_representative_role: representativeRole,
          client_legal_address: legalAddress,
          service_type: serviceType,
          service_description: serviceDescription,
          service_date: serviceDate || null,
          service_location: serviceLocation,
        }),
      })

      const payload = await response.json().catch(() => ({ error: 'No fue posible guardar los datos.' }))
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible guardar los datos.')

      setSuccess('Datos de cliente y servicio actualizados.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No fue posible guardar los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-brand-stone bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-brand-navy">Datos para contrato</h3>
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de cliente</label>
          <select
            value={entityType}
            onChange={(event) => setEntityType(event.target.value as EntityType)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          >
            <option value="persona_fisica">Persona fisica</option>
            <option value="persona_moral">Persona moral</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre legal</label>
          <input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          />
        </div>

        {entityType === 'persona_moral' && (
          <>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Representante legal</label>
              <input
                value={representativeName}
                onChange={(event) => setRepresentativeName(event.target.value)}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cargo representante</label>
              <input
                value={representativeRole}
                onChange={(event) => setRepresentativeRole(event.target.value)}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Domicilio legal</label>
          <textarea
            rows={2}
            value={legalAddress}
            onChange={(event) => setLegalAddress(event.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de servicio</label>
          <input
            value={serviceType}
            onChange={(event) => setServiceType(event.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Descripcion del servicio</label>
          <textarea
            rows={3}
            value={serviceDescription}
            onChange={(event) => setServiceDescription(event.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha del servicio</label>
          <input
            type="date"
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Ubicacion del servicio</label>
          <input
            value={serviceLocation}
            onChange={(event) => setServiceLocation(event.target.value)}
            className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={saveDetails}
          disabled={loading}
          className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar datos de contrato'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {success && <p className="mt-2 text-xs text-emerald-700">{success}</p>}
    </div>
  )
}
