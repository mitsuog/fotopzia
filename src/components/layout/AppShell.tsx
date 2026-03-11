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
            'h-full shrink-0 transition-[width] duration-200',
            isSidebarCollapsed ? 'w-20' : 'w-64',
          )}
        >
          <Sidebar
            user={user}
            collapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
          />
        </div>
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
        <Topbar onMenuClick={!isDesktop ? () => setIsSidebarOpen(true) : undefined} />
        <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 md:px-8 md:py-5">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
