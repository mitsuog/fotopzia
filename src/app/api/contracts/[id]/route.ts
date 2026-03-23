import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { toContractAnnexes } from '@/lib/documents/contracts'

type ContractAction = 'archive' | 'unarchive'

type PatchPayload = {
  action?: ContractAction
}

type DeletePayload = {
  confirmationText?: string
}

function canManageContracts(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'project_manager'
}

async function collectStoragePathsRecursive(prefix: string, out: Set<string>) {
  const { data, error } = await supabaseAdmin.storage
    .from('contracts-signed')
    .list(prefix, { limit: 1000, offset: 0 })

  if (error || !data) return

  for (const item of data) {
    if (!item.name) continue
    const fullPath = prefix ? `${prefix}/${item.name}` : item.name
    if (!item.id) {
      await collectStoragePathsRecursive(fullPath, out)
      continue
    }
    out.add(fullPath)
  }
}

async function deleteStoragePaths(paths: Set<string>) {
  if (paths.size === 0) return
  const all = [...paths]
  for (let i = 0; i < all.length; i += 100) {
    const chunk = all.slice(i, i + 100)
    await supabaseAdmin.storage.from('contracts-signed').remove(chunk)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', auth.user.id)
    .single()

  if (!canManageContracts(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as PatchPayload | null
  const action = payload?.action
  if (!action || (action !== 'archive' && action !== 'unarchive')) {
    return NextResponse.json({ error: 'Accion invalida.' }, { status: 400 })
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, contract_number, title, status, contact_id, quote_id')
    .eq('id', id)
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
  }

  const nowIso = new Date().toISOString()
  const actorName = profile?.full_name || 'Usuario'

  if (action === 'archive') {
    const { error: updateError } = await supabase
      .from('contracts')
      .update({
        status: 'voided',
        updated_at: nowIso,
      })
      .eq('id', contract.id)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

    const { data: activeFlows } = await supabase
      .from('approval_flows')
      .select('id')
      .eq('entity_type', 'contract')
      .eq('entity_id', contract.id)
      .in('status', ['pending', 'in_progress'])

    const flowIds = (activeFlows ?? []).map(flow => flow.id)
    if (flowIds.length > 0) {
      await supabase
        .from('approval_flows')
        .update({ status: 'cancelled', updated_at: nowIso })
        .in('id', flowIds)

      await supabase
        .from('approval_steps')
        .update({
          status: 'skipped',
          responded_at: nowIso,
          comment: 'Workflow cancelado por archivado del contrato.',
        })
        .in('flow_id', flowIds)
        .eq('status', 'pending')
    }

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: contract.contact_id,
      deal_id: contract.quote_id,
      subject: 'Contrato archivado',
      body: `${actorName} archivo el contrato ${contract.contract_number}.`,
      created_by: auth.user.id,
    })

    return NextResponse.json({ data: { id: contract.id, status: 'voided' } })
  }

  const { error: resetError } = await supabase
    .from('contracts')
    .update({
      status: 'draft',
      sent_at: null,
      viewed_at: null,
      signed_at: null,
      signed_by: null,
      signed_signature_data: null,
      signed_signature_name: null,
      initials_data: [],
      signature_ip: null,
      rejection_reason: null,
      updated_at: nowIso,
    })
    .eq('id', contract.id)

  if (resetError) return NextResponse.json({ error: resetError.message }, { status: 400 })

  await supabase.from('activities').insert({
    type: 'stage_change',
    contact_id: contract.contact_id,
    deal_id: contract.quote_id,
    subject: 'Contrato desarchivado',
    body: `${actorName} desarchivo el contrato ${contract.contract_number} y lo regreso a borrador.`,
    created_by: auth.user.id,
  })

  return NextResponse.json({ data: { id: contract.id, status: 'draft' } })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', auth.user.id)
    .single()

  if (!canManageContracts(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as DeletePayload | null
  if ((payload?.confirmationText ?? '').trim() !== 'ELIMINAR') {
    return NextResponse.json({ error: 'Confirmacion invalida. Escribe ELIMINAR.' }, { status: 400 })
  }

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, contract_number, status, contact_id, quote_id, pdf_storage_path, annexes')
    .eq('id', id)
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
  }

  const { data: flows } = await supabase
    .from('approval_flows')
    .select('id')
    .eq('entity_type', 'contract')
    .eq('entity_id', contract.id)

  const flowIds = (flows ?? []).map(flow => flow.id)
  if (flowIds.length > 0) {
    const { error: stepsDeleteError } = await supabase
      .from('approval_steps')
      .delete()
      .in('flow_id', flowIds)

    if (stepsDeleteError) {
      return NextResponse.json({ error: stepsDeleteError.message }, { status: 400 })
    }

    const { error: flowDeleteError } = await supabase
      .from('approval_flows')
      .delete()
      .in('id', flowIds)

    if (flowDeleteError) {
      return NextResponse.json({ error: flowDeleteError.message }, { status: 400 })
    }
  }

  const storagePaths = new Set<string>()
  if (contract.pdf_storage_path) storagePaths.add(contract.pdf_storage_path)
  for (const annex of toContractAnnexes(contract.annexes)) {
    if (annex.storage_path) storagePaths.add(annex.storage_path)
  }
  await collectStoragePathsRecursive(`contracts/${contract.id}`, storagePaths)
  await deleteStoragePaths(storagePaths)

  const { error: deleteContractError } = await supabase
    .from('contracts')
    .delete()
    .eq('id', contract.id)

  if (deleteContractError) {
    return NextResponse.json({ error: deleteContractError.message }, { status: 400 })
  }

  const actorName = profile?.full_name || 'Usuario'
  await supabase.from('activities').insert({
    type: 'stage_change',
    contact_id: contract.contact_id,
    deal_id: contract.quote_id,
    subject: 'Contrato eliminado',
    body: `${actorName} elimino permanentemente el contrato ${contract.contract_number}.`,
    created_by: auth.user.id,
  })

  return NextResponse.json({ data: { id: contract.id, deleted: true } })
}
