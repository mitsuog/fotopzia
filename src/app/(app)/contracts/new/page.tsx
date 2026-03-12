import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ContractEditor } from '@/components/contracts/ContractEditor'

export const dynamic = 'force-dynamic'

interface NewContractPageProps {
  searchParams: Promise<{ contactId?: string; dealId?: string }>
}

export default async function NewContractPage({ searchParams }: NewContractPageProps) {
  const { contactId, dealId } = await searchParams
  const supabase = await createClient()

  const [{ data: contacts }, { data: quotes }, { data: deal }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name, company_name, legal_entity_type, legal_name, legal_representative_name, legal_representative_role, legal_address')
      .order('first_name'),
    supabase
      .from('quotes')
      .select('id, quote_number, title, status, contact_id, deal_id, approved_at, updated_at, client_entity_type, client_legal_name, client_representative_name, client_representative_role, client_legal_address, service_type, service_description, service_date, service_location, line_items:quote_line_items(description)')
      .order('updated_at', { ascending: false }),
    dealId
      ? supabase.from('deals').select('id, contact_id').eq('id', dealId).single()
      : Promise.resolve({ data: null }),
  ])

  const defaultContactId = contactId ?? deal?.contact_id ?? ''

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
        <span className="text-xs text-gray-500">Nuevo contrato</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-brand-navy">Nuevo contrato</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Toma automaticamente datos del ultimo documento de cotizacion aprobado por el cliente.
        </p>
      </div>

      <ContractEditor
        contacts={contacts ?? []}
        quotes={quotes ?? []}
        defaultContactId={defaultContactId}
      />
    </div>
  )
}
