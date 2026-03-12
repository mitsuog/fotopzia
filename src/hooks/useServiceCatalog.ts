'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ServiceCatalogItem } from '@/types/catalog'

// All items (for admin manager)
export function useServiceCatalog() {
  return useQuery({
    queryKey: ['service_catalog'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_catalog')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as unknown as ServiceCatalogItem[]
    },
  })
}

// Active items only (for QuoteEditor)
export function useActiveServices() {
  return useQuery({
    queryKey: ['service_catalog', 'active'],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('service_catalog')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return (data ?? []) as unknown as ServiceCatalogItem[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

type CreatePayload = Omit<ServiceCatalogItem, 'id' | 'created_by' | 'created_at' | 'updated_at'>

export function useCreateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('service_catalog')
        .insert({ ...payload, created_by: user?.id ?? null })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service_catalog'] }),
  })
}

export function useUpdateService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ServiceCatalogItem> & { id: string }) => {
      const supabase = createClient()
      const { error } = await supabase
        .from('service_catalog')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service_catalog'] }),
  })
}

export function useDeleteService() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from('service_catalog').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service_catalog'] }),
  })
}
