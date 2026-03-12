'use client'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { KanbanCard } from './KanbanCard'
import type { Deal, DealStage } from '@/types/crm'

const STAGE_STYLES: Record<DealStage, { header: string; badge: string }> = {
  lead:     { header: 'bg-slate-100 text-slate-600', badge: 'text-slate-500' },
  prospect: { header: 'bg-blue-50 text-blue-700',   badge: 'text-blue-500' },
  proposal: { header: 'bg-amber-50 text-amber-700', badge: 'text-amber-500' },
  won:      { header: 'bg-emerald-50 text-emerald-700', badge: 'text-emerald-500' },
  lost:     { header: 'bg-red-50 text-red-500',     badge: 'text-red-400' },
}

const STAGE_LABELS: Record<DealStage, string> = {
  lead:     'Lead',
  prospect: 'Prospecto',
  proposal: 'Propuesta',
  won:      'Confirmado',
  lost:     'Perdido',
}

interface KanbanColumnProps {
  stage: DealStage
  deals: Deal[]
  onAddDeal?: (stage: DealStage) => void
  onCardClick?: (deal: Deal) => void
}

export function KanbanColumn({ stage, deals, onAddDeal, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const styles = STAGE_STYLES[stage]
  const canShowAddButton = stage === 'lead' || stage === 'prospect'
  const addAriaLabel = stage === 'lead' ? 'Crear contacto en Lead' : 'Crear deal en Prospecto'

  return (
    <div className="flex h-full flex-1 min-w-[220px] max-w-[360px] flex-col">
      <div className={cn('flex items-center justify-between rounded-t-lg px-3 py-2', styles.header)}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{STAGE_LABELS[stage]}</span>
          <span className={cn('text-xs font-medium', styles.badge)}>({deals.length})</span>
        </div>
        {canShowAddButton && (
          <button
            onClick={() => onAddDeal?.(stage)}
            className="flex h-5 w-5 items-center justify-center rounded transition-colors hover:bg-black/10"
            aria-label={addAriaLabel}
            title={addAriaLabel}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-1 flex-col gap-2 overflow-y-auto rounded-b-lg border border-t-0 border-brand-stone bg-brand-canvas p-2',
          isOver && 'bg-brand-stone/50',
        )}
      >
        {deals.map(deal => (
          <KanbanCard
            key={deal.id}
            deal={deal}
            onClick={() => onCardClick?.(deal)}
          />
        ))}
        {deals.length === 0 && (
          <div className="flex h-16 items-center justify-center text-xs italic text-gray-400">
            Sin deals
          </div>
        )}
      </div>
    </div>
  )
}
