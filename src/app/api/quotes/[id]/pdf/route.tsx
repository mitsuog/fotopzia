/* @jsxImportSource react */
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type QuotePdfContact = {
  first_name: string
  last_name: string
  email: string | null
  company_name: string | null
}

type QuotePdfLineItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

type QuotePdfData = {
  id: string
  quote_number: string
  title: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  notes: string | null
  contact: QuotePdfContact | null
  line_items: QuotePdfLineItem[] | null
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from('quotes')
      .select('*, contact:contacts(first_name, last_name, email, company_name), line_items:quote_line_items(*)')
      .eq('id', id)
      .order('sort_order', { referencedTable: 'quote_line_items' })
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const quote = data as unknown as QuotePdfData

    const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

    const styles = StyleSheet.create({
      page: { padding: 40, fontFamily: 'Helvetica', fontSize: 11, color: '#1C2B4A' },
      header: { marginBottom: 24 },
      title: { fontSize: 20, fontWeight: 'bold', color: '#1C2B4A' },
      subtitle: { fontSize: 11, color: '#666', marginTop: 4 },
      quoteNum: { fontSize: 10, color: '#C49A2A', marginTop: 2 },
      section: { marginBottom: 16 },
      tableHeader: {
        flexDirection: 'row',
        backgroundColor: '#F0EEE8',
        padding: '6 8',
        borderRadius: 4,
        marginBottom: 2,
      },
      tableRow: {
        flexDirection: 'row',
        padding: '5 8',
        borderBottomWidth: 0.5,
        borderBottomColor: '#E8E5DC',
      },
      cell: { flex: 1 },
      cellRight: { flex: 1, textAlign: 'right' },
      totals: { marginTop: 12, alignItems: 'flex-end' },
      totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 180, marginBottom: 3 },
      totalLabel: { color: '#666' },
      bold: { fontWeight: 'bold' },
    })

    const contact = quote.contact
    const lineItems = quote.line_items ?? []
    const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Sin contacto'

    const pdf = await renderToBuffer(
      <Document>
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{quote.title}</Text>
            <Text style={styles.subtitle}>
              {contactName}
              {contact?.company_name ? ` - ${contact.company_name}` : ''}
            </Text>
            <Text style={styles.quoteNum}>{quote.quote_number}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.bold]}>Descripcion</Text>
              <Text style={[styles.cellRight, styles.bold]}>Cant.</Text>
              <Text style={[styles.cellRight, styles.bold]}>Precio</Text>
              <Text style={[styles.cellRight, styles.bold]}>Total</Text>
            </View>
            {lineItems.map(item => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={styles.cell}>{item.description}</Text>
                <Text style={styles.cellRight}>{item.quantity}</Text>
                <Text style={styles.cellRight}>${Number(item.unit_price).toFixed(2)}</Text>
                <Text style={styles.cellRight}>${Number(item.total).toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text>${Number(quote.subtotal).toFixed(2)} {quote.currency}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>IVA ({quote.tax_rate}%)</Text>
              <Text>${Number(quote.tax_amount).toFixed(2)} {quote.currency}</Text>
            </View>
            <View
              style={[
                styles.totalRow,
                { borderTopWidth: 1, borderTopColor: '#E8E5DC', paddingTop: 4, marginTop: 4 },
              ]}
            >
              <Text style={styles.bold}>Total</Text>
              <Text style={styles.bold}>${Number(quote.total).toFixed(2)} {quote.currency}</Text>
            </View>
          </View>

          {quote.notes && (
            <View style={[styles.section, { marginTop: 24 }]}>
              <Text style={[styles.bold, { marginBottom: 4 }]}>Notas</Text>
              <Text style={{ color: '#444' }}>{quote.notes}</Text>
            </View>
          )}
        </Page>
      </Document>,
    )

    return new Response(new Uint8Array(pdf), {
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
