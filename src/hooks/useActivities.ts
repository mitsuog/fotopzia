'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Activity, ActivityType } from '@/types/crm'

export function useActivities(contactId?: string, initialData?: Activity[]) {
  return useQuery({
    queryKey: ['activities', contactId],
    initialData,
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

export function useDealActivities(dealId?: string) {
  return useQuery({
    queryKey: ['activities', 'deal', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('deal_id', dealId!)
        .order('created_at', { ascending: false })
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
      schedule_start_at?: string
      schedule_end_at?: string
      assignee_user_ids?: string[]
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const shouldCreateCalendarEvent = (
        (payload.type === 'call' || payload.type === 'meeting')
        && Boolean(payload.contact_id)
        && Boolean(payload.schedule_start_at)
        && Boolean(payload.schedule_end_at)
      )

      if (shouldCreateCalendarEvent) {
        const response = await fetch('/api/crm-calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload.subject?.trim() || (payload.type === 'call' ? 'Llamada con cliente' : 'Reunion con cliente'),
            description: payload.body?.trim() || null,
            contact_id: payload.contact_id,
            deal_id: payload.deal_id ?? null,
            start_at: payload.schedule_start_at,
            end_at: payload.schedule_end_at,
            attendee_user_ids: payload.assignee_user_ids ?? [],
            activity_type: payload.type,
          }),
        })

        const calendarPayload = await response.json().catch(() => ({ error: 'No fue posible crear el evento de agenda.' })) as { error?: string }
        if (!response.ok) {
          throw new Error(calendarPayload.error ?? 'No fue posible crear el evento de agenda.')
        }

        return calendarPayload
      }

      const insertPayload = {
        type: payload.type,
        contact_id: payload.contact_id,
        deal_id: payload.deal_id,
        subject: payload.subject,
        body: payload.body,
        due_at: payload.due_at,
        created_by: user.id,
      }
      const { data, error } = await supabase
        .from('activities')
        .insert(insertPayload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      queryClient.invalidateQueries({ queryKey: ['crm-calendar-events'] })
      if (variables.contact_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', variables.contact_id] })
      }
      if (variables.deal_id) {
        queryClient.invalidateQueries({ queryKey: ['activities', 'deal', variables.deal_id] })
      }
    },
  })
}

export function useCompleteActivity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ activityId }: { activityId: string; contactId?: string }) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('activities')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', activityId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['activities'] })
      if (vars.contactId) queryClient.invalidateQueries({ queryKey: ['activities', vars.contactId] })
    },
  })
}
