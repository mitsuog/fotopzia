'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Command, Keyboard, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getVisibleModules, getVisibleQuickActions } from '@/lib/navigation/config'
import type { CommandPaletteItemDescriptor } from '@/types/navigation'

type PaletteItem = CommandPaletteItemDescriptor & {
  updatedAt?: string | null
}

interface RecentRoute {
  href: string
  label: string
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: string | null | undefined
}

const RECENT_ROUTES_KEY = 'fpz_recent_routes'

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function scorePaletteItem(params: {
  query: string
  item: PaletteItem
  recentHrefSet: Set<string>
}): number {
  const { query, item, recentHrefSet } = params
  const normalizedQuery = normalizeText(query)
  const normalizedLabel = normalizeText(item.label)
  const normalizedHref = normalizeText(item.href)

  let score = 0

  if (!normalizedQuery) return score

  if (normalizedLabel.startsWith(normalizedQuery)) score += 60
  else if (normalizedLabel.includes(normalizedQuery)) score += 35

  if (normalizedHref.includes(normalizedQuery)) score += 12

  if (item.subtitle) {
    const normalizedSubtitle = normalizeText(item.subtitle)
    if (normalizedSubtitle.includes(normalizedQuery)) score += 10
  }

  if (recentHrefSet.has(item.href)) score += 25
  if (item.category === 'Registro') score += 8

  if (item.updatedAt) {
    const updatedMs = new Date(item.updatedAt).getTime()
    if (!Number.isNaN(updatedMs)) {
      const days = (new Date().getTime() - updatedMs) / 86400000
      if (days <= 3) score += 12
      else if (days <= 14) score += 6
    }
  }

  return score
}

export function CommandPalette({ open, onOpenChange, role }: CommandPaletteProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const closePalette = useCallback(() => {
    onOpenChange(false)
    setQuery('')
    setSelectedIndex(0)
  }, [onOpenChange])

  const navigateTo = useCallback((href: string) => {
    router.push(href)
    closePalette()
  }, [closePalette, router])

  const visibleModuleKeys = useMemo(() => new Set(getVisibleModules(role).map(item => item.key)), [role])
  const canAccessCrm = visibleModuleKeys.has('crm')
  const canAccessProjects = visibleModuleKeys.has('projects')
  const canAccessInventory = visibleModuleKeys.has('inventory')

  const moduleItems = useMemo<PaletteItem[]>(
    () => getVisibleModules(role).map(item => ({
      id: `module:${item.key}`,
      label: item.label,
      href: item.href,
      category: 'Modulo',
    })),
    [role],
  )

  const actionItems = useMemo<PaletteItem[]>(
    () => getVisibleQuickActions(role).map(item => ({
      id: `action:${item.key}`,
      label: item.label,
      href: item.href,
      category: 'Accion',
    })),
    [role],
  )

  const recentRoutes = useMemo<RecentRoute[]>(() => {
    if (!open || typeof window === 'undefined') return []

    const raw = window.localStorage.getItem(RECENT_ROUTES_KEY)
    if (!raw) return []

    try {
      const parsed = JSON.parse(raw) as RecentRoute[]
      return parsed.slice(0, 8)
    } catch {
      return []
    }
  }, [open])

  const recentItems = useMemo<PaletteItem[]>(
    () => recentRoutes.map((route, index) => ({
      id: `recent:${route.href}:${index}`,
      label: route.label,
      href: route.href,
      category: 'Reciente',
    })),
    [recentRoutes],
  )

  const normalizedQuery = query.trim()

  const { data: recordItems = [] } = useQuery({
    queryKey: ['command-palette-records', normalizedQuery, canAccessCrm, canAccessProjects, canAccessInventory],
    enabled: open && normalizedQuery.length >= 2 && (canAccessCrm || canAccessProjects || canAccessInventory),
    staleTime: 30_000,
    queryFn: async (): Promise<PaletteItem[]> => {
      const supabase = createClient()
      const like = `%${normalizedQuery}%`

      const requests: Array<PromiseLike<PaletteItem[]>> = []

      if (canAccessCrm) {
        requests.push(
          supabase
            .from('deals')
            .select('id, title, updated_at, contact:contacts(first_name, last_name, company_name)')
            .ilike('title', like)
            .order('updated_at', { ascending: false })
            .limit(6)
            .then(({ data, error }) => {
              if (error) return []
              return (data ?? []).map(item => {
                const relation = item.contact as
                  | { first_name?: string; last_name?: string; company_name?: string | null }
                  | Array<{ first_name?: string; last_name?: string; company_name?: string | null }>
                  | null
                const contact = Array.isArray(relation) ? relation[0] ?? null : relation
                const contactLabel = contact?.company_name
                  ? contact.company_name
                  : contact
                    ? `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()
                    : null

                return {
                  id: `record:deal:${item.id}`,
                  label: `Deal: ${item.title}`,
                  href: `/crm?deal=${item.id}&panel=1`,
                  category: 'Registro' as const,
                  subtitle: contactLabel ? `CRM · ${contactLabel}` : 'CRM',
                  updatedAt: (item.updated_at ?? null) as string | null,
                }
              })
            }),
        )

        requests.push(
          supabase
            .from('contacts')
            .select('id, first_name, last_name, company_name, updated_at')
            .or(`first_name.ilike.${like},last_name.ilike.${like},company_name.ilike.${like}`)
            .order('updated_at', { ascending: false })
            .limit(6)
            .then(({ data, error }) => {
              if (error) return []
              return (data ?? []).map(item => {
                const name = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || 'Contacto'
                const label = item.company_name ? `${item.company_name} · ${name}` : name

                return {
                  id: `record:contact:${item.id}`,
                  label: `Contacto: ${label}`,
                  href: `/crm/${item.id}`,
                  category: 'Registro' as const,
                  subtitle: 'CRM',
                  updatedAt: (item.updated_at ?? null) as string | null,
                }
              })
            }),
        )
      }

      if (canAccessProjects) {
        requests.push(
          supabase
            .from('projects')
            .select('id, title, stage, updated_at')
            .ilike('title', like)
            .order('updated_at', { ascending: false })
            .limit(8)
            .then(({ data, error }) => {
              if (error) return []
              return (data ?? []).map(item => ({
                id: `record:project:${item.id}`,
                label: `Proyecto: ${item.title}`,
                href: `/projects/${item.id}`,
                category: 'Registro' as const,
                subtitle: item.stage ? `Proyectos · ${item.stage}` : 'Proyectos',
                updatedAt: (item.updated_at ?? null) as string | null,
              }))
            }),
        )
      }

      if (canAccessInventory) {
        requests.push(
          supabase
            .from('equipment_items')
            .select('id, name, asset_tag, updated_at')
            .or(`name.ilike.${like},asset_tag.ilike.${like}`)
            .order('updated_at', { ascending: false })
            .limit(8)
            .then(({ data, error }) => {
              if (error) return []
              return (data ?? []).map(item => ({
                id: `record:equipment:${item.id}`,
                label: `Equipo: ${item.name}`,
                href: `/inventory?item=${item.id}&panel=1`,
                category: 'Registro' as const,
                subtitle: item.asset_tag ? `Inventario · ${item.asset_tag}` : 'Inventario',
                updatedAt: (item.updated_at ?? null) as string | null,
              }))
            }),
        )

        requests.push(
          supabase
            .from('equipment_categories')
            .select('id, name, created_at')
            .ilike('name', like)
            .order('created_at', { ascending: false })
            .limit(5)
            .then(({ data, error }) => {
              if (error) return []
              return (data ?? []).map(item => {
                const name = typeof item.name === 'string' ? item.name : ''
                return {
                  id: `record:equipment-category:${item.id}`,
                  label: `Categoria: ${name || 'Sin nombre'}`,
                  href: `/inventory?objective=catalog&q=${encodeURIComponent(name)}`,
                  category: 'Registro' as const,
                  subtitle: 'Inventario',
                  updatedAt: (item.created_at ?? null) as string | null,
                }
              })
            }),
        )
      }

      const results = await Promise.all(requests)
      return results.flat()
    },
  })

  const items = useMemo(() => {
    const allBaseItems = [...actionItems, ...moduleItems, ...recentItems]
    const recentHrefSet = new Set(recentItems.map(item => item.href))

    if (!normalizedQuery) return allBaseItems

    const all = [...allBaseItems, ...recordItems]
      .filter(item => {
        const q = normalizeText(normalizedQuery)
        return (
          normalizeText(item.label).includes(q)
          || normalizeText(item.href).includes(q)
          || (item.subtitle ? normalizeText(item.subtitle).includes(q) : false)
        )
      })
      .map(item => ({
        item,
        score: scorePaletteItem({ query: normalizedQuery, item, recentHrefSet }),
      }))
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.item)

    return all
  }, [actionItems, moduleItems, normalizedQuery, recentItems, recordItems])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closePalette()
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex(prev => (items.length === 0 ? 0 : (prev + 1) % items.length))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex(prev => (items.length === 0 ? 0 : (prev - 1 + items.length) % items.length))
        return
      }

      if (event.key === 'Enter' && items.length > 0) {
        event.preventDefault()
        const selected = items[Math.min(selectedIndex, items.length - 1)]
        navigateTo(selected.href)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closePalette, items, navigateTo, open, selectedIndex])

  if (!open) return null

  const activeIndex = Math.min(selectedIndex, Math.max(items.length - 1, 0))

  const shortcuts = [
    { keys: 'g c', description: 'Ir a CRM' },
    { keys: 'g p', description: 'Ir a Proyectos' },
    { keys: 'g i', description: 'Ir a Inventario' },
    { keys: 'n d', description: 'Nuevo deal' },
    { keys: 'n p', description: 'Nuevo proyecto' },
    { keys: 'n i', description: 'Nuevo equipo' },
    { keys: '/', description: 'Buscar en modulo activo' },
  ]

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-16 sm:pt-20">
      <button
        type="button"
        className="absolute inset-0 bg-brand-navy/40 backdrop-blur-[2px]"
        aria-label="Cerrar comando rapido"
        onClick={closePalette}
      />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-brand-stone/80 bg-white shadow-[0_30px_80px_-28px_rgba(20,35,63,0.5)]">
        <div className="flex items-center gap-2 border-b border-brand-stone/70 px-3 py-2.5">
          <div className="rounded-md bg-brand-canvas p-1.5 text-brand-navy/70">
            <Search className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={event => {
              setQuery(event.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Busca modulo, accion o registro..."
            className="w-full border-0 bg-transparent text-sm text-brand-navy outline-none placeholder:text-gray-400"
          />
          <div className="hidden items-center gap-1 rounded-md border border-brand-stone bg-brand-canvas px-2 py-1 text-[10px] text-gray-500 sm:inline-flex">
            <Command className="h-3 w-3" />K
          </div>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-500">Sin resultados para esta busqueda.</div>
          ) : (
            <div className="space-y-1">
              {items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    navigateTo(item.href)
                  }}
                  className={cn(
                    'flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                    activeIndex === index ? 'bg-brand-canvas text-brand-navy' : 'hover:bg-brand-paper/80',
                  )}
                >
                  <div className="min-w-0">
                    <span className="block truncate text-sm text-brand-navy">{item.label}</span>
                    {item.subtitle && <span className="block truncate text-xs text-gray-500">{item.subtitle}</span>}
                  </div>
                  <span className="shrink-0 rounded-full border border-brand-stone bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-gray-500">
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-brand-stone/60 bg-brand-canvas/45 px-3 py-2">
          <div className="mb-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            <Keyboard className="h-3 w-3" /> Atajos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {shortcuts.map(shortcut => (
              <span key={shortcut.keys} className="inline-flex items-center gap-1 rounded-md border border-brand-stone/80 bg-white px-2 py-1 text-[10px] text-gray-600">
                <code className="font-semibold text-brand-navy">{shortcut.keys}</code>
                <span>{shortcut.description}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
