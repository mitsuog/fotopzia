import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPortalAccessByToken } from '@/lib/portal/token'
import { buildZip } from '@/lib/documents/zip'
import { renderQuotePdfBuffer, type QuotePdfData } from '@/lib/documents/quote-pdf'
import { parseContractContent, toContractAnnexes } from '@/lib/documents/contracts'
import { renderContractAnnexPdfBuffer, renderContractPdfBuffer } from '@/lib/documents/contract-pdf'

function safeName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function downloadStorageFile(bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
  if (error || !data) return null
  const buffer = await data.arrayBuffer()
  return new Uint8Array(buffer)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const { access, error } = await getPortalAccessByToken(token)
  if (error || !access) {
    return NextResponse.json({ error: error ?? 'Portal no disponible.' }, { status: 404 })
  }

  const [quotesResult, contractsResult] = await Promise.all([
    supabaseAdmin
      .from('quotes')
      .select('id, quote_number, title, subtotal, tax_rate, tax_amount, total, currency, notes, approved_by, approved_at, pdf_storage_path, contact:contacts(first_name, last_name, email, company_name), line_items:quote_line_items(*)')
      .eq('contact_id', access.contact_id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('contracts')
      .select('id, contract_number, title, content, signed_by, signed_at, signed_signature_data, initials_data, page_count, annexes, pdf_storage_path, contact:contacts(first_name, last_name, email), quote:quotes(quote_number)')
      .eq('contact_id', access.contact_id)
      .eq('status', 'signed')
      .order('created_at', { ascending: false }),
  ])

  if (quotesResult.error) return NextResponse.json({ error: quotesResult.error.message }, { status: 400 })
  if (contractsResult.error) return NextResponse.json({ error: contractsResult.error.message }, { status: 400 })

  const entries: Array<{ name: string; data: Uint8Array }> = []

  for (const quote of quotesResult.data ?? []) {
    let quotePdf: Uint8Array | null = null
    if (quote.pdf_storage_path) {
      quotePdf = await downloadStorageFile('quotes-pdf', quote.pdf_storage_path)
    }

    if (!quotePdf) {
      const payload: QuotePdfData = {
        id: quote.id,
        quote_number: quote.quote_number,
        title: quote.title,
        subtotal: quote.subtotal,
        tax_rate: quote.tax_rate,
        tax_amount: quote.tax_amount,
        total: quote.total,
        currency: quote.currency,
        notes: quote.notes,
        approved_by: quote.approved_by,
        approved_at: quote.approved_at,
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
      quotePdf = await renderQuotePdfBuffer(payload)
    }

    entries.push({
      name: `cotizaciones/${safeName(quote.quote_number)}.pdf`,
      data: quotePdf,
    })
  }

  for (const contract of contractsResult.data ?? []) {
    let contractPdf: Uint8Array | null = null
    if (contract.pdf_storage_path) {
      contractPdf = await downloadStorageFile('contracts-signed', contract.pdf_storage_path)
    }

    const parsedContent = parseContractContent(contract.content, toContractAnnexes(contract.annexes))

    if (!contractPdf) {
      const initials = Array.isArray(contract.initials_data) ? contract.initials_data.map(item => String(item)) : []
      const contactName = contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'Cliente'
      contractPdf = await renderContractPdfBuffer({
        id: contract.id,
        contract_number: contract.contract_number,
        title: contract.title,
        body: parsedContent.body,
        contact_name: contactName,
        contact_email: contract.contact?.email ?? null,
        quote_number: contract.quote?.quote_number ?? null,
        signed_by: contract.signed_by,
        signed_at: contract.signed_at,
        signed_signature_data: contract.signed_signature_data ?? null,
        initials_data: initials,
        page_count: contract.page_count ?? 1,
        annexes: parsedContent.annexes,
      })
    }

    entries.push({
      name: `contratos/${safeName(contract.contract_number)}.pdf`,
      data: contractPdf,
    })

    const signedAnnexes = parsedContent.annexes.filter(annex => annex.signed_at)
    for (const annex of signedAnnexes) {
      let annexData = await downloadStorageFile('contracts-signed', annex.storage_path)
      if (!annexData) {
        annexData = await renderContractAnnexPdfBuffer({
          contract_number: contract.contract_number,
          contract_title: contract.title,
          annex_title: annex.title,
          annex_body: annex.body ?? 'Anexo contractual.',
          contact_name: contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'Cliente',
          signer_name: annex.signed_by ?? null,
          signed_at: annex.signed_at ?? null,
          signature_data: annex.signature_data ?? null,
        })
      }
      entries.push({
        name: `contratos/anexos/${safeName(contract.contract_number)}-${safeName(annex.title)}.pdf`,
        data: annexData,
      })
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No hay documentos firmados para descargar.' }, { status: 404 })
  }

  const zipBytes = buildZip(entries)
  const fileName = `paquete-documentos-firmados-${safeName(access.contacts?.last_name ?? 'cliente')}.zip`
  const zipArrayBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer
  const zipBlob = new Blob([zipArrayBuffer], { type: 'application/zip' })

  return new Response(zipBlob, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': String(zipBytes.byteLength),
    },
  })
}
