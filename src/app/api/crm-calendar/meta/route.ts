import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarActor } from '@/lib/crm-calendar/server'

export async function GET() {
  const { actor, error: actorError } = await getCalendarActor()
  if (actorError) return NextResponse.json({ error: actorError.message }, { status: 400 })
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const supabase = await createClient()

  const [{ data: contacts, error: contactsError }, { data: deals, error: dealsError }, { data: users, error: usersError }] =
    await Promise.all([
      supabase
        .from('contacts')
        .select('id, first_name, last_name, company_name')
        .order('first_name'),
      supabase
        .from('deals')
        .select('id, title, contact_id, stage')
        .neq('stage', 'lost')
        .order('created_at', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'project_manager', 'operator'])
        .eq('is_active', true)
        .order('full_name'),
    ])

  if (contactsError || dealsError || usersError) {
    return NextResponse.json(
      { error: contactsError?.message ?? dealsError?.message ?? usersError?.message ?? 'Error al cargar metadatos.' },
      { status: 400 },
    )
  }

  return NextResponse.json({
    data: {
      contacts: contacts ?? [],
      deals: deals ?? [],
      users: users ?? [],
      actor,
    },
  })
}
