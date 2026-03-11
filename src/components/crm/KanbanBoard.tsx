'use client'
import { useState, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import { useDeals, useUpdateDealStage } from '@/hooks/useDeals'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { NewDealSheet } from './NewDealSheet'
import { Search } from 'lucide-react'
import type { Deal, DealStage } from '@/types/crm'

const STAGES: DealStage[] = ['lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost']

interface KanbanBoardProps {
  initialDeals: Deal[]
}

export function KanbanBoard({ initialDeals }: KanbanBoardProps) {
  const { data: deals = initialDeals } = useDeals()
  const updateStage = useUpdateDealStage()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newDealStage, setNewDealStage] = useState<DealStage>('lead')
  const [isNewDealOpen, setIsNewDealOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  const filteredDeals = useMemo(() => {
    if (!search) return deals
    const q = search.toLowerCase()
    return deals.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.contact && `${d.contact.first_name} ${d.contact.last_name}`.toLowerCase().includes(q))
    )
  }, [deals, search])

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over) return
    const dealId = active.id as string
    const targetStage = over.id as DealStage
    if (STAGES.includes(targetStage)) {
      const deal = deals.find(d => d.id === dealId)
      if (deal && deal.stage !== targetStage) {
        updateStage.mutate({ dealId, stage: targetStage })
      }
    }
  }

  function handleAddDeal(stage: DealStage) {
    setNewDealStage(stage)
    setIsNewDealOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar deal o contacto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-brand-stone rounded-lg bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          />
        </div>
        <button
          onClick={() => handleAddDeal('lead')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-navy text-white text-sm rounded-lg hover:bg-brand-navy-light transition-colors"
        >
          + Nuevo Deal
        </button>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 h-full pb-4" style={{ minWidth: 'max-content' }}>
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={filteredDeals.filter(d => d.stage === stage)}
                onAddDeal={handleAddDeal}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal ? <KanbanCard deal={activeDeal} isDragOverlay /> : null}
          </DragOverlay>
        </DndContext>
      </div>

      <NewDealSheet
        open={isNewDealOpen}
        defaultStage={newDealStage}
        onClose={() => setIsNewDealOpen(false)}
      />
    </div>
  )
}
