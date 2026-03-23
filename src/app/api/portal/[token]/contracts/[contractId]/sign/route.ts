import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { parseContractContent, toContractAnnexes } from '@/lib/documents/contracts'
import { renderContractPdfBuffer } from '@/lib/documents/contract-pdf'

function getClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  return request.headers.get('x-real-ip')
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; contractId: string }> },
) {
  const { token, contractId } = await params
  const { access, error } = await getPortalAccessByToken(token)
  if (error || !access) {
    return NextResponse.json({ error: error ?? 'Portal no disponible.' }, { status: 404 })
  }
  await touchPortalAccess(access)

  const payload = await request.json().catch(() => null) as {
    signer_name?: string
    signature_data?: string
    initials_data?: string[]
  } | null

  const signerName = String(payload?.signer_name ?? '').trim()
  const signatureData = String(payload?.signature_data ?? '').trim()
  const initialsData = Array.isArray(payload?.initials_data) ? payload.initials_data.map(value => String(value).trim()) : []

  if (!signerName) {
    return NextResponse.json({ error: 'El nombre del firmante es obligatorio.' }, { status: 400 })
  }
  if (!signatureData.startsWith('data:image/')) {
    return NextResponse.json({ error: 'La firma autógrafa es obligatoria.' }, { status: 400 })
  }

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('contracts')
    .select('id, contract_number, title, content, contact_id, quote_id, page_count, annexes, created_by, status, contact:contacts(first_name, last_name, email), quote:quotes(quote_number)')
    .eq('id', contractId)
    .single()

  if (contractError || !contract || contract.contact_id !== access.contact_id) {
    return NextResponse.json({ error: 'Contrato no disponible para este portal.' }, { status: 404 })
  }

  if (contract.status !== 'sent' && contract.status !== 'viewed') {
    return NextResponse.json({ error: 'Este contrato no está disponible para firma.' }, { status: 400 })
  }

  const parsedContent = parseContractContent(contract.content, toContractAnnexes(contract.annexes))
  const annexes = parsedContent.annexes
  const pendingAnnexes = annexes.filter(annex => annex.requires_signature && !annex.signed_at)
  if (pendingAnnexes.length > 0) {
    return NextResponse.json({ error: 'Debes firmar todos los anexos antes de firmar el contrato general.' }, { status: 400 })
  }

  const pageCount = Number(contract.page_count ?? 1)
  if (pageCount > 1 && (initialsData.length < pageCount || initialsData.some(item => !item.startsWith('data:image/')))) {
    return NextResponse.json({ error: 'Debes registrar antefirma en cada página del contrato.' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()
  const { error: updateError } = await supabaseAdmin
    .from('contracts')
    .update({
      status: 'signed',
      viewed_at: nowIso,
      signed_at: nowIso,
      signed_by: signerName,
      signed_signature_data: signatureData,
      signed_signature_name: signerName,
      initials_data: initialsData.slice(0, pageCount),
      signature_ip: getClientIp(request),
      updated_at: nowIso,
    })
    .eq('id', contract.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const contactName = contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'Cliente'
  const contractPdf = await renderContractPdfBuffer({
    id: contract.id,
    contract_number: contract.contract_number,
    title: contract.title,
    body: parsedContent.body,
    contact_name: contactName,
    contact_email: contract.contact?.email ?? null,
    quote_number: contract.quote?.quote_number ?? null,
    signed_by: signerName,
    signed_at: nowIso,
    signed_signature_data: signatureData,
    initials_data: initialsData.slice(0, pageCount),
    page_count: pageCount,
    annexes,
  })

  const contractPdfPath = `contracts/${contract.id}/signed-${Date.now()}.pdf`
  const { error: uploadError } = await supabaseAdmin.storage
    .from('contracts-signed')
    .upload(contractPdfPath, contractPdf, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (!uploadError) {
    await supabaseAdmin
      .from('contracts')
      .update({ pdf_storage_path: contractPdfPath, updated_at: nowIso })
      .eq('id', contract.id)
  } else {
    console.error('[portal] No se pudo subir PDF firmado de contrato:', uploadError.message)
  }

  const { error: activityError } = await supabaseAdmin.from('activities').insert({
    type: 'stage_change',
    contact_id: contract.contact_id,
    deal_id: contract.quote_id,
    subject: 'Contrato firmado por cliente',
    body: `${signerName} firmó el contrato ${contract.contract_number}.`,
    created_by: contract.created_by,
  })

  if (activityError) {
    console.error('[portal] No se pudo registrar actividad de firma de contrato:', activityError.message)
  }

  return NextResponse.json({
    data: {
      id: contract.id,
      status: 'signed',
      signed_at: nowIso,
      signed_by: signerName,
      pdf_storage_path: contractPdfPath,
    },
  })
}

