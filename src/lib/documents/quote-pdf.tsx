/* @jsxImportSource react */

import { ensurePdfFontsRegistered } from './pdf-fonts'
import { buildDocumentHeader } from './pdf-header'

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

export type QuotePdfData = {
  id: string
  quote_number: string
  title: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  currency: string
  notes: string | null
  approved_by: string | null
  approved_at: string | null
  contact: QuotePdfContact | null
  line_items: QuotePdfLineItem[] | null
}

export async function renderQuotePdfBuffer(quote: QuotePdfData): Promise<Uint8Array> {
  await ensurePdfFontsRegistered()
  const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Roboto', fontSize: 11, color: '#1C2B4A' },
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
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', width: 190, marginBottom: 3 },
    totalLabel: { color: '#666' },
    bold: { fontWeight: 'bold' },
    footer: { marginTop: 20, fontSize: 9.5, color: '#666' },
    meta: { marginTop: 3, fontSize: 9, color: '#4b5563' },
  })

  const contact = quote.contact
  const lineItems = quote.line_items ?? []
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Sin contacto'

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {buildDocumentHeader({ View, Text, StyleSheet }, {
          docType: 'COTIZACION',
          docNumber: quote.quote_number,
          clientName: contactName,
        })}
        {contact?.company_name && (
          <Text style={styles.meta}>Empresa: {contact.company_name}</Text>
        )}
        {contact?.email && (
          <Text style={styles.meta}>Email: {contact.email}</Text>
        )}
        <Text style={[styles.meta, { marginTop: 8, fontWeight: 'bold', fontSize: 11 }]}>{quote.title}</Text>

        <View style={[styles.section, { marginTop: 16 }]}>
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

        {quote.approved_by && quote.approved_at && (
          <View style={styles.footer}>
            <Text>
              Firmado por cliente: {quote.approved_by} - {new Date(quote.approved_at).toLocaleString('es-MX')}
            </Text>
          </View>
        )}
      </Page>
    </Document>,
  )

  return new Uint8Array(pdf)
}
