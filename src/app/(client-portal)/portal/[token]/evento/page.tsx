import { notFound } from 'next/navigation'
import { getPortalAccessByToken, touchPortalAccess } from '@/lib/portal/token'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PortalShell } from '@/components/portal/PortalShell'

export const dynamic = 'force-dynamic'

interface PortalEventPageProps {
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
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default async function PortalEventPage({ params }: PortalEventPageProps) {
  const { token } = await params
  const { access } = await getPortalAccessByToken(token)
  if (!access) notFound()

  await touchPortalAccess(access)

  const [eventsResult, quotesResult, contractsResult] = await Promise.all([
    supabaseAdmin
      .from('calendar_events')
      .select('id, title, type, status, start_at, end_at, location, description, created_by')
      .eq('contact_id', access.contact_id)
      .order('start_at', { ascending: true })
      .limit(24),
    supabaseAdmin
      .from('quotes')
      .select('id, status')
      .eq('contact_id', access.contact_id),
    supabaseAdmin
      .from('contracts')
      .select('id, status')
      .eq('contact_id', access.contact_id),
  ])

  const now = Date.now()
  const events = eventsResult.data ?? []
  const upcomingEvents = events.filter(event => event.status !== 'cancelled' && new Date(event.end_at).getTime() >= now)
  const nextEvent = upcomingEvents[0] ?? null

  const ownerIds = Array.from(new Set(upcomingEvents.map(event => event.created_by)))
  const owners =
    ownerIds.length > 0
      ? (
        await supabaseAdmin
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', ownerIds)
      ).data ?? []
      : []
  const ownerById = new Map(owners.map(owner => [owner.id, owner]))

  const quotes = quotesResult.data ?? []
  const contracts = contractsResult.data ?? []

  const pendingQuoteSignatures = quotes.filter(quote => quote.status === 'sent' || quote.status === 'viewed').length
  const pendingContractSignatures = contracts.filter(contract => contract.status === 'sent' || contract.status === 'viewed').length

  return (
    <PortalShell
      token={token}
      active="event"
      title="Mi evento"
      description="Seguimiento de citas, sesiones y responsables asignados por el equipo Fotopzia."
    >
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-brand-stone bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Proxima cita</p>
          <p className="mt-2 text-sm font-semibold text-brand-navy">
            {nextEvent ? formatDateTime(nextEvent.start_at) : 'Sin cita programada'}
          </p>
        </article>
        <article className="rounded-xl border border-brand-stone bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Agenda activa</p>
          <p className="mt-2 text-sm font-semibold text-brand-navy">{upcomingEvents.length} citas pendientes</p>
        </article>
        <article className="rounded-xl border border-brand-stone bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Firmas pendientes</p>
          <p className="mt-2 text-sm font-semibold text-brand-navy">
            {pendingQuoteSignatures + pendingContractSignatures} documentos por firmar
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-brand-stone bg-white p-5">
        <h2 className="text-sm font-semibold text-brand-navy">Detalle de agenda</h2>
        {upcomingEvents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No hay eventos activos para este contacto.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {upcomingEvents.map(event => {
              const owner = ownerById.get(event.created_by)
              return (
                <article key={event.id} className="rounded-lg border border-brand-stone/80 bg-brand-paper/30 p-3">
                  <p className="text-sm font-semibold text-brand-navy">{event.title}</p>
                  <p className="text-xs text-gray-600">
                    {EVENT_TYPE_LABEL[event.type] ?? event.type} · {EVENT_STATUS_LABEL[event.status] ?? event.status}
                  </p>
                  <p className="text-xs text-gray-600">
                    {formatDateTime(event.start_at)} - {formatDateTime(event.end_at)}
                  </p>
                  {event.location ? <p className="text-xs text-gray-600">Ubicacion: {event.location}</p> : null}
                  <p className="text-xs text-gray-600">Atiende: {owner?.full_name ?? 'Equipo Fotopzia'}</p>
                  {owner?.email ? <p className="text-xs text-gray-600">Contacto: {owner.email}</p> : null}
                  {owner?.phone ? <p className="text-xs text-gray-600">Telefono: {owner.phone}</p> : null}
                  {event.description ? <p className="mt-2 text-xs text-gray-700">{event.description}</p> : null}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </PortalShell>
  )
}

