'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Deal, DealStage } from '@/types/crm'

function mapDealErrorMessage(message: string): string {
  const m = message.toLowerCase()

  if (m.includes('duplicar el mismo cliente')) return message
  if (m.includes('al menos una cotizacion')) return message
  if (m.includes('autorizacion del cliente')) return message
  if (m.includes('cotizacion enviada o aprobada')) return message
  if (m.includes('cotizacion aprobada')) return message
  if (m.includes('contrato firmado')) return message
  if (m.includes('row-level security policy')) return 'Tu usuario no tiene permisos para mover este deal.'

  return message
}

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('deals')
        .select('*, contact:contacts(id, first_name, last_name, email, company_name, source, tags)')
        .order('position')
      if (error) throw error
      return data as Deal[]
    },
  })
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: string; stage: DealStage }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('deals')
        .update({ stage, updated_at: new Date().toISOString() })
        .eq('id', dealId)
      if (error) throw new Error(mapDealErrorMessage(error.message))
    },
    onMutate: async ({ dealId, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] })
      const previous = queryClient.getQueryData(['deals'])
      queryClient.setQueryData(['deals'], (old: Deal[] | undefined) =>
        old ? old.map(d => d.id === dealId ? { ...d, stage } : d) : []
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['deals'], context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })
}

export function useCreateDeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      contact_id: string
      title: string
      stage: DealStage
      value?: number
      currency?: string
      expected_close?: string
      notes?: string
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('deals')
        .insert({ ...payload, created_by: user.id })
        .select('*, contact:contacts(*)')
        .single()
      if (error) throw new Error(mapDealErrorMessage(error.message))
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deals'] }),
  })
}
