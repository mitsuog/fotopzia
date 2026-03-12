import { PageHeader } from '@/components/layout/PageHeader'
import { QuotesTable } from '@/components/quotes/QuotesTable'
import { createClient } from '@/lib/supabase/server'
import type { Quote } from '@/types/quotes'

export const dynamic = 'force-dynamic'

export default async function QuotesPage() {
  const supabase = await createClient()
  const { data: quotes } = await supabase
    .from('quotes')
    .select('*, contact:contacts(id, first_name, last_name, company_name)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-5 pb-10">
      <PageHeader
        title="Cotizaciones"
        subtitle={`${quotes?.length ?? 0} en total`}
        badge="Ventas"
      />
      <QuotesTable initialQuotes={(quotes ?? []) as Quote[]} />
    </div>
  )
}
