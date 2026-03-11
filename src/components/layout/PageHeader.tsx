import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  badge?: string
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, badge, actions }: PageHeaderProps) {
  return (
    <section className="relative mb-6 overflow-hidden rounded-2xl border border-brand-stone/80 bg-gradient-to-br from-brand-paper via-brand-paper to-brand-canvas p-5 shadow-[0_16px_40px_-24px_rgba(28,43,74,0.45)]">
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand-gold/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-20 bottom-0 h-36 w-36 rounded-full bg-brand-navy/10 blur-2xl" />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {badge && (
            <span className="mb-2 inline-flex items-center rounded-full border border-brand-stone bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
              {badge}
            </span>
          )}
          <h1 className="text-[clamp(1.55rem,2.6vw,2.15rem)] font-semibold leading-tight tracking-[-0.02em] text-brand-navy">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-sm text-gray-600">{subtitle}</p>}
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </section>
  )
}
