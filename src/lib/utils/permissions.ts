export type AppRole = 'admin' | 'project_manager' | 'operator' | 'client'
export type Permission =
  | 'manage_users' | 'manage_settings'
  | 'manage_crm' | 'view_crm'
  | 'manage_quotes' | 'view_quotes'
  | 'manage_contracts' | 'view_contracts'
  | 'manage_approvals' | 'view_approvals'
  | 'manage_projects' | 'view_projects'
  | 'manage_calendar' | 'view_calendar'
  | 'manage_portfolios' | 'view_portfolios' | 'upload_media'
  | 'view_portal'

export const PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: [
    'manage_users', 'manage_settings',
    'manage_crm', 'view_crm',
    'manage_quotes', 'view_quotes',
    'manage_contracts', 'view_contracts',
    'manage_approvals', 'view_approvals',
    'manage_projects', 'view_projects',
    'manage_calendar', 'view_calendar',
    'manage_portfolios', 'view_portfolios', 'upload_media',
  ],
  project_manager: [
    'manage_crm', 'view_crm',
    'manage_quotes', 'view_quotes',
    'manage_contracts', 'view_contracts',
    'manage_approvals', 'view_approvals',
    'manage_projects', 'view_projects',
    'manage_calendar', 'view_calendar',
    'manage_portfolios', 'view_portfolios', 'upload_media',
  ],
  operator: [
    'manage_projects', 'view_projects',
    'view_crm',
    'view_quotes',
    'view_contracts',
    'view_approvals',
    'manage_calendar', 'view_calendar',
    'upload_media', 'view_portfolios',
  ],
  client: ['view_portal'],
}

export function can(role: AppRole, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission)
}
