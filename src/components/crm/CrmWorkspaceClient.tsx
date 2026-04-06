'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { AlertTriangle, BarChart3, CalendarClock, LayoutList, Plus, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KanbanColumn } from '@/components/crm/KanbanColumn'
import { KanbanCard } from '@/components/crm/KanbanCard'
import { LostReasonDialog } from '@/components/crm/LostReasonDialog'
import { NewContactSheet } from '@/components/crm/NewContactSheet'
import { NewDealSheet } from '@/components/crm/NewDealSheet'
import { DealWorkspacePanel } from '@/components/crm/DealWorkspacePanel'
import { SavedViewsBar } from '@/components/workspace/SavedViewsBar'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { EmptyState } from '@/components/ui/EmptyState'
import { useDeals, useReactivateDeal, useUpdateDealStage, useUpdateLostDetails } from '@/hooks/useDeals'
import type { Deal, DealStage, LostDetails } from '@/types/crm'
import type { CrmWorkspaceQuery } from '@/types/workspace'

const STAGES: DealStage[] = ['lead', 'prospect', 'proposal', 'won', 'lost']

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

type WorkspaceView = 'kanban' | 'list'

type DealFollowupRow = {
  deal_id: string | null
  due_at: string | null
  created_at: string
}

interface ProfileOption {
  id: string
  full_name: string | null
  email: string | null
}

interface CrmWorkspaceClientProps {
  initialDeals: Deal[]
  profiles: ProfileOption[]
}

function parseQuery(params: URLSearchParams): CrmWorkspaceQuery {
  const view = params.get('view')
  const stage = params.get('stage')

  return {
    view: view === 'list' ? 'list' : 'kanban',
    q: params.get('q') ?? undefined,
    stage: STAGES.includes(stage as DealStage) ? (stage as DealStage) : 'all',
    assignee: params.get('assignee') ?? undefined,
    deal: params.get('deal') ?? undefined,
    panel: params.get('panel') === '1' ? '1' : '0',
  }
}

function formatFollowupLabel(dueAt: string | null): string {
  if (!dueAt) return 'Sin fecha definida'

  const dueMs = new Date(dueAt).getTime()
  if (Number.isNaN(dueMs)) return 'Sin fecha definida'

  const now = new Date().getTime()
  const diffDays = Math.floor((dueMs - now) / 86400000)
  if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)}d`
  if (diffDays === 0) return 'Vence hoy'
  return `Vence en ${diffDays}d`
}

export function CrmWorkspaceClient({ initialDeals, profiles }: CrmWorkspaceClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const { data: deals = initialDeals } = useDeals()
  const updateStage = useUpdateDealStage()
  const updateLostDetails = useUpdateLostDetails()
  const reactivateDeal = useReactivateDeal()

  const { data: followupRows = [] } = useQuery({
    queryKey: ['crm-workspace-followups'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('activities')
        .select('deal_id, due_at, created_at')
        .eq('completed', false)
        .not('deal_id', 'is', null)
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(400)

      if (error) throw error
      return (data ?? []) as DealFollowupRow[]
    },
    staleTime: 30_000,
  })

  const initialQuery = parseQuery(new URLSearchParams(searchParams.toString()))

  const [view, setView] = useState<WorkspaceView>(initialQuery.view ?? 'kanban')
  const [query, setQuery] = useState(initialQuery.q ?? '')
  const [stageFilter, setStageFilter] = useState<DealStage | 'all'>((initialQuery.stage as DealStage | 'all') ?? 'all')
  const [assigneeFilter, setAssigneeFilter] = useState(initialQuery.assignee ?? '')
  const [selectedDealId, setSelectedDealId] = useState(initialQuery.deal ?? '')
  const [panelOpen, setPanelOpen] = useState(initialQuery.panel === '1' && Boolean(initialQuery.deal))

  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [pendingLostDealId, setPendingLostDealId] = useState<string | null>(null)
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [panelSession, setPanelSession] = useState(0)
  const [panelInitialFollowup, setPanelInitialFollowup] = useState(false)

  const [isNewDealOpen, setIsNewDealOpen] = useState(searchParams.get('newDeal') === '1')
  const [isNewContactOpen, setIsNewContactOpen] = useState(searchParams.get('newContact') === '1')
  const [newDealStage, setNewDealStage] = useState<DealStage>('prospect')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const followupByDeal = useMemo(() => {
    const map = new Map<string, { nextDueAt: string | null; openCount: number; latestActivityAt: string }>()

    for (const row of followupRows) {
      if (!row.deal_id) continue
      const current = map.get(row.deal_id)
      if (!current) {
        map.set(row.deal_id, {
          nextDueAt: row.due_at,
          openCount: 1,
          latestActivityAt: row.created_at,
        })
        continue
      }

      const hasEarlierDue = row.due_at && (!current.nextDueAt || new Date(row.due_at).getTime() < new Date(current.nextDueAt).getTime())
      map.set(row.deal_id, {
        nextDueAt: hasEarlierDue ? row.due_at : current.nextDueAt,
        openCount: current.openCount + 1,
        latestActivityAt: new Date(row.created_at).getTime() > new Date(current.latestActivityAt).getTime()
          ? row.created_at
          : current.latestActivityAt,
      })
    }

    return map
  }, [followupRows])

  const selectedDeal = useMemo(
    () => deals.find(deal => deal.id === selectedDealId) ?? null,
    [deals, selectedDealId],
  )
  const isPanelVisible = panelOpen && Boolean(selectedDeal)

  useEffect(() => {
    const params = new URLSearchParams()
    if (view !== 'kanban') params.set('view', view)
    if (query.trim()) params.set('q', query.trim())
    if (stageFilter !== 'all') params.set('stage', stageFilter)
    if (assigneeFilter) params.set('assignee', assigneeFilter)
    if (isPanelVisible && selectedDealId) {
      params.set('deal', selectedDealId)
      params.set('panel', '1')
    }

    const next = params.toString()
    const current = searchParams.toString()
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [assigneeFilter, isPanelVisible, pathname, query, router, searchParams, selectedDealId, stageFilter, view])

  const filteredDeals = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return deals.filter(deal => {
      if (stageFilter !== 'all' && deal.stage !== stageFilter) return false
      if (assigneeFilter && deal.assigned_to !== assigneeFilter) return false

      if (normalized) {
        const contact = deal.contact ? `${deal.contact.first_name} ${deal.contact.last_name}`.toLowerCase() : ''
        const fields = [deal.title.toLowerCase(), contact]
        if (!fields.some(field => field.includes(normalized))) return false
      }

      return true
    })
  }, [assigneeFilter, deals, query, stageFilter])

  const todayQueue = useMemo(() => {
    const nowDate = new Date()
    const now = nowDate.getTime()
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    const endOfDayMs = endOfDay.getTime()

    return deals
      .filter(deal => deal.stage !== 'won' && deal.stage !== 'lost')
      .map(deal => {
        const followup = followupByDeal.get(deal.id)
        const dueMs = followup?.nextDueAt ? new Date(followup.nextDueAt).getTime() : null

        const isOverdue = dueMs !== null && !Number.isNaN(dueMs) && dueMs < now
        const isDueToday = dueMs !== null && !Number.isNaN(dueMs) && dueMs >= now && dueMs <= endOfDayMs
        const missingFollowup = !followup

        const priority = isOverdue ? 0 : isDueToday ? 1 : missingFollowup ? 2 : 3

        return {
          deal,
          followup,
          dueAt: followup?.nextDueAt ?? null,
          priority,
          tone: isOverdue ? 'danger' : isDueToday ? 'warning' : missingFollowup ? 'neutral' : 'ok',
          label: isOverdue
            ? 'Seguimiento vencido'
            : isDueToday
              ? 'Seguimiento hoy'
              : missingFollowup
                ? 'Sin seguimiento'
                : 'En seguimiento',
        }
      })
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER
        return aDue - bDue
      })
      .slice(0, 6)
  }, [deals, followupByDeal])

  const hasFilters = Boolean(query.trim() || stageFilter !== 'all' || assigneeFilter)

  const currentQueryString = useMemo(() => {
    const params = new URLSearchParams()
    if (view !== 'kanban') params.set('view', view)
    if (query.trim()) params.set('q', query.trim())
    if (stageFilter !== 'all') params.set('stage', stageFilter)
    if (assigneeFilter) params.set('assignee', assigneeFilter)
    if (isPanelVisible && selectedDealId) {
      params.set('deal', selectedDealId)
      params.set('panel', '1')
    }
    return params.toString()
  }, [assigneeFilter, isPanelVisible, query, selectedDealId, stageFilter, view])

  function applySavedQuery(saved: string) {
    const parsed = parseQuery(new URLSearchParams(saved))
    setView(parsed.view ?? 'kanban')
    setQuery(parsed.q ?? '')
    setStageFilter((parsed.stage as DealStage | 'all') ?? 'all')
    setAssigneeFilter(parsed.assignee ?? '')
    setSelectedDealId(parsed.deal ?? '')
    setPanelOpen(parsed.panel === '1' && Boolean(parsed.deal))
  }

  function openDealPanel(dealId: string, options?: { focusFollowup?: boolean }) {
    setSelectedDealId(dealId)
    setPanelOpen(true)
    setPanelInitialFollowup(Boolean(options?.focusFollowup))
    setPanelSession(value => value + 1)
  }

  function closePanel() {
    setPanelOpen(false)
    setPanelInitialFollowup(false)
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null)
    setWorkspaceError(null)

    const { active, over } = event
    if (!over) return

    const dealId = active.id as string
    const targetStage = over.id as DealStage
    if (!STAGES.includes(targetStage)) return

    const deal = deals.find(item => item.id === dealId)
    if (!deal || deal.stage === targetStage) return

    if (targetStage === 'lost') {
      setPendingLostDealId(dealId)
      return
    }

    updateStage.mutate(
      { dealId, stage: targetStage },
      {
        onError: error => {
          const message = error instanceof Error ? error.message : 'No fue posible mover el deal.'
          setWorkspaceError(message)
        },
      },
    )
  }

  function handleStageChange(stage: DealStage) {
    if (!selectedDeal) return
    setWorkspaceError(null)

    if (stage === 'lost') {
      setPendingLostDealId(selectedDeal.id)
      return
    }

    updateStage.mutate(
      { dealId: selectedDeal.id, stage },
      {
        onError: error => {
          const message = error instanceof Error ? error.message : 'No fue posible actualizar etapa.'
          setWorkspaceError(message)
        },
      },
    )
  }

  async function handleLostConfirm(details: LostDetails) {
    if (!pendingLostDealId) return

    await updateLostDetails.mutateAsync({ dealId: pendingLostDealId, details }).catch(error => {
      const message = error instanceof Error ? error.message : 'No fue posible registrar la perdida.'
      setWorkspaceError(message)
    })

    setPendingLostDealId(null)
  }

  async function handleReactivate() {
    if (!selectedDeal) return
    setWorkspaceError(null)

    await reactivateDeal.mutateAsync(selectedDeal.id).catch(error => {
      const message = error instanceof Error ? error.message : 'No fue posible reactivar el deal.'
      setWorkspaceError(message)
    })
  }

  function handleNewFromStage(stage: DealStage) {
    if (stage === 'lead') {
      setIsNewContactOpen(true)
      return
    }
    setNewDealStage(stage === 'prospect' ? 'prospect' : 'proposal')
    setIsNewDealOpen(true)
  }

  const activeDeal = activeDragId ? deals.find(deal => deal.id === activeDragId) : null
  const tableNowMs = new Date().getTime()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex overflow-hidden rounded-lg border border-brand-stone text-xs">
          <button
            type="button"
            onClick={() => setView('kanban')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-medium ${view === 'kanban' ? 'bg-brand-navy text-white' : 'bg-white text-brand-navy hover:bg-brand-paper'}`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 font-medium ${view === 'list' ? 'bg-brand-navy text-white' : 'bg-white text-brand-navy hover:bg-brand-paper'}`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Lista
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setNewDealStage('prospect')
              setIsNewDealOpen(true)
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy-light"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear deal
          </button>
          <Link
            href="/crm/list?newContact=1"
            className="inline-flex items-center gap-1 rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear contacto
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-stone/80 bg-white/80 p-2">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            id="crm-workspace-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar deal o contacto..."
            className="w-full rounded-lg border border-brand-stone bg-white py-1.5 pl-8 pr-2.5 text-xs text-brand-navy"
          />
        </div>

        <span className="inline-flex items-center gap-1 rounded-md border border-brand-stone bg-brand-paper px-2 py-1 text-[11px] text-brand-navy">
          <AlertTriangle className="h-3 w-3" /> Filtros
        </span>

        <select
          value={stageFilter}
          onChange={event => setStageFilter(event.target.value as DealStage | 'all')}
          className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy"
        >
          <option value="all">Todas las etapas</option>
          {STAGES.map(stage => (
            <option key={stage} value={stage}>{STAGE_LABELS[stage]}</option>
          ))}
        </select>

        <select
          value={assigneeFilter}
          onChange={event => setAssigneeFilter(event.target.value)}
          className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy"
        >
          <option value="">Todos los responsables</option>
          {profiles.map(profile => (
            <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setStageFilter('all')
              setAssigneeFilter('')
            }}
            className="rounded-md border border-brand-stone bg-white px-2 py-1 text-[11px] text-brand-navy hover:bg-brand-paper"
          >
            Limpiar
          </button>
        )}
      </div>

      <SavedViewsBar
        module="crm"
        currentQuery={currentQueryString}
        onApplyQuery={applySavedQuery}
      />

      {todayQueue.length > 0 && (
        <section className="rounded-xl border border-brand-stone/80 bg-white/85 p-3 shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)]">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Siguientes acciones hoy</p>
              <p className="text-sm text-brand-navy">Prioriza seguimiento vencido, hoy o sin actividad.</p>
            </div>
            <Link href="/crm-calendar" className="text-xs font-medium text-brand-navy hover:text-brand-gold">
              Ver agenda CRM
            </Link>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {todayQueue.map(item => {
              const toneClass = item.tone === 'danger'
                ? 'bg-red-50 text-red-700 border-red-200'
                : item.tone === 'warning'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : item.tone === 'neutral'
                    ? 'bg-slate-50 text-slate-700 border-slate-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'

              return (
                <div key={item.deal.id} className="rounded-lg border border-brand-stone/70 bg-brand-paper/40 p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-navy">{item.deal.title}</p>
                      <p className="truncate text-xs text-gray-500">
                        {item.deal.contact ? `${item.deal.contact.first_name} ${item.deal.contact.last_name}` : 'Sin contacto'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass}`}>
                      {item.label}
                    </span>
                  </div>

                  <div className="mb-2 flex items-center gap-1 text-[11px] text-gray-600">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {formatFollowupLabel(item.dueAt)}
                    {item.followup && <span>· {item.followup.openCount} pendientes</span>}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => openDealPanel(item.deal.id)}
                      className="rounded-md border border-brand-stone bg-white px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-paper"
                    >
                      Abrir deal
                    </button>
                    <button
                      type="button"
                      onClick={() => openDealPanel(item.deal.id, { focusFollowup: true })}
                      className="rounded-md border border-brand-stone bg-brand-paper px-2 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-canvas"
                    >
                      Crear seguimiento
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {workspaceError && (
        <InlineAlert
          variant="warning"
          title="Operacion incompleta"
          description={workspaceError}
        />
      )}

      <div className={`grid gap-4 ${isPanelVisible ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'}`}>
        <div className="min-w-0">
          {filteredDeals.length === 0 ? (
            <EmptyState
              title="No hay deals para este filtro"
              description="Ajusta filtros o crea un nuevo deal para comenzar seguimiento."
              ctaLabel="Crear deal"
              ctaHref="/crm?newDeal=1"
            />
          ) : view === 'kanban' ? (
            <div className="overflow-x-auto">
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex min-h-[520px] gap-3 pb-2">
                  {STAGES.map(stage => (
                    <KanbanColumn
                      key={stage}
                      stage={stage}
                      deals={filteredDeals.filter(deal => deal.stage === stage)}
                      onAddDeal={handleNewFromStage}
                      onCardClick={deal => openDealPanel(deal.id)}
                    />
                  ))}
                </div>

                <DragOverlay>
                  {activeDeal ? <KanbanCard deal={activeDeal} isDragOverlay /> : null}
                </DragOverlay>
              </DndContext>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-brand-stone/80 bg-white/80 shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-brand-stone bg-brand-canvas/80">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Deal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Contacto</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Etapa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Seguimiento</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Valor</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Cierre</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-brand-navy">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeals.map(deal => {
                      const followup = followupByDeal.get(deal.id)
                      const dueMs = followup?.nextDueAt ? new Date(followup.nextDueAt).getTime() : null
                      const isOverdue = dueMs !== null && !Number.isNaN(dueMs) && dueMs < tableNowMs

                      return (
                        <tr key={deal.id} className="border-b border-brand-stone/50 last:border-0 hover:bg-brand-canvas/40">
                          <td className="px-4 py-3 text-sm font-medium text-brand-navy">{deal.title}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {deal.contact ? `${deal.contact.first_name} ${deal.contact.last_name}` : 'Sin contacto'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_BADGES[deal.stage]}`}>
                              {STAGE_LABELS[deal.stage]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${isOverdue ? 'bg-red-100 text-red-700' : followup ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>
                              {followup ? formatFollowupLabel(followup.nextDueAt) : 'Sin seguimiento'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-700">
                            {deal.value ? `$${Number(deal.value).toLocaleString('es-MX')} ${deal.currency}` : 'Sin valor'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {deal.expected_close ? new Date(deal.expected_close).toLocaleDateString('es-MX') : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => openDealPanel(deal.id)}
                                className="rounded-md border border-brand-stone bg-white px-2.5 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-paper"
                              >
                                Abrir panel
                              </button>
                              <button
                                type="button"
                                onClick={() => openDealPanel(deal.id, { focusFollowup: true })}
                                className="rounded-md border border-brand-stone bg-brand-paper px-2.5 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-canvas"
                              >
                                Crear seguimiento
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {isPanelVisible && selectedDeal && (
          <aside className="hidden min-h-[520px] overflow-hidden rounded-xl border border-brand-stone/80 bg-white shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] lg:block">
            <DealWorkspacePanel
              key={`${selectedDeal.id}-${panelSession}`}
              deal={selectedDeal}
              initialOpenFollowupComposer={panelInitialFollowup}
              onStageChange={handleStageChange}
              onReactivate={handleReactivate}
            />
          </aside>
        )}
      </div>

      {isPanelVisible && selectedDeal && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-brand-navy/35" onClick={closePanel} />
          <div className="absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl">
            <DealWorkspacePanel
              key={`${selectedDeal.id}-${panelSession}`}
              deal={selectedDeal}
              onClose={closePanel}
              initialOpenFollowupComposer={panelInitialFollowup}
              onStageChange={handleStageChange}
              onReactivate={handleReactivate}
            />
          </div>
        </div>
      )}

      <LostReasonDialog
        open={pendingLostDealId !== null}
        onConfirm={handleLostConfirm}
        onCancel={() => setPendingLostDealId(null)}
      />

      <NewDealSheet
        open={isNewDealOpen}
        defaultStage={newDealStage}
        onClose={() => setIsNewDealOpen(false)}
      />

      <NewContactSheet
        open={isNewContactOpen}
        onClose={() => setIsNewContactOpen(false)}
      />
    </div>
  )
}

