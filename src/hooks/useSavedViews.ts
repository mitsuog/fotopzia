'use client'

import { useCallback, useMemo, useState } from 'react'
import type { SavedViewDefinition, SavedViewsState, WorkspaceModule } from '@/types/workspace'

const STORAGE_KEY = 'fpz_saved_views_v1'
const RECENT_LIMIT = 5

const EMPTY_STATE: SavedViewsState = {
  byModule: {
    crm: [],
    projects: [],
    inventory: [],
  },
  defaults: {},
  lastQueryByModule: {},
  recentQueriesByModule: {
    crm: [],
    projects: [],
    inventory: [],
  },
}

function nowIso(): string {
  return new Date().toISOString()
}

function normalizeQuery(query: string): string {
  return query.trim().replace(/^\?/, '')
}

function safeParseState(value: string | null): SavedViewsState {
  if (!value) return EMPTY_STATE

  try {
    const parsed = JSON.parse(value) as Partial<SavedViewsState>
    return {
      byModule: {
        crm: parsed.byModule?.crm ?? [],
        projects: parsed.byModule?.projects ?? [],
        inventory: parsed.byModule?.inventory ?? [],
      },
      defaults: parsed.defaults ?? {},
      lastQueryByModule: parsed.lastQueryByModule ?? {},
      recentQueriesByModule: {
        crm: parsed.recentQueriesByModule?.crm ?? [],
        projects: parsed.recentQueriesByModule?.projects ?? [],
        inventory: parsed.recentQueriesByModule?.inventory ?? [],
      },
    }
  } catch {
    return EMPTY_STATE
  }
}

function buildId(module: WorkspaceModule): string {
  return `${module}-${Math.random().toString(36).slice(2, 10)}`
}

function buildRecentQueries(current: string[], nextQuery: string): string[] {
  if (!nextQuery) return current
  return [nextQuery, ...current.filter(item => item !== nextQuery)].slice(0, RECENT_LIMIT)
}

export function useSavedViews(module: WorkspaceModule) {
  const [state, setState] = useState<SavedViewsState>(() => {
    if (typeof window === 'undefined') return EMPTY_STATE
    return safeParseState(window.localStorage.getItem(STORAGE_KEY))
  })

  const views = useMemo(() => {
    const moduleViews = state.byModule[module] ?? []
    return [...moduleViews].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return a.name.localeCompare(b.name, 'es')
    })
  }, [module, state.byModule])
  const defaultViewId = state.defaults[module] ?? null
  const lastQuery = state.lastQueryByModule[module] ?? ''
  const recentQueries = state.recentQueriesByModule[module] ?? []

  const persistState = useCallback((next: SavedViewsState) => {
    setState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }, [])

  const createView = useCallback((name: string, query: string, pinned = false) => {
    const normalizedQuery = normalizeQuery(query)
    const timestamp = nowIso()
    const nextView: SavedViewDefinition = {
      id: buildId(module),
      module,
      name,
      query: normalizedQuery,
      pinned,
      created_at: timestamp,
      updated_at: timestamp,
    }

    const currentRecent = state.recentQueriesByModule[module] ?? []
    const nextRecent = buildRecentQueries(currentRecent, normalizedQuery)

    const next: SavedViewsState = {
      ...state,
      byModule: {
        ...state.byModule,
        [module]: [...(state.byModule[module] ?? []), nextView],
      },
      lastQueryByModule: {
        ...state.lastQueryByModule,
        [module]: normalizedQuery,
      },
      recentQueriesByModule: {
        ...state.recentQueriesByModule,
        [module]: nextRecent,
      },
    }

    persistState(next)
    return nextView
  }, [module, persistState, state])

  const updateView = useCallback((viewId: string, patch: Partial<Pick<SavedViewDefinition, 'name' | 'query' | 'pinned'>>) => {
    const moduleViews = (state.byModule[module] ?? []).map(view => {
      if (view.id !== viewId) return view

      const nextQuery = patch.query === undefined ? view.query : normalizeQuery(patch.query)
      return {
        ...view,
        ...patch,
        query: nextQuery,
        updated_at: nowIso(),
      }
    })

    const next: SavedViewsState = {
      ...state,
      byModule: {
        ...state.byModule,
        [module]: moduleViews,
      },
    }

    persistState(next)
  }, [module, persistState, state])

  const removeView = useCallback((viewId: string) => {
    const moduleViews = (state.byModule[module] ?? []).filter(view => view.id !== viewId)
    const nextDefaults = { ...state.defaults }
    if (nextDefaults[module] === viewId) delete nextDefaults[module]

    const next: SavedViewsState = {
      ...state,
      byModule: {
        ...state.byModule,
        [module]: moduleViews,
      },
      defaults: nextDefaults,
    }

    persistState(next)
  }, [module, persistState, state])

  const setDefaultView = useCallback((viewId: string | null) => {
    const nextDefaults = { ...state.defaults }
    if (!viewId) delete nextDefaults[module]
    else nextDefaults[module] = viewId

    const next: SavedViewsState = {
      ...state,
      defaults: nextDefaults,
    }

    persistState(next)
  }, [module, persistState, state])

  const rememberQuery = useCallback((query: string) => {
    const normalizedQuery = normalizeQuery(query)
    const currentLast = state.lastQueryByModule[module] ?? ''
    const currentRecent = state.recentQueriesByModule[module] ?? []
    const nextRecent = buildRecentQueries(currentRecent, normalizedQuery)
    const hasSameRecent = nextRecent.length === currentRecent.length
      && nextRecent.every((item, index) => item === currentRecent[index])

    if (currentLast === normalizedQuery && hasSameRecent) return

    const next: SavedViewsState = {
      ...state,
      lastQueryByModule: {
        ...state.lastQueryByModule,
        [module]: normalizedQuery,
      },
      recentQueriesByModule: {
        ...state.recentQueriesByModule,
        [module]: nextRecent,
      },
    }

    persistState(next)
  }, [module, persistState, state])

  return {
    views,
    defaultViewId,
    lastQuery,
    recentQueries,
    createView,
    updateView,
    removeView,
    setDefaultView,
    rememberQuery,
  }
}
