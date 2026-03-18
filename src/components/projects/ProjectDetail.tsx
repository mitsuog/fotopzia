'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import {
  useProject,
  useProjectTasks,
  useProjectDeliverables,
  type ProjectWithAll,
  type ProjectTask,
  type ProjectDeliverable,
  type TeamProfile,
} from '@/hooks/useProject'
import { useWBS } from '@/hooks/useWBS'
import type { WBSNode, Dependency } from '@/types/wbs'
import { ProjectGrid } from './ProjectGrid'
import { ProjectKanban } from './ProjectKanban'
import { ProjectDeliverables } from './ProjectDeliverables'
import { TaskSidePanel } from './TaskSidePanel'
import { WBSTree } from './WBSTree'
import { WBSNodePanel } from './WBSNodePanel'
import { GanttV2 } from './GanttV2'
import { ProjectProgressRing } from './ProjectProgressRing'
import { ProjectCalendarTab } from './ProjectCalendarTab'
import { ProjectFinancesTab } from './ProjectFinancesTab'

type ViewMode = 'grid' | 'kanban' | 'gantt'
type Tab = 'tasks' | 'wbs' | 'deliverables' | 'calendar' | 'finances'
type WBSView = 'tree' | 'gantt'

const STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'preproduccion',    label: 'Pre-producción' },
  { value: 'primera_revision', label: '1ª Revisión' },
  { value: 'produccion',       label: 'Producción' },
  { value: 'segunda_revision', label: '2ª Revisión' },
  { value: 'entrega',          label: 'Entrega' },
  { value: 'cierre',           label: 'Cierre' },
]

const STAGE_COLORS: Record<string, string> = {
  preproduccion:    'bg-gray-100 text-gray-600',
  primera_revision: 'bg-sky-100 text-sky-700',
  produccion:       'bg-blue-100 text-blue-700',
  segunda_revision: 'bg-violet-100 text-violet-700',
  entrega:          'bg-amber-100 text-amber-700',
  cierre:           'bg-emerald-100 text-emerald-700',
}

interface ProjectDetailProps {
  initialProject: ProjectWithAll
  initialTasks: ProjectTask[]
  initialDeliverables: ProjectDeliverable[]
  initialWBSNodes: WBSNode[]
  initialDependencies: Dependency[]
  profiles: TeamProfile[]
}

export function ProjectDetail({
  initialProject,
  initialTasks,
  initialDeliverables,
  initialWBSNodes,
  initialDependencies,
  profiles,
}: ProjectDetailProps) {
  const { project, updateProject } = useProject(initialProject.id, initialProject)
  const { tasks, updateTask, deleteTask, createTask } = useProjectTasks(initialProject.id, initialTasks)
  const { deliverables, updateDeliverable, createDeliverable } = useProjectDeliverables(initialProject.id, initialDeliverables)
  const { nodes: wbsNodes, tree, deps, getNodeProgress, createNode, updateNode, deleteNode, createDependency, deleteDependency, moveNode } =
    useWBS(initialProject.id, initialWBSNodes, initialDependencies)

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [groupBy, setGroupBy] = useState<'status' | 'assignee'>('status')
  const [tab, setTab] = useState<Tab>('tasks')
  const [wbsView, setWbsView] = useState<WBSView>('tree')
  const [panel, setPanel] = useState<{ open: boolean; task: ProjectTask | null; isNew: boolean; defaultDate?: string }>({
    open: false, task: null, isNew: false,
  })
  const [wbsPanel, setWbsPanel] = useState<WBSNode | null>(null)

  const p = project ?? initialProject

  // Overall project progress from WBS
  const wbsTaskNodes = wbsNodes.filter(n => n.level === 'task')
  const wbsDone = wbsTaskNodes.filter(n => n.status === 'done').length
  const wbsProgress = wbsTaskNodes.length > 0 ? Math.round((wbsDone / wbsTaskNodes.length) * 100) : 0

  function openNew() { setPanel({ open: true, task: null, isNew: true }) }
  function openEdit(t: ProjectTask) { setPanel({ open: true, task: t, isNew: false }) }
  function closePanel() { setPanel(prev => ({ ...prev, open: false })) }

  async function handleSaveTask(data: Partial<ProjectTask> & { title: string }) {
    if (panel.task) {
      await updateTask(panel.task.id, data)
    } else {
      await createTask(data)
    }
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Back */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-navy transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Todos los proyectos
        </Link>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-brand-navy">{p.title}</h1>
            {p.contact && (
              <p className="mt-1 text-sm text-gray-500">
                {p.contact.first_name} {p.contact.last_name}
                {p.contact.email && (
                  <span className="ml-1.5 text-xs text-gray-400">· {p.contact.email}</span>
                )}
              </p>
            )}
            {(p.start_date || p.due_date) && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                {p.start_date && <span>Inicio: <strong className="text-gray-600">{new Date(p.start_date).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</strong></span>}
                {p.start_date && p.due_date && <span>·</span>}
                {p.due_date && <span>Entrega: <strong className="text-gray-600">{new Date(p.due_date).toLocaleDateString('es-MX', { dateStyle: 'medium' })}</strong></span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* WBS progress ring */}
            {wbsTaskNodes.length > 0 && (
              <div className="flex flex-col items-center gap-1">
                <ProjectProgressRing progress={wbsProgress} size={48} strokeWidth={4} />
                <span className="text-[10px] text-gray-400">avance WBS</span>
              </div>
            )}
            <div className="shrink-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Etapa</p>
              <select
                value={p.stage}
                onChange={e => updateProject({ stage: e.target.value as ProjectWithAll['stage'] })}
                className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-xs font-semibold outline-none ring-1 ring-gray-200 ${STAGE_COLORS[p.stage] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {STAGE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([
          { id: 'tasks' as Tab, label: `Tareas (${tasks.length})` },
          { id: 'wbs' as Tab, label: `Estructura (${wbsNodes.length})` },
          { id: 'calendar' as Tab, label: 'Calendario' },
          { id: 'deliverables' as Tab, label: `Entregables (${deliverables.length})` },
          { id: 'finances' as Tab, label: 'Finanzas' },
        ] as const).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative pb-2.5 px-1 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'text-brand-navy after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:rounded-full after:bg-brand-navy'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <ProjectCalendarTab
          tasks={tasks}
          deliverables={deliverables}
          profiles={profiles}
          onNewTask={dateStr => {
            setPanel({ open: true, task: null, isNew: true, defaultDate: dateStr })
          }}
          onOpenTask={openEdit}
        />
      )}

      {tab === 'deliverables' && (
        <ProjectDeliverables
          projectId={p.id}
          deliverables={deliverables}
          onUpdateDeliverable={updateDeliverable}
          onCreateDeliverable={createDeliverable}
        />
      )}

      {tab === 'wbs' && (
        <div className="space-y-4">
          {/* WBS sub-toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
              {([
                { v: 'tree' as WBSView, label: '≡ Árbol' },
                { v: 'gantt' as WBSView, label: '━ Línea de tiempo' },
              ] as const).map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setWbsView(v)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    wbsView === v ? 'bg-brand-navy text-white' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {wbsView === 'tree' ? (
            <div className="flex gap-0">
              {/* Tree */}
              <div className={`min-w-0 transition-all ${wbsPanel ? 'sm:flex-1' : 'w-full'}`}>
                <WBSTree
                  nodes={wbsNodes}
                  tree={tree}
                  profiles={profiles}
                  getNodeProgress={getNodeProgress}
                  onUpdateNode={updateNode}
                  onCreateNode={createNode}
                  onDeleteNode={deleteNode}
                  onOpenNode={setWbsPanel}
                  onMoveNode={moveNode}
                />
              </div>
              {/* Node detail panel — mobile: full-screen overlay, desktop: side panel */}
              {wbsPanel && (
                <>
                  {/* Mobile overlay */}
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-white sm:hidden">
                    <WBSNodePanel
                      node={wbsPanel}
                      allNodes={wbsNodes}
                      deps={deps}
                      profiles={profiles}
                      onClose={() => setWbsPanel(null)}
                      onUpdate={async (id, updates) => {
                        const result = await updateNode(id, updates)
                        setWbsPanel(prev => prev ? { ...prev, ...updates } : null)
                        return result
                      }}
                      onDelete={async id => {
                        await deleteNode(id)
                        setWbsPanel(null)
                      }}
                      onCreateDependency={async (payload) => createDependency(payload)}
                      onDeleteDependency={async (depId) => deleteDependency(depId)}
                    />
                  </div>
                  {/* Desktop side panel */}
                  <div className="hidden sm:block ml-4 w-80 shrink-0 rounded-xl border border-brand-stone shadow-sm">
                    <WBSNodePanel
                      node={wbsPanel}
                      allNodes={wbsNodes}
                      deps={deps}
                      profiles={profiles}
                      onClose={() => setWbsPanel(null)}
                      onUpdate={async (id, updates) => {
                        const result = await updateNode(id, updates)
                        setWbsPanel(prev => prev ? { ...prev, ...updates } : null)
                        return result
                      }}
                      onDelete={async id => {
                        await deleteNode(id)
                        setWbsPanel(null)
                      }}
                      onCreateDependency={async (payload) => createDependency(payload)}
                      onDeleteDependency={async (depId) => deleteDependency(depId)}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <GanttV2
              nodes={wbsNodes}
              tree={tree}
              dependencies={deps}
              profiles={profiles}
              getNodeProgress={getNodeProgress}
              onOpenNode={node => { setWbsPanel(node); setWbsView('tree') }}
            />
          )}
        </div>
      )}

      {tab === 'tasks' && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Group by */}
              <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white text-xs">
                <span className="flex items-center border-r border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  Agrupar
                </span>
                {(['status', 'assignee'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroupBy(g)}
                    className={`px-3 py-1.5 font-medium transition-colors ${
                      groupBy === g ? 'bg-brand-navy text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {g === 'status' ? 'Estado' : 'Responsable'}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex overflow-hidden rounded-lg border border-gray-200 bg-white text-xs">
                {([
                  { m: 'grid' as ViewMode,   label: '≡ Lista' },
                  { m: 'kanban' as ViewMode, label: '⊞ Tablero' },
                ] as const).map(({ m, label }) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={`px-3 py-1.5 font-medium transition-colors ${
                      viewMode === m ? 'bg-brand-navy text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={openNew}
              className="flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-navy-light transition-colors"
            >
              + Nueva tarea
            </button>
          </div>

          {viewMode === 'grid' && (
            <ProjectGrid
              tasks={tasks}
              profiles={profiles}
              projectStart={p.start_date}
              projectEnd={p.due_date}
              groupBy={groupBy}
              onUpdateTask={updateTask}
              onDeleteTask={deleteTask}
              onCreateTask={createTask}
              onOpenTask={openEdit}
            />
          )}
          {viewMode === 'kanban' && (
            <ProjectKanban
              tasks={tasks}
              profiles={profiles}
              groupBy={groupBy}
              onUpdateTask={updateTask}
              onOpenTask={openEdit}
            />
          )}
        </>
      )}

      {tab === 'finances' && (
        <ProjectFinancesTab projectId={p.id} />
      )}

      {/* Side panel for tasks */}
      <TaskSidePanel
        open={panel.open}
        task={panel.task}
        isNew={panel.isNew}
        defaultStartDate={panel.defaultDate}
        profiles={profiles}
        onClose={closePanel}
        onSave={handleSaveTask}
        onDelete={panel.task ? deleteTask : undefined}
      />
    </div>
  )
}
