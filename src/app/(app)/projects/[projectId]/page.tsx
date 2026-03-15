import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectDetail } from '@/components/projects/ProjectDetail'
import type { ProjectWithAll, ProjectTask, ProjectDeliverable, TeamProfile } from '@/hooks/useProject'

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
  ])

  if (!project) notFound()

  return (
    <ProjectDetail
      initialProject={project as unknown as ProjectWithAll}
      initialTasks={(tasks ?? []) as unknown as ProjectTask[]}
      initialDeliverables={(deliverables ?? []) as unknown as ProjectDeliverable[]}
      profiles={(profiles ?? []) as unknown as TeamProfile[]}
    />
  )
}
