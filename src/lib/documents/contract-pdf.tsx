/* @jsxImportSource react */

import type { ContractAnnex } from '@/types/quotes'

export type ContractPdfData = {
  id: string
  contract_number: string
  title: string
  body: string
  contact_name: string
  contact_email: string | null
  quote_number: string | null
  signed_by: string | null
  signed_at: string | null
  initials_data: string[]
  page_count: number
  annexes: ContractAnnex[]
}

export type ContractAnnexPdfData = {
  contract_number: string
  contract_title: string
  annex_title: string
  annex_body: string
  contact_name: string
  signer_name: string | null
  signed_at: string | null
  signature_data: string | null
}

export async function renderContractPdfBuffer(contract: ContractPdfData): Promise<Uint8Array> {
  const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 38, fontFamily: 'Helvetica', fontSize: 10.5, color: '#1C2B4A', lineHeight: 1.45 },
    header: { marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#1C2B4A', paddingBottom: 8 },
    brand: { fontSize: 18, fontWeight: 'bold', color: '#1C2B4A' },
    subBrand: { fontSize: 9, color: '#7a7a7a', marginTop: 2 },
    title: { marginTop: 12, fontSize: 14, fontWeight: 'bold', color: '#1C2B4A' },
    meta: { marginTop: 6, fontSize: 9.5, color: '#4b5563' },
    body: { marginTop: 14 },
    paragraph: { marginBottom: 8, textAlign: 'justify' },
    sectionTitle: { marginTop: 10, marginBottom: 4, fontWeight: 'bold', color: '#1C2B4A' },
    annexBox: { marginTop: 16, borderWidth: 1, borderColor: '#D8D3C8', borderRadius: 4, padding: 8 },
    annexTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    annexItem: { fontSize: 9.5, marginBottom: 2, color: '#334155' },
    signatureBox: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#c0c0c0', paddingTop: 8 },
    signatureName: { fontSize: 10, fontWeight: 'bold' },
    footerInitial: {
      position: 'absolute',
      bottom: 12,
      left: 38,
      right: 38,
      fontSize: 8.5,
      color: '#6b7280',
      borderTopWidth: 0.5,
      borderTopColor: '#d1d5db',
      paddingTop: 4,
    },
  })

  const lines = contract.body.split('\n')
  const renderedParagraphs = lines.map((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return <Text key={`sp-${index}`} style={styles.paragraph}>{' '}</Text>
    const isSectionTitle = /^[IVXLCDM]+\./i.test(trimmed) || /^ANEXO/i.test(trimmed)
    if (isSectionTitle) return <Text key={`st-${index}`} style={styles.sectionTitle}>{trimmed}</Text>
    return <Text key={`p-${index}`} style={styles.paragraph}>{trimmed}</Text>
  })

  const initialStamp = contract.initials_data.length
    ? contract.initials_data.join(' | ')
    : 'Pendiente de antefirmas'

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <Text style={styles.brand}>Fotopzia Mexico</Text>
          <Text style={styles.subBrand}>Fotografia y video profesional</Text>
          <Text style={styles.title}>{contract.title}</Text>
          <Text style={styles.meta}>Contrato: {contract.contract_number}</Text>
          <Text style={styles.meta}>Cliente: {contract.contact_name}</Text>
          {contract.contact_email && <Text style={styles.meta}>Email: {contract.contact_email}</Text>}
          {contract.quote_number && <Text style={styles.meta}>Cotizacion relacionada: {contract.quote_number}</Text>}
        </View>

        <View style={styles.body}>{renderedParagraphs}</View>

        <View style={styles.annexBox}>
          <Text style={styles.annexTitle}>Anexos del contrato</Text>
          {contract.annexes.length === 0 && <Text style={styles.annexItem}>Sin anexos</Text>}
          {contract.annexes.map((annex, index) => (
            <Text key={annex.id} style={styles.annexItem}>
              {index + 1}. {annex.title} - {annex.signed_at ? 'Firmado' : 'Pendiente'}
            </Text>
          ))}
        </View>

        <View style={styles.signatureBox}>
          <Text style={styles.signatureName}>
            {contract.signed_by ? `Firmado por: ${contract.signed_by}` : 'Firma pendiente del cliente'}
          </Text>
          <Text style={styles.meta}>
            {contract.signed_at ? `Fecha de firma: ${new Date(contract.signed_at).toLocaleString('es-MX')}` : 'Sin fecha de firma'}
          </Text>
        </View>

        <Text style={styles.footerInitial} fixed>
          Antefirma cliente (requisito por pagina): {initialStamp} - Paginas requeridas: {contract.page_count}
        </Text>
      </Page>
    </Document>,
  )

  return new Uint8Array(pdf)
}

export async function renderContractAnnexPdfBuffer(annex: ContractAnnexPdfData): Promise<Uint8Array> {
  const { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 38, fontFamily: 'Helvetica', fontSize: 10.5, color: '#1C2B4A', lineHeight: 1.45 },
    header: { marginBottom: 14, borderBottomWidth: 2, borderBottomColor: '#1C2B4A', paddingBottom: 8 },
    brand: { fontSize: 17, fontWeight: 'bold', color: '#1C2B4A' },
    subBrand: { fontSize: 9, color: '#7a7a7a', marginTop: 2 },
    title: { marginTop: 10, fontSize: 13, fontWeight: 'bold', color: '#1C2B4A' },
    meta: { marginTop: 3, fontSize: 9.5, color: '#4b5563' },
    paragraph: { marginBottom: 8, textAlign: 'justify' },
    signatureBox: { marginTop: 18, borderTopWidth: 1, borderTopColor: '#d1d5db', paddingTop: 8 },
    signatureImage: { marginTop: 6, width: 180, height: 60, objectFit: 'contain' },
  })

  const bodyLines = annex.annex_body.split('\n').map((line, index) => (
    <Text key={`annex-line-${index}`} style={styles.paragraph}>
      {line.trim() || ' '}
    </Text>
  ))

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>Fotopzia Mexico</Text>
          <Text style={styles.subBrand}>Documento anexo del contrato</Text>
          <Text style={styles.title}>{annex.annex_title}</Text>
          <Text style={styles.meta}>Contrato: {annex.contract_number}</Text>
          <Text style={styles.meta}>Referencia: {annex.contract_title}</Text>
          <Text style={styles.meta}>Cliente: {annex.contact_name}</Text>
        </View>

        <View>{bodyLines}</View>

        <View style={styles.signatureBox}>
          <Text style={styles.meta}>
            {annex.signer_name ? `Firmado por: ${annex.signer_name}` : 'Firma pendiente del cliente'}
          </Text>
          <Text style={styles.meta}>
            {annex.signed_at ? `Fecha: ${new Date(annex.signed_at).toLocaleString('es-MX')}` : 'Sin fecha de firma'}
          </Text>
          {annex.signature_data?.startsWith('data:image/') && (
            <Image src={annex.signature_data} style={styles.signatureImage} />
          )}
        </View>
      </Page>
    </Document>,
  )

  return new Uint8Array(pdf)
}
