'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { canAccessPath, getDefaultPathForRole, getModuleLabelByPath } from '@/lib/navigation/config'

interface AppShellUser {
  email: string
  profile?: {
    full_name: string | null
    role: string | null
    avatar_url?: string | null
  }
}

interface AppShellProps {
  user: AppShellUser
  children: React.ReactNode
}

interface RecentRoute {
  href: string
  label: string
}

const RECENT_ROUTES_KEY = 'fpz_recent_routes'

function toRouteLabel(pathname: string): string {
  const moduleLabel = getModuleLabelByPath(pathname)
  if (moduleLabel) return moduleLabel

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return 'Inicio'
  return segments[segments.length - 1]
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const shortcutBufferRef = useRef<{ key: string | null; timestamp: number }>({ key: null, timestamp: 0 })
  const collapseButtonLeft = isSidebarCollapsed ? '4rem' : '15rem'

  const role = user.profile?.role

  useEffect(() => {
    const syncViewport = () => {
      const desktop = window.innerWidth >= 768
      setIsDesktop(desktop)
      if (desktop) setIsSidebarOpen(false)
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (!isSidebarOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSidebarOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSidebarOpen])

  useEffect(() => {
    const focusWorkspaceSearch = () => {
      const selector = pathname?.startsWith('/crm')
        ? '#crm-workspace-search'
        : pathname?.startsWith('/projects')
          ? '#projects-workspace-search'
          : null

      if (!selector) return false
      const input = document.querySelector<HTMLInputElement>(selector)
      if (!input) return false
      input.focus()
      input.select()
      return true
    }

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      if (target.isContentEditable) return true
      return tag === 'input' || tag === 'textarea' || tag === 'select'
    }

    const navigateByShortcut = (action: string) => {
      if (action === 'g:c') {
        router.push('/crm')
        return
      }
      if (action === 'g:p') {
        router.push('/projects')
        return
      }
      if (action === 'g:i') {
        router.push('/inventory')
        return
      }
      if (action === 'n:d') {
        router.push('/crm?newDeal=1')
        return
      }
      if (action === 'n:p') {
        router.push('/projects/new')
        return
      }
      if (action === 'n:i') {
        router.push('/inventory?newItem=1')
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setIsCommandOpen(prev => !prev)
        return
      }

      if (isTypingTarget(event.target)) return

      if (event.key === '/') {
        const focused = focusWorkspaceSearch()
        if (focused) {
          event.preventDefault()
        }
        return
      }

      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return

      const now = Date.now()
      const normalized = event.key.toLowerCase()
      const prev = shortcutBufferRef.current
      const isExpired = now - prev.timestamp > 800

      if (isExpired) {
        shortcutBufferRef.current = { key: normalized, timestamp: now }
        return
      }

      const action = `${prev.key}:${normalized}`
      if (action === 'g:c' || action === 'g:p' || action === 'g:i' || action === 'n:d' || action === 'n:p' || action === 'n:i') {
        event.preventDefault()
        navigateByShortcut(action)
      }

      shortcutBufferRef.current = { key: null, timestamp: 0 }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pathname, router])

  useEffect(() => {
    if (!pathname) return
    if (!canAccessPath(role, pathname)) {
      const safePath = getDefaultPathForRole(role)
      if (safePath !== pathname) {
        router.replace(safePath)
      }
    }
  }, [pathname, role, router])

  useEffect(() => {
    if (!pathname || pathname.startsWith('/auth')) return

    try {
      const current: RecentRoute = { href: pathname, label: toRouteLabel(pathname) }
      const raw = window.localStorage.getItem(RECENT_ROUTES_KEY)
      const parsed = raw ? (JSON.parse(raw) as RecentRoute[]) : []

      const deduped = [current, ...parsed.filter(item => item.href !== pathname)].slice(0, 12)
      window.localStorage.setItem(RECENT_ROUTES_KEY, JSON.stringify(deduped))
    } catch {
      // Non-blocking: palette recents are an enhancement.
    }
  }, [pathname])

  return (
    <div className="flex h-screen min-h-screen overflow-hidden">
      {isDesktop && (
        <div
          className={cn(
            'relative z-20 h-full shrink-0 transition-[width] duration-200',
            isSidebarCollapsed ? 'w-20' : 'w-64',
          )}
        >
          <Sidebar
            user={user}
            collapsed={isSidebarCollapsed}
          />
        </div>
      )}

      {isDesktop && (
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed(prev => !prev)}
          className="fixed top-8 z-[80] inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-[#223256]/55 text-white shadow-[0_12px_24px_-14px_rgba(0,0,0,0.95)] backdrop-blur-sm opacity-85 transition-[left,background-color,opacity] duration-200 hover:bg-[#2d3f69]/80 hover:opacity-100"
          style={{ left: collapseButtonLeft }}
          aria-label={isSidebarCollapsed ? 'Expandir sidebar' : 'Minimizar sidebar'}
          title={isSidebarCollapsed ? 'Expandir sidebar' : 'Minimizar sidebar'}
        >
          {isSidebarCollapsed ? (
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-current">
              <path d="M7 4L14 10L7 16V4Z" />
            </svg>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 fill-current">
              <path d="M13 4L6 10L13 16V4Z" />
            </svg>
          )}
        </button>
      )}

      {!isDesktop && isSidebarOpen && (
        <div className="fixed inset-0 z-40">
          <div onClick={() => setIsSidebarOpen(false)} className="absolute inset-0 bg-black/45" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[86vw]">
            <Sidebar user={user} className="w-full" onNavigate={() => setIsSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar
          user={user}
          onMenuClick={!isDesktop ? () => setIsSidebarOpen(true) : undefined}
          onCommandPalette={() => setIsCommandOpen(true)}
        />
        <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 md:px-6 md:py-5 lg:px-8 2xl:px-10">
          <div className="w-full">{children}</div>
        </main>
      </div>

      <CommandPalette
        open={isCommandOpen}
        onOpenChange={setIsCommandOpen}
        role={role}
      />
    </div>
  )
}

