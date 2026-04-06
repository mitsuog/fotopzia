export interface CrmWorkspaceQuery {
  view?: 'kanban' | 'list'
  q?: string
  stage?: 'all' | 'lead' | 'prospect' | 'proposal' | 'won' | 'lost'
  assignee?: string
  deal?: string
  panel?: '1' | '0'
}

export interface ProjectsWorkspaceQuery {
  objective?: 'progress' | 'blocked' | 'upcoming'
  view?: 'list' | 'portfolio'
  q?: string
  status?: string
  assignee?: string
  risk?: 'all' | 'low' | 'medium' | 'high'
  archived?: '1' | '0'
}

export type WorkspaceModule = 'crm' | 'projects'

export interface SavedViewDefinition {
  id: string
  module: WorkspaceModule
  name: string
  query: string
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface SavedViewsState {
  byModule: Record<WorkspaceModule, SavedViewDefinition[]>
  defaults: Partial<Record<WorkspaceModule, string>>
  lastQueryByModule: Partial<Record<WorkspaceModule, string>>
  recentQueriesByModule: Record<WorkspaceModule, string[]>
}

