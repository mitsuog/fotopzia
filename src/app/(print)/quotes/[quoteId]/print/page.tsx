import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { QuoteLineItem, QuoteStatus } from '@/types/quotes'
import { PrintToolbar } from './PrintToolbar'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  viewed: 'Vista',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Vencida',
}

function fmt(n: number, currency = 'MXN') {
  return `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function formatMxPhone(phone: string | null | undefined): string {
  if (!phone) return 'No disponible'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `+52 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 12 && digits.startsWith('52')) {
    return `+52 (${digits.slice(2, 5)}) ${digits.slice(5, 8)}-${digits.slice(8)}`
  }
  if (digits.length === 13 && digits.startsWith('521')) {
    return `+52 (${digits.slice(3, 6)}) ${digits.slice(6, 9)}-${digits.slice(9)}`
  }
  return phone
}

export default async function QuotePrintPage({
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
    contact: { first_name: string; last_name: string; email: string | null; phone: string | null; company_name: string | null } | null
    deal: { id: string; title: string } | null
    line_items: QuoteLineItem[]
    status: QuoteStatus
    created_by: string
  }

  const { data: quoteAuthor } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', q.created_by)
    .maybeSingle()

  const authorName = quoteAuthor?.full_name ?? 'Equipo Fotopzia Mexico'
  const authorEmail = quoteAuthor?.email ?? 'contacto@fotopzia.com'
  const authorPhone = formatMxPhone(quoteAuthor?.phone)

  const contact = q.contact
  const lineItems: QuoteLineItem[] = q.line_items ?? []
  const today = format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es })
  const validUntil = q.valid_until
    ? format(new Date(q.valid_until), "d 'de' MMMM 'de' yyyy", { locale: es })
    : null

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        @page {
          size: A4;
          margin: 1.8cm 2cm 2.2cm 2cm;
        }

        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .page-wrap { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
        }

        @media screen {
          body { background: #edecea; }
          .page-wrap {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            box-shadow: 0 6px 32px rgba(0,0,0,0.18);
            border-radius: 4px;
            min-height: 1122px;
          }
        }

        body {
          font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
          font-size: 11px;
          color: #1a1a2e;
          line-height: 1.5;
        }

        /* Toolbar - screen only */
        .toolbar {
          background: #1C2B4A;
          padding: 12px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 4px 4px 0 0;
        }
        .toolbar-left { display: flex; align-items: center; gap: 8px; }
        .toolbar span { color: rgba(255,255,255,0.6); font-size: 11px; }
        .btn-print {
          display: inline-flex; align-items: center; gap: 6px;
          background: #C49A2A; color: white; border: none; cursor: pointer;
          padding: 8px 18px; border-radius: 6px; font-size: 12px; font-weight: 600;
          font-family: inherit;
          transition: background 0.15s;
        }
        .btn-print:hover { background: #DDB84A; }
        .btn-close {
          display: inline-flex; align-items: center;
          background: transparent; color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.2);
          cursor: pointer; padding: 8px 14px; border-radius: 6px; font-size: 12px;
          font-family: inherit;
          transition: background 0.15s;
        }
        .btn-close:hover { background: rgba(255,255,255,0.1); color: white; }

        /* Page content */
        .page-content { padding: 48px 52px 56px; }

        /* Studio header */
        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 24px;
          border-bottom: 2px solid #1C2B4A;
          margin-bottom: 28px;
        }
        .studio-name {
          font-size: 22px;
          font-weight: 800;
          color: #1C2B4A;
          letter-spacing: -0.5px;
          line-height: 1.1;
        }
        .studio-logo {
          width: 220px;
          height: auto;
          display: block;
          margin-bottom: 10px;
        }
        .studio-tagline {
          font-size: 10px;
          color: #C49A2A;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-top: 3px;
        }
        .studio-contact-info {
          font-size: 9.5px;
          color: #666;
          margin-top: 8px;
          line-height: 1.7;
        }
        .quote-label-block { text-align: right; }
        .quote-title-badge {
          display: inline-block;
          background: #1C2B4A;
          color: white;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 3px;
          padding: 6px 18px;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        .quote-meta-grid {
          display: grid;
          grid-template-columns: auto auto;
          gap: 3px 16px;
          text-align: left;
          margin-top: 8px;
        }
        .meta-label { color: #888; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .meta-value { color: #1C2B4A; font-size: 10.5px; font-weight: 600; }
        .status-pill {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          background: #f0f0f0;
          color: #555;
        }

        /* Client block */
        .client-block {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 28px;
        }
        .client-section { flex: 1; }
        .section-eyebrow {
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 700;
          color: #C49A2A;
          margin-bottom: 6px;
        }
        .client-fullname {
          font-size: 14px;
          font-weight: 700;
          color: #1C2B4A;
          line-height: 1.2;
        }
        .client-company {
          font-size: 11px;
          color: #555;
          margin-top: 2px;
          font-weight: 500;
        }
        .client-contact-line {
          font-size: 10px;
          color: #777;
          margin-top: 6px;
          line-height: 1.7;
        }

        .deal-ref {
          background: #f8f7f4;
          border-left: 3px solid #C49A2A;
          padding: 6px 12px;
          border-radius: 0 4px 4px 0;
          font-size: 10px;
          color: #555;
        }
        .deal-ref strong { color: #1C2B4A; }

        /* Line items table */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0;
          font-size: 10.5px;
        }
        .items-table thead tr {
          background: #1C2B4A;
          color: white;
        }
        .items-table thead th {
          padding: 9px 12px;
          text-align: left;
          font-weight: 600;
          font-size: 9px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .items-table thead th:not(:first-child) { text-align: right; }
        .items-table tbody tr { border-bottom: 1px solid #edecea; }
        .items-table tbody tr:last-child { border-bottom: none; }
        .items-table tbody td { padding: 10px 12px; vertical-align: top; }
        .items-table tbody td:not(:first-child) { text-align: right; }
        .item-desc { font-weight: 500; color: #1C2B4A; }
        .item-category {
          display: inline-block;
          font-size: 8.5px;
          color: #999;
          margin-top: 2px;
          text-transform: capitalize;
        }
        .table-section {
          border: 1px solid #e5e3dd;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 24px;
        }

        /* Totals */
        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 28px;
        }
        .totals-box {
          width: 280px;
          border: 1px solid #e5e3dd;
          border-radius: 6px;
          overflow: hidden;
        }
        .totals-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 14px;
          font-size: 11px;
          border-bottom: 1px solid #e5e3dd;
        }
        .totals-row:last-child { border-bottom: none; }
        .totals-row.total-final {
          background: #1C2B4A;
          color: white;
          font-weight: 700;
          font-size: 13px;
          padding: 12px 14px;
        }
        .totals-row .t-label { color: #666; }
        .totals-row.total-final .t-label { color: rgba(255,255,255,0.8); }
        .totals-row .t-amount { font-weight: 600; color: #1C2B4A; }
        .totals-row.total-final .t-amount { color: #C49A2A; }

        /* Notes */
        .notes-section {
          background: #faf9f7;
          border: 1px solid #e5e3dd;
          border-radius: 6px;
          padding: 16px 18px;
          margin-bottom: 32px;
        }
        .notes-title {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 700;
          color: #C49A2A;
          margin-bottom: 8px;
        }
        .notes-body {
          font-size: 10.5px;
          color: #555;
          line-height: 1.7;
          white-space: pre-wrap;
        }

        /* Signature */
        .signature-section {
          display: flex;
          gap: 40px;
          margin-bottom: 40px;
        }
        .sig-box { flex: 1; }
        .sig-line {
          border-bottom: 1px solid #1C2B4A;
          margin-bottom: 6px;
          height: 40px;
        }
        .sig-name { font-size: 10px; font-weight: 600; color: #1C2B4A; }
        .sig-role { font-size: 9px; color: #999; margin-top: 2px; }
        .sig-date { font-size: 9px; color: #aaa; margin-top: 8px; }

        /* Footer */
        .doc-footer {
          border-top: 1px solid #e5e3dd;
          padding-top: 14px;
          text-align: center;
          font-size: 9px;
          color: #aaa;
          line-height: 1.7;
        }
        .doc-footer strong { color: #888; }
      `}</style>

      {/* Toolbar - screen only */}
      <PrintToolbar quoteNumber={q.quote_number} />

      {/* Document */}
      <div className="page-wrap">
        <div className="page-content">

          {/* Studio header */}
          <div className="doc-header">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo_fotopzia.png" alt="Fotopzia Mexico" className="studio-logo" />
              <div className="studio-contact-info">
                Veracruz, Ver.<br />
                Asesor: {authorName}<br />
                {authorEmail}<br />
                {authorPhone}
              </div>
            </div>
            <div className="quote-label-block">
              <div className="quote-title-badge">COTIZACION</div>
              <div className="quote-meta-grid">
                <span className="meta-label">Folio</span>
                <span className="meta-value">{q.quote_number}</span>
                <span className="meta-label">Fecha</span>
                <span className="meta-value">{today}</span>
                {validUntil && (
                  <>
                    <span className="meta-label">Valida hasta</span>
                    <span className="meta-value">{validUntil}</span>
                  </>
                )}
                <span className="meta-label">Moneda</span>
                <span className="meta-value">{q.currency}</span>
                <span className="meta-label">Estado</span>
                <span className="meta-value">
                  <span className="status-pill">{STATUS_LABELS[q.status]}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Client + Deal */}
          <div className="client-block">
            <div className="client-section">
              <div className="section-eyebrow">Para</div>
              {contact ? (
                <>
                  <div className="client-fullname">{contact.first_name} {contact.last_name}</div>
                  {contact.company_name && <div className="client-company">{contact.company_name}</div>}
                  <div className="client-contact-line">
                    {contact.email && <>{contact.email}<br /></>}
                    {contact.phone && <>{contact.phone}<br /></>}
                  </div>
                </>
              ) : (
                <div className="client-fullname" style={{ color: '#aaa' }}>Sin contacto</div>
              )}
            </div>
            {q.deal && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                <div className="deal-ref">
                  <div className="section-eyebrow" style={{ marginBottom: 3 }}>Referencia</div>
                  <strong>{q.deal.title}</strong>
                </div>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="table-section">
            <table className="items-table">
              <thead>
                <tr>
                  <th style={{ width: '45%' }}>Descripcion</th>
                  <th style={{ width: '8%' }}>Cant.</th>
                  <th style={{ width: '17%' }}>Precio unit.</th>
                  <th style={{ width: '10%' }}>Desc.</th>
                  <th style={{ width: '20%' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#aaa', fontStyle: 'italic' }}>
                      Sin conceptos
                    </td>
                  </tr>
                )}
                {lineItems.map((item, i) => {
                  const itemTotal = Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_pct) / 100)
                  return (
                    <tr key={item.id ?? i}>
                      <td>
                        <div className="item-desc">{item.description}</div>
                        {item.category && <div className="item-category">{item.category}</div>}
                      </td>
                      <td>{Number(item.quantity).toLocaleString('es-MX')}</td>
                      <td>{fmt(Number(item.unit_price), '')}</td>
                      <td>{Number(item.discount_pct) > 0 ? `${item.discount_pct}%` : '—'}</td>
                      <td style={{ fontWeight: 600, color: '#1C2B4A' }}>
                        {fmt(itemTotal, '')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="totals-section">
            <div className="totals-box">
              <div className="totals-row">
                <span className="t-label">Subtotal</span>
                <span className="t-amount">{fmt(Number(q.subtotal), '')}</span>
              </div>
              <div className="totals-row">
                <span className="t-label">IVA ({Number(q.tax_rate)}%)</span>
                <span className="t-amount">{fmt(Number(q.tax_amount), '')}</span>
              </div>
              <div className="totals-row total-final">
                <span className="t-label">TOTAL</span>
                <span className="t-amount">{fmt(Number(q.total), q.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {q.notes && (
            <div className="notes-section">
              <div className="notes-title">Terminos y condiciones</div>
              <div className="notes-body">{q.notes}</div>
            </div>
          )}

          {/* Signature area */}
          <div className="signature-section">
            <div className="sig-box">
              <div className="sig-line" />
              <div className="sig-name">{contact ? `${contact.first_name} ${contact.last_name}` : 'Cliente'}</div>
              <div className="sig-role">Firma del cliente - Acepto las condiciones</div>
              <div className="sig-date">Fecha: _____ / _____ / __________</div>
            </div>
          </div>

          {/* Footer */}
          <div className="doc-footer">
            <strong>Fotopzia Mexico</strong> · Fotografia y Video Profesional · Veracruz, Ver.<br />
            Asesor responsable: {authorName} · {authorEmail} · {authorPhone}<br />
            Esta cotizacion tiene vigencia hasta la fecha indicada. Los precios incluyen IVA desglosado.<br />
            © {new Date().getFullYear()} Fotopzia Mexico · contacto@fotopzia.com · fotopzia.com
          </div>

        </div>
      </div>

      {/* Auto-print script */}
      <script dangerouslySetInnerHTML={{ __html: `
        // Only auto-print if loaded with ?autoprint=1
        if (new URLSearchParams(location.search).get('autoprint') === '1') {
          window.addEventListener('load', () => setTimeout(() => window.print(), 400))
        }
      `}} />
    </>
  )
}


