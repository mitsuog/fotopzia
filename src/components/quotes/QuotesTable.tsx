'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Eye, Printer, Search } from 'lucide-react'
import { useQuotes } from '@/hooks/useQuotes'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import type { Quote, QuoteStatus } from '@/types/quotes'

const STATUS_TABS: { value: QuoteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'draft', label: 'Borrador' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'viewed', label: 'Vistas' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'expired', label: 'Vencidas' },
]

export function QuotesTable({ initialQuotes }: { initialQuotes: Quote[] }) {
  const { data: quotes = initialQuotes } = useQuotes()
  const [activeStatus, setActiveStatus] = useState<QuoteStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const supersededMap = useMemo(() => {
    const activeStatuses: QuoteStatus[] = ['draft', 'sent', 'viewed', 'approved']
    const latestByContact = new Map<string, Quote>()

    for (const quote of quotes) {
      if (!quote.contact_id || !activeStatuses.includes(quote.status)) continue
      const current = latestByContact.get(quote.contact_id)
      if (!current || new Date(quote.created_at).getTime() > new Date(current.created_at).getTime()) {
        latestByContact.set(quote.contact_id, quote)
      }
    }

    const map = new Map<string, Quote>()
    for (const quote of quotes) {
      if (!quote.contact_id) continue
      const latest = latestByContact.get(quote.contact_id)
      if (latest && latest.id !== quote.id) map.set(quote.id, latest)
    }
    return map
  }, [quotes])

  const filtered = useMemo(() => {
    let list = quotes
    if (activeStatus !== 'all') list = list.filter(quote => quote.status === activeStatus)
    if (search) {
      const query = search.toLowerCase()
      list = list.filter(quote =>
        quote.title.toLowerCase().includes(query)
        || quote.quote_number.toLowerCase().includes(query)
        || (quote.contact && `${quote.contact.first_name} ${quote.contact.last_name}`.toLowerCase().includes(query)),
      )
    }
    return list
  }, [quotes, activeStatus, search])

  const counts = useMemo(() => {
    const map: Partial<Record<QuoteStatus | 'all', number>> = { all: quotes.length }
    for (const quote of quotes) map[quote.status] = (map[quote.status] ?? 0) + 1
    return map
  }, [quotes])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveStatus(tab.value)}
              className={[
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors',
                activeStatus === tab.value
                  ? 'bg-brand-navy text-white'
                  : 'border border-brand-stone bg-white text-gray-600 hover:bg-brand-canvas',
              ].join(' ')}
            >
              {tab.label}
              {counts[tab.value] !== undefined && (
                <span className={activeStatus === tab.value ? 'text-white/70' : 'text-gray-400'}>
                  {counts[tab.value]}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar folio, titulo o cliente..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            className="w-full rounded-lg border border-brand-stone bg-brand-paper py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-stone bg-brand-paper">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-brand-stone bg-brand-canvas">
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Folio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Titulo</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Cliente</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-brand-navy">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Vigencia</th>
                <th className="px-4 py-3 text-xs font-semibold text-brand-navy" />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-sm text-gray-400 italic">
                    {search || activeStatus !== 'all'
                      ? 'Sin cotizaciones que coincidan con el filtro'
                      : 'No hay cotizaciones aun. Crea la primera.'}
                  </td>
                </tr>
              )}

              {filtered.map(quote => {
                const replacement = supersededMap.get(quote.id)
                return (
                  <tr
                    key={quote.id}
                    className="border-b border-brand-stone/40 transition-colors hover:bg-brand-canvas/50 last:border-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{quote.quote_number}</td>
                    <td className="px-4 py-3 font-medium text-brand-navy max-w-[200px] truncate">{quote.title}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {quote.contact ? `${quote.contact.first_name} ${quote.contact.last_name}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      ${Number(quote.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}{' '}
                      <span className="text-xs font-normal text-gray-400">{quote.currency}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <QuoteStatusBadge status={quote.status} />
                        {replacement && (
                          <p className="text-[11px] text-amber-700">
                            Reemplazada por{' '}
                            <Link href={`/quotes/${replacement.id}`} className="font-semibold underline">
                              {replacement.quote_number}
                            </Link>
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {quote.valid_until
                        ? format(new Date(quote.valid_until), 'd MMM yyyy', { locale: es })
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/quotes/${quote.id}`}
                          className="inline-flex items-center gap-1 text-xs text-brand-navy hover:text-brand-gold transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </Link>
                        <a
                          href={`/quotes/${quote.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-navy transition-colors"
                          title="Imprimir / PDF"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
