import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectDetail } from '@/components/projects/ProjectDetail'
import type { ProjectWithAll, ProjectTask, ProjectDeliverable, TeamProfile } from '@/hooks/useProject'
import type { WBSNode, Dependency } from '@/types/wbs'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ projectId: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { projectId } = await params
  const supabase = await createClient()

  const [
    { data: project },
    { data: tasks },
    { data: deliverables },
    { data: profiles },
    { data: wbsNodes },
    { data: dependencies },
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('*, contact:contacts(first_name, last_name, email)')
      .eq('id', projectId)
      .single(),
    supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false }),
    supabase
      .from('project_deliverables')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('id, full_name, role, email')
      .neq('role', 'client'),
    supabase
      .from('project_wbs_nodes')
      .select('*')
      .eq('project_id', projectId)
      .order('level', { ascending: true })
      .order('position', { ascending: true }),
    supabase
      .from('project_dependencies')
      .select('*')
      .eq('project_id', projectId),
  ])

  if (!project) notFound()

  return (
    <ProjectDetail
      initialProject={project as unknown as ProjectWithAll}
      initialTasks={(tasks ?? []) as unknown as ProjectTask[]}
      initialDeliverables={(deliverables ?? []) as unknown as ProjectDeliverable[]}
      initialWBSNodes={(wbsNodes ?? []) as unknown as WBSNode[]}
      initialDependencies={(dependencies ?? []) as unknown as Dependency[]}
      profiles={(profiles ?? []) as unknown as TeamProfile[]}
    />
  )
}
