import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseContractContent, toContractAnnexes } from '@/lib/documents/contracts'
import { ContractSigningWizard } from '@/components/portal/ContractSigningWizard'
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
  const defaultName = access.contacts
    ? `${access.contacts.first_name} ${access.contacts.last_name}`
    : ''

  return (
    <PortalShell
      token={token}
      active="documents"
      title={contract.title}
      description={`${contract.contract_number} · ${parsedContent.annexes.filter(a => a.requires_signature && !a.signed_at).length} documento(s) pendiente(s) de firma`}
    >
      <ContractSigningWizard
        token={token}
        contractId={contract.id}
        contractNumber={contract.contract_number}
        contractTitle={contract.title}
        contractBody={parsedContent.body}
        pageCount={contract.page_count ?? 1}
        signerNameDefault={defaultName}
        initialAnnexes={parsedContent.annexes}
        contractAlreadySigned={contract.status === 'signed'}
      />
    </PortalShell>
  )
}
