import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { renderQuotePdfBuffer, type QuotePdfData } from '@/lib/documents/quote-pdf'

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; quoteId: string }> },
) {
  const { token, quoteId } = await params
  const { access, error } = await getPortalAccessByToken(token)
  if (error || !access) {
    return NextResponse.json({ error: error ?? 'Portal no disponible.' }, { status: 404 })
  }
  await touchPortalAccess(access)

  const payload = await request.json().catch(() => null) as { signer_name?: string; signature_data?: string } | null
  const signerName = String(payload?.signer_name ?? '').trim()
  const signatureData = String(payload?.signature_data ?? '').trim()

  if (!signerName) {
    return NextResponse.json({ error: 'El nombre del firmante es obligatorio.' }, { status: 400 })
  }
  if (!signatureData.startsWith('data:image/')) {
    return NextResponse.json({ error: 'La firma autografa es obligatoria.' }, { status: 400 })
  }

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('quotes')
    .select('id, quote_number, contact_id, deal_id, title, status, subtotal, tax_rate, tax_amount, total, currency, notes, created_by, contact:contacts(first_name, last_name, email, company_name), line_items:quote_line_items(*)')
    .eq('id', quoteId)
    .single()

  if (quoteError || !quote || quote.contact_id !== access.contact_id) {
    return NextResponse.json({ error: 'Cotizacion no disponible para este portal.' }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  const { error: updateError } = await supabaseAdmin
    .from('quotes')
    .update({
      status: 'approved',
      viewed_at: nowIso,
      approved_at: nowIso,
      approved_by: signerName,
      approved_signature_data: signatureData,
      approved_signature_name: signerName,
      approved_ip: getClientIp(request),
      updated_at: nowIso,
    })
    .eq('id', quote.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const pdfPayload: QuotePdfData = {
    id: quote.id,
    quote_number: quote.quote_number,
    title: quote.title,
    subtotal: quote.subtotal,
    tax_rate: quote.tax_rate,
    tax_amount: quote.tax_amount,
    total: quote.total,
    currency: quote.currency,
    notes: quote.notes,
    approved_by: signerName,
    approved_at: nowIso,
    contact: quote.contact
      ? {
        first_name: quote.contact.first_name,
        last_name: quote.contact.last_name,
        email: quote.contact.email,
        company_name: quote.contact.company_name,
      }
      : null,
    line_items: (quote.line_items ?? []).map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    })),
  }

  const quotePdf = await renderQuotePdfBuffer(pdfPayload)
  const quotePdfPath = `quotes/${quote.id}/signed-${Date.now()}.pdf`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('quotes-pdf')
    .upload(quotePdfPath, quotePdf, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (!uploadError) {
    await supabaseAdmin
      .from('quotes')
      .update({ pdf_storage_path: quotePdfPath, updated_at: nowIso })
      .eq('id', quote.id)
  } else {
    console.error('[portal] No se pudo subir PDF firmado de cotizacion:', uploadError.message)
  }

  const { error: activityError } = await supabaseAdmin.from('activities').insert({
    type: 'stage_change',
    contact_id: quote.contact_id,
    deal_id: quote.deal_id,
    subject: 'Cotizacion aprobada por cliente',
    body: `${signerName} firmo y aprobo la cotizacion ${quote.quote_number}.`,
    created_by: quote.created_by,
  })

  if (activityError) {
    console.error('[portal] No se pudo registrar actividad de firma de cotizacion:', activityError.message)
  }

  return NextResponse.json({
    data: {
      id: quote.id,
      status: 'approved',
      approved_at: nowIso,
      approved_by: signerName,
      pdf_storage_path: quotePdfPath,
    },
  })
}
