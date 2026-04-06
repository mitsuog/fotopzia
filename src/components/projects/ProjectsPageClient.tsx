'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, BarChart2, Filter, LayoutList, Plus, Search } from 'lucide-react'
import { PortfolioView } from './PortfolioView'
import { ProjectProgressRing } from './ProjectProgressRing'
import type { PortfolioProjectSummary } from '@/types/wbs'
import type { ProjectsWorkspaceQuery } from '@/types/workspace'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { SavedViewsBar } from '@/components/workspace/SavedViewsBar'

const STAGE_COLORS: Record<string, string> = {
  preproduccion: 'bg-gray-100 text-gray-600',
  primera_revision: 'bg-sky-100 text-sky-700',
  produccion: 'bg-blue-100 text-blue-700',
  segunda_revision: 'bg-violet-100 text-violet-700',
  entrega: 'bg-amber-100 text-amber-700',
  cierre: 'bg-emerald-100 text-emerald-700',
}

const STAGE_LABELS: Record<string, string> = {
  preproduccion: 'Pre-produccion',
  primera_revision: '1a Revision',
  produccion: 'Produccion',
  segunda_revision: '2a Revision',
  entrega: 'Entrega',
  cierre: 'Cierre',
}

const RISK_STYLES: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-slate-100 text-slate-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

type ProjectRow = {
  id: string
  title: string
  stage: string
  project_type: string
  start_date: string | null
  due_date: string | null
  color: string | null
  progress: number
  contact: { first_name: string; last_name: string } | null
  taskStats: { total: number; done: number }
  deliverableStats: { total: number; delivered: number }
  objectiveStats: {
    blocked_count: number
    overdue_count: number
    upcoming_count: number
    next_due_date: string | null
    risk_level: 'low' | 'medium' | 'high'
  }
  assigned_to?: string | null
  assigned_to_name?: string | null
  is_archived: boolean
  archived_at: string | null
}

type ProfileOption = {
  id: string
  full_name: string | null
  email: string | null
}

interface ProjectsPageClientProps {
  projects: ProjectRow[]
  portfolioProjects: PortfolioProjectSummary[]
  profiles?: ProfileOption[]
}

function parseQuery(searchParams: URLSearchParams): ProjectsWorkspaceQuery {
  const objective = searchParams.get('objective')
  const view = searchParams.get('view')
  const risk = searchParams.get('risk')

  return {
    objective: objective === 'blocked' || objective === 'upcoming' ? objective : 'progress',
    view: view === 'portfolio' ? 'portfolio' : 'list',
    q: searchParams.get('q') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    assignee: searchParams.get('assignee') ?? undefined,
    risk: risk === 'low' || risk === 'medium' || risk === 'high' ? risk : 'all',
    archived: searchParams.get('archived') === '1' ? '1' : '0',
  }
}

export function ProjectsPageClient({ projects, portfolioProjects, profiles = [] }: ProjectsPageClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialQuery = parseQuery(new URLSearchParams(searchParams.toString()))

  const [rows, setRows] = useState<ProjectRow[]>(projects)
  const [objective, setObjective] = useState<'progress' | 'blocked' | 'upcoming'>(initialQuery.objective ?? 'progress')
  const [view, setView] = useState<'list' | 'portfolio'>(initialQuery.view ?? 'list')
  const [query, setQuery] = useState(initialQuery.q ?? '')
  const [filterByAssignee, setFilterByAssignee] = useState(initialQuery.assignee ?? '')
  const [filterByStage, setFilterByStage] = useState(initialQuery.status ?? '')
  const [riskFilter, setRiskFilter] = useState<'all' | 'low' | 'medium' | 'high'>(initialQuery.risk ?? 'all')
  const [showArchived, setShowArchived] = useState(initialQuery.archived === '1')
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectRow | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (objective !== 'progress') params.set('objective', objective)
    if (view !== 'list') params.set('view', view)
    if (query.trim()) params.set('q', query.trim())
    if (filterByStage) params.set('status', filterByStage)
    if (filterByAssignee) params.set('assignee', filterByAssignee)
    if (riskFilter !== 'all') params.set('risk', riskFilter)
    if (showArchived) params.set('archived', '1')

    const next = params.toString()
    const current = searchParams.toString()
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [pathname, router, searchParams, objective, view, query, filterByStage, filterByAssignee, riskFilter, showArchived])

  const currentQueryString = useMemo(() => {
    const params = new URLSearchParams()
    if (objective !== 'progress') params.set('objective', objective)
    if (view !== 'list') params.set('view', view)
    if (query.trim()) params.set('q', query.trim())
    if (filterByStage) params.set('status', filterByStage)
    if (filterByAssignee) params.set('assignee', filterByAssignee)
    if (riskFilter !== 'all') params.set('risk', riskFilter)
    if (showArchived) params.set('archived', '1')
    return params.toString()
  }, [objective, view, query, filterByStage, filterByAssignee, riskFilter, showArchived])

  function applySavedQuery(saved: string) {
    const parsed = parseQuery(new URLSearchParams(saved))
    setObjective(parsed.objective ?? 'progress')
    setView(parsed.view ?? 'list')
    setQuery(parsed.q ?? '')
    setFilterByStage(parsed.status ?? '')
    setFilterByAssignee(parsed.assignee ?? '')
    setRiskFilter(parsed.risk ?? 'all')
    setShowArchived(parsed.archived === '1')
  }

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return rows.filter(project => {
      if (!showArchived && project.is_archived) return false
      if (filterByAssignee && project.assigned_to !== filterByAssignee) return false
      if (filterByStage && project.stage !== filterByStage) return false
      if (riskFilter !== 'all' && project.objectiveStats.risk_level !== riskFilter) return false

      if (objective === 'blocked') {
        if (project.objectiveStats.blocked_count === 0 && project.objectiveStats.overdue_count === 0) return false
      }

      if (objective === 'upcoming') {
        if (project.objectiveStats.upcoming_count === 0) return false
      }

      if (normalized) {
        const contact = project.contact ? `${project.contact.first_name} ${project.contact.last_name}`.toLowerCase() : ''
        const fields = [project.title.toLowerCase(), project.stage.toLowerCase(), contact]
        if (!fields.some(field => field.includes(normalized))) return false
      }

      return true
    })
  }, [rows, showArchived, filterByAssignee, filterByStage, riskFilter, objective, query])

  const visiblePortfolioProjects = useMemo(() => {
    const byId = new Map<string, PortfolioProjectSummary>()
    for (const item of portfolioProjects) byId.set(item.id, item)

    return filtered
      .filter(project => project.stage !== 'cierre' && !project.is_archived)
      .map(project => byId.get(project.id))
      .filter((item): item is PortfolioProjectSummary => Boolean(item))
  }, [filtered, portfolioProjects])

  const counts = useMemo(() => {
    const active = rows.filter(project => project.stage !== 'cierre' && !project.is_archived)
    const blocked = active.filter(project => project.objectiveStats.blocked_count > 0 || project.objectiveStats.overdue_count > 0)
    const upcoming = active.filter(project => project.objectiveStats.upcoming_count > 0)

    return {
      progress: active.length,
      blocked: blocked.length,
      upcoming: upcoming.length,
    }
  }, [rows])

  const blockedBuckets = useMemo(() => {
    const overdueCritical = filtered
      .filter(project => project.objectiveStats.overdue_count > 0)
      .sort((a, b) => b.objectiveStats.overdue_count - a.objectiveStats.overdue_count)

    const blockedOnly = filtered
      .filter(project => project.objectiveStats.overdue_count === 0 && project.objectiveStats.blocked_count > 0)
      .sort((a, b) => b.objectiveStats.blocked_count - a.objectiveStats.blocked_count)

    const highRisk = filtered
      .filter(project => project.objectiveStats.risk_level === 'high')
      .sort((a, b) => {
        const aDate = a.objectiveStats.next_due_date ? new Date(a.objectiveStats.next_due_date).getTime() : Number.MAX_SAFE_INTEGER
        const bDate = b.objectiveStats.next_due_date ? new Date(b.objectiveStats.next_due_date).getTime() : Number.MAX_SAFE_INTEGER
        return aDate - bDate
      })

    return { overdueCritical, blockedOnly, highRisk }
  }, [filtered])

  const upcomingTimeline = useMemo(() => {
    return filtered
      .filter(project => project.objectiveStats.upcoming_count > 0)
      .sort((a, b) => {
        const aDate = a.objectiveStats.next_due_date ? new Date(a.objectiveStats.next_due_date).getTime() : Number.MAX_SAFE_INTEGER
        const bDate = b.objectiveStats.next_due_date ? new Date(b.objectiveStats.next_due_date).getTime() : Number.MAX_SAFE_INTEGER
        return aDate - bDate
      })
      .slice(0, 8)
  }, [filtered])

  const hasFilters = Boolean(query.trim() || filterByAssignee || filterByStage || riskFilter !== 'all' || showArchived)

  async function setArchive(project: ProjectRow, archived: boolean) {
    setActionError(null)
    setBusyId(project.id)

    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: archived }),
      })
      const json = await res.json().catch(() => ({ error: { message: 'No fue posible actualizar el proyecto.' } }))
      if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'No fue posible actualizar el proyecto.')

      setRows(prev => prev.map(item => {
        if (item.id !== project.id) return item
        return {
          ...item,
          is_archived: Boolean(json.data?.is_archived),
          archived_at: (json.data?.archived_at ?? null) as string | null,
        }
      }))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No fue posible actualizar el proyecto.')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDeleteProject(confirmationText: string) {
    if (!projectToDelete) return false

    setActionError(null)
    setBusyId(projectToDelete.id)
    try {
      const res = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationText }),
      })
      const json = await res.json().catch(() => ({ error: { message: 'No fue posible eliminar el proyecto.' } }))
      if (!res.ok) throw new Error(json.error?.message ?? json.error ?? 'No fue posible eliminar el proyecto.')

      setRows(prev => prev.filter(item => item.id !== projectToDelete.id))
      setProjectToDelete(null)
      return true
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No fue posible eliminar el proyecto.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-lg border border-brand-stone text-xs">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${view === 'list' ? 'bg-brand-navy text-white' : 'text-brand-navy hover:bg-brand-canvas'}`}
          >
            <LayoutList className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            type="button"
            onClick={() => setView('portfolio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium transition-colors ${view === 'portfolio' ? 'bg-brand-navy text-white' : 'text-brand-navy hover:bg-brand-canvas'}`}
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Portfolio
          </button>
        </div>

        <Link
          href="/projects/new"
          className="flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
        >
          <Plus className="h-4 w-4" />
          Crear proyecto
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-stone/80 bg-white/80 p-2">
        {([
          { id: 'progress', label: 'Avance', count: counts.progress },
          { id: 'blocked', label: 'Bloqueos', count: counts.blocked },
          { id: 'upcoming', label: 'Proximos', count: counts.upcoming },
        ] as const).map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => setObjective(item.id)}
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${objective === item.id ? 'bg-brand-navy text-white' : 'border border-brand-stone bg-white text-brand-navy hover:bg-brand-paper'}`}
          >
            {item.label}
            <span className={objective === item.id ? 'text-white/80' : 'text-gray-500'}>{item.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            id="projects-workspace-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Buscar por titulo, etapa o contacto..."
            className="w-full rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 pl-8 text-xs text-brand-navy outline-none"
          />
        </div>

        <Filter className="h-3.5 w-3.5 text-gray-400" />

        <select
          value={filterByStage}
          onChange={event => setFilterByStage(event.target.value)}
          className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy"
        >
          <option value="">Todas las etapas</option>
          {Object.entries(STAGE_LABELS).map(([stage, label]) => (
            <option key={stage} value={stage}>{label}</option>
          ))}
        </select>

        {profiles.length > 0 && (
          <select
            value={filterByAssignee}
            onChange={event => setFilterByAssignee(event.target.value)}
            className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy"
          >
            <option value="">Todos los responsables</option>
            {profiles.map(profile => (
              <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id}</option>
            ))}
          </select>
        )}

        <select
          value={riskFilter}
          onChange={event => setRiskFilter(event.target.value as 'all' | 'low' | 'medium' | 'high')}
          className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy"
        >
          <option value="all">Riesgo: todos</option>
          <option value="low">Riesgo bajo</option>
          <option value="medium">Riesgo medio</option>
          <option value="high">Riesgo alto</option>
        </select>

        <button
          type="button"
          onClick={() => setShowArchived(value => !value)}
          className={`rounded-lg border px-2.5 py-1.5 text-xs ${showArchived ? 'border-brand-navy bg-brand-paper text-brand-navy' : 'border-brand-stone text-gray-500 hover:text-brand-navy'}`}
        >
          {showArchived ? 'Ocultar archivados' : 'Mostrar archivados'}
        </button>
      </div>

      <SavedViewsBar
        module="projects"
        currentQuery={currentQueryString}
        onApplyQuery={applySavedQuery}
      />

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{filtered.length} de {rows.length} proyectos visibles</span>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFilterByAssignee('')
              setFilterByStage('')
              setRiskFilter('all')
              setShowArchived(false)
            }}
            className="rounded-md border border-brand-stone bg-white px-2 py-1 text-xs text-brand-navy hover:bg-brand-paper"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {actionError && (
        <InlineAlert
          variant="error"
          title="No pudimos completar la accion"
          description={actionError}
        />
      )}

      {objective === 'blocked' && filtered.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-3">
          {[
            {
              title: 'Vencido Critico',
              data: blockedBuckets.overdueCritical,
              tone: 'border-red-200 bg-red-50/70 text-red-800',
              empty: 'Sin vencimientos criticos.',
            },
            {
              title: 'Bloqueado',
              data: blockedBuckets.blockedOnly,
              tone: 'border-amber-200 bg-amber-50/70 text-amber-800',
              empty: 'Sin bloqueos activos.',
            },
            {
              title: 'Riesgo Alto',
              data: blockedBuckets.highRisk,
              tone: 'border-rose-200 bg-rose-50/70 text-rose-800',
              empty: 'Sin proyectos en riesgo alto.',
            },
          ].map(bucket => (
            <article key={bucket.title} className={`rounded-xl border p-3 ${bucket.tone}`}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.08em]">{bucket.title}</p>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-semibold">{bucket.data.length}</span>
              </div>
              {bucket.data.length === 0 ? (
                <p className="rounded-md bg-white/65 px-2 py-2 text-xs">{bucket.empty}</p>
              ) : (
                <div className="space-y-1.5">
                  {bucket.data.slice(0, 3).map(project => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block rounded-md border border-white/70 bg-white/80 px-2.5 py-2 text-xs hover:bg-white"
                    >
                      <p className="truncate font-semibold text-brand-navy">{project.title}</p>
                      <p className="mt-0.5 text-[11px] text-gray-600">
                        {project.objectiveStats.overdue_count} vencidas · {project.objectiveStats.blocked_count} bloqueadas
                      </p>
                      <span className="mt-1 inline-flex rounded-full border border-brand-stone/80 px-2 py-0.5 text-[10px] font-medium text-brand-navy">
                        Resolver bloqueo
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {objective === 'upcoming' && filtered.length > 0 && (
        <section className="rounded-xl border border-brand-stone/80 bg-white/85 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Proximos entregables (7 dias)</p>
            <span className="text-xs text-gray-500">{upcomingTimeline.length} proyectos en ventana</span>
          </div>

          {upcomingTimeline.length === 0 ? (
            <p className="rounded-md border border-brand-stone/60 bg-brand-paper/40 px-3 py-3 text-sm text-gray-600">
              No hay entregables dentro de la ventana actual.
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {upcomingTimeline.map(project => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="rounded-lg border border-brand-stone/70 bg-brand-paper/45 px-3 py-2.5 transition-colors hover:border-brand-gold/60"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-brand-navy">{project.title}</p>
                      <p className="truncate text-xs text-gray-600">
                        Responsable: {project.assigned_to_name ?? 'Sin responsable'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RISK_STYLES[project.objectiveStats.risk_level]}`}>
                      Riesgo {project.objectiveStats.risk_level}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Siguiente hito: {project.objectiveStats.next_due_date
                      ? new Date(project.objectiveStats.next_due_date).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })
                      : 'Sin fecha'}
                  </p>
                  <span className="mt-1 inline-flex rounded-full border border-brand-stone/80 bg-white px-2 py-0.5 text-[10px] font-medium text-brand-navy">
                    Abrir y ejecutar siguiente accion
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {view === 'list' ? (
        <>
          <div className="block space-y-2 sm:hidden">
            {filtered.length === 0 ? (
              <EmptyState
                title="No hay proyectos para este objetivo"
                description="Ajusta filtros o cambia de objetivo para ver mas resultados."
                ctaLabel="Crear proyecto"
                ctaHref="/projects/new"
              />
            ) : (
              filtered.map(project => (
                <div
                  key={project.id}
                  className={`rounded-xl border p-3 shadow-sm ${project.is_archived ? 'border-gray-200 bg-gray-50/80' : 'border-brand-stone/80 bg-white/80'}`}
                >
                  <div className="flex items-center gap-3">
                    <ProjectProgressRing progress={project.progress} size={36} strokeWidth={3} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-brand-navy">{project.title}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {project.contact
                          ? `${project.contact.first_name} ${project.contact.last_name}`
                          : project.project_type === 'internal' ? 'Proyecto interno' : 'Proyecto alianza'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${STAGE_COLORS[project.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STAGE_LABELS[project.stage] ?? project.stage}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-medium ${RISK_STYLES[project.objectiveStats.risk_level]}`}>
                      Riesgo {project.objectiveStats.risk_level}
                    </span>
                    {project.objectiveStats.blocked_count > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                        <AlertTriangle className="h-3 w-3" />
                        {project.objectiveStats.blocked_count} bloqueos
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link href={`/projects/${project.id}`} className="rounded-md border border-brand-stone bg-white px-2.5 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-paper">
                      Abrir proyecto
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === project.id}
                      onClick={() => setArchive(project, !project.is_archived)}
                      className="rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {busyId === project.id ? 'Guardando...' : project.is_archived ? 'Desarchivar' : 'Archivar'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-brand-stone/80 bg-white/80 shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur sm:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-brand-stone bg-brand-canvas/80">
                    <th className="px-4 py-3 text-left font-semibold text-brand-navy">Proyecto</th>
                    <th className="px-4 py-3 text-left font-semibold text-brand-navy">Etapa</th>
                    <th className="px-4 py-3 text-left font-semibold text-brand-navy">Progreso</th>
                    <th className="px-4 py-3 text-left font-semibold text-brand-navy">Objetivo</th>
                    <th className="px-4 py-3 text-left font-semibold text-brand-navy">Siguiente hito</th>
                    <th className="px-4 py-3 text-left font-semibold text-brand-navy">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-gray-400">Sin proyectos para este objetivo.</td>
                    </tr>
                  ) : (
                    filtered.map(project => (
                      <tr key={project.id} className={`border-b border-brand-stone/50 last:border-0 ${project.is_archived ? 'bg-gray-50/60' : 'hover:bg-brand-canvas/40'} transition-colors`}>
                        <td className="px-4 py-3">
                          <Link href={`/projects/${project.id}`} className="block">
                            <p className="font-medium text-brand-navy hover:text-brand-gold">{project.title}</p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              {project.contact
                                ? `${project.contact.first_name} ${project.contact.last_name}`
                                : project.project_type === 'internal' ? 'Proyecto interno' : 'Proyecto alianza'}
                            </p>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[project.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STAGE_LABELS[project.stage] ?? project.stage}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProjectProgressRing progress={project.progress} size={24} strokeWidth={2.5} />
                            <span className="text-xs text-gray-600">{project.progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className={`rounded-full px-2 py-0.5 font-medium ${RISK_STYLES[project.objectiveStats.risk_level]}`}>
                              Riesgo {project.objectiveStats.risk_level}
                            </span>
                            {project.objectiveStats.overdue_count > 0 && (
                              <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{project.objectiveStats.overdue_count} vencidas</span>
                            )}
                            {project.objectiveStats.blocked_count > 0 && (
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">{project.objectiveStats.blocked_count} bloqueadas</span>
                            )}
                            {project.objectiveStats.upcoming_count > 0 && (
                              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">{project.objectiveStats.upcoming_count} proximas</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {project.objectiveStats.next_due_date
                            ? new Date(project.objectiveStats.next_due_date).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })
                            : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={busyId === project.id}
                              onClick={() => setArchive(project, !project.is_archived)}
                              className="rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                            >
                              {busyId === project.id ? 'Guardando...' : project.is_archived ? 'Desarchivar' : 'Archivar'}
                            </button>
                            <button
                              type="button"
                              disabled={busyId === project.id}
                              onClick={() => setProjectToDelete(project)}
                              className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                            >
                              {busyId === project.id ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <PortfolioView projects={visiblePortfolioProjects} loading={false} />
      )}

      <ConfirmationDialog
        open={Boolean(projectToDelete)}
        title="Eliminar proyecto permanentemente"
        description={projectToDelete
          ? `Esta accion eliminara el proyecto ${projectToDelete.title} de forma definitiva.`
          : 'Esta accion eliminara el proyecto de forma definitiva.'}
        confirmLabel="Eliminar permanentemente"
        confirmVariant="danger"
        requireText="ELIMINAR"
        requireTextLabel="Escribe ELIMINAR para confirmar"
        loading={Boolean(projectToDelete && busyId === projectToDelete.id)}
        onClose={() => {
          if (!projectToDelete || busyId !== projectToDelete.id) setProjectToDelete(null)
        }}
        onConfirm={async typedText => {
          await confirmDeleteProject(typedText)
        }}
      />
    </div>
  )
}

