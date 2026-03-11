import Link from 'next/link'
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
    <div>
      <PageHeader
        title="Cotizaciones"
        subtitle={`${quotes?.length ?? 0} cotizaciones en total`}
        badge="Ventas"
        actions={
          <Link href="/quotes/new" className="inline-flex items-center rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white">
            + Nueva Cotizacion
          </Link>
        }
      />
      <QuotesTable initialQuotes={(quotes ?? []) as Quote[]} />
    </div>
  )
}
