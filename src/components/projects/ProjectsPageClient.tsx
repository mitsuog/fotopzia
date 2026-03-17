'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, LayoutList, BarChart2 } from 'lucide-react'
import { PortfolioView } from './PortfolioView'
import { ProjectProgressRing } from './ProjectProgressRing'
import type { PortfolioProjectSummary } from '@/types/wbs'

const STAGE_COLORS: Record<string, string> = {
  preproduccion:    'bg-gray-100 text-gray-600',
  primera_revision: 'bg-sky-100 text-sky-700',
  produccion:       'bg-blue-100 text-blue-700',
  segunda_revision: 'bg-violet-100 text-violet-700',
  entrega:          'bg-amber-100 text-amber-700',
  cierre:           'bg-emerald-100 text-emerald-700',
}
const STAGE_LABELS: Record<string, string> = {
  preproduccion:    'Pre-producción',
  primera_revision: '1ª Revisión',
  produccion:       'Producción',
  segunda_revision: '2ª Revisión',
  entrega:          'Entrega',
  cierre:           'Cierre',
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
}

interface ProjectsPageClientProps {
  projects: ProjectRow[]
  portfolioProjects: PortfolioProjectSummary[]
}

export function ProjectsPageClient({ projects, portfolioProjects }: ProjectsPageClientProps) {
  const [view, setView] = useState<'list' | 'portfolio'>('list')

  return (
    <div className="space-y-5">
      {/* Header toolbar */}
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
          Nuevo proyecto
        </Link>
      </div>

      {view === 'list' ? (
        <div className="rounded-xl border border-brand-stone/80 bg-white/80 overflow-hidden shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-brand-stone bg-brand-canvas/80">
                  <th className="text-left px-4 py-3 font-semibold text-brand-navy">Proyecto</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-navy">Etapa</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-navy">Avance</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-navy">Tareas</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-navy">Entregables</th>
                  <th className="text-left px-4 py-3 font-semibold text-brand-navy">Vence</th>
                </tr>
              </thead>
              <tbody>
                {projects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-400">Sin proyectos aún</td>
                  </tr>
                ) : (
                  projects.map(project => (
                    <tr key={project.id} className="border-b border-brand-stone/50 last:border-0 hover:bg-brand-canvas/40 cursor-pointer transition-colors">
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
                        <Link href={`/projects/${project.id}`} className="block">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[project.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                            {STAGE_LABELS[project.stage] ?? project.stage}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/projects/${project.id}`} className="flex items-center gap-2">
                          <ProjectProgressRing progress={project.progress} size={24} strokeWidth={2.5} />
                          <span className="text-xs text-gray-600">{project.progress}%</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <Link href={`/projects/${project.id}`} className="block">{project.taskStats.done}/{project.taskStats.total}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <Link href={`/projects/${project.id}`} className="block">{project.deliverableStats.delivered}/{project.deliverableStats.total}</Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <Link href={`/projects/${project.id}`} className="block">
                          {project.due_date
                            ? new Date(project.due_date).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City' })
                            : '-'}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <PortfolioView projects={portfolioProjects} loading={false} />
      )}
    </div>
  )
}
