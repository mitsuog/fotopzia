import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

type PortalSection = 'summary' | 'documents' | 'event'

interface PortalShellProps {
  token: string
  active: PortalSection
  title: string
  description?: string
  children: ReactNode
}

const NAV_ITEMS: Array<{ key: PortalSection; label: string; href: (token: string) => string }> = [
  { key: 'summary', label: 'Resumen', href: token => `/portal/${token}` },
  { key: 'documents', label: 'Documentos', href: token => `/portal/${token}/documents` },
  { key: 'event', label: 'Mi evento', href: token => `/portal/${token}/evento` },
]

export function PortalShell({ token, active, title, description, children }: PortalShellProps) {
  const year = new Date().getFullYear()

  return (
    <div className="min-h-screen bg-brand-canvas">
      <header className="border-b border-brand-stone/70 bg-gradient-to-r from-brand-navy to-brand-navy-light shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <Link href={`/portal/${token}`} className="inline-flex items-center">
            <Image
              src="/logo_fotopzia.png"
              alt="Fotopzia"
              width={220}
              height={56}
              className="h-9 w-auto sm:h-10"
              priority
            />
          </Link>
          <nav className="flex flex-wrap gap-1.5">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.key}
                href={item.href(token)}
                className={[
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-colors',
                  active === item.key
                    ? 'bg-white/20 text-white ring-1 ring-white/40'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-brand-stone bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-gold">
            Portal del cliente
          </p>
          <h1 className="mt-1 text-2xl font-bold text-brand-navy">{title}</h1>
          {description ? <p className="mt-2 text-sm text-gray-600">{description}</p> : null}
        </section>
        {children}
      </main>

      <footer className="border-t border-brand-stone/70 bg-white/80 px-4 py-4 sm:px-6">
        <p className="mx-auto max-w-6xl text-[11px] leading-relaxed text-brand-navy/40">
          Este portal es propiedad exclusiva de Fotopzia Mexico. Los contenidos son propiedad de Fotopzia Mexico. Derechos reservados. Desarrollo: Tail OS Technologies. (c) {year}
        </p>
      </footer>
    </div>
  )
}
