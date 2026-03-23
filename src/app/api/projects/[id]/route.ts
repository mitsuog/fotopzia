import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { NextResponse } from 'next/server'

function isAdminOrPm(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'project_manager'
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*, contact:contacts(first_name, last_name, email)')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const payload = await request.json()
  const allowed = ['stage', 'due_date', 'start_date', 'assigned_to', 'title', 'description', 'is_archived']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in payload) updates[key] = payload[key]
  }

  if ('is_archived' in payload) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .single()

    if (!isAdminOrPm(profile?.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const archived = Boolean(payload.is_archived)
    updates.is_archived = archived
    updates.archived_at = archived ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ data })
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
    .select('role')
    .eq('id', auth.user.id)
    .single()

  if (!isAdminOrPm(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const payload = (await request.json().catch(() => null)) as { confirmationText?: string } | null
  if ((payload?.confirmationText ?? '').trim() !== 'ELIMINAR') {
    return NextResponse.json({ error: 'Confirmacion invalida. Escribe ELIMINAR.' }, { status: 400 })
  }

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, title, contact_id, deal_id')
    .eq('id', id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Proyecto no encontrado.' }, { status: 404 })
  }

  await supabase.from('project_activity_log').insert({
    project_id: project.id,
    actor_id: auth.user.id,
    event_type: 'project_deleted',
    payload: { title: project.title },
  })

  const { error: deleteError } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 })

  const activityPayload: Database['public']['Tables']['activities']['Insert'] = {
    type: 'stage_change',
    contact_id: (project.contact_id as string | null) ?? null,
    deal_id: (project.deal_id as string | null) ?? null,
    subject: 'Proyecto eliminado',
    body: `Se elimino permanentemente el proyecto ${project.title}.`,
    created_by: auth.user.id,
  }

  await supabase.from('activities').insert(activityPayload)

  return NextResponse.json({ data: { id, deleted: true } })
}