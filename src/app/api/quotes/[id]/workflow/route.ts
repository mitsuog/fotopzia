import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type WorkflowAction = 'submit_approval' | 'approve' | 'reject' | 'return_to_review' | 'send_signature'

type WorkflowPayload = {
  action?: WorkflowAction
  comment?: string
  direct?: boolean
}

type ApprovalFlowStatus = Database['public']['Enums']['approval_flow_status']

function hasApproverRole(role: string): boolean {
  return role === 'admin' || role === 'project_manager'
}

function getNowIso(): string {
  return new Date().toISOString()
}

function validateQuoteCompleteness(quote: {
  client_entity_type: string | null
  client_legal_name: string | null
  client_representative_name: string | null
  client_representative_role: string | null
  client_legal_address: string | null
  service_type: string | null
  service_description: string | null
  service_location: string | null
}): string | null {
  const entityType = quote.client_entity_type === 'persona_moral' ? 'persona_moral' : 'persona_fisica'
  if (!quote.client_legal_name?.trim()) return 'Falta nombre legal del cliente.'
  if (!quote.client_legal_address?.trim()) return 'Falta domicilio legal del cliente.'
  if (!quote.service_type?.trim()) return 'Falta tipo de servicio.'
  if (!quote.service_description?.trim()) return 'Falta descripcion de servicio.'
  if (!quote.service_location?.trim()) return 'Falta ubicacion del servicio.'

  if (entityType === 'persona_moral') {
    if (!quote.client_representative_name?.trim()) return 'Falta representante legal para persona moral.'
    if (!quote.client_representative_role?.trim()) return 'Falta cargo del representante legal para persona moral.'
  }

  return null
}

function normalizeEntityType(input: string | null | undefined): 'persona_fisica' | 'persona_moral' {
  return input === 'persona_moral' ? 'persona_moral' : 'persona_fisica'
}

function resolveEntityType(
  quoteEntityType: string | null | undefined,
  contactEntityType: string | null | undefined,
): 'persona_fisica' | 'persona_moral' {
  if (contactEntityType === 'persona_fisica' || contactEntityType === 'persona_moral') {
    return contactEntityType
  }
  return normalizeEntityType(quoteEntityType)
}

async function ensureFlowForQuote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quote: { id: string; quote_number: string },
  createdBy: string,
) {
  const { data: latestFlow } = await supabase
    .from('approval_flows')
    .select('id, status')
    .eq('entity_type', 'quote')
    .eq('entity_id', quote.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestFlow && (latestFlow.status === 'in_progress' || latestFlow.status === 'pending')) {
    return { flow: latestFlow, created: false }
  }

  const { data: flow, error: flowError } = await supabase
    .from('approval_flows')
    .insert({
      entity_type: 'quote',
      entity_id: quote.id,
      title: `Aprobacion interna de cotizacion ${quote.quote_number}`,
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
  nextStatus: ApprovalFlowStatus,
  approver: { id: string; full_name: string },
  comment?: string,
) {
  const nowIso = getNowIso()

  const { error: flowError } = await supabase
    .from('approval_flows')
    .update({
      status: nextStatus,
      updated_at: nowIso,
    })
    .eq('id', flowId)

  if (flowError) throw new Error(flowError.message)

  const stepStatus = nextStatus === 'approved' ? 'approved' : nextStatus === 'rejected' ? 'rejected' : 'pending'
  if (stepStatus === 'pending') return

  const { data: pendingStep } = await supabase
    .from('approval_steps')
    .select('id')
    .eq('flow_id', flowId)
    .eq('status', 'pending')
    .order('step_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (pendingStep) {
    const { error: stepUpdateError } = await supabase
      .from('approval_steps')
      .update({
        status: stepStatus,
        approver_id: approver.id,
        approver_name: approver.full_name,
        responded_at: nowIso,
        comment: comment || null,
      })
      .eq('id', pendingStep.id)

    if (stepUpdateError) throw new Error(stepUpdateError.message)
  }
}

async function resetFlowToReview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  flowId: string,
) {
  const nowIso = getNowIso()

  const { error: flowError } = await supabase
    .from('approval_flows')
    .update({
      status: 'in_progress',
      updated_at: nowIso,
    })
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

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, title, status, created_at, contact_id, deal_id, client_entity_type, client_legal_name, client_representative_name, client_representative_role, client_legal_address, service_type, service_description, service_location, contact:contacts(first_name, last_name, company_name, legal_entity_type, legal_name, legal_representative_name, legal_representative_role, legal_address)')
    .eq('id', id)
    .single()

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Cotizacion no encontrada.' }, { status: 404 })
  }

  const contactFullName = quote.contact
    ? `${quote.contact.first_name ?? ''} ${quote.contact.last_name ?? ''}`.trim()
    : ''
  const effectiveEntityType = resolveEntityType(quote.client_entity_type, quote.contact?.legal_entity_type)
  const hydratedQuote = {
    ...quote,
    client_entity_type: effectiveEntityType,
    client_legal_name:
      quote.client_legal_name?.trim()
      || quote.contact?.legal_name?.trim()
      || (effectiveEntityType === 'persona_moral'
        ? (quote.contact?.company_name?.trim() || contactFullName)
        : contactFullName),
    client_representative_name:
      quote.client_representative_name?.trim()
      || quote.contact?.legal_representative_name?.trim()
      || (effectiveEntityType === 'persona_fisica' ? contactFullName : ''),
    client_representative_role:
      quote.client_representative_role?.trim()
      || quote.contact?.legal_representative_role?.trim()
      || null,
    client_legal_address:
      quote.client_legal_address?.trim()
      || quote.contact?.legal_address?.trim()
      || '',
  }

  const legalFieldsChanged =
    hydratedQuote.client_entity_type !== quote.client_entity_type
    || hydratedQuote.client_legal_name !== quote.client_legal_name
    || hydratedQuote.client_representative_name !== quote.client_representative_name
    || hydratedQuote.client_representative_role !== quote.client_representative_role
    || hydratedQuote.client_legal_address !== quote.client_legal_address

  if (legalFieldsChanged) {
    await supabase
      .from('quotes')
      .update({
        client_entity_type: hydratedQuote.client_entity_type,
        client_legal_name: hydratedQuote.client_legal_name || null,
        client_representative_name: hydratedQuote.client_representative_name || null,
        client_representative_role:
          hydratedQuote.client_entity_type === 'persona_moral'
            ? (hydratedQuote.client_representative_role || null)
            : null,
        client_legal_address: hydratedQuote.client_legal_address || null,
        updated_at: getNowIso(),
      })
      .eq('id', quote.id)
  }

  const actorName = profile.full_name || 'Usuario'

  if (action === 'submit_approval') {
    const completenessError = validateQuoteCompleteness(hydratedQuote)
    if (completenessError) {
      return NextResponse.json({ error: completenessError }, { status: 400 })
    }

    const { flow, created } = await ensureFlowForQuote(supabase, quote, user.id)

    if (!created) {
      return NextResponse.json({
        data: {
          flow_id: flow.id,
          flow_status: flow.status,
        },
      })
    }

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: quote.contact_id,
      deal_id: quote.deal_id,
      subject: 'Cotizacion enviada a aprobacion interna',
      body: `${actorName} envio a aprobacion interna la cotizacion ${quote.quote_number}.`,
      created_by: user.id,
    })

    return NextResponse.json({
      data: {
        flow_id: flow.id,
        flow_status: flow.status,
      },
    })
  }

  const { data: flow } = await supabase
    .from('approval_flows')
    .select('id, status')
    .eq('entity_type', 'quote')
    .eq('entity_id', quote.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (action === 'approve') {
    if (!flow) {
      return NextResponse.json({ error: 'No existe flujo de aprobacion para esta cotizacion.' }, { status: 400 })
    }

    await markFlowStatus(supabase, flow.id, 'approved', { id: user.id, full_name: actorName }, payload?.comment)

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: quote.contact_id,
      deal_id: quote.deal_id,
      subject: 'Cotizacion aprobada internamente',
      body: `${actorName} aprobo internamente la cotizacion ${quote.quote_number}.`,
      created_by: user.id,
    })

    return NextResponse.json({ data: { flow_id: flow.id, flow_status: 'approved' } })
  }

  if (action === 'reject') {
    if (!flow) {
      return NextResponse.json({ error: 'No existe flujo de aprobacion para esta cotizacion.' }, { status: 400 })
    }

    await markFlowStatus(supabase, flow.id, 'rejected', { id: user.id, full_name: actorName }, payload?.comment)

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: quote.contact_id,
      deal_id: quote.deal_id,
      subject: 'Cotizacion rechazada internamente',
      body: `${actorName} rechazo internamente la cotizacion ${quote.quote_number}.`,
      created_by: user.id,
    })

    return NextResponse.json({ data: { flow_id: flow.id, flow_status: 'rejected' } })
  }

  if (action === 'return_to_review') {
    if (!flow) {
      return NextResponse.json({ error: 'No existe flujo de aprobacion para esta cotizacion.' }, { status: 400 })
    }

    const reviewComment = payload?.comment?.trim()
    if (!reviewComment) {
      return NextResponse.json({
        error: 'Debes capturar un comentario describiendo que se cambio antes de regresar a revision.',
      }, { status: 400 })
    }

    const nowIso = getNowIso()
    const { error: resetQuoteError } = await supabase
      .from('quotes')
      .update({
        status: 'draft',
        sent_at: null,
        viewed_at: null,
        approved_at: null,
        approved_by: null,
        approved_signature_data: null,
        approved_signature_name: null,
        approved_ip: null,
        updated_at: nowIso,
      })
      .eq('id', quote.id)

    if (resetQuoteError) {
      return NextResponse.json({ error: resetQuoteError.message }, { status: 400 })
    }

    await resetFlowToReview(supabase, flow.id)

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: quote.contact_id,
      deal_id: quote.deal_id,
      subject: 'Cotizacion regresada a revision',
      body: `${actorName} regreso a revision la cotizacion ${quote.quote_number}. Cambios: ${reviewComment}`,
      created_by: user.id,
    })

    return NextResponse.json({ data: { flow_id: flow.id, flow_status: 'in_progress', quote_status: 'draft' } })
  }

  if (action === 'send_signature') {
    const completenessError = validateQuoteCompleteness(hydratedQuote)
    if (completenessError) {
      return NextResponse.json({ error: completenessError }, { status: 400 })
    }

    const { data: newerQuote } = await supabase
      .from('quotes')
      .select('id, quote_number')
      .eq('contact_id', quote.contact_id)
      .neq('id', quote.id)
      .in('status', ['draft', 'sent', 'viewed', 'approved'])
      .gt('created_at', quote.created_at)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (newerQuote) {
      return NextResponse.json({
        error: `Esta cotizacion fue reemplazada por la version mas reciente (${newerQuote.quote_number}). Revisa esa version para continuar.`,
      }, { status: 400 })
    }

    const nowIso = getNowIso()
    let effectiveFlow = flow

    if (payload?.direct) {
      const ensured = await ensureFlowForQuote(supabase, quote, user.id)
      effectiveFlow = { id: ensured.flow.id, status: ensured.flow.status }
      await markFlowStatus(supabase, effectiveFlow.id, 'approved', { id: user.id, full_name: actorName }, 'Aprobacion directa por PM/Admin')

      await supabase.from('activities').insert({
        type: 'stage_change',
        contact_id: quote.contact_id,
        deal_id: quote.deal_id,
        subject: 'Aprobacion interna directa',
        body: `${actorName} aprobo directamente la cotizacion ${quote.quote_number} para envio a firma.`,
        created_by: user.id,
      })
    } else {
      if (!effectiveFlow || effectiveFlow.status !== 'approved') {
        return NextResponse.json({
          error: 'La cotizacion debe estar aprobada internamente antes de enviarse a firma.',
        }, { status: 400 })
      }
    }

    const { error: sendError } = await supabase
      .from('quotes')
      .update({
        status: 'sent',
        sent_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', quote.id)

    if (sendError) {
      return NextResponse.json({ error: sendError.message }, { status: 400 })
    }

    await supabase.from('activities').insert({
      type: 'stage_change',
      contact_id: quote.contact_id,
      deal_id: quote.deal_id,
      subject: 'Cotizacion enviada a firma',
      body: `${actorName} envio a firma la cotizacion ${quote.quote_number}.`,
      created_by: user.id,
    })

    return NextResponse.json({
      data: {
        quote_id: quote.id,
        quote_status: 'sent',
        flow_id: effectiveFlow?.id ?? null,
      },
    })
  }

  return NextResponse.json({ error: 'Accion no soportada.' }, { status: 400 })
}
