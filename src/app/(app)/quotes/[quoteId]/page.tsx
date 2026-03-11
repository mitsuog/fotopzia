import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { QuoteTotals } from '@/components/quotes/QuoteTotals'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { QuoteLineItem, QuoteStatus } from '@/types/quotes'

export const dynamic = 'force-dynamic'

type QuoteDetailContact = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  company_name: string | null
}

type QuoteDetail = {
  id: string
  quote_number: string
  title: string
  status: QuoteStatus
  valid_until: string | null
  notes: string | null
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  contact: QuoteDetailContact | null
  line_items: QuoteLineItem[] | null
}

export default async function QuoteDetailPage({
  params,
}: {
  params: { quoteId: string }
}) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('quotes')
    .select('*, contact:contacts(id, first_name, last_name, email, company_name), line_items:quote_line_items(*)')
    .eq('id', params.quoteId)
    .order('sort_order', { referencedTable: 'quote_line_items' })
    .single()

  if (!data) notFound()

  const quote = data as unknown as QuoteDetail
  const contact = quote.contact
  const lineItems = quote.line_items ?? []

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-sm text-gray-400">{quote.quote_number}</span>
            <QuoteStatusBadge status={quote.status} />
          </div>
          <h1 className="text-2xl font-bold text-brand-navy">{quote.title}</h1>
          <p className="text-gray-500 mt-0.5">
            {contact ? `${contact.first_name} ${contact.last_name}` : '-'}
            {contact?.company_name && ` - ${contact.company_name}`}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 border border-brand-stone text-sm rounded-lg hover:bg-brand-canvas text-brand-navy transition-colors"
          >
            Descargar PDF
          </a>
        </div>
      </div>

      {quote.valid_until && (
        <p className="text-xs text-gray-500 mb-4">
          Valida hasta:{' '}
          <strong>{format(new Date(quote.valid_until), 'd MMM yyyy', { locale: es })}</strong>
        </p>
      )}

      <div className="bg-brand-paper border border-brand-stone rounded-xl overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-stone bg-brand-canvas">
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Descripcion</th>
              <th className="text-right px-4 py-3 font-semibold text-brand-navy w-16">Cant.</th>
              <th className="text-right px-4 py-3 font-semibold text-brand-navy w-28">Precio unit.</th>
              <th className="text-right px-4 py-3 font-semibold text-brand-navy w-20">Desc. %</th>
              <th className="text-right px-4 py-3 font-semibold text-brand-navy w-28">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400 italic">
                  Sin conceptos
                </td>
              </tr>
            )}
            {lineItems.map(item => (
              <tr key={item.id} className="border-b border-brand-stone/50">
                <td className="px-4 py-3">{item.description}</td>
                <td className="px-4 py-3 text-right">{item.quantity}</td>
                <td className="px-4 py-3 text-right">
                  ${Number(item.unit_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right">{Number(item.discount_pct) > 0 ? `${item.discount_pct}%` : '-'}</td>
                <td className="px-4 py-3 text-right font-medium">
                  ${Number(item.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-4 flex justify-end border-t border-brand-stone">
          <QuoteTotals
            subtotal={Number(quote.subtotal)}
            taxRate={Number(quote.tax_rate)}
            taxAmount={Number(quote.tax_amount)}
            total={Number(quote.total)}
            currency={quote.currency}
          />
        </div>
      </div>

      {quote.notes && (
        <div className="bg-brand-paper border border-brand-stone rounded-xl p-4">
          <h3 className="font-semibold text-brand-navy mb-2">Notas para el cliente</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}
    </div>
  )
}
