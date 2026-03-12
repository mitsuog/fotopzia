'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'

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

export function AppShell({ user, children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const collapseButtonLeft = isSidebarCollapsed ? '4rem' : '15rem'

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
        <Topbar user={user} onMenuClick={!isDesktop ? () => setIsSidebarOpen(true) : undefined} />
        <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 md:px-6 md:py-5 lg:px-8 2xl:px-10">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  )
}
