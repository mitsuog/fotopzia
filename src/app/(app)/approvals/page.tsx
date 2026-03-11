import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ApprovalsPage() {
  const supabase = await createClient()

  const { data: flows } = await supabase
    .from('approval_flows')
    .select('id, title, entity_type, status, created_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Aprobaciones" subtitle={`${flows?.length ?? 0} flujos en seguimiento`} badge="Workflows" />

      <div className="rounded-xl border border-brand-stone/80 bg-white/80 overflow-hidden shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
            <tr className="border-b border-brand-stone bg-brand-canvas/80">
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Titulo</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Entidad</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Estado</th>
            </tr>
            </thead>
            <tbody>
            {(flows ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center py-10 text-gray-400">Sin flujos de aprobacion</td>
              </tr>
            ) : (
              flows?.map(flow => (
                <tr key={flow.id} className="border-b border-brand-stone/50 last:border-0">
                  <td className="px-4 py-3 font-medium text-brand-navy">{flow.title}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{flow.entity_type}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize text-gray-600">
                      {flow.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
