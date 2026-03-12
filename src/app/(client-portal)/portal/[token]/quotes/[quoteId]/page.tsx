import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { QuoteSigningForm } from '@/components/portal/QuoteSigningForm'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

interface PortalQuotePageProps {
  params: Promise<{ token: string; quoteId: string }>
}

export default async function PortalQuoteSigningPage({ params }: PortalQuotePageProps) {
  const { token, quoteId } = await params
  const { access } = await getPortalAccessByToken(token)
  if (!access) notFound()
  await touchPortalAccess(access)

  const { data: quote } = await supabaseAdmin
    .from('quotes')
    .select('id, quote_number, title, status, subtotal, tax_rate, tax_amount, total, currency, notes, contact_id, line_items:quote_line_items(*)')
    .eq('id', quoteId)
    .single()

  if (!quote || quote.contact_id !== access.contact_id) notFound()

  const defaultName = access.contacts ? `${access.contacts.first_name} ${access.contacts.last_name}` : ''
  const lineItems = quote.line_items ?? []

  return (
    <PortalShell
      token={token}
      active="documents"
      title={quote.title}
      description={`${quote.quote_number} · Estado actual: ${quote.status}`}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="overflow-hidden rounded-xl border border-brand-stone bg-white lg:col-span-2">
          <div className="flex items-center justify-between gap-2 border-b border-brand-stone bg-brand-paper px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-navy">Detalle de conceptos</h2>
            <Link
              href={`/portal/${token}/documents`}
              className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper"
            >
              Volver a documentos
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-brand-stone/50 text-xs text-gray-600">
                  <th className="px-4 py-2 text-left font-medium">Descripcion</th>
                  <th className="px-4 py-2 text-right font-medium">Cant.</th>
                  <th className="px-4 py-2 text-right font-medium">P. Unit.</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-500">Sin conceptos</td>
                  </tr>
                )}
                {lineItems.map(item => (
                  <tr key={item.id} className="border-b border-brand-stone/40 last:border-0">
                    <td className="px-4 py-3 text-brand-navy">{item.description}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {Number(item.unit_price).toLocaleString('es-MX', { style: 'currency', currency: quote.currency })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-brand-navy">
                      {Number(item.total).toLocaleString('es-MX', { style: 'currency', currency: quote.currency })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1 border-t border-brand-stone bg-brand-paper/40 px-4 py-3 text-sm">
            <p className="flex justify-between"><span>Subtotal</span><span>{Number(quote.subtotal).toLocaleString('es-MX', { style: 'currency', currency: quote.currency })}</span></p>
            <p className="flex justify-between"><span>IVA ({quote.tax_rate}%)</span><span>{Number(quote.tax_amount).toLocaleString('es-MX', { style: 'currency', currency: quote.currency })}</span></p>
            <p className="flex justify-between font-semibold text-brand-navy"><span>Total</span><span>{Number(quote.total).toLocaleString('es-MX', { style: 'currency', currency: quote.currency })}</span></p>
          </div>

          {quote.notes && (
            <div className="border-t border-brand-stone px-4 py-3 text-sm text-gray-700">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Notas</p>
              <p className="whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}
        </section>

        <aside>
          <QuoteSigningForm
            token={token}
            quoteId={quote.id}
            defaultSignerName={defaultName}
          />
        </aside>
      </div>
    </PortalShell>
  )
}

