'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, LayoutList, BarChart2, Filter } from 'lucide-react'
import { PortfolioView } from './PortfolioView'
import { ProjectProgressRing } from './ProjectProgressRing'
import type { PortfolioProjectSummary } from '@/types/wbs'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'

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
  primera_revision: '1a Revisión',
  produccion: 'Produccion',
  segunda_revision: '2a Revisión',
  entrega: 'Entrega',
  cierre: 'Cierre',
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

export function ProjectsPageClient({ projects, portfolioProjects, profiles = [] }: ProjectsPageClientProps) {
  const [rows, setRows] = useState<ProjectRow[]>(projects)
  const [view, setView] = useState<'list' | 'portfolio'>('list')
  const [filterByAssignee, setFilterByAssignee] = useState<string>('')
  const [filterByContact, setFilterByContact] = useState<string>('')
  const [showArchived, setShowArchived] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectRow | null>(null)

  const contactOptions = useMemo(() => {
    const seen = new Set<string>()
    const list: { key: string; label: string }[] = []
    for (const p of rows) {
      if (p.contact) {
        const key = `${p.contact.first_name} ${p.contact.last_name}`
        if (!seen.has(key)) {
          seen.add(key)
          list.push({ key, label: key })
        }
      }
    }
    return list.sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter(p => {
      if (!showArchived && p.is_archived) return false
      if (filterByAssignee && p.assigned_to !== filterByAssignee) return false
      if (filterByContact) {
        const name = p.contact ? `${p.contact.first_name} ${p.contact.last_name}` : ''
        if (name !== filterByContact) return false
      }
      return true
    })
  }, [rows, showArchived, filterByAssignee, filterByContact])

  const hasFilters = filterByAssignee || filterByContact || showArchived

  async function setArchive(project: ProjectRow, archived: boolean) {
    setActionError(null)
    setBusyId(project.id)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: archived }),
      })
      const json = await res.json().catch(() => ({ error: 'No fue posible actualizar el proyecto.' }))
      if (!res.ok) throw new Error(json.error ?? 'No fue posible actualizar el proyecto.')

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
      const json = await res.json().catch(() => ({ error: 'No fue posible eliminar el proyecto.' }))
      if (!res.ok) throw new Error(json.error ?? 'No fue posible eliminar el proyecto.')

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
          Nuevo proyecto
        </Link>
      </div>

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

          <button
            type="button"
            onClick={() => setShowArchived(v => !v)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs ${showArchived ? 'border-brand-navy bg-brand-paper text-brand-navy' : 'border-brand-stone text-gray-500 hover:text-brand-navy'}`}
          >
            {showArchived ? 'Ocultar archivados' : 'Mostrar archivados'}
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={() => { setFilterByAssignee(''); setFilterByContact(''); setShowArchived(false) }}
              className="rounded-lg border border-brand-stone px-2.5 py-1.5 text-xs text-gray-500 hover:text-brand-navy"
            >
              Limpiar filtros
            </button>
          )}

          {hasFilters && (
            <span className="text-xs text-gray-400">{filtered.length} de {rows.length} proyectos</span>
          )}
        </div>
      )}

      {actionError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</p>
      )}

      {view === 'list' ? (
        <>
          <div className="block sm:hidden space-y-2">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">
                {hasFilters ? 'Sin proyectos con esos filtros' : 'Sin proyectos aun'}
              </p>
            ) : (
              filtered.map(project => (
                <div
                  key={project.id}
                  className={`rounded-xl border p-3 shadow-sm ${project.is_archived ? 'border-gray-200 bg-gray-50/80' : 'border-brand-stone/80 bg-white/80'}`}
                >
                  <div className="flex items-center gap-3">
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
                      {project.is_archived && (
                        <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-600">Archivado</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="rounded-md border border-brand-stone bg-white px-2.5 py-1 text-[11px] font-medium text-brand-navy hover:bg-brand-paper"
                    >
                      Abrir
                    </Link>
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
                </div>
              ))
            )}
          </div>

          <div className="hidden sm:block rounded-xl border border-brand-stone/80 bg-white/80 overflow-hidden shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-brand-stone bg-brand-canvas/80">
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Proyecto</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Etapa</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Progreso</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Tareas</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Entregables</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Vence</th>
                    <th className="text-left px-4 py-3 font-semibold text-brand-navy">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-gray-400">
                        {hasFilters ? 'Sin proyectos con esos filtros' : 'Sin proyectos aun'}
                      </td>
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
                          {project.is_archived && (
                            <span className="ml-2 inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Archivado</span>
                          )}
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
        <PortfolioView projects={portfolioProjects} loading={false} />
      )}
      <ConfirmationDialog
        open={Boolean(projectToDelete)}
        title="Eliminar proyecto permanentemente"
        description={projectToDelete
          ? `Esta acción eliminará el proyecto ${projectToDelete.title} de forma definitiva.`
          : 'Esta acción eliminará el proyecto de forma definitiva.'}
        confirmLabel="Eliminar permanentemente"
        confirmVariant="danger"
        requireText="ELIMINAR"
        requireTextLabel="Escribe ELIMINAR para confirmar"
        loading={Boolean(projectToDelete && busyId === projectToDelete.id)}
        onClose={() => {
          if (!projectToDelete || busyId !== projectToDelete.id) setProjectToDelete(null)
        }}
        onConfirm={async (typedText) => {
          await confirmDeleteProject(typedText)
        }}
      />
    </div>
  )
}
