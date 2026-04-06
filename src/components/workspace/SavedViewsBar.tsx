'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bookmark, Pin, Plus, Save, Settings2, Trash2 } from 'lucide-react'
import { useSavedViews } from '@/hooks/useSavedViews'
import type { WorkspaceModule } from '@/types/workspace'

interface SavedViewsBarProps {
  module: WorkspaceModule
  currentQuery: string
  onApplyQuery: (query: string) => void
}

type DialogMode = 'create' | 'edit'

function moduleViewLabel(module: WorkspaceModule): string {
  if (module === 'crm') return 'Vista CRM'
  if (module === 'projects') return 'Vista Proyectos'
  return 'Vista Inventario'
}

export function SavedViewsBar({ module, currentQuery, onApplyQuery }: SavedViewsBarProps) {
  const {
    views,
    defaultViewId,
    lastQuery,
    recentQueries,
    createView,
    updateView,
    removeView,
    setDefaultView,
    rememberQuery,
  } = useSavedViews(module)

  const [selectedId, setSelectedId] = useState<string>(() => defaultViewId ?? '')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<DialogMode>('create')
  const [draftName, setDraftName] = useState('')
  const [draftPinned, setDraftPinned] = useState(false)
  const [draftDefault, setDraftDefault] = useState(false)
  const [draftError, setDraftError] = useState<string | null>(null)

  const effectiveSelectedId = selectedId || defaultViewId || ''

  const selectedView = useMemo(
    () => views.find(view => view.id === effectiveSelectedId) ?? null,
    [effectiveSelectedId, views],
  )

  const recentOptions = useMemo(
    () => recentQueries.filter(item => item && item !== currentQuery).slice(0, 3),
    [currentQuery, recentQueries],
  )

  useEffect(() => {
    rememberQuery(currentQuery)
  }, [currentQuery, rememberQuery])

  useEffect(() => {
    if (currentQuery) return

    const defaultView = defaultViewId ? views.find(view => view.id === defaultViewId) ?? null : null
    if (defaultView?.query) {
      onApplyQuery(defaultView.query)
      return
    }

    if (lastQuery) {
      onApplyQuery(lastQuery)
    }
  }, [currentQuery, defaultViewId, lastQuery, onApplyQuery, views])

  function openDialog(mode: DialogMode) {
    const fallbackName = moduleViewLabel(module)
    const defaultName = mode === 'edit' && selectedView ? selectedView.name : fallbackName
    const defaultPinned = mode === 'edit' && selectedView ? selectedView.pinned : false
    const defaultAsDefault = mode === 'edit' && selectedView ? defaultViewId === selectedView.id : false

    setDialogMode(mode)
    setDraftName(defaultName)
    setDraftPinned(defaultPinned)
    setDraftDefault(defaultAsDefault)
    setDraftError(null)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
    setDraftError(null)
  }

  function handleApplySelected(viewId: string) {
    setSelectedId(viewId)
    if (!viewId) return

    const view = views.find(item => item.id === viewId)
    if (!view) return

    onApplyQuery(view.query)
  }

  function handleDeleteSelected() {
    if (!selectedView) return
    removeView(selectedView.id)
    setSelectedId('')
  }

  function handleUpdateSelectedQuery() {
    if (!selectedView) return
    updateView(selectedView.id, { query: currentQuery })
  }

  function handleSubmitDialog() {
    const name = draftName.trim()
    if (!name) {
      setDraftError('Escribe un nombre para la vista.')
      return
    }

    if (dialogMode === 'create') {
      const created = createView(name, currentQuery, draftPinned)
      setSelectedId(created.id)
      if (draftDefault) {
        setDefaultView(created.id)
      }
      closeDialog()
      return
    }

    if (!selectedView) {
      setDraftError('Selecciona una vista para editar.')
      return
    }

    updateView(selectedView.id, {
      name,
      pinned: draftPinned,
      query: currentQuery,
    })

    if (draftDefault) {
      setDefaultView(selectedView.id)
    } else if (defaultViewId === selectedView.id) {
      setDefaultView(null)
    }

    closeDialog()
  }

  function labelRecentQuery(serialized: string): string {
    const params = new URLSearchParams(serialized)
    const textSearch = params.get('q')
    const focus = params.get('objective')
      ?? params.get('stage')
      ?? params.get('status')
      ?? params.get('risk')
      ?? params.get('view')

    if (textSearch) return `Busqueda: ${textSearch}`
    if (focus) return `Filtro: ${focus}`
    return 'Ultimo contexto'
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-stone/80 bg-white/80 px-2 py-1.5 text-xs">
        <div className="inline-flex items-center gap-1.5 text-gray-500">
          <Bookmark className="h-3.5 w-3.5" />
          Vistas
        </div>

        <select
          value={effectiveSelectedId}
          onChange={event => handleApplySelected(event.target.value)}
          className="min-w-[180px] rounded-md border border-brand-stone bg-white px-2 py-1 text-xs text-brand-navy"
        >
          <option value="">Seleccionar vista guardada</option>
          {views.map(view => (
            <option key={view.id} value={view.id}>{view.name}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => openDialog('create')}
          className="inline-flex items-center gap-1 rounded-md border border-brand-stone bg-brand-paper px-2 py-1 text-[11px] text-brand-navy hover:bg-brand-canvas"
        >
          <Plus className="h-3 w-3" /> Guardar como nueva
        </button>

        <button
          type="button"
          disabled={!selectedView}
          onClick={handleUpdateSelectedQuery}
          className="inline-flex items-center gap-1 rounded-md border border-brand-stone bg-white px-2 py-1 text-[11px] text-brand-navy hover:bg-brand-canvas disabled:opacity-40"
        >
          <Save className="h-3 w-3" /> Actualizar actual
        </button>

        <button
          type="button"
          disabled={!selectedView}
          onClick={() => openDialog('edit')}
          className="inline-flex items-center gap-1 rounded-md border border-brand-stone bg-white px-2 py-1 text-[11px] text-brand-navy hover:bg-brand-canvas disabled:opacity-40"
        >
          <Settings2 className="h-3 w-3" /> Configurar
        </button>

        <button
          type="button"
          disabled={!selectedView}
          onClick={handleDeleteSelected}
          className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-700 hover:bg-red-100 disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" /> Eliminar
        </button>

        {recentOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {recentOptions.map(serialized => (
              <button
                key={serialized}
                type="button"
                onClick={() => onApplyQuery(serialized)}
                className="rounded-full border border-brand-stone bg-white px-2 py-0.5 text-[11px] text-gray-600 hover:border-brand-gold/60 hover:text-brand-navy"
              >
                {labelRecentQuery(serialized)}
              </button>
            ))}
          </div>
        )}
      </div>

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/35"
            aria-label="Cerrar modal"
            onClick={closeDialog}
          />

          <div className="relative z-10 w-full max-w-md rounded-xl border border-brand-stone bg-white shadow-2xl">
            <div className="border-b border-brand-stone px-4 py-3">
              <h3 className="text-sm font-semibold text-brand-navy">
                {dialogMode === 'create' ? 'Guardar vista' : 'Configurar vista'}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {dialogMode === 'create'
                  ? 'Guarda el estado actual de filtros y vista para reutilizarlo.'
                  : 'Actualiza nombre, pin y preferencia predeterminada de la vista.'}
              </p>
            </div>

            <div className="space-y-3 px-4 py-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={event => {
                    setDraftName(event.target.value)
                    if (draftError) setDraftError(null)
                  }}
                  className="w-full rounded-md border border-brand-stone px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                  placeholder={moduleViewLabel(module)}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-brand-navy">
                <input
                  type="checkbox"
                  checked={draftPinned}
                  onChange={event => setDraftPinned(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-brand-stone"
                />
                Fijar como prioritaria (pin)
              </label>

              <label className="flex items-center gap-2 text-xs text-brand-navy">
                <input
                  type="checkbox"
                  checked={draftDefault}
                  onChange={event => setDraftDefault(event.target.checked)}
                  className="h-3.5 w-3.5 rounded border-brand-stone"
                />
                Usar como vista predeterminada
              </label>

              {draftError && <p className="text-xs text-red-600">{draftError}</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-brand-stone px-4 py-3">
              <button
                type="button"
                onClick={closeDialog}
                className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-canvas"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitDialog}
                className="inline-flex items-center gap-1 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light"
              >
                <Pin className="h-3 w-3" />
                {dialogMode === 'create' ? 'Guardar vista' : 'Aplicar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


