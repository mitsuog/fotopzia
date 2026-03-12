import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import type { ContractAnnex } from '@/types/quotes'

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
    return NextResponse.json({ error: 'La firma autografa del anexo es obligatoria.' }, { status: 400 })
  }

  const { data: contract, error: contractError } = await supabaseAdmin
    .from('contracts')
    .select('id, contact_id, annexes, contract_number, created_by')
    .eq('id', contractId)
    .single()

  if (contractError || !contract || contract.contact_id !== access.contact_id) {
    return NextResponse.json({ error: 'Contrato no disponible para este portal.' }, { status: 404 })
  }

  const annexes = Array.isArray(contract.annexes) ? (contract.annexes as unknown as ContractAnnex[]) : []
  const index = annexes.findIndex(annex => annex.id === annexId)
  if (index < 0) {
    return NextResponse.json({ error: 'Anexo no encontrado.' }, { status: 404 })
  }

  const target = annexes[index]
  if (!target.requires_signature) {
    return NextResponse.json({ error: 'Este anexo no requiere firma.' }, { status: 400 })
  }

  annexes[index] = {
    ...target,
    signed_at: new Date().toISOString(),
    signed_by: signerName,
    signature_data: signatureData,
  }

  const { error: updateError } = await supabaseAdmin
    .from('contracts')
    .update({
      annexes,
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
    body: `${signerName} firmo el anexo "${target.title}" del contrato ${contract.contract_number}.`,
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
