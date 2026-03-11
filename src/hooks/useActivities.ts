'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Activity, ActivityType } from '@/types/crm'

export function useActivities(contactId?: string) {
  return useQuery({
    queryKey: ['activities', contactId],
    queryFn: async () => {
      const supabase = createClient()
      let query = supabase
        .from('activities')
        .select('*')
        .order('created_at', { ascending: false })
      if (contactId) query = query.eq('contact_id', contactId)
      const { data, error } = await query
      if (error) throw error
      return data as Activity[]
    },
  })
}

export function useCreateActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      type: ActivityType
      contact_id?: string
      deal_id?: string
      subject?: string
      body?: string
      due_at?: string
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('activities')
        .insert({ ...payload, created_by: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      if (variables.contact_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', variables.contact_id] })
      }
    },
  })
}
