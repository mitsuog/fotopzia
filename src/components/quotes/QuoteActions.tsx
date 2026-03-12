'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Printer, ChevronDown } from 'lucide-react'
import { useUpdateQuoteStatus } from '@/hooks/useQuotes'
import { cn } from '@/lib/utils'
import type { QuoteStatus } from '@/types/quotes'

const TRANSITIONS: Record<QuoteStatus, { label: string; next: QuoteStatus; className: string }[]> = {
  draft:    [{ label: 'Marcar como Enviada', next: 'sent',     className: 'bg-blue-600 hover:bg-blue-700 text-white' }],
  sent:     [{ label: 'Marcar como Vista',   next: 'viewed',   className: 'bg-purple-600 hover:bg-purple-700 text-white' },
             { label: 'Aprobar manualmente', next: 'approved', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
             { label: 'Marcar rechazada',    next: 'rejected', className: 'bg-red-600 hover:bg-red-700 text-white' }],
  viewed:   [{ label: 'Aprobar manualmente', next: 'approved', className: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
             { label: 'Marcar rechazada',    next: 'rejected', className: 'bg-red-600 hover:bg-red-700 text-white' }],
  approved: [],
  rejected: [{ label: 'Reabrir como borrador', next: 'draft', className: 'bg-gray-600 hover:bg-gray-700 text-white' }],
  expired:  [{ label: 'Reabrir como borrador', next: 'draft', className: 'bg-gray-600 hover:bg-gray-700 text-white' }],
}

interface QuoteActionsProps {
  quoteId: string
  status: QuoteStatus
  dealId?: string | null
}

export function QuoteActions({ quoteId, status, dealId }: QuoteActionsProps) {
  const router = useRouter()
  const updateStatus = useUpdateQuoteStatus()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const transitions = TRANSITIONS[status] ?? []

  async function handleTransition(next: QuoteStatus) {
    setError(null)
    setOpen(false)
    try {
      await updateStatus.mutateAsync({ quoteId, status: next })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error actualizando estado')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Print */}
      <a
        href={`/quotes/${quoteId}/print`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-canvas"
      >
        <Printer className="h-3.5 w-3.5" />
        Imprimir / PDF
      </a>

      {/* Deal link */}
      {dealId && (
        <a
          href={`/crm/kanban`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-brand-canvas"
        >
          Ver Deal →
        </a>
      )}

      {/* Status transitions */}
      {transitions.length === 1 && (
        <button
          onClick={() => handleTransition(transitions[0].next)}
          disabled={updateStatus.isPending}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50',
            transitions[0].className,
          )}
        >
          {updateStatus.isPending ? 'Guardando…' : transitions[0].label}
        </button>
      )}

      {transitions.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light transition-colors"
          >
            Cambiar estado <ChevronDown className="h-3 w-3" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border border-brand-stone bg-white shadow-lg">
                {transitions.map(t => (
                  <button
                    key={t.next}
                    onClick={() => handleTransition(t.next)}
                    className="flex w-full items-center px-3 py-2 text-left text-xs text-gray-700 hover:bg-brand-canvas transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  )
}
