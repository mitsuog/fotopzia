import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  FileClock,
  FileSignature,
  Handshake,
} from 'lucide-react'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/supabase/types'
import type { ContractStatus, QuoteStatus } from '@/types/quotes'

type DealStage = Enums<'deal_stage'>
type EventStatus = Enums<'event_status'>

type ContactSummary = {
  first_name: string
  last_name: string
  company_name: string | null
}

type DealRow = {
  id: string
  title: string
  stage: DealStage
  value: number | null
  probability: number | null
  currency: string
  expected_close: string | null
  updated_at: string
  contact: ContactSummary | null
}

type QuoteRow = {
  id: string
  quote_number: string
  title: string
  status: QuoteStatus
  total: number
  currency: string
  valid_until: string | null
  sent_at: string | null
  created_at: string
  contact: ContactSummary | null
}

type ContractRow = {
  id: string
  contract_number: string
  title: string
  status: ContractStatus
  sent_at: string | null
  signed_at: string | null
  created_at: string
  contact: ContactSummary | null
}

type ActivityRow = {
  id: string
  subject: string | null
  type: string
  due_at: string | null
  completed: boolean
  contact: ContactSummary | null
  deal: { title: string } | null
}

type CalendarEventRow = {
  id: string
  title: string
  start_at: string
  end_at: string
  status: EventStatus
  type: string
  location: string | null
  contact: ContactSummary | null
}

const OPEN_STAGE_ORDER: DealStage[] = ['lead', 'prospect', 'qualified', 'proposal', 'negotiation']

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  qualified: 'Calificado',
  proposal: 'Propuesta',
  negotiation: 'Negociacion',
  won: 'Ganado',
  lost: 'Perdido',
}

const STAGE_PROBABILITY_FALLBACK: Record<DealStage, number> = {
  lead: 15,
  prospect: 30,
  qualified: 50,
  proposal: 70,
  negotiation: 85,
  won: 100,
  lost: 0,
}

const quoteWorkStatuses = new Set<QuoteStatus>(['sent', 'viewed'])
const contractPendingSignatureStatuses = new Set<ContractStatus>(['sent', 'viewed'])

const numberFormat = new Intl.NumberFormat('es-MX')
const currencyFormat = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
})
const dayFormat = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})
const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatCurrency(value: number): string {
  return currencyFormat.format(value || 0)
}

function formatInteger(value: number): string {
  return numberFormat.format(Math.round(value || 0))
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`
}

function formatDate(value: string | null): string {
  const parsed = parseDate(value)
  return parsed ? dayFormat.format(parsed) : '-'
}

function formatDateTime(value: string | null): string {
  const parsed = parseDate(value)
  return parsed ? dateTimeFormat.format(parsed) : '-'
}

function daysFrom(base: Date, target: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.floor((target.getTime() - base.getTime()) / msPerDay)
}

function fullContactName(contact: ContactSummary | null): string {
  if (!contact) return 'Sin contacto'
  if (contact.company_name) return contact.company_name
  return `${contact.first_name} ${contact.last_name}`.trim()
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

interface MetricCardProps {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  details: string[]
}

function MetricCard({ title, value, subtitle, icon, details }: MetricCardProps) {
  return (
    <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/60">{title}</p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-brand-navy">{value}</p>
          <p className="mt-0.5 text-xs text-gray-600">{subtitle}</p>
        </div>
        <div className="rounded-lg border border-brand-stone bg-brand-canvas/80 p-2.5 text-brand-navy">{icon}</div>
      </div>
      <ul className="mt-4 space-y-1.5 text-xs text-gray-600">
        {details.map(detail => (
          <li key={detail}>{detail}</li>
        ))}
      </ul>
    </article>
  )
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const in7Days = new Date(todayStart)
  in7Days.setDate(in7Days.getDate() + 7)

  const in14Days = new Date(todayStart)
  in14Days.setDate(in14Days.getDate() + 14)

  const last30Days = new Date(todayStart)
  last30Days.setDate(last30Days.getDate() - 30)

  const nowIso = now.toISOString()
  const in7DaysIso = in7Days.toISOString()

  const [
    { data: profile },
    { count: contactsCount },
    { count: activeProjectsCount },
    { data: dealsData },
    { data: quotesData },
    { data: contractsData },
    { data: upcomingEventsData },
    { count: upcomingEventsCount },
    { data: overdueActivitiesData },
    { count: overdueActivitiesCount },
    { count: pendingApprovalsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('full_name, role').single(),
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }).neq('stage', 'cerrado'),
    supabase
      .from('deals')
      .select('id, title, stage, value, probability, currency, expected_close, updated_at, contact:contacts(first_name, last_name, company_name)')
      .order('updated_at', { ascending: false }),
    supabase
      .from('quotes')
      .select('id, quote_number, title, status, total, currency, valid_until, sent_at, created_at, contact:contacts(first_name, last_name, company_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('contracts')
      .select('id, contract_number, title, status, sent_at, signed_at, created_at, contact:contacts(first_name, last_name, company_name)')
      .order('created_at', { ascending: false }),
    supabase
      .from('calendar_events')
      .select('id, title, start_at, end_at, status, type, location, contact:contacts(first_name, last_name, company_name)')
      .neq('status', 'cancelled')
      .gte('start_at', nowIso)
      .lte('start_at', in7DaysIso)
      .order('start_at', { ascending: true })
      .limit(8),
    supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'cancelled')
      .gte('start_at', nowIso)
      .lte('start_at', in7DaysIso),
    supabase
      .from('activities')
      .select('id, subject, type, due_at, completed, contact:contacts(first_name, last_name, company_name), deal:deals(title)')
      .eq('completed', false)
      .not('due_at', 'is', null)
      .lt('due_at', nowIso)
      .order('due_at', { ascending: true })
      .limit(8),
    supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('completed', false)
      .not('due_at', 'is', null)
      .lt('due_at', nowIso),
    supabase.from('approval_flows').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
  ])

  const deals = (dealsData ?? []) as DealRow[]
  const quotes = (quotesData ?? []) as QuoteRow[]
  const contracts = (contractsData ?? []) as ContractRow[]
  const upcomingEvents = (upcomingEventsData ?? []) as CalendarEventRow[]
  const overdueActivities = (overdueActivitiesData ?? []) as ActivityRow[]

  const activeDeals = deals.filter(deal => deal.stage !== 'won' && deal.stage !== 'lost')
  const wonDeals = deals.filter(deal => deal.stage === 'won')
  const lostDeals = deals.filter(deal => deal.stage === 'lost')
  const winRate = wonDeals.length + lostDeals.length > 0 ? (wonDeals.length / (wonDeals.length + lostDeals.length)) * 100 : 0

  const pipelineValue = activeDeals.reduce((total, deal) => total + (deal.value ?? 0), 0)
  const weightedPipelineValue = activeDeals.reduce((total, deal) => {
    const amount = deal.value ?? 0
    const probability = clamp(deal.probability ?? STAGE_PROBABILITY_FALLBACK[deal.stage], 0, 100) / 100
    return total + amount * probability
  }, 0)

  const averageProbability =
    activeDeals.length > 0
      ? activeDeals.reduce((total, deal) => total + clamp(deal.probability ?? STAGE_PROBABILITY_FALLBACK[deal.stage], 0, 100), 0) /
        activeDeals.length
      : 0

  const dealsClosingSoon = activeDeals
    .filter(deal => {
      const date = parseDate(deal.expected_close)
      return Boolean(date && date >= todayStart && date <= in14Days)
    })
    .sort((a, b) => (parseDate(a.expected_close)?.getTime() ?? 0) - (parseDate(b.expected_close)?.getTime() ?? 0))

  const dealsAtRisk = activeDeals
    .filter(deal => {
      const date = parseDate(deal.expected_close)
      return Boolean(date && date < todayStart)
    })
    .sort((a, b) => (parseDate(a.expected_close)?.getTime() ?? 0) - (parseDate(b.expected_close)?.getTime() ?? 0))

  const openQuotes = quotes.filter(quote => quoteWorkStatuses.has(quote.status))
  const approvedQuotes = quotes.filter(quote => quote.status === 'approved')
  const rejectedQuotes = quotes.filter(quote => quote.status === 'rejected')
  const expiredQuotes = quotes.filter(quote => quote.status === 'expired')
  const quoteApprovalBase = approvedQuotes.length + rejectedQuotes.length + expiredQuotes.length
  const quoteApprovalRate = quoteApprovalBase > 0 ? (approvedQuotes.length / quoteApprovalBase) * 100 : 0

  const openQuoteValue = openQuotes.reduce((total, quote) => total + (quote.total ?? 0), 0)
  const approvedQuoteValue = approvedQuotes.reduce((total, quote) => total + (quote.total ?? 0), 0)

  const quotesExpiringSoon = openQuotes
    .filter(quote => {
      const date = parseDate(quote.valid_until)
      return Boolean(date && date >= todayStart && date <= in7Days)
    })
    .sort((a, b) => (parseDate(a.valid_until)?.getTime() ?? 0) - (parseDate(b.valid_until)?.getTime() ?? 0))

  const quotesExpiredAttention = openQuotes
    .filter(quote => {
      const date = parseDate(quote.valid_until)
      return Boolean(date && date < todayStart)
    })
    .sort((a, b) => (parseDate(a.valid_until)?.getTime() ?? 0) - (parseDate(b.valid_until)?.getTime() ?? 0))

  const quoteQueue = [...quotesExpiredAttention, ...quotesExpiringSoon].slice(0, 8)

  const pendingSignatureContracts = contracts
    .filter(contract => contractPendingSignatureStatuses.has(contract.status))
    .sort(
      (a, b) =>
        (parseDate(a.sent_at)?.getTime() ?? parseDate(a.created_at)?.getTime() ?? 0) -
        (parseDate(b.sent_at)?.getTime() ?? parseDate(b.created_at)?.getTime() ?? 0),
    )

  const signedContracts = contracts.filter(contract => contract.status === 'signed')
  const contractSignatureBase = contracts.filter(contract => ['sent', 'viewed', 'signed', 'rejected', 'voided'].includes(contract.status))
  const contractSignatureRate = contractSignatureBase.length > 0 ? (signedContracts.length / contractSignatureBase.length) * 100 : 0

  const quotesLast30 = quotes.filter(quote => (parseDate(quote.created_at)?.getTime() ?? 0) >= last30Days.getTime())
  const quoteValueLast30 = quotesLast30.reduce((total, quote) => total + (quote.total ?? 0), 0)
  const approvedValueLast30 = quotes
    .filter(quote => quote.status === 'approved' && (parseDate(quote.created_at)?.getTime() ?? 0) >= last30Days.getTime())
    .reduce((total, quote) => total + (quote.total ?? 0), 0)
  const signedLast30 = contracts.filter(contract => (parseDate(contract.signed_at)?.getTime() ?? 0) >= last30Days.getTime()).length
  const wonLast30 = deals.filter(deal => deal.stage === 'won' && (parseDate(deal.updated_at)?.getTime() ?? 0) >= last30Days.getTime()).length

  const stageBreakdown = OPEN_STAGE_ORDER.map(stage => {
    const stageDeals = activeDeals.filter(deal => deal.stage === stage)
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: stageDeals.length,
      value: stageDeals.reduce((total, deal) => total + (deal.value ?? 0), 0),
    }
  })
  const maxStageCount = Math.max(1, ...stageBreakdown.map(stage => stage.count))

  const criticalAlerts = (overdueActivitiesCount ?? 0) + quotesExpiredAttention.length
  const warningAlerts = dealsAtRisk.length + pendingSignatureContracts.length + (pendingApprovalsCount ?? 0)
  const healthScore = clamp(
    100 -
      (overdueActivitiesCount ?? 0) * 5 -
      quotesExpiredAttention.length * 7 -
      dealsAtRisk.length * 4 -
      pendingSignatureContracts.length * 2 -
      (pendingApprovalsCount ?? 0) * 2,
    0,
    100,
  )

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Dashboard Operativo"
        subtitle={
          profile
            ? `Bienvenido, ${profile.full_name} (${profile.role}). Prioridades en tiempo real del estudio.`
            : 'Vista ejecutiva del estudio con metricas, alertas y carga operativa.'
        }
        badge="Control Center"
        actions={
          <>
            <Link
              href="/crm/kanban"
              className="inline-flex items-center rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold/60"
            >
              Ir a CRM
            </Link>
            <Link
              href="/quotes/new"
              className="inline-flex items-center rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold/60"
            >
              Nueva cotizacion
            </Link>
            <Link
              href="/calendar"
              className="inline-flex items-center rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
            >
              Ver agenda
            </Link>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Pipeline Activo"
          value={formatInteger(activeDeals.length)}
          subtitle="oportunidades abiertas"
          icon={<CircleDollarSign className="h-5 w-5" />}
          details={[
            `Valor pipeline: ${formatCurrency(pipelineValue)}`,
            `Valor ponderado: ${formatCurrency(weightedPipelineValue)}`,
            `Probabilidad media: ${formatPercent(averageProbability)}`,
          ]}
        />
        <MetricCard
          title="Cotizaciones En Curso"
          value={formatInteger(openQuotes.length)}
          subtitle="documentos en negociacion"
          icon={<FileClock className="h-5 w-5" />}
          details={[
            `Valor en negociacion: ${formatCurrency(openQuoteValue)}`,
            `Aprobacion historica: ${formatPercent(quoteApprovalRate)}`,
            `Por vencer en 7 dias: ${formatInteger(quotesExpiringSoon.length)}`,
          ]}
        />
        <MetricCard
          title="Contratos"
          value={formatInteger(pendingSignatureContracts.length)}
          subtitle="pendientes de firma"
          icon={<FileSignature className="h-5 w-5" />}
          details={[
            `Firmados: ${formatInteger(signedContracts.length)}`,
            `Tasa de firma: ${formatPercent(contractSignatureRate)}`,
            `Flujos por aprobar: ${formatInteger(pendingApprovalsCount ?? 0)}`,
          ]}
        />
        <MetricCard
          title="Operacion Semanal"
          value={formatInteger((upcomingEventsCount ?? 0) + (overdueActivitiesCount ?? 0))}
          subtitle="puntos de atencion esta semana"
          icon={<CalendarClock className="h-5 w-5" />}
          details={[
            `Eventos proximos (7 dias): ${formatInteger(upcomingEventsCount ?? 0)}`,
            `Actividades vencidas: ${formatInteger(overdueActivitiesCount ?? 0)}`,
            `Proyectos activos: ${formatInteger(activeProjectsCount ?? 0)}`,
          ]}
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
        <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-navy">Embudo comercial</h2>
              <p className="text-sm text-gray-600">Distribucion de oportunidades por etapa y valor estimado.</p>
            </div>
            <div className="rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-right">
              <p className="text-[11px] uppercase tracking-[0.1em] text-brand-navy/70">Win Rate</p>
              <p className="text-lg font-semibold text-brand-navy">{formatPercent(winRate)}</p>
            </div>
          </div>

          <div className="space-y-3">
            {stageBreakdown.map(stage => (
              <div key={stage.stage} className="rounded-xl border border-brand-stone/70 bg-brand-paper/50 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-brand-navy">{stage.label}</p>
                  <p className="text-xs text-gray-600">
                    {formatInteger(stage.count)} oportunidades · {formatCurrency(stage.value)}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-brand-stone/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-navy to-brand-gold"
                    style={{ width: `${stage.count === 0 ? 0 : Math.max(8, Math.round((stage.count / maxStageCount) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-brand-stone/70 bg-brand-paper/60 p-3">
              <p className="text-xs text-gray-500">Contactos totales</p>
              <p className="mt-1 text-xl font-semibold text-brand-navy">{formatInteger(contactsCount ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-brand-stone/70 bg-brand-paper/60 p-3">
              <p className="text-xs text-gray-500">Deals que cierran en 14 dias</p>
              <p className="mt-1 text-xl font-semibold text-brand-navy">{formatInteger(dealsClosingSoon.length)}</p>
            </div>
            <div className="rounded-lg border border-brand-stone/70 bg-brand-paper/60 p-3">
              <p className="text-xs text-gray-500">Valor aprobado</p>
              <p className="mt-1 text-xl font-semibold text-brand-navy">{formatCurrency(approvedQuoteValue)}</p>
            </div>
          </div>
        </article>

        <div className="space-y-5">
          <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-navy">Salud operativa</h2>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${healthScore >= 75 ? 'bg-emerald-100 text-emerald-700' : healthScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}
              >
                {formatPercent(healthScore)}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-stone/70">
              <div
                className={`h-full rounded-full ${healthScore >= 75 ? 'bg-emerald-500' : healthScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <div className="mt-4 space-y-2 text-sm text-gray-700">
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Alertas criticas
                </span>
                <strong>{formatInteger(criticalAlerts)}</strong>
              </p>
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-amber-500" />
                  Alertas de seguimiento
                </span>
                <strong>{formatInteger(warningAlerts)}</strong>
              </p>
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <Handshake className="h-4 w-4 text-brand-navy" />
                  Cierres ganados (30 dias)
                </span>
                <strong>{formatInteger(wonLast30)}</strong>
              </p>
            </div>
          </article>

          <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
            <h2 className="text-lg font-semibold text-brand-navy">Rendimiento ultimos 30 dias</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span>Valor cotizado</span>
                <strong className="text-brand-navy">{formatCurrency(quoteValueLast30)}</strong>
              </p>
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span>Valor aprobado</span>
                <strong className="text-brand-navy">{formatCurrency(approvedValueLast30)}</strong>
              </p>
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span>Contratos firmados</span>
                <strong className="text-brand-navy">{formatInteger(signedLast30)}</strong>
              </p>
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span>Cotizaciones emitidas</span>
                <strong className="text-brand-navy">{formatInteger(quotesLast30.length)}</strong>
              </p>
            </div>
          </article>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Cotizaciones por atender</h2>
            <span className="rounded-full bg-brand-paper px-2 py-1 text-xs font-medium text-brand-navy">{formatInteger(quoteQueue.length)}</span>
          </div>
          {quoteQueue.length === 0 ? (
            <p className="rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-5 text-center text-sm text-gray-500">
              Sin cotizaciones urgentes en este momento.
            </p>
          ) : (
            <div className="space-y-2">
              {quoteQueue.map(quote => {
                const dueDate = parseDate(quote.valid_until)
                const dayDelta = dueDate ? daysFrom(todayStart, dueDate) : null
                return (
                  <Link
                    key={quote.id}
                    href={`/quotes/${quote.id}`}
                    className="block rounded-lg border border-brand-stone/70 bg-brand-paper/50 p-3 transition-colors hover:border-brand-gold/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-navy">
                          {quote.quote_number} · {quote.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-600">{fullContactName(quote.contact)}</p>
                      </div>
                      <QuoteStatusBadge status={quote.status} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                      <span>{formatCurrency(quote.total)}</span>
                      <span>
                        {dayDelta === null
                          ? 'Sin fecha de vigencia'
                          : dayDelta < 0
                            ? `Vencida hace ${Math.abs(dayDelta)} dias`
                            : dayDelta === 0
                              ? 'Vence hoy'
                              : `Vence en ${dayDelta} dias`}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Contratos pendientes de firma</h2>
            <span className="rounded-full bg-brand-paper px-2 py-1 text-xs font-medium text-brand-navy">
              {formatInteger(pendingSignatureContracts.length)}
            </span>
          </div>
          {pendingSignatureContracts.length === 0 ? (
            <p className="rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-5 text-center text-sm text-gray-500">
              No hay contratos esperando firma.
            </p>
          ) : (
            <div className="space-y-2">
              {pendingSignatureContracts.slice(0, 8).map(contract => (
                <Link
                  key={contract.id}
                  href={`/contracts/${contract.id}`}
                  className="block rounded-lg border border-brand-stone/70 bg-brand-paper/50 p-3 transition-colors hover:border-brand-gold/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-navy">
                        {contract.contract_number} · {contract.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-600">{fullContactName(contract.contact)}</p>
                    </div>
                    <ContractStatusBadge status={contract.status} />
                  </div>
                  <div className="mt-2 text-xs text-gray-600">Enviado: {formatDate(contract.sent_at)}</div>
                </Link>
              ))}
            </div>
          )}
        </article>

        <div className="space-y-5">
          <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-navy">Agenda proximos 7 dias</h2>
              <span className="rounded-full bg-brand-paper px-2 py-1 text-xs font-medium text-brand-navy">
                {formatInteger(upcomingEventsCount ?? 0)}
              </span>
            </div>
            {upcomingEvents.length === 0 ? (
              <p className="rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-5 text-center text-sm text-gray-500">
                Sin eventos programados.
              </p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(event => (
                  <Link
                    key={event.id}
                    href="/calendar"
                    className="block rounded-lg border border-brand-stone/70 bg-brand-paper/50 p-3 transition-colors hover:border-brand-gold/60"
                  >
                    <p className="truncate text-sm font-semibold text-brand-navy">{event.title}</p>
                    <p className="mt-0.5 text-xs text-gray-600">{fullContactName(event.contact)}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                      <span>{formatDateTime(event.start_at)}</span>
                      <span className="capitalize">{event.type.replace('_', ' ')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-navy">Actividades vencidas</h2>
              <span className="rounded-full bg-brand-paper px-2 py-1 text-xs font-medium text-brand-navy">
                {formatInteger(overdueActivitiesCount ?? 0)}
              </span>
            </div>
            {overdueActivities.length === 0 ? (
              <p className="rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-5 text-center text-sm text-gray-500">
                Todo al corriente por ahora.
              </p>
            ) : (
              <div className="space-y-2">
                {overdueActivities.map(activity => (
                  <Link
                    key={activity.id}
                    href="/crm/list"
                    className="block rounded-lg border border-brand-stone/70 bg-brand-paper/50 p-3 transition-colors hover:border-brand-gold/60"
                  >
                    <p className="truncate text-sm font-semibold text-brand-navy">
                      {activity.subject || 'Actividad sin asunto'}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-600">
                      {activity.deal?.title ? `${activity.deal.title} · ` : ''}
                      {fullContactName(activity.contact)}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                      <span className="capitalize">{activity.type.replace('_', ' ')}</span>
                      <span>{formatDateTime(activity.due_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-navy">Focos rojos del pipeline</h2>
          <Link
            href="/crm/kanban"
            className="inline-flex items-center gap-1 rounded-md border border-brand-stone bg-brand-paper px-2.5 py-1 text-xs font-medium text-brand-navy hover:border-brand-gold/60"
          >
            Atender en CRM
          </Link>
        </div>

        {dealsAtRisk.length === 0 ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            No hay oportunidades con fecha de cierre vencida.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            {dealsAtRisk.slice(0, 8).map(deal => (
              <div key={deal.id} className="rounded-lg border border-red-200 bg-red-50 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-red-800">{deal.title}</p>
                    <p className="text-xs text-red-700">{fullContactName(deal.contact)}</p>
                  </div>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                    {STAGE_LABELS[deal.stage]}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-red-700">
                  <span>Cierre esperado: {formatDate(deal.expected_close)}</span>
                  <span>Valor: {formatCurrency(deal.value ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
