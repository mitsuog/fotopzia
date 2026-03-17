'use client'

import type { GanttScale } from '@/types/wbs'

interface GanttTimescaleProps {
  scale: GanttScale
  windowStart: Date
  columns: Date[]   // array of column start dates
}

const MONTH_LABELS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
const DAY_LABELS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

export function GanttTimescale({ scale, windowStart, columns }: GanttTimescaleProps) {
  // Build top-row groups (months for weekly/monthly, quarters/years for quarterly/yearly)
  const topGroups = buildTopGroups(scale, columns)

  return (
    <div className="select-none">
      {/* Top row: month/quarter/year labels */}
      <div className="flex border-b border-brand-stone/60">
        {topGroups.map((group, i) => (
          <div
            key={i}
            className="border-r border-brand-stone/40 px-2 py-1 text-[11px] font-semibold text-brand-navy/70"
            style={{ flex: group.span }}
          >
            {group.label}
          </div>
        ))}
      </div>

      {/* Bottom row: column unit ticks */}
      <div className="flex border-b border-brand-stone">
        {columns.map((col, i) => {
          const isToday = isSameDay(col, new Date())
          const weekend = scale === 'weekly' && isWeekend(col)
          return (
            <div
              key={i}
              className={`flex flex-1 items-center justify-center border-r border-brand-stone/30 py-1 text-[10px] ${
                isToday
                  ? 'bg-amber-50 font-bold text-amber-700'
                  : weekend
                    ? 'bg-brand-canvas/60 text-gray-400'
                    : 'text-gray-500'
              }`}
            >
              {formatColumnLabel(scale, col)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatColumnLabel(scale: GanttScale, col: Date): string {
  switch (scale) {
    case 'weekly':
      return String(col.getDate())
    case 'monthly':
      // Show "Mar 3" style week start
      return `${MONTH_LABELS_ES[col.getMonth()]} ${col.getDate()}`
    case 'quarterly':
    case 'yearly':
      return MONTH_LABELS_ES[col.getMonth()]
  }
}

interface TopGroup {
  label: string
  span: number
}

function buildTopGroups(scale: GanttScale, columns: Date[]): TopGroup[] {
  if (scale === 'weekly') {
    // Group by month
    const groups: TopGroup[] = []
    let current: TopGroup | null = null
    for (const col of columns) {
      const label = `${MONTH_LABELS_ES[col.getMonth()]} ${col.getFullYear()}`
      if (current !== null && current.label === label) {
        current.span++
      } else {
        if (current !== null) groups.push(current)
        current = { label, span: 1 }
      }
    }
    if (current !== null) groups.push(current)
    return groups
  }

  if (scale === 'monthly') {
    const groups: TopGroup[] = []
    let current: TopGroup | null = null
    for (const col of columns) {
      const label = `${MONTH_LABELS_ES[col.getMonth()]} ${col.getFullYear()}`
      if (current !== null && current.label === label) {
        current.span++
      } else {
        if (current !== null) groups.push(current)
        current = { label, span: 1 }
      }
    }
    if (current !== null) groups.push(current)
    return groups
  }

  if (scale === 'quarterly') {
    const groups: TopGroup[] = []
    let current: TopGroup | null = null
    for (const col of columns) {
      const q = Math.floor(col.getMonth() / 3) + 1
      const label = `T${q} ${col.getFullYear()}`
      if (current !== null && current.label === label) {
        current.span++
      } else {
        if (current !== null) groups.push(current)
        current = { label, span: 1 }
      }
    }
    if (current !== null) groups.push(current)
    return groups
  }

  const groups: TopGroup[] = []
  let current: TopGroup | null = null
  for (const col of columns) {
    const label = String(col.getFullYear())
    if (current !== null && current.label === label) {
      current.span++
    } else {
      if (current !== null) groups.push(current)
      current = { label, span: 1 }
    }
  }
  if (current !== null) groups.push(current)
  return groups
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

// Exported helper: build the column array for a given scale and window start
export function buildColumns(scale: GanttScale, windowStart: Date): { columns: Date[]; windowEnd: Date } {
  const cols: Date[] = []
  const start = new Date(windowStart)
  start.setHours(0, 0, 0, 0)

  switch (scale) {
    case 'weekly': {
      // 21 days
      for (let i = 0; i < 21; i++) {
        const d = new Date(start)
        d.setDate(d.getDate() + i)
        cols.push(d)
      }
      break
    }
    case 'monthly': {
      // ~13 weeks
      const base = new Date(start)
      // Snap to Monday
      const day = base.getDay()
      base.setDate(base.getDate() - (day === 0 ? 6 : day - 1))
      for (let i = 0; i < 13; i++) {
        const d = new Date(base)
        d.setDate(d.getDate() + i * 7)
        cols.push(d)
      }
      break
    }
    case 'quarterly': {
      // 6 months
      for (let i = 0; i < 6; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
        cols.push(d)
      }
      break
    }
    case 'yearly': {
      // 12 months
      for (let i = 0; i < 12; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
        cols.push(d)
      }
      break
    }
  }

  const windowEnd = new Date(cols[cols.length - 1])
  switch (scale) {
    case 'weekly':
      windowEnd.setDate(windowEnd.getDate() + 1)
      break
    case 'monthly':
      windowEnd.setDate(windowEnd.getDate() + 7)
      break
    case 'quarterly':
    case 'yearly':
      windowEnd.setMonth(windowEnd.getMonth() + 1)
      break
  }

  return { columns: cols, windowEnd }
}

// Snap windowStart to a natural boundary for the given scale
export function snapWindowStart(date: Date, scale: GanttScale): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  if (scale === 'monthly' || scale === 'weekly') {
    // Snap to Monday
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  } else {
    d.setDate(1)
  }
  return d
}

// Navigate by one step in the given scale direction
export function navigateWindow(windowStart: Date, scale: GanttScale, direction: 1 | -1): Date {
  const d = new Date(windowStart)
  switch (scale) {
    case 'weekly':
      d.setDate(d.getDate() + direction * 7)
      break
    case 'monthly':
      d.setDate(d.getDate() + direction * 28)
      break
    case 'quarterly':
      d.setMonth(d.getMonth() + direction * 3)
      break
    case 'yearly':
      d.setMonth(d.getMonth() + direction * 3)
      break
  }
  return d
}
