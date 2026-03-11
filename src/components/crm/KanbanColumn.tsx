'use client'
import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { KanbanCard } from './KanbanCard'
import type { Deal, DealStage } from '@/types/crm'

const STAGE_STYLES: Record<DealStage, { header: string; badge: string }> = {
  lead:        { header: 'bg-slate-100 text-slate-600', badge: 'text-slate-500' },
  prospect:    { header: 'bg-blue-50 text-blue-700', badge: 'text-blue-500' },
  qualified:   { header: 'bg-violet-50 text-violet-700', badge: 'text-violet-500' },
  proposal:    { header: 'bg-amber-50 text-amber-700', badge: 'text-amber-500' },
  negotiation: { header: 'bg-orange-50 text-orange-700', badge: 'text-orange-500' },
  won:         { header: 'bg-emerald-50 text-emerald-700', badge: 'text-emerald-500' },
  lost:        { header: 'bg-red-50 text-red-500', badge: 'text-red-400' },
}

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  qualified: 'Calificado',
  proposal: 'Propuesta',
  negotiation: 'Negociación',
  won: 'Confirmado',
  lost: 'Perdido',
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

  return (
    <div className="min-w-[260px] max-w-[280px] h-full flex flex-col">
      <div className={cn('flex items-center justify-between px-3 py-2 rounded-t-lg', styles.header)}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{STAGE_LABELS[stage]}</span>
          <span className={cn('text-xs font-medium', styles.badge)}>({deals.length})</span>
        </div>
        <button
          onClick={() => onAddDeal?.(stage)}
          className="w-5 h-5 rounded flex items-center justify-center hover:bg-black/10 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 flex flex-col gap-2 p-2 rounded-b-lg bg-brand-canvas border border-t-0 border-brand-stone overflow-y-auto',
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
          <div className="flex items-center justify-center h-16 text-xs text-gray-400 italic">
            Sin deals
          </div>
        )}
      </div>
    </div>
  )
}
