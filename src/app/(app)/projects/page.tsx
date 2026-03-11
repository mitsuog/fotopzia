import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

type ProjectRow = {
  id: string
  title: string
  stage: string
  due_date: string | null
  contact: { first_name: string; last_name: string } | null
}

type TaskRow = { project_id: string; status: string }
type DeliverableRow = { project_id: string; status: string }

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()

  const [{ data: projects }, { data: tasks }, { data: deliverables }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, title, stage, due_date, contact:contacts(first_name, last_name)')
      .order('created_at', { ascending: false }),
    supabase.from('project_tasks').select('project_id, status'),
    supabase.from('project_deliverables').select('project_id, status'),
  ])

  const taskMap = new Map<string, { total: number; done: number }>()
  ;((tasks ?? []) as unknown as TaskRow[]).forEach(task => {
    const current = taskMap.get(task.project_id) ?? { total: 0, done: 0 }
    current.total += 1
    if (task.status === 'done') current.done += 1
    taskMap.set(task.project_id, current)
  })

  const deliverableMap = new Map<string, { total: number; delivered: number }>()
  ;((deliverables ?? []) as unknown as DeliverableRow[]).forEach(item => {
    const current = deliverableMap.get(item.project_id) ?? { total: 0, delivered: 0 }
    current.total += 1
    if (item.status === 'delivered' || item.status === 'approved') current.delivered += 1
    deliverableMap.set(item.project_id, current)
  })

  return (
    <div>
      <PageHeader title="Proyectos" subtitle={`${projects?.length ?? 0} proyectos en operacion`} badge="Studio Ops" />

      <div className="rounded-xl border border-brand-stone/80 bg-white/80 overflow-hidden shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
            <tr className="border-b border-brand-stone bg-brand-canvas/80">
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Proyecto</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Etapa</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Tareas</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Entregables</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Vence</th>
            </tr>
            </thead>
            <tbody>
            {(projects ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">Sin proyectos aun</td>
              </tr>
            ) : (
              ((projects ?? []) as unknown as ProjectRow[]).map(project => {
                const taskStats = taskMap.get(project.id) ?? { total: 0, done: 0 }
                const deliverableStats = deliverableMap.get(project.id) ?? { total: 0, delivered: 0 }

                return (
                  <tr key={project.id} className="border-b border-brand-stone/50 last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-navy">{project.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {project.contact ? `${project.contact.first_name} ${project.contact.last_name}` : 'Sin contacto'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                        {project.stage.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{taskStats.done}/{taskStats.total}</td>
                    <td className="px-4 py-3 text-gray-700">{deliverableStats.delivered}/{deliverableStats.total}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {project.due_date ? new Date(project.due_date).toLocaleDateString('es-MX') : '-'}
                    </td>
                  </tr>
                )
              })
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
