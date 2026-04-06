import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import type { PortfolioProjectSummary, ProjectType } from '@/types/wbs'

export const dynamic = 'force-dynamic'

type RawProject = {
  id: string
  title: string
  stage: string
  project_type: string | null
  start_date: string | null
  due_date: string | null
  progress_mode: string | null
  progress_pct: number | null
  color: string | null
  assigned_to: string | null
  contact: { first_name: string; last_name: string; company_name: string | null } | null
  assigned_profile: { full_name: string | null } | null
}

type RawWBSNode = {
  id: string
  project_id: string
  status: string
  level: string
}

export async function GET() {
  const supabase = await createClient()

  const projectQuery = await supabase
    .from('projects')
    .select(`
      id, title, stage, project_type, start_date, due_date,
      progress_mode, progress_pct, color, assigned_to,
      contact:contacts(first_name, last_name, company_name),
      assigned_profile:profiles!projects_assigned_to_fkey(full_name)
    `)
    .neq('stage', 'cierre')
    .neq('is_archived', true)
    .order('created_at', { ascending: false })

  let rawProjects = projectQuery.data

  if (projectQuery.error) {
    const fallback = await supabase
      .from('projects')
      .select(`
        id, title, stage, start_date, due_date,
        contact:contacts(first_name, last_name, company_name)
      `)
      .neq('stage', 'cierre')
      .neq('is_archived', true)
      .order('created_at', { ascending: false })

    if (fallback.error) {
      return apiError('SERVER_ERROR', fallback.error.message, { status: 400 })
    }

    rawProjects = fallback.data as unknown as typeof rawProjects
  }

  const projects = (rawProjects ?? []) as unknown as RawProject[]

  if (projects.length === 0) {
    return apiSuccess([], { total: 0 })
  }

  const projectIds = projects.map(project => project.id)

  const [{ data: rawWbsNodes }, { data: rawMacroNodes }] = await Promise.all([
    supabase
      .from('project_wbs_nodes')
      .select('id, project_id, level, status')
      .in('project_id', projectIds)
      .eq('level', 'task'),
    supabase
      .from('project_wbs_nodes')
      .select('id, project_id')
      .in('project_id', projectIds)
      .eq('level', 'macro'),
  ])

  const wbsNodes = (rawWbsNodes ?? []) as unknown as RawWBSNode[]
  const macroNodes = (rawMacroNodes ?? []) as unknown as { id: string; project_id: string }[]

  const tasksByProject = new Map<string, { total: number; done: number }>()
  for (const node of wbsNodes) {
    const entry = tasksByProject.get(node.project_id) ?? { total: 0, done: 0 }
    entry.total++
    if (node.status === 'done') entry.done++
    tasksByProject.set(node.project_id, entry)
  }

  const macrosByProject = new Map<string, number>()
  for (const node of macroNodes) {
    macrosByProject.set(node.project_id, (macrosByProject.get(node.project_id) ?? 0) + 1)
  }

  const summaries: PortfolioProjectSummary[] = projects.map(project => {
    const tasks = tasksByProject.get(project.id) ?? { total: 0, done: 0 }

    let progress: number
    if (project.progress_mode === 'manual' && project.progress_pct !== null) {
      progress = project.progress_pct
    } else if (tasks.total > 0) {
      progress = Math.round((tasks.done / tasks.total) * 100)
    } else {
      progress = 0
    }

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
      assigned_to_name: project.assigned_profile?.full_name ?? null,
      macro_count: macrosByProject.get(project.id) ?? 0,
      task_done: tasks.done,
      task_total: tasks.total,
    }
  })

  return apiSuccess(summaries, { total: summaries.length })
}
