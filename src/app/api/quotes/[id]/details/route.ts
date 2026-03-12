import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type UpdateQuoteDetailsPayload = {
  client_entity_type?: 'persona_fisica' | 'persona_moral'
  client_legal_name?: string
  client_representative_name?: string
  client_representative_role?: string
  client_legal_address?: string
  service_type?: string
  service_description?: string
  service_date?: string | null
  service_location?: string
}

function validatePayload(payload: UpdateQuoteDetailsPayload): string | null {
  const entityType = payload.client_entity_type === 'persona_moral' ? 'persona_moral' : 'persona_fisica'

  if (!payload.client_legal_name?.trim()) return 'El nombre legal del cliente es obligatorio.'
  if (!payload.client_legal_address?.trim()) return 'El domicilio legal del cliente es obligatorio.'
  if (!payload.service_type?.trim()) return 'El tipo de servicio es obligatorio.'
  if (!payload.service_description?.trim()) return 'La descripcion del servicio es obligatoria.'
  if (!payload.service_location?.trim()) return 'La ubicacion del servicio es obligatoria.'

  if (entityType === 'persona_moral') {
    if (!payload.client_representative_name?.trim()) {
      return 'El representante legal es obligatorio para persona moral.'
    }
    if (!payload.client_representative_role?.trim()) {
      return 'El cargo del representante legal es obligatorio para persona moral.'
    }
  }

  return null
}

export async function PATCH(
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

  if (!profile || (profile.role !== 'admin' && profile.role !== 'project_manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as UpdateQuoteDetailsPayload | null
  if (!payload) return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 })

  const validationError = validatePayload(payload)
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 })
  }

  const entityType = payload.client_entity_type === 'persona_moral' ? 'persona_moral' : 'persona_fisica'

  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (quoteError || !quote) {
    return NextResponse.json({ error: 'Cotizacion no encontrada.' }, { status: 404 })
  }

  const representativeName = entityType === 'persona_moral'
    ? payload.client_representative_name?.trim() || null
    : payload.client_representative_name?.trim() || payload.client_legal_name?.trim() || null

  const representativeRole = entityType === 'persona_moral'
    ? payload.client_representative_role?.trim() || null
    : null

  const { error: updateError } = await supabase
    .from('quotes')
    .update({
      client_entity_type: entityType,
      client_legal_name: payload.client_legal_name?.trim() || null,
      client_representative_name: representativeName,
      client_representative_role: representativeRole,
      client_legal_address: payload.client_legal_address?.trim() || null,
      service_type: payload.service_type?.trim() || null,
      service_description: payload.service_description?.trim() || null,
      service_date: payload.service_date || null,
      service_location: payload.service_location?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quote.id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  await supabase
    .from('contacts')
    .update({
      legal_entity_type: entityType,
      legal_name: payload.client_legal_name?.trim() || null,
      legal_representative_name: entityType === 'persona_moral'
        ? (payload.client_representative_name?.trim() || null)
        : null,
      legal_representative_role: entityType === 'persona_moral'
        ? (payload.client_representative_role?.trim() || null)
        : null,
      legal_address: payload.client_legal_address?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quote.contact_id)

  await supabase.from('activities').insert({
    type: 'stage_change',
    contact_id: quote.contact_id,
    deal_id: quote.deal_id,
    subject: 'Datos legales de cotizacion actualizados',
    body: `${profile.full_name} actualizo datos legales/servicio de la cotizacion ${quote.quote_number}.`,
    created_by: user.id,
  })

  return NextResponse.json({ data: { id: quote.id } })
}
