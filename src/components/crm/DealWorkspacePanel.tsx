'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, ChevronRight, ExternalLink, FileText, RotateCcw, ScrollText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ActivityFeed } from '@/components/crm/ActivityFeed'
import { InlineActivityForm } from '@/components/crm/InlineActivityForm'
import { useDealActivities } from '@/hooks/useActivities'
import type { Deal, DealStage } from '@/types/crm'

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  proposal: 'Propuesta',
  won: 'Confirmado',
  lost: 'Perdido',
}

const STAGE_BADGES: Record<DealStage, string> = {
  lead: 'bg-slate-100 text-slate-700',
  prospect: 'bg-blue-100 text-blue-700',
  proposal: 'bg-amber-100 text-amber-700',
  won: 'bg-emerald-100 text-emerald-700',
  lost: 'bg-red-100 text-red-700',
}

const STAGE_OPTIONS: DealStage[] = ['lead', 'prospect', 'proposal', 'won', 'lost']

interface DealWorkspacePanelProps {
  deal: Deal
  onClose?: () => void
  initialOpenFollowupComposer?: boolean
  onStageChange: (stage: DealStage) => void
  onReactivate: () => Promise<void> | void
}

interface LatestQuote {
  id: string
  quote_number: string
  title: string
}

interface LatestContract {
  id: string
  contract_number: string
  title: string
}

export function DealWorkspacePanel({
  deal,
  onClose,
  initialOpenFollowupComposer = false,
  onStageChange,
  onReactivate,
}: DealWorkspacePanelProps) {
  const [showActivityForm, setShowActivityForm] = useState(initialOpenFollowupComposer)
  const { data: activities = [] } = useDealActivities(deal.id)

  const { data: latestQuote } = useQuery({
    queryKey: ['crm-workspace-latest-quote', deal.id, deal.contact_id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, title, updated_at')
        .eq('contact_id', deal.contact_id)
        .eq('deal_id', deal.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as LatestQuote | null
    },
    staleTime: 60_000,
  })

  const { data: latestContract } = useQuery({
    queryKey: ['crm-workspace-latest-contract', deal.id, deal.contact_id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contracts')
        .select('id, contract_number, title, updated_at')
        .eq('contact_id', deal.contact_id)
        .neq('status', 'voided')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as LatestContract | null
    },
    staleTime: 60_000,
  })

  const contactName = deal.contact
    ? `${deal.contact.first_name} ${deal.contact.last_name}`.trim()
    : 'Sin contacto'

  function renderStageAction() {
    if (deal.stage === 'lead' || deal.stage === 'prospect') {
      return (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowActivityForm(value => !value)}
            className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-left text-xs font-medium text-brand-navy hover:bg-brand-paper"
          >
            Crear seguimiento
          </button>

          {deal.stage === 'prospect' && (
            <button
              type="button"
              onClick={() => onStageChange('proposal')}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
            >
              Mover a propuesta
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }

    if (deal.stage === 'proposal') {
      return (
        <div className="space-y-2">
          <Link
            href={`/quotes/new?contactId=${deal.contact_id}&dealId=${deal.id}`}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-brand-stone bg-white px-3 py-2 text-xs font-medium text-brand-navy hover:bg-brand-paper"
          >
            <FileText className="h-3.5 w-3.5" />
            Crear cotizacion
          </Link>
          <button
            type="button"
            onClick={() => onStageChange('won')}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Marcar como confirmado
          </button>
          <button
            type="button"
            onClick={() => onStageChange('lost')}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            Marcar como perdido
          </button>
        </div>
      )
    }

    if (deal.stage === 'won') {
      return (
        <div className="space-y-2">
          <Link
            href={`/contracts/new?contactId=${deal.contact_id}&dealId=${deal.id}`}
            className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
          >
            <ScrollText className="h-3.5 w-3.5" />
            Crear contrato
          </Link>
        </div>
      )
    }

    return (
      <button
        type="button"
        onClick={() => void onReactivate()}
        className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-brand-stone bg-white px-3 py-2 text-xs font-medium text-brand-navy hover:bg-brand-paper"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reactivar como lead
      </button>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-brand-stone/70 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-brand-navy">{deal.title}</p>
            <p className="truncate text-xs text-gray-500">{contactName}</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-brand-stone px-2 py-1 text-[11px] text-gray-600 hover:bg-brand-paper"
            >
              Cerrar
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <section className="rounded-xl border border-brand-stone/80 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_BADGES[deal.stage]}`}>
              {STAGE_LABELS[deal.stage]}
            </span>
            <select
              value={deal.stage}
              onChange={event => onStageChange(event.target.value as DealStage)}
              className="rounded-md border border-brand-stone bg-white px-2 py-1 text-[11px] text-brand-navy"
            >
              {STAGE_OPTIONS.map(stage => (
                <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 text-xs text-gray-600">
            <p>Valor: {deal.value ? `$${Number(deal.value).toLocaleString('es-MX')} ${deal.currency}` : 'Sin valor'}</p>
            {deal.expected_close && (
              <p className="inline-flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5 text-gray-400" />
                Cierre: {new Date(deal.expected_close).toLocaleDateString('es-MX')}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-brand-stone/80 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Siguiente accion</p>
          {renderStageAction()}
          {showActivityForm && (
            <InlineActivityForm
              contactId={deal.contact_id}
              dealId={deal.id}
              onDone={() => setShowActivityForm(false)}
            />
          )}
        </section>

        <section className="rounded-xl border border-brand-stone/80 bg-white p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Documentos</p>
          {latestQuote ? (
            <Link href={`/quotes/${latestQuote.id}`} className="inline-flex w-full items-center justify-between rounded-md border border-brand-stone bg-brand-paper px-2.5 py-1.5 text-xs text-brand-navy hover:bg-brand-canvas">
              <span className="truncate">Cotizacion {latestQuote.quote_number}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <p className="text-xs text-gray-500">Sin cotizacion vinculada.</p>
          )}

          {latestContract ? (
            <Link href={`/contracts/${latestContract.id}`} className="inline-flex w-full items-center justify-between rounded-md border border-brand-stone bg-brand-paper px-2.5 py-1.5 text-xs text-brand-navy hover:bg-brand-canvas">
              <span className="truncate">Contrato {latestContract.contract_number}</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <p className="text-xs text-gray-500">Sin contrato activo.</p>
          )}

          <Link href={`/crm/${deal.contact_id}`} className="inline-flex w-full items-center justify-between rounded-md border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy hover:bg-brand-paper">
            <span>Abrir contexto completo del contacto</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="rounded-xl border border-brand-stone/80 bg-white p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Actividad reciente</p>
          <ActivityFeed activities={activities.slice(0, 6)} />
        </section>
      </div>
    </div>
  )
}
