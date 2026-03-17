import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { ContractActions } from '@/components/contracts/ContractActions'
import { parseContractContent, toContractAnnexes } from '@/lib/documents/contracts'

export const dynamic = 'force-dynamic'

interface ContractDetailPageProps {
  params: Promise<{ contractId: string }>
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-800">{value}</p>
    </div>
  )
}

export default async function ContractDetailPage({ params }: ContractDetailPageProps) {
  const { contractId } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select(`
      id, contract_number, title, status, content, quote_id, contact_id,
      page_count, signed_by, signed_at, created_at, updated_at, annexes,
      contact:contacts(first_name, last_name, email, phone, company_name),
      quote:quotes(
        id, quote_number, title, status, total, currency,
        approved_at, service_type, service_date, service_location,
        client_legal_name, client_legal_address, client_entity_type,
        client_representative_name, client_representative_role
      )
    `)
    .eq('id', contractId)
    .single()

  if (!contract) notFound()

  // Fetch quote line items for preview
  const { data: quoteLineItems } = contract.quote_id
    ? await supabase
        .from('quote_line_items')
        .select('description, quantity, unit_price, total')
        .eq('quote_id', contract.quote_id)
        .order('sort_order', { ascending: true })
        .limit(10)
    : { data: null }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let canApprove = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    canApprove = profile?.role === 'admin' || profile?.role === 'project_manager'
  }

  const { data: latestApprovalFlow } = await supabase
    .from('approval_flows')
    .select('status')
    .eq('entity_type', 'contract')
    .eq('entity_id', contract.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const parsedContent = parseContractContent(contract.content, toContractAnnexes(contract.annexes))
  const td = parsedContent.template_data

  // Find linked project via contact_id
  const { data: linkedProject } = contract.contact_id
    ? await supabase
        .from('projects')
        .select('id, title, stage, due_date')
        .eq('contact_id', contract.contact_id)
        .neq('stage', 'cierre')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  const activeToken = await supabase
    .from('client_portal_tokens')
    .select('token, expires_at')
    .eq('contact_id', contract.contact_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const validToken = (activeToken.data ?? []).find(token => !token.expires_at || new Date(token.expires_at) > new Date())
  const portalUrl = validToken ? `/portal/${validToken.token}/documents` : null
  const zipUrl = validToken ? `/api/portal/${validToken.token}/documents/zip` : null

  const quote = Array.isArray(contract.quote) ? contract.quote[0] : contract.quote
  const contact = Array.isArray(contract.contact) ? contract.contact[0] : contract.contact

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-2">
        <Link
          href="/contracts"
          className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-brand-navy"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Contratos
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-xs font-mono text-gray-500">{contract.contract_number}</span>
      </div>

      <div className="rounded-xl border border-brand-stone bg-brand-paper p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Contrato</p>
            <h1 className="text-xl font-bold text-brand-navy">{contract.title}</h1>
            <p className="mt-1 text-xs text-gray-600">Número: {contract.contract_number}</p>
          </div>
          <ContractStatusBadge status={contract.status} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          {/* Contract template data — structured view */}
          <div className="rounded-xl border border-brand-stone bg-white p-4">
            <h2 className="mb-4 text-sm font-semibold text-brand-navy">Datos del contrato</h2>

            <div className="space-y-4">
              {/* Client */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-navy/60">Cliente</p>
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-brand-stone bg-brand-paper/50 p-3 sm:grid-cols-2">
                  <Field label="Nombre legal" value={td.client_legal_name} />
                  <Field label="Tipo" value={td.client_representative_role === 'No aplica (persona fisica)' ? 'Persona física' : 'Persona moral'} />
                  <Field label="Representante" value={td.client_representative_name || null} />
                  <Field label="Cargo" value={td.client_representative_role && td.client_representative_role !== 'No aplica (persona fisica)' ? td.client_representative_role : null} />
                  <Field label="Domicilio legal" value={td.client_address} />
                </div>
              </div>

              {/* Service */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-navy/60">Servicio</p>
                <div className="grid grid-cols-1 gap-3 rounded-lg border border-brand-stone bg-brand-paper/50 p-3 sm:grid-cols-2">
                  <Field label="Tipo de servicio" value={td.service_type} />
                  <Field label="Fecha" value={td.event_date ? new Date(td.event_date).toLocaleDateString('es-MX', { dateStyle: 'long' }) : null} />
                  <Field label="Locación" value={td.event_location} />
                  <Field label="Participantes / mascotas / productos" value={td.participants_description || null} />
                  <div className="sm:col-span-2">
                    <Field label="Descripción" value={td.service_description} />
                  </div>
                  {td.special_restrictions && (
                    <div className="sm:col-span-2">
                      <Field label="Restricciones especiales" value={td.special_restrictions} />
                    </div>
                  )}
                </div>
              </div>

              {/* Financial */}
              {(td.total_amount || td.advance_percentage) && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-brand-navy/60">Honorarios</p>
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-brand-stone bg-brand-paper/50 p-3 sm:grid-cols-4">
                    <Field label="Total" value={td.total_amount ? `$${td.total_amount} MXN` : null} />
                    <Field label="Anticipo" value={td.advance_amount ? `$${td.advance_amount} MXN (${td.advance_percentage}%)` : null} />
                    <Field label="Saldo" value={td.balance_amount ? `$${td.balance_amount} MXN` : null} />
                    <Field label="Jurisdicción" value={`${td.jurisdiction_city}, ${td.jurisdiction_state}`} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quote preview */}
          {quote && (
            <div className="rounded-xl border border-brand-stone bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-brand-navy">
                  Cotización vinculada — {quote.quote_number}
                </h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${quote.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {quote.status === 'approved' ? 'Aprobada' : quote.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Título</p>
                  <p className="mt-0.5 text-sm text-gray-800">{quote.title}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total</p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-navy">
                    {Number(quote.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: quote.currency ?? 'MXN' })}
                  </p>
                </div>
                {quote.approved_at && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Aprobada</p>
                    <p className="mt-0.5 text-sm text-gray-800">{new Date(quote.approved_at).toLocaleDateString('es-MX')}</p>
                  </div>
                )}
              </div>

              {quoteLineItems && quoteLineItems.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Líneas de cotización</p>
                  <div className="overflow-hidden rounded-lg border border-brand-stone">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-brand-paper">
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Descripción</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Cant.</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">P.U.</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {quoteLineItems.map((item, i) => (
                          <tr key={i} className="border-t border-brand-stone/50">
                            <td className="px-3 py-2 text-gray-700">{item.description ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-600">{item.quantity ?? 1}</td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {Number(item.unit_price ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-gray-800">
                              {Number(item.total ?? 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Annexes */}
          <div className="rounded-xl border border-brand-stone bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-navy">Anexos</h2>
            {parsedContent.annexes.length === 0 ? (
              <p className="text-sm text-gray-500">Sin anexos.</p>
            ) : (
              <ul className="space-y-2">
                {parsedContent.annexes.map(annex => (
                  <li key={annex.id} className="flex items-center justify-between gap-2 rounded-lg border border-brand-stone/60 bg-brand-paper/40 px-3 py-2">
                    <span className="text-sm text-gray-700">{annex.title}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${annex.signed_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {annex.signed_at ? `Firmado — ${annex.signed_by ?? 'cliente'}` : 'Pendiente'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <ContractActions
            contractId={contract.id}
            status={contract.status}
            initialPortalUrl={portalUrl}
            zipUrl={zipUrl}
            approvalStatus={latestApprovalFlow?.status ?? null}
            canApprove={canApprove}
            linkedProject={linkedProject ? {
              id: linkedProject.id as string,
              title: linkedProject.title as string,
              stage: linkedProject.stage as string,
              due_date: linkedProject.due_date as string | null,
            } : null}
            contactId={contract.contact_id}
            projectTitle={quote?.title ?? contract.title}
          />

          <div className="rounded-xl border border-brand-stone bg-white p-4 text-xs text-gray-700 space-y-1.5">
            <p className="mb-2 text-sm font-semibold text-brand-navy">Detalle legal</p>
            <p><strong>Páginas con antefirma:</strong> {contract.page_count ?? 1}</p>
            <p><strong>Firma final:</strong> {contract.signed_by ?? 'Pendiente'}</p>
            <p><strong>Fecha firma:</strong> {contract.signed_at ? new Date(contract.signed_at).toLocaleString('es-MX') : 'Pendiente'}</p>
            <p><strong>Creado:</strong> {new Date(contract.created_at).toLocaleDateString('es-MX')}</p>
          </div>

          <div className="rounded-xl border border-brand-stone bg-white p-4 text-xs text-gray-700">
            <p className="mb-2 text-sm font-semibold text-brand-navy">Cliente</p>
            {contact ? (
              <div className="space-y-1">
                <p className="font-medium text-brand-navy">{contact.first_name} {contact.last_name}</p>
                {contact.company_name && <p className="text-gray-600">{contact.company_name}</p>}
                {contact.email && <p className="text-gray-600">{contact.email}</p>}
                {contact.phone && <p className="text-gray-600">{contact.phone}</p>}
              </div>
            ) : (
              <p>Sin contacto</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
