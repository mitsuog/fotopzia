import { ContractStatusBadge } from '@/components/contracts/ContractStatusBadge'
import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ContractsPage() {
  const supabase = await createClient()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, contract_number, title, status, created_at, contact:contacts(first_name, last_name)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader title="Contratos" subtitle={`${contracts?.length ?? 0} contratos registrados`} badge="Legal" />

      <div className="rounded-xl border border-brand-stone/80 bg-white/80 overflow-hidden shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
            <tr className="border-b border-brand-stone bg-brand-canvas/80">
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Numero</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Titulo</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Cliente</th>
              <th className="text-left px-4 py-3 font-semibold text-brand-navy">Estado</th>
            </tr>
            </thead>
            <tbody>
            {(contracts ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-10 text-gray-400">Sin contratos por ahora</td>
              </tr>
            ) : (
              contracts?.map(contract => (
                <tr key={contract.id} className="border-b border-brand-stone/50 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{contract.contract_number}</td>
                  <td className="px-4 py-3 font-medium text-brand-navy">{contract.title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {contract.contact ? `${contract.contact.first_name} ${contract.contact.last_name}` : '-'}
                  </td>
                  <td className="px-4 py-3"><ContractStatusBadge status={contract.status} /></td>
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
