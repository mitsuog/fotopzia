import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  meeting: 'Reunion',
  production_session: 'Sesion',
}

const EVENT_STATUS_LABEL: Record<string, string> = {
  tentative: 'Tentativa',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default async function ClientPortalPage({ params }: PageProps) {
  const { token } = await params
  const { access } = await getPortalAccessByToken(token)
  if (!access) notFound()

  await touchPortalAccess(access)
  const contact = access.contacts
  const nowIso = new Date().toISOString()

  const [quotesCountResult, contractsCountResult, projectsCountResult, upcomingEventsResult] = await Promise.all([
    supabaseAdmin.from('quotes').select('*', { count: 'exact', head: true }).eq('contact_id', access.contact_id),
    supabaseAdmin.from('contracts').select('*', { count: 'exact', head: true }).eq('contact_id', access.contact_id),
    supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', access.contact_id)
      .not('stage', 'eq', 'cerrado'),
    supabaseAdmin
      .from('calendar_events')
      .select('id, title, type, status, start_at, end_at, location, created_by')
      .eq('contact_id', access.contact_id)
      .neq('status', 'cancelled')
      .gte('end_at', nowIso)
      .order('start_at', { ascending: true })
      .limit(8),
  ])

  const upcomingEvents = upcomingEventsResult.data ?? []
  const nextEvent = upcomingEvents[0] ?? null
  const ownerIds = Array.from(new Set(upcomingEvents.map(event => event.created_by)))
  const owners =
    ownerIds.length > 0
      ? (
        await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .in('id', ownerIds)
      ).data ?? []
      : []
  const ownerById = new Map(owners.map(owner => [owner.id, owner.full_name]))

  return (
    <PortalShell
      token={token}
      active="summary"
      title="Resumen"
      description={contact ? `Bienvenido, ${contact.first_name} ${contact.last_name}` : 'Bienvenido al portal de cliente.'}
    >
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            label: 'Documentos',
            href: `/portal/${token}/documents`,
            value: `${quotesCountResult.count ?? 0} cotizaciones / ${contractsCountResult.count ?? 0} contratos`,
          },
          {
            label: 'Mi evento',
            href: `/portal/${token}/evento`,
            value: nextEvent ? formatDateTime(nextEvent.start_at) : 'Sin citas programadas',
          },
          {
            label: 'Proyectos activos',
            href: `/portal/${token}`,
            value: `${projectsCountResult.count ?? 0} en curso`,
          },
        ].map(item => (
          <a
            key={item.label}
            href={item.href}
            className="rounded-xl border border-brand-stone bg-white p-4 transition-colors hover:bg-brand-paper"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">{item.label}</p>
            <p className="mt-2 text-sm font-semibold text-brand-navy">{item.value}</p>
          </a>
        ))}
      </section>

      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-navy">Agenda proxima</h2>
        {upcomingEvents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Aun no tienes citas registradas en agenda.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {upcomingEvents.map(event => (
              <div key={event.id} className="rounded-lg border border-brand-stone/80 bg-brand-paper/40 p-3">
                <p className="text-sm font-semibold text-brand-navy">{event.title}</p>
                <p className="text-xs text-gray-600">
                  {EVENT_TYPE_LABEL[event.type] ?? event.type} · {EVENT_STATUS_LABEL[event.status] ?? event.status}
                </p>
                <p className="text-xs text-gray-600">
                  {formatDateTime(event.start_at)} - {formatDateTime(event.end_at)}
                </p>
                <p className="text-xs text-gray-600">Atiende: {ownerById.get(event.created_by) ?? 'Equipo Fotopzia'}</p>
                {event.location ? <p className="text-xs text-gray-600">Ubicacion: {event.location}</p> : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  )
}

