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
import { useDeals, useUpdateDealStage, useUpdateLostDetails } from '@/hooks/useDeals'
import { KanbanColumn } from './KanbanColumn'
import { KanbanCard } from './KanbanCard'
import { NewDealSheet } from './NewDealSheet'
import { NewContactSheet } from './NewContactSheet'
import { DealDetailPanel } from './DealDetailPanel'
import { LostReasonDialog } from './LostReasonDialog'
import { Search } from 'lucide-react'
import type { Deal, DealStage, LostDetails } from '@/types/crm'

const STAGES: DealStage[] = ['lead', 'prospect', 'proposal', 'won', 'lost']
const DND_CONTEXT_ID = 'crm-kanban-dnd'

interface KanbanBoardProps {
  initialDeals: Deal[]
}

export function KanbanBoard({ initialDeals }: KanbanBoardProps) {
  const { data: deals = initialDeals } = useDeals()
  const updateStage = useUpdateDealStage()
  const updateLostDetails = useUpdateLostDetails()

  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [pendingLostDealId, setPendingLostDealId] = useState<string | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [newDealStage, setNewDealStage] = useState<DealStage>('prospect')
  const [isNewDealOpen, setIsNewDealOpen] = useState(false)
  const [isNewContactOpen, setIsNewContactOpen] = useState(false)

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
    setPipelineError(null)
    const { active, over } = event
    if (!over) return
    const dealId = active.id as string
    const targetStage = over.id as DealStage
    if (!STAGES.includes(targetStage)) return
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === targetStage) return

    if (targetStage === 'lost') {
      setPendingLostDealId(dealId)
      return
    }

    updateStage.mutate(
      { dealId, stage: targetStage },
      {
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'No fue posible mover el deal.'
          setPipelineError(message)
        },
      },
    )
  }

  function handleStageChange(stage: DealStage) {
    if (!selectedDeal) return
    if (stage === 'lost') {
      setPendingLostDealId(selectedDeal.id)
      setSelectedDeal(null)
      return
    }
    updateStage.mutate(
      { dealId: selectedDeal.id, stage },
      {
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'No fue posible mover el deal.'
          setPipelineError(message)
        },
      },
    )
  }

  async function handleLostConfirm(details: LostDetails) {
    if (!pendingLostDealId) return
    await updateLostDetails.mutateAsync(
      { dealId: pendingLostDealId, details },
    ).catch((error) => {
      const message = error instanceof Error ? error.message : 'No fue posible registrar la pérdida.'
      setPipelineError(message)
    })
    setPendingLostDealId(null)
  }

  function handleAddDeal(stage: DealStage) {
    if (stage === 'lead') {
      setIsNewContactOpen(true)
      return
    }
    if (stage !== 'prospect') return

    setNewDealStage('prospect')
    setIsNewDealOpen(true)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar deal o contacto..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-brand-stone bg-brand-paper py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          />
        </div>
      </div>

      {pipelineError && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {pipelineError}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-x-auto">
        <DndContext
          id={DND_CONTEXT_ID}
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full min-h-0 gap-3 pb-4">
            {STAGES.map(stage => (
              <KanbanColumn
                key={stage}
                stage={stage}
                deals={filteredDeals.filter(d => d.stage === stage)}
                onAddDeal={handleAddDeal}
                onCardClick={setSelectedDeal}
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

      <NewContactSheet
        open={isNewContactOpen}
        onClose={() => setIsNewContactOpen(false)}
      />

      <DealDetailPanel
        open={selectedDeal !== null}
        deal={selectedDeal}
        onClose={() => setSelectedDeal(null)}
        onStageChange={handleStageChange}
      />

      <LostReasonDialog
        open={pendingLostDealId !== null}
        onConfirm={handleLostConfirm}
        onCancel={() => setPendingLostDealId(null)}
      />
    </div>
  )
}
