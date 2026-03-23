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
  FolderKanban,
} from 'lucide-react'
import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { QuoteStatusBadge } from '@/components/quotes/QuoteStatusBadge'
import { WeatherWidget } from '@/components/dashboard/WeatherWidget'
import { ProjectProgressPanel } from '@/components/dashboard/ProjectProgressPanel'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/supabase/types'
import type { ContractStatus, QuoteStatus } from '@/types/quotes'
import type { WeatherData, PortfolioProjectSummary } from '@/types/wbs'

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

// ─── Formatters (Mexico City timezone) ──────────────────────────────────────

const TZ = 'America/Mexico_City'

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
  timeZone: TZ,
})
const dateTimeFormat = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TZ,
})

function nowInMX(): Date {
  // Returns a Date object whose UTC value equals the current moment,
  // but whose local calendar values correspond to America/Mexico_City
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
}

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

// ─── Components ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  title: string
  value: string
  subtitle: string
  icon: ReactNode
  details: string[]
  href?: string
}

function MetricCard({ title, value, subtitle, icon, details, href }: MetricCardProps) {
  const inner = (
    <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur h-full">
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
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Use Mexico City local time for all date calculations
  const now = nowInMX()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const in7Days = new Date(todayStart)
  in7Days.setDate(in7Days.getDate() + 7)

  const in14Days = new Date(todayStart)
  in14Days.setDate(in14Days.getDate() + 14)

  const last30Days = new Date(todayStart)
  last30Days.setDate(last30Days.getDate() - 30)

  // For Supabase queries we need real UTC ISO strings
  const nowUTCIso = new Date().toISOString()
  const in7DaysUTCIso = new Date(Date.now() + 7 * 86400000).toISOString()

  const [
    { data: profile },
    { count: contactsCount },
    { data: activeProjectsData },
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
    supabase
      .from('projects')
      .select(`
        id, title, stage, project_type, start_date, due_date,
        progress_mode, progress_pct, color,
        contact:contacts(first_name, last_name, company_name)
      `)
      .neq('stage', 'cierre')
      .neq('is_archived', true)
      .order('created_at', { ascending: false }),
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
      .neq('status', 'voided')
      .order('created_at', { ascending: false }),
    supabase
      .from('calendar_events')
      .select('id, title, start_at, end_at, status, type, location, contact:contacts(first_name, last_name, company_name)')
      .neq('status', 'cancelled')
      .gte('start_at', nowUTCIso)
      .lte('start_at', in7DaysUTCIso)
      .order('start_at', { ascending: true })
      .limit(8),
    supabase
      .from('calendar_events')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'cancelled')
      .gte('start_at', nowUTCIso)
      .lte('start_at', in7DaysUTCIso),
    supabase
      .from('activities')
      .select('id, subject, type, due_at, completed, contact:contacts(first_name, last_name, company_name), deal:deals(title)')
      .eq('completed', false)
      .not('due_at', 'is', null)
      .lt('due_at', nowUTCIso)
      .order('due_at', { ascending: true })
      .limit(8),
    supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .eq('completed', false)
      .not('due_at', 'is', null)
      .lt('due_at', nowUTCIso),
    supabase.from('approval_flows').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
  ])

  // Fetch WBS progress for active projects
  const activeProjectIds = ((activeProjectsData ?? []) as unknown as Array<{ id: string }>).map(p => p.id)
  const { data: wbsTaskNodes } = activeProjectIds.length > 0
    ? await supabase
        .from('project_wbs_nodes')
        .select('project_id, status, level')
        .in('project_id', activeProjectIds)
        .eq('level', 'task')
    : { data: [] }

  // Build project portfolio summaries
  const wbsByProject = new Map<string, { total: number; done: number }>()
  for (const node of wbsTaskNodes ?? []) {
    const n = node as { project_id: string; status: string }
    const cur = wbsByProject.get(n.project_id) ?? { total: 0, done: 0 }
    cur.total++
    if (n.status === 'done') cur.done++
    wbsByProject.set(n.project_id, cur)
  }

  const portfolioProjects: PortfolioProjectSummary[] = ((activeProjectsData ?? []) as unknown as Array<{
    id: string; title: string; stage: string; project_type: string; start_date: string | null;
    due_date: string | null; progress_mode: string; progress_pct: number | null; color: string | null;
    contact: ContactSummary | null
  }>).map(p => {
    const tasks = wbsByProject.get(p.id) ?? { total: 0, done: 0 }
    let progress: number
    if (p.progress_mode === 'manual' && p.progress_pct !== null) {
      progress = p.progress_pct
    } else if (tasks.total > 0) {
      progress = Math.round((tasks.done / tasks.total) * 100)
    } else {
      progress = 0
    }
    const contactName = p.contact?.company_name
      ? p.contact.company_name
      : p.contact
        ? `${p.contact.first_name} ${p.contact.last_name}`.trim()
        : null

    return {
      id: p.id,
      title: p.title,
      stage: p.stage,
      project_type: (p.project_type ?? 'contract') as 'contract' | 'internal' | 'alliance',
      start_date: p.start_date,
      due_date: p.due_date,
      progress,
      color: p.color,
      contact_name: contactName,
      assigned_to_name: null,
      macro_count: 0,
      task_done: tasks.done,
      task_total: tasks.total,
    }
  })

  const avgProjectProgress = portfolioProjects.length > 0
    ? Math.round(portfolioProjects.reduce((s, p) => s + p.progress, 0) / portfolioProjects.length)
    : 0

  // ─── Fetch weather via Open-Meteo (no API key required) ──────────────────
  const WMO_ICON: Record<number, string> = {
    0: '01', 1: '01', 2: '02', 3: '04',
    45: '50', 48: '50',
    51: '09', 53: '09', 55: '09', 56: '09', 57: '09',
    61: '10', 63: '10', 65: '10', 66: '10', 67: '10',
    71: '13', 73: '13', 75: '13', 77: '13',
    80: '10', 81: '10', 82: '10', 85: '13', 86: '13',
    95: '11', 96: '11', 99: '11',
  }
  const WMO_DESC: Record<number, string> = {
    0: 'Cielo despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
    45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna intensa',
    61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
    71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve intensa', 77: 'Granizo pequeño',
    80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos intensos',
    95: 'Tormenta eléctrica', 96: 'Tormenta con granizo', 99: 'Tormenta intensa con granizo',
  }
  const wmoIcon = (code: number) => (WMO_ICON[code] ?? '01') + 'd'
  const wmoDesc = (code: number) => WMO_DESC[code] ?? 'Condición variable'

  let weatherData: WeatherData | null = null
  try {
    const omParams = new URLSearchParams({
      latitude: '19.18', longitude: '-96.13',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,cloud_cover',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
      timezone: 'America/Mexico_City',
      forecast_days: '6',
      wind_speed_unit: 'ms',
    })
    const omRes = await fetch(`https://api.open-meteo.com/v1/forecast?${omParams}`, { next: { revalidate: 1800 } })
    if (omRes.ok) {
      const om = await omRes.json() as {
        current: { temperature_2m: number; relative_humidity_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; wind_direction_10m: number; precipitation: number; cloud_cover: number }
        daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; precipitation_probability_max: number[] }
      }
      weatherData = {
        city: 'Veracruz',
        updated_at: new Date().toISOString(),
        current: {
          temp: Math.round(om.current.temperature_2m),
          feels_like: Math.round(om.current.apparent_temperature),
          description: wmoDesc(om.current.weather_code),
          icon: wmoIcon(om.current.weather_code),
          humidity: om.current.relative_humidity_2m,
          wind_speed: Math.round(om.current.wind_speed_10m * 10) / 10,
          wind_deg: om.current.wind_direction_10m,
          rain_1h: om.current.precipitation > 0 ? om.current.precipitation : undefined,
          clouds: om.current.cloud_cover,
        },
        forecast: om.daily.time.slice(0, 5).map((date, i) => ({
          date,
          temp_min: Math.round(om.daily.temperature_2m_min[i]),
          temp_max: Math.round(om.daily.temperature_2m_max[i]),
          description: wmoDesc(om.daily.weather_code[i]),
          icon: wmoIcon(om.daily.weather_code[i]),
          pop: (om.daily.precipitation_probability_max[i] ?? 0) / 100,
        })),
      }
    }
  } catch {
    // Graceful fallback — weather widget shows placeholder
  }

  // ─── Deal analysis ────────────────────────────────────────────────────────
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

  const dealsClosingSoon = activeDeals.filter(deal => {
    const date = parseDate(deal.expected_close)
    return Boolean(date && date >= todayStart && date <= in14Days)
  })

  const dealsAtRisk = activeDeals
    .filter(deal => { const date = parseDate(deal.expected_close); return Boolean(date && date < todayStart) })
    .sort((a, b) => (parseDate(a.expected_close)?.getTime() ?? 0) - (parseDate(b.expected_close)?.getTime() ?? 0))

  const openQuotes = quotes.filter(quote => quoteWorkStatuses.has(quote.status))
  const approvedQuotes = quotes.filter(quote => quote.status === 'approved')
  const rejectedQuotes = quotes.filter(quote => quote.status === 'rejected')
  const expiredQuotes = quotes.filter(quote => quote.status === 'expired')
  const quoteApprovalBase = approvedQuotes.length + rejectedQuotes.length + expiredQuotes.length
  const quoteApprovalRate = quoteApprovalBase > 0 ? (approvedQuotes.length / quoteApprovalBase) * 100 : 0

  const openQuoteValue = openQuotes.reduce((total, quote) => total + (quote.total ?? 0), 0)
  const approvedQuoteValue = approvedQuotes.reduce((total, quote) => total + (quote.total ?? 0), 0)

  const quotesExpiringSoon = openQuotes.filter(quote => {
    const date = parseDate(quote.valid_until)
    return Boolean(date && date >= todayStart && date <= in7Days)
  })

  const quotesExpiredAttention = openQuotes.filter(quote => {
    const date = parseDate(quote.valid_until)
    return Boolean(date && date < todayStart)
  })

  const quoteQueue = [...quotesExpiredAttention, ...quotesExpiringSoon]
    .sort((a, b) => (parseDate(a.valid_until)?.getTime() ?? 0) - (parseDate(b.valid_until)?.getTime() ?? 0))
    .slice(0, 8)

  const pendingSignatureContracts = contracts
    .filter(contract => contractPendingSignatureStatuses.has(contract.status))
    .sort((a, b) =>
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
  const maxStageCount = Math.max(1, ...stageBreakdown.map(s => s.count))

  // Conversion rates between stages
  const stageConvRates = OPEN_STAGE_ORDER.map((stage, i) => {
    if (i === 0) return null
    const from = stageBreakdown[i - 1].count
    const to = stageBreakdown[i].count
    return from > 0 ? Math.round((to / from) * 100) : null
  })

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
        title="Dashboard"
        subtitle={
          profile
            ? `Bienvenido, ${profile.full_name}. Vista ejecutiva del estudio.`
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

      {/* ─── Section 1: 4 metric cards ──────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Pipeline Activo"
          value={formatInteger(activeDeals.length)}
          subtitle="oportunidades abiertas"
          icon={<CircleDollarSign className="h-5 w-5" />}
          href="/crm/kanban"
          details={[
            `Valor pipeline: ${formatCurrency(pipelineValue)}`,
            `Valor ponderado: ${formatCurrency(weightedPipelineValue)}`,
            `Prob. media: ${formatPercent(averageProbability)}`,
          ]}
        />
        <MetricCard
          title="Cotizaciones"
          value={formatInteger(openQuotes.length)}
          subtitle="en negociacion"
          icon={<FileClock className="h-5 w-5" />}
          href="/quotes"
          details={[
            `En negociacion: ${formatCurrency(openQuoteValue)}`,
            `Aprobacion: ${formatPercent(quoteApprovalRate)}`,
            `Por vencer 7d: ${formatInteger(quotesExpiringSoon.length)}`,
          ]}
        />
        <MetricCard
          title="Contratos"
          value={formatInteger(pendingSignatureContracts.length)}
          subtitle="pendientes de firma"
          icon={<FileSignature className="h-5 w-5" />}
          href="/contracts"
          details={[
            `Firmados: ${formatInteger(signedContracts.length)}`,
            `Tasa firma: ${formatPercent(contractSignatureRate)}`,
            `Flujos pendientes: ${formatInteger(pendingApprovalsCount ?? 0)}`,
          ]}
        />
        <MetricCard
          title="Proyectos"
          value={formatInteger(portfolioProjects.length)}
          subtitle="proyectos activos"
          icon={<FolderKanban className="h-5 w-5" />}
          href="/projects"
          details={[
            `Avance promedio: ${formatPercent(avgProjectProgress)}`,
            `Eventos prox. (7d): ${formatInteger(upcomingEventsCount ?? 0)}`,
            `Actividades vencidas: ${formatInteger(overdueActivitiesCount ?? 0)}`,
          ]}
        />
      </section>

      {/* ─── Section 2: Funnel + Salud + Proyectos ───────────────────────── */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[2fr_1fr]">
        {/* Conversion funnel */}
        <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-navy">Embudo de conversión</h2>
              <p className="text-sm text-gray-600">Distribución de oportunidades y tasas de conversión.</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.1em] text-brand-navy/70">Win Rate</p>
                <p className="text-lg font-semibold text-brand-navy">{formatPercent(winRate)}</p>
              </div>
              <div className="rounded-lg border border-brand-stone bg-brand-paper px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.1em] text-brand-navy/70">Cierra 14d</p>
                <p className="text-lg font-semibold text-brand-navy">{dealsClosingSoon.length}</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {stageBreakdown.map((stage, i) => (
              <div key={stage.stage}>
                {i > 0 && stageConvRates[i] !== null && (
                  <div className="flex items-center px-2 py-0.5">
                    <div className="h-px flex-1 border-dashed border-brand-stone/60" style={{ borderTopWidth: 1 }} />
                    <span className="mx-2 rounded-full bg-brand-canvas px-1.5 py-0.5 text-[10px] font-medium text-brand-navy/60">
                      {stageConvRates[i]}% conv.
                    </span>
                    <div className="h-px flex-1 border-dashed border-brand-stone/60" style={{ borderTopWidth: 1 }} />
                  </div>
                )}
                <div className="rounded-xl border border-brand-stone/70 bg-brand-paper/50 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-sm font-semibold text-brand-navy">{stage.label}</p>
                    <p className="text-xs text-gray-600">
                      {formatInteger(stage.count)} ops · {formatCurrency(stage.value)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-brand-stone/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-navy to-brand-gold"
                      style={{ width: `${stage.count === 0 ? 0 : Math.max(8, Math.round((stage.count / maxStageCount) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-brand-stone/70 bg-brand-paper/60 p-3">
              <p className="text-xs text-gray-500">Contactos totales</p>
              <p className="mt-1 text-xl font-semibold text-brand-navy">{formatInteger(contactsCount ?? 0)}</p>
            </div>
            <div className="rounded-lg border border-brand-stone/70 bg-brand-paper/60 p-3">
              <p className="text-xs text-gray-500">Valor aprobado</p>
              <p className="mt-1 text-xl font-semibold text-brand-navy">{formatCurrency(approvedQuoteValue)}</p>
            </div>
            <div className="rounded-lg border border-brand-stone/70 bg-brand-paper/60 p-3">
              <p className="text-xs text-gray-500">Ganados 30d</p>
              <p className="mt-1 text-xl font-semibold text-brand-navy">{formatInteger(wonLast30)}</p>
            </div>
          </div>
        </article>

        {/* Right column: Clima + Salud + Proyectos */}
        <div className="space-y-5">
          {/* Weather widget */}
          <WeatherWidget data={weatherData} />

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
                  Alertas críticas
                </span>
                <strong>{formatInteger(criticalAlerts)}</strong>
              </p>
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-amber-500" />
                  Alertas seguimiento
                </span>
                <strong>{formatInteger(warningAlerts)}</strong>
              </p>
              <p className="flex items-center justify-between rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <Handshake className="h-4 w-4 text-brand-navy" />
                  Ganados 30d
                </span>
                <strong>{formatInteger(wonLast30)}</strong>
              </p>
            </div>
          </article>

          {/* Projects progress */}
          <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-navy">Proyectos activos</h2>
              <Link
                href="/projects?view=portfolio"
                className="text-xs text-brand-navy/60 hover:text-brand-gold"
              >
                Ver todos →
              </Link>
            </div>
            <ProjectProgressPanel projects={portfolioProjects} />
          </article>
        </div>
      </section>

      {/* ─── Section 3: Rendimiento 30d ────────────────────────────────── */}
      <section className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
        <h2 className="mb-3 text-lg font-semibold text-brand-navy">Rendimiento últimos 30 días</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Valor cotizado', value: formatCurrency(quoteValueLast30) },
            { label: 'Valor aprobado', value: formatCurrency(approvedValueLast30) },
            { label: 'Contratos firmados', value: formatInteger(signedLast30) },
            { label: 'Cotizaciones emitidas', value: formatInteger(quotesLast30.length) },
          ].map(item => (
            <div key={item.label} className="rounded-lg border border-brand-stone/60 bg-brand-paper/50 p-3">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="mt-1 text-xl font-semibold text-brand-navy">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Section 4: Lists ─────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <article className="rounded-2xl border border-brand-stone/80 bg-white/85 p-5 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-navy">Cotizaciones por atender</h2>
            <span className="rounded-full bg-brand-paper px-2 py-1 text-xs font-medium text-brand-navy">{formatInteger(quoteQueue.length)}</span>
          </div>
          {quoteQueue.length === 0 ? (
            <p className="rounded-lg border border-brand-stone/60 bg-brand-paper/50 px-3 py-5 text-center text-sm text-gray-500">
              Sin cotizaciones urgentes.
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
                          ? 'Sin fecha'
                          : dayDelta < 0
                            ? `Vencida hace ${Math.abs(dayDelta)}d`
                            : dayDelta === 0
                              ? 'Vence hoy'
                              : `Vence en ${dayDelta}d`}
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
            <h2 className="text-lg font-semibold text-brand-navy">Contratos pendientes</h2>
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
              <h2 className="text-lg font-semibold text-brand-navy">Agenda 7 días</h2>
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
                Todo al corriente.
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

      {/* ─── Section 5: Risk pipeline ─────────────────────────────────── */}
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
                  <span>Cierre: {formatDate(deal.expected_close)}</span>
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

