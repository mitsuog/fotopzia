export interface ServiceCatalogItem {
  id: string
  icon: string
  label: string
  description: string
  unit_price: number
  category: string | null
  is_active: boolean
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export const SERVICE_CATEGORIES = [
  { value: 'photography', label: 'Fotografía' },
  { value: 'video',       label: 'Video' },
  { value: 'editing',     label: 'Edición' },
  { value: 'album',       label: 'Álbum' },
  { value: 'digital',     label: 'Digital' },
  { value: 'travel',      label: 'Viáticos' },
  { value: 'drone',       label: 'Drone' },
  { value: 'other',       label: 'Otro' },
] as const
