import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { renderQuotePdfBuffer, type QuotePdfData } from '@/lib/documents/quote-pdf'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from('quotes')
      .select('id, quote_number, title, subtotal, tax_rate, tax_amount, total, currency, notes, approved_by, approved_at, contact:contacts(first_name, last_name, email, company_name), line_items:quote_line_items(*)')
      .eq('id', id)
      .order('sort_order', { referencedTable: 'quote_line_items' })
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = data as unknown as QuotePdfData
    const pdf = await renderQuotePdfBuffer(quote)
    const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer
    const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })

    return new Response(pdfBlob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quote_number}.pdf"`,
      },
    })
  } catch (err) {
    console.error('PDF generation error:', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }
}
