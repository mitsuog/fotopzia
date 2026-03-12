import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseContractContent, toContractAnnexes } from '@/lib/documents/contracts'
import { ContractSigningForm } from '@/components/portal/ContractSigningForm'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

interface PortalContractPageProps {
  params: Promise<{ token: string; contractId: string }>
}

export default async function PortalContractSigningPage({ params }: PortalContractPageProps) {
  const { token, contractId } = await params
  const { access } = await getPortalAccessByToken(token)
  if (!access) notFound()
  await touchPortalAccess(access)

  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('id, contract_number, title, status, content, page_count, contact_id, annexes')
    .eq('id', contractId)
    .single()

  if (!contract || contract.contact_id !== access.contact_id) notFound()

  const parsedContent = parseContractContent(contract.content, toContractAnnexes(contract.annexes))
  const defaultName = access.contacts ? `${access.contacts.first_name} ${access.contacts.last_name}` : ''

  return (
    <PortalShell
      token={token}
      active="documents"
      title={contract.title}
      description={`${contract.contract_number} · Estado actual: ${contract.status}`}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="rounded-xl border border-brand-stone bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-brand-navy">Clausulas del contrato (solo lectura)</h2>
            <Link
              href={`/portal/${token}/documents`}
              className="rounded-md border border-brand-stone px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper"
            >
              Volver a documentos
            </Link>
          </div>

          <div className="space-y-2 text-sm text-gray-700">
            {parsedContent.body.split('\n').map((line, index) => {
              const trimmed = line.trim()
              if (!trimmed) return <p key={`blank-${index}`}>&nbsp;</p>
              const isTitle = /^[IVXLCDM]+\./i.test(trimmed) || /^CONTRATO/i.test(trimmed)
              return (
                <p key={`line-${index}`} className={isTitle ? 'font-semibold text-brand-navy' : ''}>
                  {trimmed}
                </p>
              )
            })}
          </div>

          <div className="mt-5 rounded-lg border border-brand-stone p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Anexos incluidos</h3>
            <ul className="mt-2 space-y-1">
              {parsedContent.annexes.length === 0 && (
                <li className="text-sm text-gray-500">Sin anexos.</li>
              )}
              {parsedContent.annexes.map(annex => (
                <li key={annex.id} className="text-sm text-gray-700">
                  {annex.title} · {annex.signed_at ? 'Firmado' : 'Pendiente'}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside>
          <ContractSigningForm
            token={token}
            contractId={contract.id}
            defaultSignerName={defaultName}
            pageCount={contract.page_count ?? 1}
            initialAnnexes={parsedContent.annexes}
          />
        </aside>
      </div>
    </PortalShell>
  )
}

