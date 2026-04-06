import type { AppRole } from '@/lib/utils/permissions'

export type NavModuleKey =
  | 'dashboard'
  | 'crm'
  | 'crm_calendar'
  | 'quotes'
  | 'contracts'
  | 'approvals'
  | 'projects'
  | 'calendar'
  | 'portfolios'
  | 'finances'
  | 'inventory'
  | 'settings'

export type QuickActionKey =
  | 'new_contact'
  | 'new_deal'
  | 'new_quote'
  | 'new_contract'
  | 'new_project'

export interface NavRoleConfig {
  modules: NavModuleKey[]
  actions: QuickActionKey[]
}

export type NavConfigByRole = Record<AppRole, NavRoleConfig>

export type CommandPaletteCategory = 'Modulo' | 'Accion' | 'Reciente' | 'Registro'

export interface CommandPaletteItemDescriptor {
  id: string
  label: string
  href: string
  category: CommandPaletteCategory
  subtitle?: string
  updated_at?: string | null
}
