import { createClient } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { QuoteEditor } from '@/components/quotes/QuoteEditor'
import type { Contact } from '@/types/crm'

export const dynamic = 'force-dynamic'

interface DealSummary {
  id: string
  title: string
  contact_id: string
}

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ contactId?: string; dealId?: string }>
}) {
  const { contactId, dealId } = await searchParams
  const supabase = await createClient()

  const [{ data: contacts }, { data: deals }] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, first_name, last_name, company_name, email, phone, source, tags, assigned_to, created_by, created_at, updated_at')
      .order('first_name'),
    supabase
      .from('deals')
      .select('id, title, contact_id')
      .order('title'),
  ])

  // Auto-resolve contactId from deal when not provided
  let resolvedContactId = contactId
  if (dealId && !contactId) {
    const deal = (deals ?? []).find((d: DealSummary) => d.id === dealId)
    if (deal) resolvedContactId = deal.contact_id
  }

  return (
    <div className="space-y-5 pb-10">
      <div className="flex items-center gap-2">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-navy transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Cotizaciones
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-xs text-gray-500">Nueva cotización</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-brand-navy">Nueva Cotización</h1>
        <p className="text-sm text-gray-500 mt-0.5">Define conceptos, impuestos y condiciones</p>
      </div>

      <QuoteEditor
        contacts={(contacts ?? []) as Contact[]}
        deals={(deals ?? []) as DealSummary[]}
        defaultContactId={resolvedContactId}
        defaultDealId={dealId}
      />
    </div>
  )
}
