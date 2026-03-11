'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Contact } from '@/types/crm'

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Contact[]
    },
  })
}

export function useCreateContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      first_name: string
      last_name: string
      email?: string
      phone?: string
      company_name?: string
      source?: string
      tags?: string[]
    }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('contacts')
        .insert({ ...payload, created_by: user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  })
}

export function useUpdateContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      id: string
      first_name: string
      last_name: string
      email?: string
      phone?: string
      company_name?: string
      source?: string
      tags?: string[]
    }) => {
      const { id, ...changes } = payload
      const supabase = createClient()
      const { data, error } = await supabase
        .from('contacts')
        .update(changes)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Contact
    },
    onSuccess: (updatedContact) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.setQueryData<Contact[]>(['contacts'], prev =>
        (prev ?? []).map(contact => (contact.id === updatedContact.id ? updatedContact : contact)),
      )
    },
  })
}
