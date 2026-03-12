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
      .order('created_at', { ascending: false }),
  ])

  const quotes = quotesResult.data ?? []
  const contracts = (contractsResult.data ?? []).map(contract => {
    const parsed = parseContractContent(contract.content, contract.annexes)
    const pendingAnnexes = parsed.annexes.filter(annex => annex.requires_signature && !annex.signed_at).length
    return {
      ...contract,
      pendingAnnexes,
    }
  })

  return (
    <PortalShell
      token={token}
      active="documents"
      title="Documentos"
      description={`Cliente: ${access.contacts ? `${access.contacts.first_name} ${access.contacts.last_name}` : 'Sin nombre'}`}
    >
      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/portal/${token}/documents/zip`}
            className="inline-flex items-center rounded-lg border border-brand-stone bg-brand-paper px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas"
          >
            Descargar paquete ZIP de firmados
          </a>
          <Link
            href={`/portal/${token}/evento`}
            className="inline-flex items-center rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas"
          >
            Ver mi evento
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-navy">Cotizaciones</h2>
        <div className="mt-3 space-y-2">
          {quotes.length === 0 && <p className="text-sm text-gray-500">No hay cotizaciones disponibles.</p>}
          {quotes.map(quote => (
            <div key={quote.id} className="rounded-lg border border-brand-stone p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">{quote.title}</p>
                  <p className="text-xs text-gray-600">
                    {quote.quote_number} · {quote.status} ·{' '}
                    {Number(quote.total).toLocaleString('es-MX', { style: 'currency', currency: quote.currency })}
                  </p>
                </div>
                {(quote.status === 'sent' || quote.status === 'viewed') ? (
                  <Link
                    href={`/portal/${token}/quotes/${quote.id}`}
                    className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light"
                  >
                    Firmar cotizacion
                  </Link>
                ) : (
                  <span className="rounded-md border border-brand-stone px-3 py-1.5 text-xs text-gray-600">
                    {quote.status === 'approved' ? `Firmada por ${quote.approved_by ?? 'cliente'}` : 'No requiere firma'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-navy">Contratos</h2>
        <div className="mt-3 space-y-2">
          {contracts.length === 0 && <p className="text-sm text-gray-500">No hay contratos disponibles.</p>}
          {contracts.map(contract => (
            <div key={contract.id} className="rounded-lg border border-brand-stone p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-brand-navy">{contract.title}</p>
                  <p className="text-xs text-gray-600">
                    {contract.contract_number} · {contract.status} · Anexos pendientes: {contract.pendingAnnexes}
                  </p>
                </div>
                {(contract.status === 'sent' || contract.status === 'viewed') ? (
                  <Link
                    href={`/portal/${token}/contracts/${contract.id}`}
                    className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light"
                  >
                    Firmar contrato
                  </Link>
                ) : (
                  <span className="rounded-md border border-brand-stone px-3 py-1.5 text-xs text-gray-600">
                    {contract.status === 'signed' ? `Firmado por ${contract.signed_by ?? 'cliente'}` : 'No requiere firma'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </PortalShell>
  )
}

