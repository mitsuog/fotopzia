import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PortalShell } from '@/components/portal/PortalShell'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

const EVENT_TYPE_ICON: Record<string, string> = {
  meeting: '📅',
  production_session: '📷',
}

function getEventBadge(status: string, endAt: string): { label: string; className: string } {
  const isPast = new Date(endAt) < new Date()
  if (status === 'cancelled') return { label: 'Cancelada', className: 'bg-red-100 text-red-700' }
  if (isPast && status === 'confirmed') return { label: 'Realizada', className: 'bg-emerald-100 text-emerald-700' }
  if (!isPast && status === 'confirmed') return { label: 'Confirmada', className: 'bg-blue-100 text-blue-800' }
  if (!isPast && status === 'tentative') return { label: 'Tentativa', className: 'bg-amber-100 text-amber-700' }
  return { label: status, className: 'bg-gray-100 text-gray-600' }
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

  const [
    quotesCountResult,
    contractsCountResult,
    projectsCountResult,
    allEventsResult,
    pendingContractsResult,
    pendingQuotesResult,
  ] = await Promise.all([
    supabaseAdmin.from('quotes').select('*', { count: 'exact', head: true }).eq('contact_id', access.contact_id),
    supabaseAdmin.from('contracts').select('*', { count: 'exact', head: true }).eq('contact_id', access.contact_id).neq('status', 'voided'),
    supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', access.contact_id)
      .not('stage', 'eq', 'cierre')
      .neq('is_archived', true),
    supabaseAdmin
      .from('calendar_events')
      .select('id, title, type, status, start_at, end_at, location, created_by')
      .eq('contact_id', access.contact_id)
      .order('start_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('contracts')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', access.contact_id)
      .neq('status', 'voided')
      .in('status', ['sent', 'viewed']),
    supabaseAdmin
      .from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', access.contact_id)
      .in('status', ['sent', 'viewed']),
  ])

  const allEvents = allEventsResult.data ?? []
  const upcomingEvents = allEvents
    .filter(e => new Date(e.end_at) >= new Date())
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 5)
  const pastEvents = allEvents
    .filter(e => new Date(e.end_at) < new Date())
    .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
    .slice(0, 10)

  const nextEvent = upcomingEvents[0] ?? null
  const pendingCount = (pendingContractsResult.count ?? 0) + (pendingQuotesResult.count ?? 0)

  const ownerIds = Array.from(new Set(allEvents.map(event => event.created_by)))
  const owners = ownerIds.length > 0
    ? (await supabaseAdmin.from('profiles').select('id, full_name').in('id', ownerIds)).data ?? []
    : []
  const ownerById = new Map(owners.map(owner => [owner.id, owner.full_name]))

  return (
    <PortalShell
      token={token}
      active="summary"
      title="Resumen"
      description={contact ? `Bienvenido, ${contact.first_name} ${contact.last_name}` : 'Bienvenido al portal de cliente.'}
    >
      {/* Callout documentos pendientes */}
      {pendingCount > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-amber-800">
              Tienes {pendingCount} documento{pendingCount > 1 ? 's' : ''} pendiente{pendingCount > 1 ? 's' : ''} de firma
            </p>
            <Link
              href={`/portal/${token}/documents`}
              className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
            >
              Ver documentos
            </Link>
          </div>
        </section>
      )}

      {/* Stats cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            label: 'Documentos',
            href: `/portal/${token}/documents`,
            value: `${quotesCountResult.count ?? 0} cotiz. / ${contractsCountResult.count ?? 0} contratos`,
          },
          {
            label: 'Proximo evento',
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

      {/* Upcoming events */}
      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-navy">Proximas citas</h2>
        {upcomingEvents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No hay citas proximas registradas.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {upcomingEvents.map(event => {
              const badge = getEventBadge(event.status, event.end_at)
              const icon = EVENT_TYPE_ICON[event.type] ?? '•'
              return (
                <div key={event.id} className="flex gap-3 rounded-lg border border-brand-stone/80 bg-brand-paper/40 p-3">
                  <span className="mt-0.5 text-base">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-brand-navy">{event.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-600">
                      {formatDateTime(event.start_at)} — {formatDateTime(event.end_at)}
                    </p>
                    <p className="text-xs text-gray-600">Atiende: {ownerById.get(event.created_by) ?? 'Equipo Fotopzia'}</p>
                    {event.location ? <p className="text-xs text-gray-600">Lugar: {event.location}</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Past events */}
      {pastEvents.length > 0 && (
        <section className="rounded-2xl border border-brand-stone bg-white p-5">
          <h2 className="text-sm font-semibold text-brand-navy">Historial de citas</h2>
          <div className="mt-3 space-y-2">
            {pastEvents.map(event => {
              const badge = getEventBadge(event.status, event.end_at)
              const icon = EVENT_TYPE_ICON[event.type] ?? '•'
              return (
                <div key={event.id} className="flex gap-3 rounded-lg border border-brand-stone/50 bg-gray-50/60 p-3 opacity-80">
                  <span className="mt-0.5 text-base">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-gray-700">{event.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{formatDateTime(event.start_at)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </PortalShell>
  )
}

