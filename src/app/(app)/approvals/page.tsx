import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type FlowRow = {
  id: string
  title: string
  entity_type: string
  entity_id: string
  status: string
  created_at: string
}

type QuoteDoc = {
  id: string
  quote_number: string
  title: string
  status: string | null
}

type ContractDoc = {
  id: string
  contract_number: string
  title: string
  status: string | null
}

export default async function ApprovalsPage() {
  const supabase = await createClient()

  const { data: flows } = await supabase
    .from('approval_flows')
    .select('id, title, entity_type, entity_id, status, created_at')
    .order('created_at', { ascending: false })

  const safeFlows: FlowRow[] = (flows ?? []) as FlowRow[]

  const quoteIds = safeFlows.filter(flow => flow.entity_type === 'quote').map(flow => flow.entity_id)
  const contractIds = safeFlows.filter(flow => flow.entity_type === 'contract').map(flow => flow.entity_id)

  const quoteMap = new Map<string, QuoteDoc>()
  const contractMap = new Map<string, ContractDoc>()

  if (quoteIds.length > 0) {
    const { data: quotes } = await supabase
      .from('quotes')
      .select('id, quote_number, title, status')
      .in('id', quoteIds)

    for (const quote of (quotes ?? []) as QuoteDoc[]) {
      quoteMap.set(quote.id, quote)
    }
  }

  if (contractIds.length > 0) {
    const { data: contracts } = await supabase
      .from('contracts')
      .select('id, contract_number, title, status')
      .in('id', contractIds)

    for (const contract of (contracts ?? []) as ContractDoc[]) {
      contractMap.set(contract.id, contract)
    }
  }

  function getFlowStatusLabel(status: string): string {
    return status.replace('_', ' ')
  }

  function getDocumentMeta(flow: FlowRow):
    | {
      code: string
      title: string
      status: string
      detailHref: string
      previewHref: string
    }
    | null {
    if (flow.entity_type === 'quote') {
      const quote = quoteMap.get(flow.entity_id)
      if (!quote) return null
      return {
        code: quote.quote_number,
        title: quote.title,
        status: quote.status ?? 'draft',
        detailHref: `/quotes/${quote.id}`,
        previewHref: `/quotes/${quote.id}/print`,
      }
    }

    if (flow.entity_type === 'contract') {
      const contract = contractMap.get(flow.entity_id)
      if (!contract) return null
      return {
        code: contract.contract_number,
        title: contract.title,
        status: contract.status ?? 'draft',
        detailHref: `/contracts/${contract.id}`,
        previewHref: `/contracts/${contract.id}/print`,
      }
    }

    return null
  }

  return (
    <div>
      <PageHeader
        title="Aprobaciones"
        subtitle={`${safeFlows.length} flujos en seguimiento`}
        badge="Workflows"
      />

      <div className="rounded-xl border border-brand-stone/80 bg-white/80 overflow-hidden shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-brand-stone bg-brand-canvas/80">
                <th className="text-left px-4 py-3 font-semibold text-brand-navy">Workflow</th>
                <th className="text-left px-4 py-3 font-semibold text-brand-navy">Documento</th>
                <th className="text-left px-4 py-3 font-semibold text-brand-navy">Entidad</th>
                <th className="text-left px-4 py-3 font-semibold text-brand-navy">Estado</th>
                <th className="text-left px-4 py-3 font-semibold text-brand-navy">Vista previa</th>
              </tr>
            </thead>
            <tbody>
              {safeFlows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">Sin flujos de aprobacion</td>
                </tr>
              ) : (
                safeFlows.map(flow => {
                  const documentMeta = getDocumentMeta(flow)
                  return (
                    <tr key={flow.id} className="border-b border-brand-stone/50 last:border-0 align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-brand-navy">{flow.title}</p>
                        <p className="text-xs text-gray-400">{new Date(flow.created_at).toLocaleString('es-MX')}</p>
                      </td>
                      <td className="px-4 py-3">
                        {documentMeta ? (
                          <div>
                            <p className="font-medium text-brand-navy">{documentMeta.code}</p>
                            <p className="text-xs text-gray-600">{documentMeta.title}</p>
                            <p className="mt-1 text-[11px] text-gray-500">Estado doc: {documentMeta.status}</p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Documento no disponible</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{flow.entity_type}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                          {getFlowStatusLabel(flow.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-[440px]">
                        {documentMeta ? (
                          <details className="rounded-lg border border-brand-stone/60 bg-white p-2">
                            <summary className="cursor-pointer text-xs font-semibold text-brand-navy">
                              Ver lo que se va a aprobar
                            </summary>
                            <div className="mt-2 space-y-2">
                              <div className="h-[360px] overflow-hidden rounded-md border border-brand-stone/50">
                                <iframe
                                  src={documentMeta.previewHref}
                                  title={`Vista previa ${documentMeta.code}`}
                                  className="h-full w-full bg-white"
                                />
                              </div>
                              <div className="flex gap-2">
                                <Link
                                  href={documentMeta.detailHref}
                                  className="rounded-md border border-brand-stone px-2 py-1 text-xs text-brand-navy hover:bg-brand-canvas"
                                >
                                  Abrir detalle
                                </Link>
                                <Link
                                  href={documentMeta.previewHref}
                                  target="_blank"
                                  className="rounded-md border border-brand-stone px-2 py-1 text-xs text-brand-navy hover:bg-brand-canvas"
                                >
                                  Abrir PDF/impresion
                                </Link>
                              </div>
                            </div>
                          </details>
                        ) : (
                          <p className="text-xs text-gray-400">Sin vista previa para esta entidad</p>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
