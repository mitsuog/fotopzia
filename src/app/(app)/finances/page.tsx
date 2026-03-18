import { FinancesOverviewClient } from '@/components/finances/FinancesOverviewClient'

export const dynamic = 'force-dynamic'

export default async function FinancesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Resumen Financiero</h1>
        <p className="text-sm text-gray-400">Análisis por período</p>
      </div>
      <FinancesOverviewClient initialSummary={null} />
    </div>
  )
}
