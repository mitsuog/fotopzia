import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronLeft, Mail, Building2, Phone } from 'lucide-react'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { QuoteTotals } from '@/components/quotes/QuoteTotals'
import { QuoteActions } from '@/components/quotes/QuoteActions'
import type { QuoteLineItem, QuoteStatus } from '@/types/quotes'

export const dynamic = 'force-dynamic'

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ quoteId: string }>
}) {
  const { quoteId } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('quotes')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone, company_name),
      deal:deals(id, title),
      line_items:quote_line_items(*)
    `)
    .eq('id', quoteId)
    .order('sort_order', { referencedTable: 'quote_line_items' })
    .single()

  if (!data) notFound()

  const q = data as typeof data & {
    contact: { id: string; first_name: string; last_name: string; email: string | null; phone: string | null; company_name: string | null } | null
    deal: { id: string; title: string } | null
    line_items: QuoteLineItem[]
    status: QuoteStatus
  }

  const contact = q.contact
  const lineItems: QuoteLineItem[] = q.line_items ?? []

  return (
    <div className="space-y-5 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/quotes"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-navy transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Cotizaciones
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-xs font-mono text-gray-500">{q.quote_number}</span>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-brand-stone bg-brand-paper p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="font-mono text-xs text-gray-400">{q.quote_number}</span>
              <QuoteStatusBadge status={q.status} />
            </div>
            <h1 className="text-xl font-bold text-brand-navy">{q.title}</h1>
            {q.valid_until && (
              <p className="mt-1 text-xs text-gray-500">
                Válida hasta:{' '}
                <strong className="text-gray-700">
                  {format(new Date(q.valid_until), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </strong>
              </p>
            )}
          </div>
          <QuoteActions quoteId={q.id} status={q.status} dealId={q.deal_id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: Line items + Notes */}
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-brand-stone bg-brand-paper">
            <div className="border-b border-brand-stone bg-brand-canvas px-4 py-3">
              <h2 className="text-sm font-semibold text-brand-navy">Conceptos</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-brand-stone/50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">Descripción</th>
                    <th className="px-4 py-2.5 text-right font-medium w-16">Cant.</th>
                    <th className="px-4 py-2.5 text-right font-medium w-28">P. unit.</th>
                    <th className="px-4 py-2.5 text-right font-medium w-20">Desc.</th>
                    <th className="px-4 py-2.5 text-right font-medium w-28">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-xs italic text-gray-400">
                        Sin conceptos
                      </td>
                    </tr>
                  )}
                  {lineItems.map(item => {
                    const itemTotal =
                      Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_pct) / 100)
                    return (
                      <tr key={item.id} className="border-b border-brand-stone/40 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-medium text-brand-navy">{item.description}</p>
                          {item.category && (
                            <p className="mt-0.5 text-[11px] capitalize text-gray-400">{item.category}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">{Number(item.quantity)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          ${Number(item.unit_price).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {Number(item.discount_pct) > 0 ? `${item.discount_pct}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-brand-navy">
                          ${itemTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-brand-stone px-4 py-4">
              <QuoteTotals
                subtotal={Number(q.subtotal)}
                taxRate={Number(q.tax_rate)}
                taxAmount={Number(q.tax_amount)}
                total={Number(q.total)}
                currency={q.currency}
              />
            </div>
          </div>

          {q.notes && (
            <div className="rounded-xl border border-brand-stone bg-brand-paper p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Notas para el cliente
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.notes}</p>
            </div>
          )}
          {q.internal_notes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                Notas internas
              </h3>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{q.internal_notes}</p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="rounded-xl border border-brand-stone bg-brand-paper p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</h3>
            {contact ? (
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white">
                    {(contact.first_name[0] ?? '') + (contact.last_name[0] ?? '')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-brand-navy">
                      {contact.first_name} {contact.last_name}
                    </p>
                    {contact.company_name && (
                      <p className="text-xs text-gray-500">{contact.company_name}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-gray-600">
                  {contact.email && (
                    <a href={`mailto:${contact.email}`} className="flex items-center gap-2 hover:text-brand-navy">
                      <Mail className="h-3.5 w-3.5 text-gray-400" /> {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a href={`tel:${contact.phone}`} className="flex items-center gap-2 hover:text-brand-navy">
                      <Phone className="h-3.5 w-3.5 text-gray-400" /> {contact.phone}
                    </a>
                  )}
                  {contact.company_name && (
                    <p className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-gray-400" /> {contact.company_name}
                    </p>
                  )}
                </div>
                <Link
                  href={`/crm/${contact.id}`}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-brand-stone px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas transition-colors"
                >
                  Ver perfil completo
                </Link>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sin contacto</p>
            )}
          </div>

          {q.deal && (
            <div className="rounded-xl border border-brand-stone bg-brand-paper p-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Deal</h3>
              <p className="text-sm font-medium text-brand-navy">{q.deal.title}</p>
              <Link
                href="/crm/kanban"
                className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-brand-stone px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas transition-colors"
              >
                Ver en Kanban →
              </Link>
            </div>
          )}

          <div className="rounded-xl border border-brand-stone bg-brand-paper p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Detalles</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Creada</span>
                <span className="font-medium">{format(new Date(q.created_at), 'd MMM yyyy', { locale: es })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Moneda</span>
                <span className="font-medium">{q.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">IVA</span>
                <span className="font-medium">{Number(q.tax_rate)}%</span>
              </div>
              {q.valid_until && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Vigencia</span>
                  <span className="font-medium">{format(new Date(q.valid_until), 'd MMM yyyy', { locale: es })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
