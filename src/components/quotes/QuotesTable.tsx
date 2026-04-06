'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Eye, Printer, Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuotes } from '@/hooks/useQuotes'
import { QuoteStatusBadge } from './QuoteStatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Quote, QuoteStatus } from '@/types/quotes'
import type { ListViewQuery } from '@/types/list-view'

const STATUS_TABS: { value: QuoteStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'draft', label: 'Borrador' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'viewed', label: 'Vistas' },
  { value: 'approved', label: 'Aprobadas' },
  { value: 'rejected', label: 'Rechazadas' },
  { value: 'expired', label: 'Vencidas' },
]

function parseInitialQuery(searchParams: ReturnType<typeof useSearchParams>): ListViewQuery {
  const status = searchParams.get('status')
  const normalizedStatus = STATUS_TABS.some(tab => tab.value === status) ? status : 'all'

  return {
    q: searchParams.get('q') ?? undefined,
    status: normalizedStatus ?? 'all',
  }
}

export function QuotesTable({ initialQuotes }: { initialQuotes: Quote[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: quotes = initialQuotes } = useQuotes()

  const initialQuery = parseInitialQuery(searchParams)
  const [activeStatus, setActiveStatus] = useState<QuoteStatus | 'all'>((initialQuery.status as QuoteStatus | 'all') ?? 'all')
  const [search, setSearch] = useState(initialQuery.q ?? '')

  useEffect(() => {
    const nextParams = new URLSearchParams()
    if (search.trim()) nextParams.set('q', search.trim())
    if (activeStatus !== 'all') nextParams.set('status', activeStatus)

    const next = nextParams.toString()
    const current = searchParams.toString()
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [activeStatus, pathname, router, search, searchParams])

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

    if (activeStatus !== 'all') {
      list = list.filter(quote => quote.status === activeStatus)
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase()
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

  const hasFilters = Boolean(search.trim() || activeStatus !== 'all')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scrollbar-none flex flex-nowrap gap-1 overflow-x-auto pb-1 sm:flex-wrap">
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

      {hasFilters && (
        <p className="text-xs text-gray-500">Mostrando {filtered.length} de {quotes.length} cotizaciones</p>
      )}

      <div className="block space-y-2 sm:hidden">
        {filtered.length === 0 ? (
          <EmptyState
            title={hasFilters ? 'No encontramos cotizaciones con esos filtros.' : 'No hay cotizaciones aun.'}
            description={hasFilters ? 'Ajusta estado o busqueda para ver resultados.' : 'Crea la primera cotizacion para iniciar tu pipeline.'}
            ctaLabel={hasFilters ? undefined : 'Crear cotizacion'}
            ctaHref={hasFilters ? undefined : '/quotes/new'}
          />
        ) : (
          filtered.map(quote => (
            <Link
              key={quote.id}
              href={`/quotes/${quote.id}`}
              className="flex items-start gap-3 rounded-xl border border-brand-stone bg-brand-paper p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] text-gray-400">{quote.quote_number}</p>
                <p className="truncate font-semibold text-brand-navy">{quote.title}</p>
                {quote.contact && (
                  <p className="text-xs text-gray-500">{quote.contact.first_name} {quote.contact.last_name}</p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <QuoteStatusBadge status={quote.status} />
                <p className="text-sm font-semibold tabular-nums text-brand-navy">
                  ${Number(quote.total).toLocaleString('es-MX', { minimumFractionDigits: 0 })}
                </p>
                {quote.valid_until && (
                  <p className="text-[10px] text-gray-400">{format(new Date(quote.valid_until), 'd MMM', { locale: es })}</p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-brand-stone bg-brand-paper sm:block">
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
                    {hasFilters
                      ? 'Sin cotizaciones que coincidan con el filtro.'
                      : 'No hay cotizaciones aun. Crea la primera.'}
                  </td>
                </tr>
              )}

              {filtered.map(quote => {
                const replacement = supersededMap.get(quote.id)
                return (
                  <tr
                    key={quote.id}
                    className="last:border-0 border-b border-brand-stone/40 transition-colors hover:bg-brand-canvas/50"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{quote.quote_number}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 font-medium text-brand-navy">{quote.title}</td>
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
                          className="inline-flex items-center gap-1 text-xs text-brand-navy transition-colors hover:text-brand-gold"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver
                        </Link>
                        <a
                          href={`/quotes/${quote.id}/print`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-brand-navy"
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
