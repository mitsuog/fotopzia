'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X, Mail, Phone, Building2, Briefcase, CalendarClock, ChevronRight, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ActivityFeed } from './ActivityFeed'
import { useDealActivities, useCreateActivity } from '@/hooks/useActivities'
import { useUpdateLostDetails, useReactivateDeal } from '@/hooks/useDeals'
import type { Deal, DealStage, LostDetails } from '@/types/crm'
import { useQuery } from '@tanstack/react-query'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  proposal: 'Propuesta',
  won: 'Confirmado',
  lost: 'Perdido',
}

const STAGE_COLORS: Record<DealStage, string> = {
  lead: 'bg-slate-100 text-slate-600',
  prospect: 'bg-blue-50 text-blue-700',
  proposal: 'bg-amber-50 text-amber-700',
  won: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-red-50 text-red-700',
}

function getInitials(firstName: string | undefined, lastName: string | undefined): string {
  return `${firstName?.[0] ?? '?'}${lastName?.[0] ?? ''}`.toUpperCase()
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTE_OPTIONS = ['00', '15', '30', '45'] as const

interface CalendarMetaUser {
  id: string
  full_name: string | null
  email: string | null
}

interface ActiveQuoteCandidate {
  id: string
  quote_number: string
  title: string
  status: 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired'
  updated_at: string
  deal_id: string | null
}

interface ActiveQuoteView extends ActiveQuoteCandidate {
  approval_status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'cancelled' | null
}

function buildIsoFromLocalParts(datePart?: string, hourPart?: string, minutePart?: string): string | undefined {
  if (!datePart || !hourPart || !minutePart) return undefined
  const parsed = new Date(`${datePart}T${hourPart}:${minutePart}:00`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

function pickActiveQuote(candidates: ActiveQuoteCandidate[], dealId: string): ActiveQuoteCandidate | null {
  if (!candidates.length) return null
  const inProgressStatuses: ActiveQuoteCandidate['status'][] = ['draft', 'sent', 'viewed']
  const byDealInProgress = candidates.find(quote => quote.deal_id === dealId && inProgressStatuses.includes(quote.status))
  if (byDealInProgress) return byDealInProgress

  const anyInProgress = candidates.find(quote => inProgressStatuses.includes(quote.status))
  if (anyInProgress) return anyInProgress

  const byDealApproved = candidates.find(quote => quote.deal_id === dealId && quote.status === 'approved')
  if (byDealApproved) return byDealApproved

  return candidates[0] ?? null
}

function quoteStatusLabel(status: ActiveQuoteCandidate['status']): string {
  switch (status) {
    case 'draft':
      return 'Borrador'
    case 'sent':
      return 'Enviada'
    case 'viewed':
      return 'Vista'
    case 'approved':
      return 'Aprobada'
    case 'rejected':
      return 'Rechazada'
    case 'expired':
      return 'Expirada'
    default:
      return status
  }
}

function flowStatusLabel(status: ActiveQuoteView['approval_status']): string {
  switch (status) {
    case 'pending':
      return 'Pendiente'
    case 'in_progress':
      return 'En aprobación'
    case 'approved':
      return 'Aprobada'
    case 'rejected':
      return 'Rechazada'
    case 'cancelled':
      return 'Cancelada'
    default:
      return 'Sin flujo'
  }
}

// Activity form
const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'task', 'note']),
  subject: z.string().min(1, 'El asunto es requerido'),
  start_date: z.string().optional(),
  start_hour: z.string().optional(),
  start_minute: z.enum(MINUTE_OPTIONS).optional(),
  end_hour: z.string().optional(),
  end_minute: z.enum(MINUTE_OPTIONS).optional(),
  assignee_user_id: z.string().optional(),
  body: z.string().optional(),
}).superRefine((values, context) => {
  const needsCalendarEvent = values.type === 'call' || values.type === 'meeting'
  if (!needsCalendarEvent) return

  if (!values.start_date) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['start_date'],
      message: 'Selecciona la fecha para agendar el seguimiento.',
    })
  }

  const startIso = buildIsoFromLocalParts(values.start_date, values.start_hour, values.start_minute)
  const endIso = buildIsoFromLocalParts(values.start_date, values.end_hour, values.end_minute)
  if (!startIso || !endIso) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_hour'],
      message: 'Selecciona hora de inicio y hora fin.',
    })
    return
  }

  if (new Date(endIso) <= new Date(startIso)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_hour'],
      message: 'La hora fin debe ser mayor a la hora de inicio.',
    })
  }
})
type ActivityForm = z.infer<typeof activitySchema>

function InlineActivityForm({ dealId, contactId, onDone }: { dealId: string; contactId: string; onDone: () => void }) {
  const createActivity = useCreateActivity()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['crm-calendar-meta-users'],
    queryFn: async () => {
      const response = await fetch('/api/crm-calendar/meta')
      const payload = await response.json().catch(() => ({ error: 'No fue posible cargar usuarios.' })) as {
        error?: string
        data?: { users?: CalendarMetaUser[] }
      }
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible cargar usuarios.')
      return payload.data?.users ?? []
    },
    staleTime: 1000 * 60 * 5,
  })

  const { register, control, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<ActivityForm>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: 'call',
      start_hour: '09',
      start_minute: '00',
      end_hour: '10',
      end_minute: '00',
      assignee_user_id: '',
    },
  })
  const activityType = useWatch({ control, name: 'type' })
  const createsCalendarEvent = activityType === 'call' || activityType === 'meeting'

  async function onSubmit(data: ActivityForm) {
    setSubmitError(null)
    const startAt = buildIsoFromLocalParts(data.start_date, data.start_hour, data.start_minute)
    const endAt = buildIsoFromLocalParts(data.start_date, data.end_hour, data.end_minute)

    try {
      await createActivity.mutateAsync({
        type: data.type,
        subject: data.subject,
        body: data.body,
        due_at: startAt,
        schedule_start_at: createsCalendarEvent ? startAt : undefined,
        schedule_end_at: createsCalendarEvent ? endAt : undefined,
        assignee_user_ids: data.assignee_user_id ? [data.assignee_user_id] : [],
        deal_id: dealId,
        contact_id: contactId,
      })
      reset({
        type: 'call',
        subject: '',
        body: '',
        start_date: '',
        start_hour: '09',
        start_minute: '00',
        end_hour: '10',
        end_minute: '00',
        assignee_user_id: '',
      })
      onDone()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible guardar la actividad.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-brand-stone bg-brand-paper p-3 space-y-2 mt-2">
      <div className="flex gap-2">
        <select
          {...register('type')}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        >
          <option value="call">Llamada</option>
          <option value="email">Email</option>
          <option value="meeting">Reunión</option>
          <option value="task">Tarea</option>
          <option value="note">Nota</option>
        </select>
      </div>
      <input
        {...register('subject')}
        type="text"
        placeholder="Asunto..."
        className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
      />
      {errors.subject && <p className="text-xs text-red-500">{errors.subject.message}</p>}
      <textarea
        {...register('body')}
        rows={2}
        placeholder="Notas (opcional)..."
        className="w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          {...register('start_date')}
          type="date"
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        />
        <div className="grid grid-cols-2 gap-2">
          <select {...register('start_hour')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
            {HOUR_OPTIONS.map(hour => <option key={hour} value={hour}>{hour}</option>)}
          </select>
          <select {...register('start_minute')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
            {MINUTE_OPTIONS.map(minute => <option key={minute} value={minute}>{minute}</option>)}
          </select>
        </div>
      </div>
      {createsCalendarEvent && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <p className="text-[11px] text-gray-500">Hora fin</p>
            <div className="grid grid-cols-2 gap-2">
              <select {...register('end_hour')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
                {HOUR_OPTIONS.map(hour => <option key={hour} value={hour}>{hour}</option>)}
              </select>
              <select {...register('end_minute')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
                {MINUTE_OPTIONS.map(minute => <option key={minute} value={minute}>{minute}</option>)}
              </select>
            </div>
          </div>
          <select
            {...register('assignee_user_id')}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          >
            <option value="">Responsable: yo (por defecto)</option>
            {assignableUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.email ?? user.id}
              </option>
            ))}
          </select>
        </>
      )}
      {errors.start_date && <p className="text-xs text-red-500">{errors.start_date.message}</p>}
      {errors.end_hour && <p className="text-xs text-red-500">{errors.end_hour.message}</p>}
      {submitError && <p className="text-xs text-red-500">{submitError}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="flex-1 rounded-md bg-brand-navy px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light disabled:opacity-50">
          Guardar
        </button>
      </div>
    </form>
  )
}

// Lost capture inline form
const lostSchema = z.object({
  lost_reason: z.enum(['precio', 'competencia', 'sin_presupuesto', 'sin_respuesta', 'otro']),
  lost_stage: z.enum(['lead', 'prospect', 'proposal']),
  lost_notes: z.string().optional(),
})
type LostForm = z.infer<typeof lostSchema>

function InlineLostForm({ dealId, onDone }: { dealId: string; onDone: () => void }) {
  const updateLost = useUpdateLostDetails()
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LostForm>({
    resolver: zodResolver(lostSchema),
    defaultValues: { lost_reason: 'precio', lost_stage: 'prospect' },
  })

  async function onSubmit(data: LostForm) {
    await updateLost.mutateAsync({ dealId, details: data as LostDetails })
    onDone()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
      <p className="text-xs font-semibold text-red-700">Registrar pérdida</p>
      <select {...register('lost_reason')} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300">
        <option value="precio">Precio</option>
        <option value="competencia">Competencia</option>
        <option value="sin_presupuesto">Sin presupuesto</option>
        <option value="sin_respuesta">Sin respuesta</option>
        <option value="otro">Otro</option>
      </select>
      <select {...register('lost_stage')} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300">
        <option value="lead">Lead</option>
        <option value="prospect">Prospecto</option>
        <option value="proposal">Propuesta</option>
      </select>
      <textarea {...register('lost_notes')} rows={2} placeholder="Notas adicionales (opcional)..." className="w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none" />
      <button type="submit" disabled={isSubmitting} className="w-full rounded-md bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">
        Registrar pérdida
      </button>
    </form>
  )
}

// Actions tab per stage
function ActionsTab({ deal, onStageChange, onClose }: { deal: Deal; onStageChange: (s: DealStage) => void; onClose: () => void }) {
  const [showActivityForm, setShowActivityForm] = useState(false)
  const reactivate = useReactivateDeal()
  const { data: recentActivities = [] } = useDealActivities(deal.id)
  const { data: activeQuote } = useQuery({
    queryKey: ['deal-active-quote', deal.id, deal.contact_id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, title, status, updated_at, deal_id')
        .eq('contact_id', deal.contact_id)
        .in('status', ['draft', 'sent', 'viewed', 'approved'])
        .order('updated_at', { ascending: false })
        .limit(20)
      if (error) throw error
      const selected = pickActiveQuote((data ?? []) as ActiveQuoteCandidate[], deal.id)
      if (!selected) return null

      const { data: latestFlow } = await supabase
        .from('approval_flows')
        .select('status')
        .eq('entity_type', 'quote')
        .eq('entity_id', selected.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return {
        ...selected,
        approval_status: (latestFlow?.status ?? null) as ActiveQuoteView['approval_status'],
      }
    },
    staleTime: 1000 * 60,
  })

  if (deal.stage === 'lead' || deal.stage === 'prospect') {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setShowActivityForm(v => !v)}
          className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-left text-sm font-medium text-brand-navy hover:bg-brand-paper transition-colors"
        >
          + Agregar seguimiento / actividad
        </button>
        {showActivityForm && deal.contact_id && (
          <InlineActivityForm dealId={deal.id} contactId={deal.contact_id} onDone={() => setShowActivityForm(false)} />
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Últimas actividades</p>
          <ActivityFeed activities={recentActivities.slice(0, 3)} />
        </div>
        {deal.stage === 'prospect' && (
          <button
            onClick={() => onStageChange('proposal')}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Mover a Propuesta <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  if (deal.stage === 'proposal') {
    return (
      <div className="space-y-3">
        {activeQuote ? (
          <div className="rounded-lg border border-brand-stone bg-brand-paper p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cotización activa</p>
            <p className="text-sm font-semibold text-brand-navy">{activeQuote.quote_number}</p>
            <p className="text-xs text-gray-600">{activeQuote.title}</p>
            <p className="text-xs text-gray-500">Estado: {quoteStatusLabel(activeQuote.status)}</p>
            <p className="text-xs text-gray-500">Workflow: {flowStatusLabel(activeQuote.approval_status)}</p>
            <Link
              href={`/quotes/${activeQuote.id}`}
              onClick={onClose}
              className="flex w-full items-center justify-center rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas transition-colors"
            >
              Revisar y tomar acciones WF
            </Link>
          </div>
        ) : (
          <Link
            href={`/quotes/new?dealId=${deal.id}&contactId=${deal.contact_id}`}
            onClick={onClose}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light transition-colors"
          >
            + Crear Cotización
          </Link>
        )}
        <Link
          href={`/contracts/new?dealId=${deal.id}`}
          onClick={onClose}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm font-medium text-brand-navy hover:bg-brand-paper transition-colors"
        >
          + Agregar Contrato
        </Link>
        <button
          onClick={() => setShowActivityForm(v => !v)}
          className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-left text-sm font-medium text-brand-navy hover:bg-brand-paper transition-colors"
        >
          + Agregar seguimiento
        </button>
        {showActivityForm && deal.contact_id && (
          <InlineActivityForm dealId={deal.id} contactId={deal.contact_id} onDone={() => setShowActivityForm(false)} />
        )}
        <button
          onClick={() => onStageChange('won')}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
        >
          Confirmar Deal <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  if (deal.stage === 'won') {
    return (
      <div className="space-y-3">
        <Link
          href={`/projects?dealId=${deal.id}`}
          onClick={onClose}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white hover:bg-brand-navy-light transition-colors"
        >
          Abrir Proyecto <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Deal confirmado. El proyecto fue provisionado automáticamente.
        </div>
      </div>
    )
  }

  if (deal.stage === 'lost') {
    return (
      <div className="space-y-3">
        {deal.lost_reason ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1 text-sm">
            <p className="font-semibold text-red-700">Deal perdido</p>
            <p className="text-gray-700"><span className="font-medium">Motivo:</span> {deal.lost_reason}</p>
            {deal.lost_stage && <p className="text-gray-700"><span className="font-medium">Etapa:</span> {deal.lost_stage}</p>}
            {deal.lost_notes && <p className="text-gray-600 italic">{deal.lost_notes}</p>}
          </div>
        ) : (
          <InlineLostForm dealId={deal.id} onDone={() => {}} />
        )}
        <button
          onClick={async () => { await reactivate.mutateAsync(deal.id); onClose() }}
          disabled={reactivate.isPending}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm font-medium text-brand-navy hover:bg-brand-paper transition-colors disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reactivar como Lead
        </button>
      </div>
    )
  }

  return null
}

// Main panel
interface DealDetailPanelProps {
  open: boolean
  deal: Deal | null
  onClose: () => void
  onStageChange: (stage: DealStage) => void
}

export function DealDetailPanel({ open, deal, onClose, onStageChange }: DealDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'actions' | 'activity'>('actions')
  const { data: allActivities = [] } = useDealActivities(deal?.id)

  if (!open || !deal) return null

  const contact = deal.contact
  const fullName = contact ? `${contact.first_name} ${contact.last_name}` : 'Sin contacto'
  const initials = getInitials(contact?.first_name, contact?.last_name)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/35" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-brand-stone bg-white shadow-2xl">
        {/* Header */}
        <header className="flex items-start justify-between border-b border-brand-stone px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-base font-semibold text-brand-navy">{deal.title}</h2>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[deal.stage])}>
                {STAGE_LABELS[deal.stage]}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 shrink-0 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {/* Contact card */}
          <section className="border-b border-brand-stone px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-navy">{fullName}</p>
                <p className="truncate text-xs text-gray-500">{contact?.company_name || 'Sin empresa'}</p>
              </div>
              <Link
                href={`/crm/${deal.contact_id}`}
                onClick={onClose}
                className="shrink-0 rounded-md border border-brand-stone px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Ver perfil
              </Link>
            </div>
            <div className="mt-3 space-y-1.5">
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-brand-navy hover:underline">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  {contact.email}
                </a>
              )}
              {contact?.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-gray-600">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  {contact.phone}
                </a>
              )}
              {contact?.company_name && (
                <p className="flex items-center gap-2 text-xs text-gray-600">
                  <Building2 className="h-3.5 w-3.5 text-gray-400" />
                  {contact.company_name}
                </p>
              )}
            </div>
          </section>

          {/* Deal meta */}
          <section className="border-b border-brand-stone px-5 py-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
              <span className="flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-gray-400" />
                {deal.value ? `$${Number(deal.value).toLocaleString('es-MX')} ${deal.currency}` : 'Sin valor'}
              </span>
              {deal.expected_close && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
                  {format(new Date(deal.expected_close), 'd MMM yyyy', { locale: es })}
                </span>
              )}
            </div>
            {deal.notes && (
              <p className="mt-2 rounded-md bg-brand-paper px-3 py-2 text-xs text-gray-600 italic">{deal.notes}</p>
            )}
          </section>

          {/* Tabs */}
          <div className="flex border-b border-brand-stone">
            {(['actions', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 px-4 py-2.5 text-xs font-semibold transition-colors',
                  activeTab === tab
                    ? 'border-b-2 border-brand-gold text-brand-navy'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {tab === 'actions' ? 'Acciones' : 'Actividad'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">
            {activeTab === 'actions' ? (
              <ActionsTab deal={deal} onStageChange={onStageChange} onClose={onClose} />
            ) : (
              <ActivityFeed activities={allActivities} />
            )}
          </div>
        </div>
      </aside>
    </>
  )
}

