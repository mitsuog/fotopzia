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
  CalendarClock,
  Images,
  Settings2,
  LogOut,
  BriefcaseBusiness,
  PanelLeftClose,
  PanelLeftOpen,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/crm', label: 'CRM', icon: Users2 },
  { href: '/crm-calendar', label: 'Agenda CRM', icon: CalendarClock },
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
  collapsed?: boolean
  onToggleCollapse?: () => void
}

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Sidebar({ user, className, onNavigate, collapsed = false, onToggleCollapse }: SidebarProps) {
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
    if (href === '/crm') return pathname === '/crm' || pathname.startsWith('/crm/')
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside
      className={cn(
        'flex h-full w-full shrink-0 flex-col bg-gradient-to-b from-brand-navy to-[#14233f] text-white shadow-[10px_0_30px_-22px_rgba(16,26,45,0.85)]',
        className,
      )}
    >
      <div className={cn('border-b border-white/10', collapsed ? 'px-2 py-4' : 'px-4 py-5')}>
        <div className={cn('rounded-xl border border-white/10 bg-white/[0.04]', collapsed ? 'px-2 py-2' : 'px-3 py-3')}>
          <div className={cn('flex items-center justify-between gap-2', collapsed && 'justify-center')}>
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white', !collapsed && 'hidden')}>
              FP
            </div>
            <Image
              src="/logo_fotopzia.jpg"
              alt="Fotopzia Studio"
              width={150}
              height={50}
              className={cn('object-contain', collapsed && 'hidden')}
              priority
            />
            {onToggleCollapse && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/[0.02] text-white/75 transition-colors hover:bg-white/10 hover:text-white md:inline-flex"
                aria-label={collapsed ? 'Expandir sidebar' : 'Minimizar sidebar'}
                title={collapsed ? 'Expandir sidebar' : 'Minimizar sidebar'}
              >
                {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={cn('px-3 pt-3', collapsed && 'px-2')}>
        <Link
          href="/crm/list?newContact=1"
          onClick={onNavigate}
          className={cn(
            'group relative inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-gold px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-gold-light',
            collapsed && 'h-10 px-0',
          )}
        >
          <UserPlus className="h-3.5 w-3.5" />
          <span className={cn('whitespace-nowrap', collapsed && 'sr-only')}>Alta de Contacto</span>
          <span
            className={cn(
              'pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/20 bg-brand-navy px-2 py-1 text-[11px] font-medium text-white shadow-lg',
              collapsed && 'group-hover:block',
            )}
          >
            Alta de Contacto
          </span>
        </Link>
      </div>

      <nav className={cn('flex-1 space-y-1 overflow-y-auto p-3 pt-4', collapsed && 'px-2')}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
              collapsed && 'justify-center px-0',
              isActive(href)
                ? 'bg-brand-gold/20 text-white ring-1 ring-brand-gold/40'
                : 'text-white/70 hover:bg-white/12 hover:text-white',
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', isActive(href) ? 'text-brand-gold' : 'text-white/55 group-hover:text-brand-gold/85')} />
            <span className={cn('whitespace-nowrap', collapsed && 'sr-only')}>{label}</span>
            <span
              className={cn(
                'pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-white/20 bg-brand-navy px-2 py-1 text-[11px] font-medium text-white shadow-lg',
                collapsed && 'group-hover:block',
              )}
            >
              {label}
            </span>
          </Link>
        ))}
      </nav>

      <div className={cn('border-t border-white/10 p-3', collapsed && 'px-2')}>
        <div className={cn('rounded-xl border border-white/10 bg-white/[0.04] p-3', collapsed && 'p-2')}>
          <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-white"
              title={fullName || user.email}
            >
              {initials}
            </div>
            <div className={cn('min-w-0 flex-1', collapsed && 'sr-only')}>
              <p className="truncate text-sm font-semibold text-white">{fullName || user.email}</p>
              {role && <p className="truncate text-[11px] capitalize text-white/60">{role}</p>}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className={cn(
              'mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/8 hover:text-white',
              collapsed && 'mt-2 px-0',
            )}
            title="Cerrar sesion"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className={cn(collapsed && 'sr-only')}>Cerrar sesion</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
