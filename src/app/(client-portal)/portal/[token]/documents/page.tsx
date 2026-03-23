import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseContractContent } from '@/lib/documents/contracts'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

interface DocumentsPageProps {
  params: Promise<{ token: string }>
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: 'Borrador', className: 'bg-gray-100 text-gray-600' },
    sent: { label: 'Pendiente de firma', className: 'bg-amber-100 text-amber-700' },
    viewed: { label: 'Revisando', className: 'bg-blue-100 text-blue-700' },
    approved: { label: 'Firmada', className: 'bg-emerald-100 text-emerald-700' },
    signed: { label: 'Firmado', className: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: 'Rechazada', className: 'bg-red-100 text-red-700' },
  }
  const entry = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${entry.className}`}>
      {entry.label}
    </span>
  )
}

export default async function PortalDocumentsPage({ params }: DocumentsPageProps) {
  const { token } = await params
  const { access } = await getPortalAccessByToken(token)
  if (!access) notFound()

  await touchPortalAccess(access)

  const [quotesResult, contractsResult] = await Promise.all([
    supabaseAdmin
      .from('quotes')
      .select('id, quote_number, title, status, total, currency, approved_at, approved_by')
      .eq('contact_id', access.contact_id)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('contracts')
      .select('id, contract_number, title, status, signed_at, signed_by, annexes, content')
      .eq('contact_id', access.contact_id)
      .neq('status', 'voided')
      .order('created_at', { ascending: false }),
  ])

  const quotes = quotesResult.data ?? []
  const contracts = (contractsResult.data ?? []).map(contract => {
    const parsed = parseContractContent(contract.content, contract.annexes)
    const totalAnnexes = parsed.annexes.filter(a => a.requires_signature).length
    const signedAnnexes = parsed.annexes.filter(a => a.requires_signature && a.signed_at).length
    return {
      ...contract,
      parsedAnnexes: parsed.annexes,
      totalAnnexes,
      signedAnnexes,
      pendingAnnexes: totalAnnexes - signedAnnexes,
    }
  })

  // Compute signing package progress
  const latestQuote = quotes[0] ?? null
  const latestContract = contracts[0] ?? null
  const quoteStep = latestQuote?.status === 'approved' ? 'done' : latestQuote ? 'pending' : 'none'
  const contractStep = latestContract?.status === 'signed' ? 'done' : latestContract ? 'pending' : 'none'

  const annexSteps = latestContract
    ? latestContract.parsedAnnexes.filter(a => a.requires_signature).map(a => ({
        title: a.title,
        done: Boolean(a.signed_at),
      }))
    : []

  const hasSignedDocs = quotes.some(q => q.status === 'approved') || contracts.some(c => c.status === 'signed')

  const progressSteps = [
    { label: 'Cotizacion', done: quoteStep === 'done', active: quoteStep === 'pending' },
    { label: 'Contrato', done: contractStep === 'done', active: contractStep === 'pending' },
    ...annexSteps.map(a => ({ label: a.title.replace(/^Anexo [ABC]\s*[-—]\s*/, 'Anexo ').replace('Autorizacion de Uso de Imagen / Voz / Mascota / Obra', 'Anexo C'), done: a.done, active: !a.done && contractStep !== 'none' })),
  ]

  return (
    <PortalShell
      token={token}
      active="documents"
      title="Documentos"
      description={`Cliente: ${access.contacts ? `${access.contacts.first_name} ${access.contacts.last_name}` : 'Sin nombre'}`}
    >
      {/* Signing progress */}
      {progressSteps.length > 0 && (
        <section className="rounded-2xl border border-brand-stone bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-brand-navy">Paquete de firma</h2>
          <div className="flex flex-wrap items-center gap-1">
            {progressSteps.map((step, i) => (
              <div key={step.label} className="flex items-center gap-1">
                <div className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                  step.done
                    ? 'bg-emerald-500 text-white'
                    : step.active
                      ? 'bg-brand-navy text-white'
                      : 'border border-brand-stone bg-white text-gray-400',
                ].join(' ')}>
                  {step.done ? '✓' : i + 1}
                </div>
                <span className={`text-xs ${step.done ? 'text-emerald-700 font-medium' : step.active ? 'text-brand-navy font-medium' : 'text-gray-400'}`}>
                  {step.label}
                </span>
                {i < progressSteps.length - 1 && (
                  <span className="text-gray-300">→</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="rounded-2xl border border-brand-stone bg-white p-4">
        <div className="flex flex-wrap gap-2">
          {hasSignedDocs && (
            <a
              href={`/api/portal/${token}/documents/zip`}
              className="inline-flex items-center rounded-lg border border-brand-stone bg-brand-paper px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas"
            >
              Descargar paquete ZIP de firmados
            </a>
          )}
          <Link
            href={`/portal/${token}/evento`}
            className="inline-flex items-center rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas"
          >
            Ver mi evento
          </Link>
        </div>
      </section>

      {/* Quotes */}
      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-navy">Cotizaciones</h2>
        <div className="mt-3 space-y-2">
          {quotes.length === 0 && <p className="text-sm text-gray-500">No hay cotizaciones disponibles.</p>}
          {quotes.map(quote => (
            <div key={quote.id} className="rounded-lg border border-brand-stone p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-brand-navy">{quote.title}</p>
                    <StatusBadge status={quote.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {quote.quote_number} · {Number(quote.total).toLocaleString('es-MX', { style: 'currency', currency: quote.currency ?? 'MXN' })}
                    {quote.approved_at ? ` · Firmada ${new Date(quote.approved_at).toLocaleDateString('es-MX')}` : ''}
                  </p>
                </div>
                {(quote.status === 'sent' || quote.status === 'viewed') ? (
                  <Link
                    href={`/portal/${token}/quotes/${quote.id}`}
                    className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light"
                  >
                    Firmar cotizacion
                  </Link>
                ) : quote.status === 'approved' ? (
                  <span className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
                    Firmada
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Contracts */}
      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-navy">Contratos y anexos</h2>
        <div className="mt-3 space-y-3">
          {contracts.length === 0 && <p className="text-sm text-gray-500">No hay contratos disponibles.</p>}
          {contracts.map(contract => (
            <div key={contract.id} className="rounded-lg border border-brand-stone p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-brand-navy">{contract.title}</p>
                    <StatusBadge status={contract.status} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {contract.contract_number}
                    {contract.signed_at ? ` · Firmado ${new Date(contract.signed_at).toLocaleDateString('es-MX')}` : ''}
                    {contract.pendingAnnexes > 0 ? ` · ${contract.pendingAnnexes} anexo(s) pendiente(s)` : ''}
                  </p>
                </div>
                {(contract.status === 'sent' || contract.status === 'viewed') ? (
                  <Link
                    href={`/portal/${token}/contracts/${contract.id}`}
                    className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light"
                  >
                    Firmar contrato
                  </Link>
                ) : contract.status === 'signed' ? (
                  <Link
                    href={`/portal/${token}/contracts/${contract.id}`}
                    className="shrink-0 rounded-md border border-brand-stone px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper"
                  >
                    Ver firmado
                  </Link>
                ) : null}
              </div>

              {/* Annexes list */}
              {contract.parsedAnnexes.length > 0 && (
                <div className="mt-2 rounded-md border border-brand-stone/60 bg-brand-paper/40 p-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Anexos</p>
                  <div className="space-y-1">
                    {contract.parsedAnnexes.map(annex => (
                      <div key={annex.id} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700">{annex.title}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${annex.signed_at ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {annex.signed_at ? 'Firmado' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </PortalShell>
  )
}

