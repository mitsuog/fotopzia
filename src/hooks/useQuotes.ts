'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Quote, QuoteStatus } from '@/types/quotes'

const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Borrador',
  sent: 'Enviada',
  viewed: 'Vista',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  expired: 'Expirada',
}

export function useQuotes() {
  return useQuery({
    queryKey: ['quotes'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('quotes')
        .select('*, contact:contacts(id, first_name, last_name, company_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Quote[]
    },
  })
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ quoteId, status }: { quoteId: string; status: QuoteStatus }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: currentQuote, error: currentQuoteError } = await supabase
        .from('quotes')
        .select('id, contact_id, deal_id, title, status')
        .eq('id', quoteId)
        .single()
      if (currentQuoteError || !currentQuote) throw (currentQuoteError ?? new Error('Cotización no encontrada'))

      const extra: Record<string, string> = {}
      if (status === 'sent') extra.sent_at = new Date().toISOString()
      if (status === 'approved') extra.approved_at = new Date().toISOString()
      const { error } = await supabase
        .from('quotes')
        .update({ status, ...extra, updated_at: new Date().toISOString() })
        .eq('id', quoteId)
      if (error) throw error

      const fromLabel = QUOTE_STATUS_LABELS[currentQuote.status as QuoteStatus] ?? currentQuote.status
      const toLabel = QUOTE_STATUS_LABELS[status] ?? status

      const { error: activityError } = await supabase
        .from('activities')
        .insert({
          type: 'stage_change',
          contact_id: currentQuote.contact_id,
          deal_id: currentQuote.deal_id,
          subject: `Cotización ${toLabel.toLowerCase()}`,
          body: `La cotización "${currentQuote.title}" cambió de ${fromLabel} a ${toLabel}.`,
          created_by: user.id,
        })

      if (activityError) {
        console.error('[quotes] No se pudo registrar actividad de cambio de estado:', activityError.message)
      }
    },
    onSuccess: (_data, { quoteId }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
      queryClient.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}
