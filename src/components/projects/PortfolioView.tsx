'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Briefcase, Building2, Handshake, TrendingUp } from 'lucide-react'
import type { PortfolioProjectSummary, ProjectType } from '@/types/wbs'
import { ProjectProgressRing } from './ProjectProgressRing'

const STAGE_LABELS: Record<string, string> = {
  preproduccion:    'Pre-producción',
  primera_revision: '1ª Revisión',
  produccion:       'Producción',
  segunda_revision: '2ª Revisión',
  entrega:          'Entrega',
  cierre:           'Cierre',
}

const STAGE_COLORS: Record<string, string> = {
  preproduccion:    'bg-slate-100 text-slate-700',
  primera_revision: 'bg-sky-100 text-sky-700',
  produccion:       'bg-blue-100 text-blue-700',
  segunda_revision: 'bg-violet-100 text-violet-700',
  entrega:          'bg-amber-100 text-amber-700',
  cierre:           'bg-emerald-100 text-emerald-700',
}

const TYPE_ICONS: Record<ProjectType, React.ReactNode> = {
  contract: <Briefcase className="h-3.5 w-3.5" />,
  internal: <Building2 className="h-3.5 w-3.5" />,
  alliance: <Handshake className="h-3.5 w-3.5" />,
}

const TYPE_LABELS: Record<ProjectType, string> = {
  contract: 'Contrato',
  internal: 'Interno',
  alliance: 'Alianza',
}

interface PortfolioViewProps {
  projects: PortfolioProjectSummary[]
  loading?: boolean
}

export function PortfolioView({ projects, loading }: PortfolioViewProps) {
  const [filterType, setFilterType] = useState<ProjectType | 'all'>('all')

  const filtered = useMemo(
    () => filterType === 'all' ? projects : projects.filter(p => p.project_type === filterType),
    [projects, filterType],
  )

  // Determine the global date window for mini-Gantt bars
  const { portfolioStart, portfolioDuration } = useMemo(() => {
    const dates: number[] = []
    for (const p of projects) {
      if (p.start_date) dates.push(new Date(p.start_date).getTime())
      if (p.due_date) dates.push(new Date(p.due_date).getTime())
    }
    if (dates.length === 0) {
      const now = Date.now()
      return { portfolioStart: now, portfolioDuration: 90 * 86400000 }
    }
    const min = Math.min(...dates)
    const max = Math.max(...dates)
    const pad = Math.max((max - min) * 0.05, 7 * 86400000)
    return { portfolioStart: min - pad, portfolioDuration: max - min + pad * 2 }
  }, [projects])

  const avgProgress = projects.length > 0
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-navy border-t-transparent" />
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-stone py-16">
        <TrendingUp className="mb-3 h-10 w-10 text-brand-stone" />
        <p className="text-sm font-medium text-brand-navy">Sin proyectos activos</p>
        <p className="mt-1 text-xs text-gray-500">Los proyectos aparecerán aquí cuando estén en curso</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-brand-stone/80 bg-white/85 px-5 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/60">Proyectos activos</p>
          <p className="text-2xl font-semibold text-brand-navy">{projects.length}</p>
        </div>
        <div className="h-8 w-px bg-brand-stone" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/60">Avance promedio</p>
          <p className="text-2xl font-semibold text-brand-navy">{avgProgress}%</p>
        </div>
        <div className="h-8 w-px bg-brand-stone" />
        <div className="flex gap-2">
          {(['all', 'contract', 'internal', 'alliance'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                filterType === type
                  ? 'border-brand-navy bg-brand-navy text-white'
                  : 'border-brand-stone text-brand-navy hover:border-brand-gold'
              }`}
            >
              {type === 'all' ? 'Todos' : TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio rows */}
      <div className="space-y-2">
        {/* Header */}
        <div className="grid items-center gap-3 rounded-lg px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-navy/50"
          style={{ gridTemplateColumns: '1fr 80px 60px 1fr' }}>
          <span>Proyecto</span>
          <span>Avance</span>
          <span>Tareas</span>
          <span>Cronograma</span>
        </div>

        {filtered.map(project => {
          const startMs = project.start_date ? new Date(project.start_date).getTime() : null
          const endMs = project.due_date ? new Date(project.due_date).getTime() : null

          let barLeft = 0
          let barWidth = 0
          if (startMs !== null && endMs !== null) {
            barLeft = Math.max(0, (startMs - portfolioStart) / portfolioDuration) * 100
            barWidth = Math.max(1, ((endMs - startMs) / portfolioDuration) * 100)
          }

          return (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="grid items-center gap-3 rounded-xl border border-brand-stone/70 bg-white/85 px-4 py-3 shadow-[0_4px_16px_-6px_rgba(28,43,74,0.15)] transition-colors hover:border-brand-gold/60"
              style={{ gridTemplateColumns: '1fr 80px 60px 1fr' }}
            >
              {/* Name + meta */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-brand-navy/40">{TYPE_ICONS[project.project_type]}</span>
                  <p className="truncate text-sm font-semibold text-brand-navy">{project.title}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[project.stage]}`}>
                    {STAGE_LABELS[project.stage] ?? project.stage}
                  </span>
                  {project.contact_name && (
                    <span className="truncate text-[11px] text-gray-500">{project.contact_name}</span>
                  )}
                </div>
              </div>

              {/* Progress ring */}
              <div className="flex items-center justify-center">
                <ProjectProgressRing progress={project.progress} size={40} strokeWidth={3.5} />
              </div>

              {/* Task ratio */}
              <div className="text-center">
                <p className="text-xs font-semibold text-brand-navy">{project.task_done}/{project.task_total}</p>
                <p className="text-[10px] text-gray-400">tareas</p>
              </div>

              {/* Mini Gantt bar */}
              <div className="relative h-5 overflow-hidden rounded-full bg-brand-stone/30">
                {startMs !== null && endMs !== null && (
                  <div
                    className="absolute top-1 h-3 rounded-full"
                    style={{
                      left: `${barLeft}%`,
                      width: `max(${barWidth}%, 4px)`,
                      backgroundColor: project.color ?? '#1C2B4A',
                      opacity: 0.75,
                    }}
                  />
                )}
                {startMs === null && (
                  <span className="flex h-full items-center px-2 text-[10px] text-gray-400">Sin fechas</span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
