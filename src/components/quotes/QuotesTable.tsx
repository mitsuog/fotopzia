'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'
import { Eye } from 'lucide-react'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import type { Quote } from '@/types/quotes'

export function QuotesTable({ initialQuotes }: { initialQuotes: Quote[] }) {
  const { data: quotes = initialQuotes } = useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('quotes')
        .select('*, contact:contacts(id, first_name, last_name, company_name)')
        .order('created_at', { ascending: false })
      return (data ?? []) as Quote[]
    },
    initialData: initialQuotes,
  })

  return (
    <div className="bg-brand-paper border border-brand-stone rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
          <tr className="border-b border-brand-stone bg-brand-canvas">
            <th className="text-left px-4 py-3 font-semibold text-brand-navy">Número</th>
            <th className="text-left px-4 py-3 font-semibold text-brand-navy">Título</th>
            <th className="text-left px-4 py-3 font-semibold text-brand-navy">Cliente</th>
            <th className="text-right px-4 py-3 font-semibold text-brand-navy">Total</th>
            <th className="text-left px-4 py-3 font-semibold text-brand-navy">Estado</th>
            <th className="text-left px-4 py-3 font-semibold text-brand-navy">Válida hasta</th>
            <th className="px-4 py-3"></th>
          </tr>
          </thead>
          <tbody>
          {quotes.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center py-12 text-gray-400 italic">
                No hay cotizaciones aún
              </td>
            </tr>
          )}
          {quotes.map((quote) => (
            <tr
              key={quote.id}
              className="border-b border-brand-stone/50 hover:bg-brand-canvas/50 transition-colors"
            >
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{quote.quote_number}</td>
              <td className="px-4 py-3 font-medium text-brand-navy">{quote.title}</td>
              <td className="px-4 py-3 text-gray-600">
                {quote.contact
                  ? `${quote.contact.first_name} ${quote.contact.last_name}`
                  : '—'}
              </td>
              <td className="px-4 py-3 text-right font-semibold">
                ${Number(quote.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                {quote.currency}
              </td>
              <td className="px-4 py-3">
                <QuoteStatusBadge status={quote.status} />
              </td>
              <td className="px-4 py-3 text-gray-500">
                {quote.valid_until
                  ? format(new Date(quote.valid_until), 'd MMM yyyy', { locale: es })
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/quotes/${quote.id}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-navy hover:text-brand-gold"
                >
                  <Eye className="w-3.5 h-3.5" /> Ver
                </Link>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
