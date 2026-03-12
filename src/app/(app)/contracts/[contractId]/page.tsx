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

export default async function ContractDetailPage({ params }: ContractDetailPageProps) {
  const { contractId } = await params
  const supabase = await createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, contract_number, title, status, content, quote_id, contact_id, page_count, signed_by, signed_at, created_at, updated_at, annexes, contact:contacts(first_name, last_name, email, phone, company_name), quote:quotes(id, quote_number, title, status)')
    .eq('id', contractId)
    .single()

  if (!contract) notFound()

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
          <div className="rounded-xl border border-brand-stone bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-brand-navy">Clausulas del contrato</h2>
            <div className="space-y-2 text-sm text-gray-700">
              {parsedContent.body.split('\n').map((line, index) => {
                const trimmed = line.trim()
                if (!trimmed) return <p key={`empty-${index}`}>&nbsp;</p>
                const isSectionTitle = /^[IVXLCDM]+\./i.test(trimmed) || /^CONTRATO/i.test(trimmed)
                return (
                  <p key={`line-${index}`} className={isSectionTitle ? 'font-semibold text-brand-navy' : ''}>
                    {trimmed}
                  </p>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-brand-stone bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-brand-navy">Anexos</h2>
            {parsedContent.annexes.length === 0 ? (
              <p className="text-sm text-gray-500">Sin anexos.</p>
            ) : (
              <ul className="space-y-1 text-sm text-gray-700">
                {parsedContent.annexes.map(annex => (
                  <li key={annex.id}>
                    {annex.title} · {annex.signed_at ? `Firmado (${annex.signed_by ?? 'cliente'})` : 'Pendiente'}
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
          />

          <div className="rounded-xl border border-brand-stone bg-white p-4 text-xs text-gray-700">
            <p className="mb-2 text-sm font-semibold text-brand-navy">Detalle legal</p>
            <p><strong>Páginas con antefirma:</strong> {contract.page_count ?? 1}</p>
            <p><strong>Firma final:</strong> {contract.signed_by ?? 'Pendiente'}</p>
            <p><strong>Fecha firma:</strong> {contract.signed_at ? new Date(contract.signed_at).toLocaleString('es-MX') : 'Pendiente'}</p>
            {contract.quote && (
              <p className="mt-2">
                <strong>Cotización vinculada:</strong>{' '}
                <Link href={`/quotes/${contract.quote.id}`} className="text-brand-navy underline">
                  {contract.quote.quote_number} ({contract.quote.status})
                </Link>
              </p>
            )}
          </div>

          <div className="rounded-xl border border-brand-stone bg-white p-4 text-xs text-gray-700">
            <p className="mb-2 text-sm font-semibold text-brand-navy">Cliente</p>
            {contract.contact ? (
              <div className="space-y-1">
                <p>{contract.contact.first_name} {contract.contact.last_name}</p>
                {contract.contact.company_name && <p>{contract.contact.company_name}</p>}
                {contract.contact.email && <p>{contract.contact.email}</p>}
                {contract.contact.phone && <p>{contract.contact.phone}</p>}
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
