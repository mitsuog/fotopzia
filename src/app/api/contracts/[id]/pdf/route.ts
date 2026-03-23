import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { renderContractPdfBuffer } from '@/lib/documents/contract-pdf'
import { parseContractContent, toContractAnnexes } from '@/lib/documents/contracts'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('id, contract_number, title, content, signed_by, signed_at, signed_signature_data, initials_data, page_count, annexes, contact:contacts(first_name, last_name, email), quote:quotes(quote_number)')
    .eq('id', id)
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
  }

  const parsedContent = parseContractContent(contract.content, toContractAnnexes(contract.annexes))
  const initials = Array.isArray(contract.initials_data) ? contract.initials_data.map(item => String(item)) : []
  const contactName = contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'Cliente'

  const pdf = await renderContractPdfBuffer({
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
  const pdfArrayBuffer = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer
  const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' })

  return new Response(pdfBlob, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${contract.contract_number}.pdf"`,
    },
  })
}
