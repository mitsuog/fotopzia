'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users2,
  FileText,
  ScrollText,
  CheckCircle2,
  CalendarDays,
  Images,
  Settings2,
  LogOut,
  BriefcaseBusiness,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/crm', label: 'CRM', icon: Users2 },
  { href: '/quotes', label: 'Cotizaciones', icon: FileText },
  { href: '/contracts', label: 'Contratos', icon: ScrollText },
  { href: '/approvals', label: 'Aprobaciones', icon: CheckCircle2 },
  { href: '/projects', label: 'Proyectos', icon: BriefcaseBusiness },
  { href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { href: '/portfolios', label: 'Portafolios', icon: Images },
  { href: '/settings', label: 'Configuracion', icon: Settings2 },
]

interface SidebarProps {
  user: {
    email: string
    profile?: {
      full_name: string | null
      role: string | null
    }
  }
  className?: string
  onNavigate?: () => void
}

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Sidebar({ user, className, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const fullName = user.profile?.full_name
  const role = user.profile?.role
  const initials = getInitials(fullName)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string): boolean {
    if (href === '/crm') return pathname.startsWith('/crm')
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className={cn(
        'flex h-full w-64 shrink-0 flex-col bg-gradient-to-b from-brand-navy to-[#14233f] text-white shadow-[10px_0_30px_-22px_rgba(16,26,45,0.85)]',
        className,
      )}
    >
      <div className="border-b border-white/10 px-4 py-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <Image src="/logo_fotopzia.jpg" alt="Fotopzia Studio" width={150} height={50} className="object-contain" priority />
        </div>
      </div>

      <div className="px-3 pt-3">
        <Link
          href="/crm/list?newContact=1"
          onClick={onNavigate}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-gold-light"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Alta de Contacto
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 pt-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              isActive(href)
                ? 'bg-white/10 text-white ring-1 ring-white/15'
                : 'text-white/65 hover:bg-white/7 hover:text-white',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', isActive(href) ? 'text-brand-gold' : 'text-white/55 group-hover:text-white/80')} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{fullName || user.email}</p>
              {role && <p className="truncate text-[11px] capitalize text-white/60">{role}</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/8 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Cerrar sesion
          </button>
        </div>
      </div>
    </aside>
  )
}
