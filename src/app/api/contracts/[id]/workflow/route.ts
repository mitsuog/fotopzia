import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseContractContent } from '@/lib/documents/contracts'

type WorkflowAction = 'submit_approval' | 'approve' | 'reject' | 'return_to_review'

type WorkflowPayload = {
  action?: WorkflowAction
  comment?: string
}

function hasApproverRole(role: string): boolean {
  return role === 'admin' || role === 'project_manager'
}

async function ensurePortalLink(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contactId: string,
  createdBy: string,
  request: Request,
) {
  const { data: tokens } = await supabase
    .from('client_portal_tokens')
    .select('token, expires_at')
    .eq('contact_id', contactId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(5)

  const validToken = tokens?.find(token => !token.expires_at || new Date(token.expires_at) > new Date())
  const origin = new URL(request.url).origin
  if (validToken) return `${origin}/portal/${validToken.token}/documents`

  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()
  const { data: inserted, error } = await supabase
    .from('client_portal_tokens')
    .insert({
      contact_id: contactId,
      label: 'Firma de documentos',
      is_active: true,
      expires_at: expiresAt,
      created_by: createdBy,
    })
    .select('token')
    .single()

  if (error || !inserted) {
    throw new Error(error?.message ?? 'No fue posible crear token de portal.')
  }

  return `${origin}/portal/${inserted.token}/documents`
}

async function ensureFlowForContract(
  supabase: Awaited<ReturnType<typeof createClient>>,
  contract: { id: string; contract_number: string },
  createdBy: string,
) {
  const { data: latestFlow } = await supabase
    .from('approval_flows')
    .select('id, status')
    .eq('entity_type', 'contract')
    .eq('entity_id', contract.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestFlow && (latestFlow.status === 'in_progress' || latestFlow.status === 'pending')) {
    return { flow: latestFlow, created: false }
  }

  const { data: flow, error: flowError } = await supabase
    .from('approval_flows')
    .insert({
      entity_type: 'contract',
      entity_id: contract.id,
      title: `Aprobacion interna de contrato ${contract.contract_number}`,
      status: 'in_progress',
      created_by: createdBy,
    })
    .select('id, status')
    .single()

  if (flowError || !flow) throw new Error(flowError?.message ?? 'No fue posible crear flujo de aprobacion.')

  const { error: stepError } = await supabase
    .from('approval_steps')
    .insert({
      flow_id: flow.id,
      step_order: 1,
      title: 'Aprobacion interna PM/Admin',
      approver_type: 'internal',
      status: 'pending',
    })

  if (stepError) throw new Error(stepError.message)

  return { flow, created: true }
}

async function markFlowStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  flowId: string,
  nextStatus: 'approved' | 'rejected',
  approver: { id: string; full_name: string },
  comment?: string,
) {
  const nowIso = new Date().toISOString()

  const { error: flowError } = await supabase
    .from('approval_flows')
    .update({ status: nextStatus, updated_at: nowIso })
    .eq('id', flowId)

  if (flowError) throw new Error(flowError.message)

  const stepStatus = nextStatus === 'approved' ? 'approved' : 'rejected'
  const { data: pendingStep } = await supabase
    .from('approval_steps')
    .select('id')
    .eq('flow_id', flowId)
    .eq('status', 'pending')
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (pendingStep) {
    const { error: stepError } = await supabase
      .from('approval_steps')
      .update({
        status: stepStatus,
        approver_id: approver.id,
        approver_name: approver.full_name,
        responded_at: nowIso,
        comment: comment || null,
      })
      .eq('id', pendingStep.id)

    if (stepError) throw new Error(stepError.message)
  }
}

async function resetFlowToReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  flowId: string,
) {
  const nowIso = new Date().toISOString()

  const { error: flowError } = await supabase
    .from('approval_flows')
    .update({ status: 'in_progress', updated_at: nowIso })
    .eq('id', flowId)

  if (flowError) throw new Error(flowError.message)

  const { error: stepsError } = await supabase
    .from('approval_steps')
    .update({
      status: 'pending',
      approver_id: null,
      approver_name: null,
      responded_at: null,
      comment: null,
    })
    .eq('flow_id', flowId)

  if (stepsError) throw new Error(stepsError.message)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile || !hasApproverRole(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as WorkflowPayload | null
  const action = payload?.action
  if (!action) return NextResponse.json({ error: 'Accion invalida.' }, { status: 400 })

  const { data: contract, error: contractError } = await supabase
    .from('contracts')
    .select('id, contract_number, title, status, content, contact_id, quote_id')
    .eq('id', id)
    .single()

  if (contractError || !contract) {
    return NextResponse.json({ error: 'Contrato no encontrado.' }, { status: 404 })
  }

  if (contract.status === 'voided') {
    return NextResponse.json({ error: 'El contrato esta archivado. Desarchivalo para continuar.' }, { status: 400 })
  }

  const actorName = profile.full_name || 'Usuario'

  if (action === 'submit_approval') {
    const { flow, created } = await ensureFlowForContract(supabase, contract, user.id)

    if (!created) {
      return NextResponse.json({ data: { flow_id: flow.id, flow_status: flow.status } })
    }

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: contract.contact_id,
      deal_id: contract.quote_id,
      subject: 'Contrato enviado a aprobacion interna',
      body: `${actorName} envio a aprobacion interna el contrato ${contract.contract_number}.`,
      created_by: user.id,
    })

    return NextResponse.json({ data: { flow_id: flow.id, flow_status: flow.status } })
  }

  const { data: flow } = await supabase
    .from('approval_flows')
    .select('id, status')
    .eq('entity_type', 'contract')
    .eq('entity_id', contract.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!flow) {
    return NextResponse.json({ error: 'No existe flujo de aprobacion para este contrato.' }, { status: 400 })
  }

  if (action === 'approve') {
    await markFlowStatus(supabase, flow.id, 'approved', { id: user.id, full_name: actorName }, payload?.comment)

    let portalUrl: string | null = null
    if (contract.status !== 'signed') {
      const nowIso = new Date().toISOString()
      const { error: sendError } = await supabase
        .from('contracts')
        .update({
          status: 'sent',
          sent_at: nowIso,
          viewed_at: contract.status === 'draft' ? null : undefined,
          updated_at: nowIso,
        })
        .eq('id', contract.id)

      if (sendError) {
        return NextResponse.json({ error: sendError.message }, { status: 400 })
      }

      const parsedContent = parseContractContent(contract.content)
      if (parsedContent.include_quote_document && contract.quote_id) {
        const { data: quote } = await supabase
          .from('quotes')
          .select('status')
          .eq('id', contract.quote_id)
          .single()

        if (quote && (quote.status === 'draft' || quote.status === 'expired')) {
          await supabase
            .from('quotes')
            .update({
              status: 'sent',
              sent_at: nowIso,
              updated_at: nowIso,
            })
            .eq('id', contract.quote_id)
        }
      }

      portalUrl = await ensurePortalLink(supabase, contract.contact_id, user.id, request)
    }

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: contract.contact_id,
      deal_id: contract.quote_id,
      subject: 'Contrato aprobado internamente y enviado a firma',
      body: `${actorName} aprobo internamente el contrato ${contract.contract_number} y lo envio a firma.`,
      created_by: user.id,
    })

    return NextResponse.json({
      data: {
        flow_id: flow.id,
        flow_status: 'approved',
        contract_status: contract.status === 'signed' ? 'signed' : 'sent',
        portal_url: portalUrl,
      },
    })
  }

  if (action === 'reject') {
    await markFlowStatus(supabase, flow.id, 'rejected', { id: user.id, full_name: actorName }, payload?.comment)

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: contract.contact_id,
      deal_id: contract.quote_id,
      subject: 'Contrato rechazado internamente',
      body: `${actorName} rechazo internamente el contrato ${contract.contract_number}.`,
      created_by: user.id,
    })

    return NextResponse.json({ data: { flow_id: flow.id, flow_status: 'rejected' } })
  }

  if (action === 'return_to_review') {
    if (contract.status === 'signed') {
      return NextResponse.json({ error: 'No se puede regresar a revision un contrato ya firmado.' }, { status: 400 })
    }

    const reviewComment = payload?.comment?.trim()
    if (!reviewComment) {
      return NextResponse.json({
        error: 'Debes capturar un comentario describiendo que se cambio antes de regresar a revision.',
      }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const { error: resetContractError } = await supabase
      .from('contracts')
      .update({
        status: 'draft',
        sent_at: null,
        viewed_at: null,
        signed_at: null,
        signed_by: null,
        signed_signature_data: null,
        signed_signature_name: null,
        updated_at: nowIso,
      })
      .eq('id', contract.id)

    if (resetContractError) {
      return NextResponse.json({ error: resetContractError.message }, { status: 400 })
    }

    await resetFlowToReview(supabase, flow.id)

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: contract.contact_id,
      deal_id: contract.quote_id,
      subject: 'Contrato regresado a revision',
      body: `${actorName} regreso a revision el contrato ${contract.contract_number}. Cambios: ${reviewComment}`,
      created_by: user.id,
    })

    return NextResponse.json({ data: { flow_id: flow.id, flow_status: 'in_progress', contract_status: 'draft' } })
  }

  return NextResponse.json({ error: 'Accion no soportada.' }, { status: 400 })
}

