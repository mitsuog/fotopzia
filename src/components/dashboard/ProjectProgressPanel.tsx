'use client'

import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import type { PortfolioProjectSummary } from '@/types/wbs'
import { ProjectProgressRing } from '@/components/projects/ProjectProgressRing'

const STAGE_LABELS: Record<string, string> = {
  preproduccion:    'Pre-prod',
  primera_revision: '1ª Rev.',
  produccion:       'Producción',
  segunda_revision: '2ª Rev.',
  entrega:          'Entrega',
  cierre:           'Cierre',
}

const STAGE_COLORS: Record<string, string> = {
  preproduccion:    'text-slate-600',
  primera_revision: 'text-sky-600',
  produccion:       'text-blue-600',
  segunda_revision: 'text-violet-600',
  entrega:          'text-amber-600',
  cierre:           'text-emerald-600',
}

interface ProjectProgressPanelProps {
  projects: PortfolioProjectSummary[]
}

export function ProjectProgressPanel({ projects }: ProjectProgressPanelProps) {
  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-6">
        <p className="text-xs text-gray-400">Sin proyectos activos</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {projects.slice(0, 6).map(project => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="flex items-center gap-3 rounded-lg border border-brand-stone/70 bg-brand-paper/50 p-2.5 transition-colors hover:border-brand-gold/60"
        >
          <ProjectProgressRing progress={project.progress} size={28} strokeWidth={2.5} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-brand-navy">{project.title}</p>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-medium ${STAGE_COLORS[project.stage] ?? 'text-gray-500'}`}>
                {STAGE_LABELS[project.stage] ?? project.stage}
              </span>
              {project.task_total > 0 && (
                <span className="text-[10px] text-gray-400">
                  {project.task_done}/{project.task_total} tareas
                </span>
              )}
            </div>
          </div>
          <div className="w-12 shrink-0">
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-stone/50">
              <div
                className="h-full rounded-full bg-brand-navy/70"
                style={{ width: `${project.progress}%`, transition: 'width 0.4s ease' }}
              />
            </div>
          </div>
        </Link>
      ))}
      {projects.length > 6 && (
        <Link
          href="/projects?view=portfolio"
          className="flex items-center justify-center gap-1 rounded-lg border border-dashed border-brand-stone py-2 text-xs text-brand-navy hover:border-brand-gold"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Ver {projects.length - 6} más en portfolio
        </Link>
      )}
    </div>
  )
}
