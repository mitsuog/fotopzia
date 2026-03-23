import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { toContractAnnexes } from '@/lib/documents/contracts'
import { renderContractAnnexPdfBuffer } from '@/lib/documents/contract-pdf'
import type { Json } from '@/lib/supabase/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; contractId: string; annexId: string }> },
) {
  const { token, contractId, annexId } = await params
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
    return NextResponse.json({ error: 'La firma autógrafa del anexo sobre el documento es obligatoria.' }, { status: 400 })
  }

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('contracts')
    .select('id, contact_id, annexes, contract_number, title, created_by, status, contact:contacts(first_name, last_name)')
    .eq('id', contractId)
    .single()

  if (contractError || !contract || contract.contact_id !== access.contact_id) {
    return NextResponse.json({ error: 'Contrato no disponible para este portal.' }, { status: 404 })
  }

  if (contract.status !== 'sent' && contract.status !== 'viewed') {
    return NextResponse.json({ error: 'Este contrato no está disponible para firma.' }, { status: 400 })
  }

  const annexes = toContractAnnexes(contract.annexes)
  const index = annexes.findIndex(annex => annex.id === annexId)
  if (index < 0) {
    return NextResponse.json({ error: 'Anexo no encontrado.' }, { status: 404 })
  }

  const target = annexes[index]
  if (!target.requires_signature) {
    return NextResponse.json({ error: 'Este anexo no requiere firma.' }, { status: 400 })
  }

  const signedAt = new Date().toISOString()
  annexes[index] = {
    ...target,
    signed_at: signedAt,
    signed_by: signerName,
    signature_data: signatureData,
  }

  const annexPdf = await renderContractAnnexPdfBuffer({
    contract_number: contract.contract_number,
    contract_title: contract.title ?? 'Contrato',
    annex_title: target.title,
    annex_body: target.body ?? 'Anexo contractual.',
    contact_name: contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : 'Cliente',
    signer_name: signerName,
    signed_at: signedAt,
    signature_data: signatureData,
  })

  const annexPath = target.storage_path || `contracts/${contract.id}/annexes/${target.id}-signed.pdf`
  const { error: annexUploadError } = await supabaseAdmin.storage
    .from('contracts-signed')
    .upload(annexPath, annexPdf, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (!annexUploadError) {
    annexes[index].storage_path = annexPath
  } else {
    console.error('[portal] No se pudo subir PDF firmado de anexo:', annexUploadError.message)
  }

  const { error: updateError } = await supabaseAdmin
    .from('contracts')
    .update({
      annexes: annexes as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contract.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  const { error: activityError } = await supabaseAdmin.from('activities').insert({
    type: 'file',
    contact_id: contract.contact_id,
    deal_id: null,
    subject: 'Anexo firmado por cliente',
    body: `${signerName} firmó el anexo "${target.title}" del contrato ${contract.contract_number}.`,
    created_by: contract.created_by,
  })

  if (activityError) {
    console.error('[portal] No se pudo registrar actividad de firma de anexo:', activityError.message)
  }

  return NextResponse.json({
    data: {
      contract_id: contract.id,
      annex_id: annexId,
      signed_at: annexes[index].signed_at,
      signed_by: signerName,
    },
  })
}

