'use client'

import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(false)
    }

    closeOnDesktop()
    window.addEventListener('resize', closeOnDesktop)
    return () => window.removeEventListener('resize', closeOnDesktop)
  }, [])

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden h-full w-64 shrink-0 lg:block">
        <Sidebar user={user} />
      </div>

      <div className="pointer-events-none fixed inset-0 z-40 lg:hidden">
        <div
          onClick={() => setIsSidebarOpen(false)}
          className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${
            isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'
          }`}
        />

        <div
          className={`absolute inset-y-0 left-0 w-72 max-w-[86vw] transform transition-transform duration-200 ease-out ${
            isSidebarOpen ? 'translate-x-0 pointer-events-auto' : '-translate-x-full'
          }`}
        >
          <Sidebar user={user} className="w-full" onNavigate={() => setIsSidebarOpen(false)} />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-auto px-3 py-4 sm:px-5 md:px-8 md:py-5">
          <div className="mx-auto w-full max-w-[1400px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
