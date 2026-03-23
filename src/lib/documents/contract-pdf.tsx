/* @jsxImportSource react */

import type { ContractAnnex } from '@/types/quotes'
import { ensurePdfFontsRegistered } from './pdf-fonts'
import { buildDocumentHeader } from './pdf-header'
import { paginateContractBody } from './contract-pagination'

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
  signed_signature_data?: string | null
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
  template_key?: string | null
}

function isSectionTitle(line: string): boolean {
  return (
    /^[IVXLCDM]+\./i.test(line) ||
    /^CONTRATO DE PRESTACI/i.test(line) ||
    /^Firmas$/i.test(line) ||
    /^(EL PRESTADOR|EL CLIENTE)$/i.test(line) ||
    /^ANEXO [ABC]\./i.test(line)
  )
}

export async function renderContractPdfBuffer(contract: ContractPdfData): Promise<Uint8Array> {
  await ensurePdfFontsRegistered()
  const { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Roboto', fontSize: 10, color: '#1C2B4A', lineHeight: 1.55 },
    meta: { marginTop: 5, fontSize: 9, color: '#4b5563' },
    body: { marginTop: 14 },
    paragraph: { marginBottom: 7, textAlign: 'justify', fontSize: 10 },
    sectionTitle: { marginTop: 14, marginBottom: 6, fontWeight: 'bold', fontSize: 11, color: '#1C2B4A' },
    initialBlock: { marginTop: 16, borderTopWidth: 0.8, borderTopColor: '#d1d5db', paddingTop: 8 },
    initialLabel: { fontSize: 8.5, color: '#6b7280', marginBottom: 5 },
    initialImage: { width: 110, height: 34, objectFit: 'contain' },
    pendingInitial: { fontSize: 8.5, color: '#6b7280' },
    signatureBox: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#c0c0c0', paddingTop: 10 },
    signatureName: { fontSize: 10, fontWeight: 'bold' },
    signatureImage: { marginTop: 6, width: 180, height: 62, objectFit: 'contain' },
  })

  const totalPages = Math.max(1, Number(contract.page_count ?? 1))
  const pages = paginateContractBody(contract.body, totalPages)

  const pdf = await renderToBuffer(
    <Document>
      {pages.map((page, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1
        const initialData = contract.initials_data[pageIndex] ?? null
        const renderedParagraphs = page.lines.map((line, index) => {
          const trimmed = line.trim()
          if (!trimmed) return <Text key={`sp-${page.pageNumber}-${index}`} style={styles.paragraph}>{' '}</Text>
          if (isSectionTitle(trimmed)) {
            return <Text key={`st-${page.pageNumber}-${index}`} style={styles.sectionTitle}>{trimmed}</Text>
          }
          return <Text key={`p-${page.pageNumber}-${index}`} style={styles.paragraph}>{trimmed}</Text>
        })

        return (
          <Page key={`page-${page.pageNumber}`} size="A4" style={styles.page} wrap={false}>
            {buildDocumentHeader({ View, Text, StyleSheet }, {
              docType: 'CONTRATO',
              docNumber: `Contrato: ${contract.contract_number} - Pagina ${page.pageNumber}/${pages.length}`,
              clientName: contract.contact_name,
            })}
            {pageIndex === 0 && contract.contact_email && <Text style={styles.meta}>Email: {contract.contact_email}</Text>}
            {pageIndex === 0 && contract.quote_number && <Text style={styles.meta}>Cotizacion relacionada: {contract.quote_number}</Text>}

            <View style={styles.body}>{renderedParagraphs}</View>

            {pages.length > 1 && (
              <View style={styles.initialBlock}>
                <Text style={styles.initialLabel}>
                  Antefirma cliente - Pagina {page.pageNumber} de {pages.length}
                </Text>
                {initialData?.startsWith('data:image/') ? (
                  <Image src={initialData} style={styles.initialImage} />
                ) : (
                  <Text style={styles.pendingInitial}>Antefirma pendiente en esta pagina.</Text>
                )}
              </View>
            )}

            {isLastPage && (
              <View style={styles.signatureBox}>
                <Text style={styles.signatureName}>
                  {contract.signed_by ? `Firmado por: ${contract.signed_by}` : 'Firma pendiente del cliente'}
                </Text>
                <Text style={styles.meta}>
                  {contract.signed_at ? `Fecha de firma: ${new Date(contract.signed_at).toLocaleString('es-MX')}` : 'Sin fecha de firma'}
                </Text>
                {contract.signed_signature_data?.startsWith('data:image/') && (
                  <Image src={contract.signed_signature_data} style={styles.signatureImage} />
                )}
              </View>
            )}
          </Page>
        )
      })}
    </Document>,
  )

  return new Uint8Array(pdf)
}

export async function renderContractAnnexPdfBuffer(annex: ContractAnnexPdfData): Promise<Uint8Array> {
  await ensurePdfFontsRegistered()
  const { renderToBuffer, Document, Page, Text, View, StyleSheet, Image } = await import('@react-pdf/renderer')

  const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Roboto', fontSize: 10, color: '#1C2B4A', lineHeight: 1.55 },
    meta: { marginTop: 3, fontSize: 9, color: '#4b5563' },
    paragraph: { marginBottom: 7, textAlign: 'justify', fontSize: 10 },
    sectionNote: { marginBottom: 8, fontSize: 9, color: '#6b7280', fontStyle: 'italic' },
    // Table styles
    tableHeader: { flexDirection: 'row', backgroundColor: '#1C2B4A', paddingVertical: 5, paddingHorizontal: 4, marginTop: 10 },
    tableHeaderCell: { color: 'white', fontWeight: 'bold', fontSize: 9 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingVertical: 4, paddingHorizontal: 4 },
    tableRowAlt: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#D8D3C8', paddingVertical: 4, paddingHorizontal: 4, backgroundColor: '#F9F8F5' },
    tableCell: { fontSize: 9, color: '#1C2B4A', flex: 1 },
    tableCellBold: { fontSize: 9, color: '#1C2B4A', flex: 1, fontWeight: 'bold' },
    // Annexo A specific (2 col)
    colLabel: { flex: 2 },
    colValue: { flex: 3 },
    // Annexo B specific (3 col)
    colHito: { flex: 3 },
    colFecha: { flex: 2 },
    colObs: { flex: 2 },
    // Notes
    notesBox: { marginTop: 12, borderWidth: 0.5, borderColor: '#D8D3C8', borderRadius: 3, padding: 8, backgroundColor: '#F9F8F5' },
    notesText: { fontSize: 9, color: '#4b5563', fontStyle: 'italic' },
    // Signature
    signatureBox: { marginTop: 20, borderTopWidth: 1, borderTopColor: '#d1d5db', paddingTop: 10 },
    signatureImage: { marginTop: 6, width: 180, height: 60, objectFit: 'contain' },
  })

  let bodyContent: React.ReactNode

  if (annex.template_key === 'anexo-a') {
    const lines = annex.annex_body.split('\n')
    const noteLines: string[] = []
    const tableRows: Array<{ label: string; value: string }> = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx > 0 && colonIdx < 50) {
        const label = trimmed.slice(0, colonIdx).trim()
        const value = trimmed.slice(colonIdx + 1).trim()
        tableRows.push({ label, value })
      } else {
        noteLines.push(trimmed)
      }
    }

    bodyContent = (
      <View>
        {noteLines.length > 0 && (
          <View style={styles.notesBox}>
            {noteLines.map((note, i) => (
              <Text key={`note-${i}`} style={styles.sectionNote}>{note}</Text>
            ))}
          </View>
        )}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colLabel]}>Campo</Text>
          <Text style={[styles.tableHeaderCell, styles.colValue]}>Valor</Text>
        </View>
        {tableRows.map((row, i) => (
          <View key={`row-${i}`} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={[styles.tableCellBold, styles.colLabel]}>{row.label}</Text>
            <Text style={[styles.tableCell, styles.colValue]}>{row.value || '-'}</Text>
          </View>
        ))}
      </View>
    )
  } else if (annex.template_key === 'anexo-b') {
    const lines = annex.annex_body.split('\n')
    const dataRows: Array<[string, string, string]> = []
    let headerRow: [string, string, string] | null = null
    const noteLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.includes('|')) {
        const cols = trimmed.split('|').map(c => c.trim())
        const row: [string, string, string] = [cols[0] ?? '', cols[1] ?? '', cols[2] ?? '']
        if (!headerRow) {
          headerRow = row
        } else {
          dataRows.push(row)
        }
      } else {
        noteLines.push(trimmed)
      }
    }

    bodyContent = (
      <View>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colHito]}>{headerRow?.[0] ?? 'Hito'}</Text>
          <Text style={[styles.tableHeaderCell, styles.colFecha]}>{headerRow?.[1] ?? 'Fecha'}</Text>
          <Text style={[styles.tableHeaderCell, styles.colObs]}>{headerRow?.[2] ?? 'Observaciones'}</Text>
        </View>
        {dataRows.length === 0 && (
          <View style={styles.tableRow}>
            <Text style={[styles.tableCell, styles.colHito]}>Sin hitos registrados</Text>
            <Text style={[styles.tableCell, styles.colFecha]}>-</Text>
            <Text style={[styles.tableCell, styles.colObs]}>-</Text>
          </View>
        )}
        {dataRows.map((row, i) => (
          <View key={`row-${i}`} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={[styles.tableCell, styles.colHito]}>{row[0] || '-'}</Text>
            <Text style={[styles.tableCell, styles.colFecha]}>{row[1] || '-'}</Text>
            <Text style={[styles.tableCell, styles.colObs]}>{row[2] || '-'}</Text>
          </View>
        ))}
        {noteLines.length > 0 && (
          <View style={styles.notesBox}>
            {noteLines.map((note, i) => (
              <Text key={`note-${i}`} style={styles.notesText}>{note}</Text>
            ))}
          </View>
        )}
      </View>
    )
  } else if (annex.template_key === 'anexo-c') {
    const lines = annex.annex_body.split('\n')
    const keyValueLines: Array<{ label: string; value: string }> = []
    const textLines: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const colonIdx = trimmed.indexOf(':')
      if (colonIdx > 0 && colonIdx < 40 && /^[A-Z\s\/]+$/.test(trimmed.slice(0, colonIdx))) {
        keyValueLines.push({ label: trimmed.slice(0, colonIdx).trim(), value: trimmed.slice(colonIdx + 1).trim() })
      } else {
        textLines.push(trimmed)
      }
    }

    bodyContent = (
      <View>
        {textLines.map((line, i) => (
          <Text key={`tl-${i}`} style={styles.paragraph}>{line}</Text>
        ))}
        {keyValueLines.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colLabel]}>Campo</Text>
              <Text style={[styles.tableHeaderCell, styles.colValue]}>Valor</Text>
            </View>
            {keyValueLines.map((row, i) => (
              <View key={`kv-${i}`} style={i % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
                <Text style={[styles.tableCellBold, styles.colLabel]}>{row.label}</Text>
                <Text style={[styles.tableCell, styles.colValue]}>{row.value || '-'}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    )
  } else {
    const bodyLines = annex.annex_body.split('\n').map((line, index) => (
      <Text key={`annex-line-${index}`} style={styles.paragraph}>
        {line.trim() || ' '}
      </Text>
    ))
    bodyContent = <View>{bodyLines}</View>
  }

  const pdf = await renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page}>
        {buildDocumentHeader({ View, Text, StyleSheet }, {
          docType: 'ANEXO',
          docNumber: `Contrato: ${annex.contract_number}`,
          clientName: annex.contact_name,
          subtitle: 'Documento anexo del contrato',
        })}
        <Text style={styles.meta}>Referencia: {annex.contract_title}</Text>
        <Text style={[styles.meta, { marginTop: 8, fontWeight: 'bold' }]}>{annex.annex_title}</Text>

        {bodyContent}

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
