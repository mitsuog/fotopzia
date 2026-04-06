import type { NavConfigByRole, NavModuleKey, QuickActionKey } from '@/types/navigation'
import type { Permission, AppRole } from '@/lib/utils/permissions'
import { PERMISSIONS, canAny, resolveAppRole } from '@/lib/utils/permissions'

interface NavModuleDefinition {
  key: NavModuleKey
  label: string
  href: string
  permissions: Permission[]
}

interface QuickActionDefinition {
  key: QuickActionKey
  label: string
  href: string
  permissions: Permission[]
}

const MODULE_DEFINITIONS: NavModuleDefinition[] = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', permissions: ['view_projects'] },
  { key: 'crm', label: 'CRM', href: '/crm', permissions: ['view_crm', 'manage_crm'] },
  { key: 'crm_calendar', label: 'Agenda CRM', href: '/crm-calendar', permissions: ['view_crm', 'manage_crm'] },
  { key: 'quotes', label: 'Cotizaciones', href: '/quotes', permissions: ['view_quotes', 'manage_quotes'] },
  { key: 'contracts', label: 'Contratos', href: '/contracts', permissions: ['view_contracts', 'manage_contracts'] },
  { key: 'approvals', label: 'Aprobaciones', href: '/approvals', permissions: ['view_approvals', 'manage_approvals'] },
  { key: 'projects', label: 'Proyectos', href: '/projects', permissions: ['view_projects', 'manage_projects'] },
  { key: 'calendar', label: 'Calendario', href: '/calendar', permissions: ['view_calendar', 'manage_calendar'] },
  { key: 'portfolios', label: 'Portafolios', href: '/portfolios', permissions: ['view_portfolios', 'manage_portfolios'] },
  {
    key: 'finances',
    label: 'Finanzas',
    href: '/finances',
    permissions: ['view_finances', 'manage_finances', 'view_admin_finances', 'manage_admin_finances'],
  },
  { key: 'inventory', label: 'Inventario', href: '/inventory', permissions: ['view_inventory', 'manage_inventory'] },
  { key: 'settings', label: 'Configuracion', href: '/settings', permissions: ['manage_settings'] },
]

const QUICK_ACTION_DEFINITIONS: QuickActionDefinition[] = [
  { key: 'new_contact', label: 'Crear contacto', href: '/crm/list?newContact=1', permissions: ['manage_crm'] },
  { key: 'new_deal', label: 'Crear deal', href: '/crm?newDeal=1', permissions: ['manage_crm'] },
  { key: 'new_quote', label: 'Crear cotizacion', href: '/quotes/new', permissions: ['manage_quotes'] },
  { key: 'new_contract', label: 'Crear contrato', href: '/contracts/new', permissions: ['manage_contracts'] },
  { key: 'new_project', label: 'Crear proyecto', href: '/projects/new', permissions: ['manage_projects'] },
]

function roleCanAccessPermissions(role: AppRole, permissions: Permission[]): boolean {
  return canAny(role, permissions)
}

function buildConfigForRole(role: AppRole) {
  return {
    modules: MODULE_DEFINITIONS.filter(def => roleCanAccessPermissions(role, def.permissions)).map(def => def.key),
    actions: QUICK_ACTION_DEFINITIONS.filter(def => roleCanAccessPermissions(role, def.permissions)).map(def => def.key),
  }
}

export const NAV_CONFIG_BY_ROLE: NavConfigByRole = {
  admin: buildConfigForRole('admin'),
  project_manager: buildConfigForRole('project_manager'),
  operator: buildConfigForRole('operator'),
  client: buildConfigForRole('client'),
}

export function getNavConfigForRole(roleInput: string | null | undefined) {
  const role = resolveAppRole(roleInput)
  return NAV_CONFIG_BY_ROLE[role]
}

export function getVisibleModules(roleInput: string | null | undefined): NavModuleDefinition[] {
  const config = getNavConfigForRole(roleInput)
  const keySet = new Set(config.modules)
  return MODULE_DEFINITIONS.filter(def => keySet.has(def.key))
}

export function getVisibleQuickActions(roleInput: string | null | undefined): QuickActionDefinition[] {
  const config = getNavConfigForRole(roleInput)
  const keySet = new Set(config.actions)
  return QUICK_ACTION_DEFINITIONS.filter(def => keySet.has(def.key))
}

const ROUTE_PREFIX_TO_MODULE: Array<{ prefix: string; module: NavModuleKey }> = [
  { prefix: '/dashboard', module: 'dashboard' },
  { prefix: '/crm-calendar', module: 'crm_calendar' },
  { prefix: '/crm', module: 'crm' },
  { prefix: '/quotes', module: 'quotes' },
  { prefix: '/contracts', module: 'contracts' },
  { prefix: '/approvals', module: 'approvals' },
  { prefix: '/projects', module: 'projects' },
  { prefix: '/calendar', module: 'calendar' },
  { prefix: '/portfolios', module: 'portfolios' },
  { prefix: '/finances', module: 'finances' },
  { prefix: '/inventory', module: 'inventory' },
  { prefix: '/settings', module: 'settings' },
]

export function canAccessPath(roleInput: string | null | undefined, pathname: string): boolean {
  const config = getNavConfigForRole(roleInput)
  if (config.modules.length === 0) return true

  const matched = ROUTE_PREFIX_TO_MODULE.find(route => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`))
  if (!matched) return true

  return config.modules.includes(matched.module)
}

export function getDefaultPathForRole(roleInput: string | null | undefined): string {
  const visible = getVisibleModules(roleInput)
  if (visible.length === 0) return '/dashboard'

  const dashboard = visible.find(module => module.key === 'dashboard')
  return (dashboard ?? visible[0]).href
}

export function getModuleLabelByPath(pathname: string): string | null {
  const match = MODULE_DEFINITIONS.find(route => pathname === route.href || pathname.startsWith(`${route.href}/`))
  return match?.label ?? null
}

export function getAllRoleConfigs() {
  return Object.keys(PERMISSIONS).reduce<Record<AppRole, NavConfigByRole[AppRole]>>((acc, role) => {
    const appRole = role as AppRole
    acc[appRole] = NAV_CONFIG_BY_ROLE[appRole]
    return acc
  }, {} as Record<AppRole, NavConfigByRole[AppRole]>)
}

