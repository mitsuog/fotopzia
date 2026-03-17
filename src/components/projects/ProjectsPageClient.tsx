'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, LayoutList, BarChart2, Filter } from 'lucide-react'
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
  assigned_to?: string | null
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

export function ProjectsPageClient({ projects, portfolioProjects, profiles = [] }: ProjectsPageClientProps) {
  const [view, setView] = useState<'list' | 'portfolio'>('list')
  const [filterByAssignee, setFilterByAssignee] = useState<string>('')
  const [filterByContact, setFilterByContact] = useState<string>('')

  // Build unique client list from loaded projects
  const contactOptions = useMemo(() => {
    const seen = new Set<string>()
    const list: { key: string; label: string }[] = []
    for (const p of projects) {
      if (p.contact) {
        const key = `${p.contact.first_name} ${p.contact.last_name}`
        if (!seen.has(key)) {
          seen.add(key)
          list.push({ key, label: key })
        }
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [projects])

  const filtered = useMemo(() => {
    return projects.filter(p => {
      if (filterByAssignee && p.assigned_to !== filterByAssignee) return false
      if (filterByContact) {
        const name = p.contact ? `${p.contact.first_name} ${p.contact.last_name}` : ''
        if (name !== filterByContact) return false
      }
      return true
    })
  }, [projects, filterByAssignee, filterByContact])

  const hasFilters = filterByAssignee || filterByContact

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

      {/* Filters bar */}
      {view === 'list' && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-3.5 w-3.5 shrink-0 text-gray-400" />
          {profiles.length > 0 && (
            <select
              value={filterByAssignee}
              onChange={e => setFilterByAssignee(e.target.value)}
              className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy outline-none"
            >
              <option value="">Todos los colaboradores</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name ?? p.email ?? p.id}</option>
              ))}
            </select>
          )}
          <select
            value={filterByContact}
            onChange={e => setFilterByContact(e.target.value)}
            className="rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs text-brand-navy outline-none"
          >
            <option value="">Todos los clientes</option>
            {contactOptions.map(c => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilterByAssignee(''); setFilterByContact('') }}
              className="rounded-lg border border-brand-stone px-2.5 py-1.5 text-xs text-gray-500 hover:text-brand-navy"
            >
              Limpiar filtros
            </button>
          )}
          {hasFilters && (
            <span className="text-xs text-gray-400">{filtered.length} de {projects.length} proyectos</span>
          )}
        </div>
      )}

      {view === 'list' ? (
        <>
          {/* Mobile: card stack */}
          <div className="block sm:hidden space-y-2">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {hasFilters ? 'Sin proyectos con esos filtros' : 'Sin proyectos aún'}
              </p>
            ) : (
              filtered.map(project => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-xl border border-brand-stone/80 bg-white/80 p-3 shadow-sm backdrop-blur"
                >
                  <ProjectProgressRing progress={project.progress} size={36} strokeWidth={3} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-brand-navy truncate">{project.title}</p>
                    <p className="mt-0.5 text-xs text-gray-500 truncate">
                      {project.contact
                        ? `${project.contact.first_name} ${project.contact.last_name}`
                        : project.project_type === 'internal' ? 'Proyecto interno' : 'Proyecto alianza'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STAGE_COLORS[project.stage] ?? 'bg-gray-100 text-gray-600'}`}>
                      {STAGE_LABELS[project.stage] ?? project.stage}
                    </span>
                    {project.due_date && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(project.due_date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'America/Mexico_City' })}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Desktop: table */}
          <div className="hidden sm:block rounded-xl border border-brand-stone/80 bg-white/80 overflow-hidden shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-brand-stone bg-brand-canvas/80">
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Proyecto</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Etapa</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Progreso</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Tareas</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Entregables</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Vence</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-gray-400">
                        {hasFilters ? 'Sin proyectos con esos filtros' : 'Sin proyectos aún'}
                      </td>
                    </tr>
                  ) : (
                    filtered.map(project => (
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
        </>
      ) : (
        <PortfolioView projects={portfolioProjects} loading={false} />
      )}
    </div>
  )
}
