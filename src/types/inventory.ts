export type EquipmentCondition = 'excelente' | 'bueno' | 'regular' | 'malo' | 'fuera_de_servicio'
export type EquipmentStatus = 'disponible' | 'en_uso' | 'mantenimiento' | 'retirado'
export type EquipmentLocation = 'estudio' | 'almacen' | 'en_campo' | 'prestado'
export type DepreciationMethod = 'linea_recta' | 'ninguno'
export type MaintenanceType = 'preventivo' | 'correctivo' | 'calibracion' | 'limpieza'

export interface EquipmentCategory {
  id: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number
  created_at: string
}

export interface EquipmentItem {
  id: string
  category_id: string | null
  asset_tag: string
  name: string
  brand: string | null
  model: string | null
  serial_number: string | null
  condition: EquipmentCondition
  status: EquipmentStatus
  purchase_date: string | null
  purchase_cost: number | null
  currency: string
  depreciation_method: DepreciationMethod
  useful_life_years: number | null
  salvage_value: number | null
  warranty_expires_at: string | null
  insurance_policy_number: string | null
  insurance_expires_at: string | null
  insurance_provider: string | null
  location: EquipmentLocation
  notes: string | null
  photo_url: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // joins
  category?: EquipmentCategory | null
  // computed
  current_book_value?: number | null
}

export interface EquipmentAssignment {
  id: string
  equipment_id: string
  project_id: string | null
  calendar_event_id: string | null
  assigned_to: string | null
  assigned_at: string
  expected_return_at: string | null
  returned_at: string | null
  condition_out: EquipmentCondition | null
  condition_in: EquipmentCondition | null
  notes: string | null
  created_by: string | null
  created_at: string
  // joins
  project?: { id: string; title: string } | null
  assignee?: { id: string; full_name: string | null } | null
}

export interface EquipmentMaintenance {
  id: string
  equipment_id: string
  type: MaintenanceType
  description: string
  performed_by: string | null
  cost: number | null
  performed_at: string
  next_due_at: string | null
  vendor: string | null
  notes: string | null
  created_by: string | null
  created_at: string
}

export const CONDITION_CONFIG: Record<EquipmentCondition, { label: string; badge: string; dot: string }> = {
  excelente:        { label: 'Excelente',         badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  bueno:            { label: 'Bueno',              badge: 'bg-green-100 text-green-700',     dot: 'bg-green-500' },
  regular:          { label: 'Regular',            badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  malo:             { label: 'Malo',               badge: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
  fuera_de_servicio:{ label: 'Fuera de servicio',  badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
}

export const STATUS_CONFIG: Record<EquipmentStatus, { label: string; badge: string; dot: string }> = {
  disponible:   { label: 'Disponible',   badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  en_uso:       { label: 'En uso',       badge: 'bg-blue-100 text-blue-700',       dot: 'bg-blue-500' },
  mantenimiento:{ label: 'Mantenimiento',badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  retirado:     { label: 'Retirado',     badge: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400' },
}

export const LOCATION_LABELS: Record<EquipmentLocation, string> = {
  estudio:  'Estudio',
  almacen:  'Almacén',
  en_campo: 'En campo',
  prestado: 'Prestado',
}

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  preventivo:   'Preventivo',
  correctivo:   'Correctivo',
  calibracion:  'Calibración',
  limpieza:     'Limpieza',
}

export interface StudioResource {
  id: string
  name: string
  type: 'studio' | 'equipment' | 'personnel'
  color: string | null
  is_active: boolean
  equipment_item_id: string | null
  equipment_item?: Pick<EquipmentItem, 'id' | 'name' | 'status' | 'condition'> | null
}
