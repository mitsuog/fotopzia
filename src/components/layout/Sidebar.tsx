'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
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
  UserPlus,
  DollarSign,
  Package,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getNavConfigForRole } from '@/lib/navigation/config'
import { resolveAppRole } from '@/lib/utils/permissions'
import type { NavModuleKey } from '@/types/navigation'
import type { LucideIcon } from 'lucide-react'

interface NavItem {
  moduleKey: NavModuleKey
  href: string
  label: string
  icon: LucideIcon
}

interface NavSection {
  moduleKey: NavModuleKey
  key: string
  label: string
  icon: LucideIcon
  basePath: string
  children: NavItem[]
}

type NavEntry = NavItem | { section: NavSection }

function isSection(entry: NavEntry): entry is { section: NavSection } {
  return 'section' in entry
}

const NAV_ITEMS: NavEntry[] = [
  { moduleKey: 'dashboard', href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { moduleKey: 'crm', href: '/crm', label: 'CRM', icon: Users2 },
  { moduleKey: 'crm_calendar', href: '/crm-calendar', label: 'Agenda CRM', icon: CalendarClock },
  { moduleKey: 'quotes', href: '/quotes', label: 'Cotizaciones', icon: FileText },
  { moduleKey: 'contracts', href: '/contracts', label: 'Contratos', icon: ScrollText },
  { moduleKey: 'approvals', href: '/approvals', label: 'Aprobaciones', icon: CheckCircle2 },
  { moduleKey: 'projects', href: '/projects', label: 'Proyectos', icon: BriefcaseBusiness },
  { moduleKey: 'calendar', href: '/calendar', label: 'Calendario', icon: CalendarDays },
  { moduleKey: 'portfolios', href: '/portfolios', label: 'Portafolios', icon: Images },
  {
    section: {
      moduleKey: 'finances',
      key: 'finances',
      label: 'Finanzas',
      icon: DollarSign,
      basePath: '/finances',
      children: [
        { moduleKey: 'finances', href: '/finances', label: 'Resumen', icon: DollarSign },
        { moduleKey: 'finances', href: '/finances/income', label: 'Ingresos', icon: DollarSign },
        { moduleKey: 'finances', href: '/finances/expenses', label: 'Egresos', icon: DollarSign },
        { moduleKey: 'finances', href: '/finances/payroll', label: 'Nominas', icon: DollarSign },
        { moduleKey: 'finances', href: '/finances/reports', label: 'Reportes', icon: DollarSign },
      ],
    },
  },
  {
    section: {
      moduleKey: 'inventory',
      key: 'inventory',
      label: 'Inventario',
      icon: Package,
      basePath: '/inventory',
      children: [
        { moduleKey: 'inventory', href: '/inventory', label: 'Equipos', icon: Package },
        { moduleKey: 'inventory', href: '/inventory/categories', label: 'Categorias', icon: Package },
      ],
    },
  },
  {
    section: {
      moduleKey: 'settings',
      key: 'settings',
      label: 'Configuracion',
      icon: Settings2,
      basePath: '/settings',
      children: [
        { moduleKey: 'settings', href: '/settings', label: 'General', icon: Settings2 },
        { moduleKey: 'settings', href: '/settings/catalogo', label: 'Catalogo de servicios', icon: Settings2 },
        { moduleKey: 'settings', href: '/settings/resources', label: 'Recursos del estudio', icon: Settings2 },
      ],
    },
  },
]

interface SidebarProps {
  user: {
    email: string
    profile?: {
      full_name: string | null
      role: string | null
      avatar_url?: string | null
    }
  }
  className?: string
  onNavigate?: () => void
  collapsed?: boolean
}

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?'
  const parts = fullName.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Sidebar({ user, className, onNavigate, collapsed = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const fullName = user.profile?.full_name
  const role = user.profile?.role
  const avatarUrl = user.profile?.avatar_url ?? null
  const initials = getInitials(fullName)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const navConfig = getNavConfigForRole(resolveAppRole(role))
  const allowedModules = new Set(navConfig.modules)
  const canCreateContact = navConfig.actions.includes('new_contact')

  const visibleItems = NAV_ITEMS.filter(entry => {
    if (isSection(entry)) return allowedModules.has(entry.section.moduleKey)
    return allowedModules.has(entry.moduleKey)
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function isActive(href: string): boolean {
    if (href === '/crm') return pathname === '/crm' || pathname.startsWith('/crm/')
    if (href === '/finances') return pathname === '/finances'
    if (href === '/inventory') return pathname === '/inventory'
    return pathname === href || pathname.startsWith(href + '/')
  }

  function isSectionActive(basePath: string): boolean {
    return pathname === basePath || pathname.startsWith(basePath + '/')
  }

  function toggleSection(key: string) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function isSectionOpen(key: string, basePath: string): boolean {
    if (openSections[key] !== undefined) return openSections[key]
    return isSectionActive(basePath)
  }

  const navItemClass = (active: boolean) =>
    cn(
      'group relative flex h-11 items-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45 active:ring-1 active:ring-white/25',
      collapsed ? 'mx-auto w-12 justify-center gap-0 px-0' : 'gap-3.5 px-3.5',
      active
        ? 'bg-brand-gold/25 text-white ring-1 ring-brand-gold/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
        : 'text-white/70 hover:bg-white/14 hover:text-white active:bg-white/18 active:text-white',
    )

  const navIconClass = (active: boolean) =>
    cn(
      'shrink-0 transition-colors',
      collapsed ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]',
      active
        ? 'text-brand-gold'
        : 'text-white/55 group-hover:text-brand-gold/85 group-active:text-brand-gold/85',
    )

  const tooltipClass = cn(
    'pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-[100] -translate-y-1/2 whitespace-nowrap rounded-md border border-white/20 bg-brand-navy px-2 py-1 text-[11px] font-medium text-white shadow-lg transition-all duration-150',
    collapsed
      ? 'translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-active:translate-x-0 group-active:opacity-100'
      : 'hidden',
  )

  return (
    <aside
      className={cn(
        'relative z-30 flex h-full w-full shrink-0 flex-col overflow-x-hidden bg-gradient-to-b from-brand-navy to-[#14233f] text-white shadow-[10px_0_30px_-22px_rgba(16,26,45,0.85)]',
        className,
      )}
    >
      <div className={cn('relative border-b border-white/10', collapsed ? 'px-2 py-5' : 'px-3 py-5')}>
        <div
          className={cn(
            'mx-auto flex items-center justify-center transition-all duration-200',
            collapsed ? 'h-12 px-2' : 'h-14 px-4',
          )}
        >
          <Image
            src={collapsed ? '/logocuadradoFotopzia.png' : '/logo_fotopzia.png'}
            alt="Fotopzia Studio"
            width={220}
            height={56}
            className={cn(
              'h-auto object-contain transition-[width] duration-200',
              collapsed ? 'w-10' : 'w-[220px]',
            )}
            priority
          />
        </div>
      </div>

      {canCreateContact && (
        <div className={cn('px-3 pt-3', collapsed && 'px-2')}>
          <Link
            href="/crm/list?newContact=1"
            onClick={onNavigate}
            aria-label="Alta de contacto"
            title={collapsed ? 'Alta de contacto' : undefined}
            className={cn(
              'group relative inline-flex w-full items-center rounded-lg bg-brand-gold text-xs font-semibold text-white transition-colors hover:bg-brand-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/55 active:scale-[0.98] active:bg-brand-gold-light',
              collapsed ? 'mx-auto h-12 w-12 justify-center gap-0 px-0' : 'justify-center gap-1.5 px-3 py-2.5',
            )}
          >
            <UserPlus className={cn('shrink-0', collapsed ? 'h-5 w-5' : 'h-3.5 w-3.5')} />
            {!collapsed && <span className="whitespace-nowrap">Alta de contacto</span>}
            <span
              className={cn(
                'pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/20 bg-brand-navy px-2 py-1 text-[11px] font-medium text-white shadow-lg transition-all duration-150',
                collapsed
                  ? 'translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-active:translate-x-0 group-active:opacity-100'
                  : 'hidden',
              )}
              style={{ zIndex: 100 }}
            >
              Alta de contacto
            </span>
          </Link>
        </div>
      )}

      <nav className={cn('flex-1 space-y-1 overflow-x-hidden overflow-y-auto p-3 pt-4', collapsed && 'px-2')}>
        {visibleItems.map(entry => {
          if (isSection(entry)) {
            const { section } = entry
            const SectionIcon = section.icon
            const sectionActive = isSectionActive(section.basePath)
            const sectionOpen = isSectionOpen(section.key, section.basePath)

            if (collapsed) {
              return (
                <div key={section.key} className="relative">
                  <button
                    type="button"
                    aria-label={section.label}
                    title={section.label}
                    onClick={() => {
                      toggleSection(section.key)
                      router.push(section.children[0].href)
                    }}
                    className={navItemClass(sectionActive)}
                  >
                    <SectionIcon className={navIconClass(sectionActive)} />
                    <span className={tooltipClass}>{section.label}</span>
                  </button>
                </div>
              )
            }

            return (
              <div key={section.key}>
                <button
                  type="button"
                  onClick={() => toggleSection(section.key)}
                  className={cn(
                    'group relative flex h-11 w-full items-center rounded-lg text-sm font-medium transition-all gap-3.5 px-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45',
                    sectionActive
                      ? 'text-white/90'
                      : 'text-white/70 hover:bg-white/14 hover:text-white',
                  )}
                >
                  <SectionIcon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0 transition-colors',
                      sectionActive ? 'text-brand-gold' : 'text-white/55 group-hover:text-brand-gold/85',
                    )}
                  />
                  <span className="flex-1 whitespace-nowrap text-left">{section.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-transform duration-200 text-white/40',
                      sectionOpen && 'rotate-180',
                    )}
                  />
                </button>

                {sectionOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 border-l border-white/10 pl-3">
                    {section.children.map(child => {
                      const childActive = isActive(child.href)
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            'flex h-9 items-center rounded-lg px-3 text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/45',
                            childActive
                              ? 'bg-brand-gold/20 text-white font-medium'
                              : 'text-white/60 hover:bg-white/10 hover:text-white/90',
                          )}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const { href, label, icon: Icon } = entry
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-label={label}
              title={collapsed ? label : undefined}
              className={navItemClass(active)}
            >
              <Icon className={navIconClass(active)} />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
              <span className={tooltipClass}>{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className={cn('border-t border-white/10', collapsed ? 'p-2' : 'p-3')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {avatarUrl && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName || user.email}
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-white/30"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-white"
                title={fullName || user.email}
              >
                {initials}
              </div>
            )}
            <button
              onClick={handleLogout}
              aria-label="Cerrar sesion"
              title="Cerrar sesion"
              className="group relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-white/70 transition-colors hover:bg-white/10 hover:text-white active:bg-white/14"
            >
              <LogOut className="h-4 w-4" />
              <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md border border-white/20 bg-brand-navy px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-all duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 group-active:translate-x-0 group-active:opacity-100">
                Cerrar sesion
              </span>
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 px-1 py-1">
              {avatarUrl && !avatarFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={fullName || user.email}
                  className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/30"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-white"
                  title={fullName || user.email}
                >
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{fullName || user.email}</p>
                {role && <p className="truncate text-[11px] capitalize text-white/60">{role}</p>}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              title="Cerrar sesion"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesion</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
