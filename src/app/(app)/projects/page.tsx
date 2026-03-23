import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'
import { ProjectsPageClient } from '@/components/projects/ProjectsPageClient'
import type { PortfolioProjectSummary, ProjectType } from '@/types/wbs'

export const dynamic = 'force-dynamic'

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
    supabase.from('project_tasks').select('project_id, status'),
    supabase.from('project_deliverables').select('project_id, status'),
    supabase.from('project_wbs_nodes').select('project_id, status, level').eq('level', 'task'),
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

  const rawProjects = ((projects ?? []) as unknown as RawProject[])

  const taskMap = new Map<string, { total: number; done: number }>()
  for (const task of tasks ?? []) {
    const t = task as { project_id: string; status: string }
    const cur = taskMap.get(t.project_id) ?? { total: 0, done: 0 }
    cur.total++
    if (t.status === 'done') cur.done++
    taskMap.set(t.project_id, cur)
  }
  for (const node of wbsResult.data ?? []) {
    const n = node as { project_id: string; status: string }
    const cur = taskMap.get(n.project_id) ?? { total: 0, done: 0 }
    cur.total++
    if (n.status === 'done') cur.done++
    taskMap.set(n.project_id, cur)
  }

  const deliverableMap = new Map<string, { total: number; delivered: number }>()
  for (const item of deliverables ?? []) {
    const d = item as { project_id: string; status: string }
    const cur = deliverableMap.get(d.project_id) ?? { total: 0, delivered: 0 }
    cur.total++
    if (d.status === 'delivered' || d.status === 'approved') cur.delivered++
    deliverableMap.set(d.project_id, cur)
  }

  const macroMap = new Map<string, number>()
  for (const node of macroResult.data ?? []) {
    const n = node as { project_id: string }
    macroMap.set(n.project_id, (macroMap.get(n.project_id) ?? 0) + 1)
  }

  const projectRows = rawProjects.map(p => {
    const ts = taskMap.get(p.id) ?? { total: 0, done: 0 }
    const progress = ts.total > 0 ? Math.round((ts.done / ts.total) * 100) : 0
    return {
      id: p.id,
      title: p.title,
      stage: p.stage,
      project_type: p.project_type ?? 'contract',
      start_date: p.start_date,
      due_date: p.due_date,
      color: p.color,
      assigned_to: p.assigned_to,
      is_archived: Boolean(p.is_archived),
      archived_at: p.archived_at,
      contact: p.contact
        ? { first_name: p.contact.first_name, last_name: p.contact.last_name }
        : null,
      progress,
      taskStats: ts,
      deliverableStats: deliverableMap.get(p.id) ?? { total: 0, delivered: 0 },
    }
  })

  const portfolioProjects: PortfolioProjectSummary[] = rawProjects
    .filter(p => p.stage !== 'cierre' && !p.is_archived)
    .map(p => {
      const ts = taskMap.get(p.id) ?? { total: 0, done: 0 }
      const progress = ts.total > 0 ? Math.round((ts.done / ts.total) * 100) : 0
      const contact = p.contact
      const contactName = contact?.company_name
        ? contact.company_name
        : contact
          ? `${contact.first_name} ${contact.last_name}`.trim()
          : null
      return {
        id: p.id,
        title: p.title,
        stage: p.stage,
        project_type: (p.project_type ?? 'contract') as ProjectType,
        start_date: p.start_date,
        due_date: p.due_date,
        progress,
        color: p.color,
        contact_name: contactName,
        assigned_to_name: null,
        macro_count: macroMap.get(p.id) ?? 0,
        task_done: ts.done,
        task_total: ts.total,
      }
    })

  const activeCount = projectRows.filter(p => p.stage !== 'cierre' && !p.is_archived).length

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
