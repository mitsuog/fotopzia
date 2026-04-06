import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { ProjectsPageClient } from '@/components/projects/ProjectsPageClient'
import type { PortfolioProjectSummary, ProjectType } from '@/types/wbs'

export const dynamic = 'force-dynamic'

type ObjectiveStats = {
  blocked_count: number
  overdue_count: number
  upcoming_count: number
  next_due_date: string | null
  risk_level: 'low' | 'medium' | 'high'
}

function toIsoDate(value: string | null): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export default async function ProjectsPage() {
  const supabase = await createClient()

  const [
    { data: projects },
    { data: tasks },
    { data: deliverables },
    wbsResult,
    macroResult,
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, stage, project_type, start_date, due_date, color, assigned_to, is_archived, archived_at, contact:contacts(first_name, last_name, company_name)')
      .order('created_at', { ascending: false }),
    supabase.from('project_tasks').select('project_id, status, due_at'),
    supabase.from('project_deliverables').select('project_id, status, due_at'),
    supabase.from('project_wbs_nodes').select('project_id, status, level, due_at').eq('level', 'task'),
    supabase.from('project_wbs_nodes').select('project_id, level').eq('level', 'macro'),
    supabase.from('profiles').select('id, full_name, email').order('full_name'),
  ])

  type RawProject = {
    id: string
    title: string
    stage: string
    project_type: string | null
    start_date: string | null
    due_date: string | null
    color: string | null
    assigned_to: string | null
    is_archived: boolean | null
    archived_at: string | null
    contact: { first_name: string; last_name: string; company_name: string | null } | null
  }

  type TaskLike = {
    project_id: string
    status: string
    due_at?: string | null
  }

  const rawProjects = (projects ?? []) as unknown as RawProject[]

  const taskMap = new Map<string, { total: number; done: number }>()
  const objectiveMap = new Map<string, Omit<ObjectiveStats, 'risk_level'>>()

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const in7Days = new Date(todayStart)
  in7Days.setDate(in7Days.getDate() + 7)

  const registerOpenItem = (projectId: string, dueAt: string | null | undefined, isBlocked: boolean) => {
    const current = objectiveMap.get(projectId) ?? {
      blocked_count: 0,
      overdue_count: 0,
      upcoming_count: 0,
      next_due_date: null,
    }

    if (isBlocked) {
      current.blocked_count += 1
    }

    const dueDate = toIsoDate(dueAt ?? null)
    if (dueDate) {
      if (dueDate < todayStart) {
        current.overdue_count += 1
      } else if (dueDate <= in7Days) {
        current.upcoming_count += 1
      }

      if (!current.next_due_date || dueDate < new Date(current.next_due_date)) {
        current.next_due_date = dueDate.toISOString()
      }
    }

    objectiveMap.set(projectId, current)
  }

  const registerTaskProgress = (item: TaskLike, doneStatuses: string[]) => {
    const current = taskMap.get(item.project_id) ?? { total: 0, done: 0 }
    current.total += 1
    if (doneStatuses.includes(item.status)) current.done += 1
    taskMap.set(item.project_id, current)

    if (!doneStatuses.includes(item.status)) {
      registerOpenItem(item.project_id, item.due_at ?? null, item.status === 'blocked')
    }
  }

  for (const task of tasks ?? []) {
    registerTaskProgress(task as TaskLike, ['done'])
  }

  for (const node of wbsResult.data ?? []) {
    registerTaskProgress(node as TaskLike, ['done'])
  }

  const deliverableMap = new Map<string, { total: number; delivered: number }>()
  for (const item of deliverables ?? []) {
    const deliverable = item as { project_id: string; status: string; due_at?: string | null }
    const current = deliverableMap.get(deliverable.project_id) ?? { total: 0, delivered: 0 }
    current.total += 1
    if (deliverable.status === 'delivered' || deliverable.status === 'approved') {
      current.delivered += 1
    } else {
      registerOpenItem(deliverable.project_id, deliverable.due_at ?? null, deliverable.status === 'blocked')
    }
    deliverableMap.set(deliverable.project_id, current)
  }

  const macroMap = new Map<string, number>()
  for (const node of macroResult.data ?? []) {
    const macro = node as { project_id: string }
    macroMap.set(macro.project_id, (macroMap.get(macro.project_id) ?? 0) + 1)
  }

  const profileMap = new Map<string, string>()
  for (const profile of profilesData ?? []) {
    const item = profile as { id: string; full_name: string | null; email: string | null }
    profileMap.set(item.id, item.full_name ?? item.email ?? item.id)
  }

  const getObjectiveStats = (projectId: string): ObjectiveStats => {
    const base = objectiveMap.get(projectId) ?? {
      blocked_count: 0,
      overdue_count: 0,
      upcoming_count: 0,
      next_due_date: null,
    }

    let riskLevel: ObjectiveStats['risk_level'] = 'low'
    if (base.overdue_count > 0 || base.blocked_count >= 2) riskLevel = 'high'
    else if (base.blocked_count > 0 || base.upcoming_count >= 3) riskLevel = 'medium'

    return {
      ...base,
      risk_level: riskLevel,
    }
  }

  const projectRows = rawProjects.map(project => {
    const taskStats = taskMap.get(project.id) ?? { total: 0, done: 0 }
    const progress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0
    const objectiveStats = getObjectiveStats(project.id)

    return {
      id: project.id,
      title: project.title,
      stage: project.stage,
      project_type: project.project_type ?? 'contract',
      start_date: project.start_date,
      due_date: project.due_date,
      color: project.color,
      assigned_to: project.assigned_to,
      assigned_to_name: project.assigned_to ? profileMap.get(project.assigned_to) ?? null : null,
      is_archived: Boolean(project.is_archived),
      archived_at: project.archived_at,
      contact: project.contact
        ? { first_name: project.contact.first_name, last_name: project.contact.last_name }
        : null,
      progress,
      taskStats,
      deliverableStats: deliverableMap.get(project.id) ?? { total: 0, delivered: 0 },
      objectiveStats,
    }
  })

  const portfolioProjects: PortfolioProjectSummary[] = rawProjects
    .filter(project => project.stage !== 'cierre' && !project.is_archived)
    .map(project => {
      const taskStats = taskMap.get(project.id) ?? { total: 0, done: 0 }
      const progress = taskStats.total > 0 ? Math.round((taskStats.done / taskStats.total) * 100) : 0
      const contact = project.contact
      const contactName = contact?.company_name
        ? contact.company_name
        : contact
          ? `${contact.first_name} ${contact.last_name}`.trim()
          : null

      return {
        id: project.id,
        title: project.title,
        stage: project.stage,
        project_type: (project.project_type ?? 'contract') as ProjectType,
        start_date: project.start_date,
        due_date: project.due_date,
        progress,
        color: project.color,
        contact_name: contactName,
        assigned_to_name: project.assigned_to ? profileMap.get(project.assigned_to) ?? null : null,
        macro_count: macroMap.get(project.id) ?? 0,
        task_done: taskStats.done,
        task_total: taskStats.total,
      }
    })

  const activeCount = projectRows.filter(project => project.stage !== 'cierre' && !project.is_archived).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Proyectos"
        subtitle={`${activeCount} proyectos activos · ${projectRows.length} en total`}
        badge="Studio Ops"
      />
      <ProjectsPageClient
        projects={projectRows}
        portfolioProjects={portfolioProjects}
        profiles={(profilesData ?? []) as { id: string; full_name: string | null; email: string | null }[]}
      />
    </div>
  )
}
