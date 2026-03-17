'use client'

import type { WBSNode } from '@/types/wbs'

// Bar background (track) — always rendered, shows full duration
const TRACK_COLORS: Record<string, string> = {
  macro:    'rgba(28,43,74,0.14)',
  activity: 'rgba(28,43,74,0.10)',
  task:     'rgba(148,163,184,0.25)',
}

// Progress fill — solid color based on priority and completion
const PRIORITY_FILL: Record<string, string> = {
  low:    '#94a3b8',
  medium: '#1C2B4A',
  high:   '#f59e0b',
  urgent: '#ef4444',
}

// Done gets a special green fill regardless of priority
const DONE_FILL = '#10b981'
const BLOCKED_FILL = '#ef4444'

interface GanttBarProps {
  node: WBSNode
  leftPct: number      // 0-100
  widthPct: number     // 0-100
  progress: number     // 0-100
  isMilestone: boolean
  onClick: () => void
  rowHeight: number
}

export function GanttBar({ node, leftPct, widthPct, progress, isMilestone, onClick, rowHeight }: GanttBarProps) {
  const barH = node.level === 'macro' ? rowHeight - 8 : node.level === 'activity' ? rowHeight - 12 : rowHeight - 16
  const topOffset = (rowHeight - barH) / 2

  // Diamond milestone
  if (isMilestone) {
    const size = Math.round(barH * 0.75)
    return (
      <div
        role="button"
        tabIndex={0}
        title={`${node.title} (Hito)`}
        onClick={onClick}
        onKeyDown={e => e.key === 'Enter' && onClick()}
        className="absolute flex cursor-pointer items-center justify-center"
        style={{
          left: `calc(${leftPct}% - ${size / 2}px)`,
          top: `${topOffset}px`,
          width: `${size}px`,
          height: `${size}px`,
          transform: 'rotate(45deg)',
          backgroundColor: '#C49A2A',
          boxShadow: '0 1px 4px rgba(196,154,42,0.5)',
          zIndex: 10,
        }}
      />
    )
  }

  if (widthPct <= 0) return null

  // Determine fill color
  let fillColor = PRIORITY_FILL[node.priority] ?? '#1C2B4A'
  if (node.status === 'done') fillColor = DONE_FILL
  else if (node.status === 'blocked') fillColor = BLOCKED_FILL

  const trackColor = TRACK_COLORS[node.level] ?? TRACK_COLORS.task
  const borderColor = fillColor

  // Border thickness by level
  const borderW = node.level === 'macro' ? 2 : 1.5
  const borderR = node.level === 'macro' ? 4 : 3

  return (
    <div
      role="button"
      tabIndex={0}
      title={`${node.title} — ${Math.round(progress)}%`}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
      className="absolute cursor-pointer overflow-hidden"
      style={{
        left: `${leftPct}%`,
        width: `max(${widthPct}%, 8px)`,
        top: `${topOffset}px`,
        height: `${barH}px`,
        backgroundColor: trackColor,
        border: `${borderW}px solid ${borderColor}`,
        borderRadius: `${borderR}px`,
        zIndex: 5,
      }}
    >
      {/* Progress fill — colored portion */}
      {progress > 0 && (
        <div
          className="absolute left-0 top-0 h-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, progress)}%`,
            backgroundColor: fillColor,
            opacity: node.level === 'task' ? 0.85 : 0.75,
          }}
        />
      )}

      {/* Title text always on top */}
      <div
        className="absolute inset-0 flex items-center px-1.5 overflow-hidden"
        style={{ zIndex: 1 }}
      >
        <span
          className="truncate text-[10px] font-semibold leading-none"
          style={{
            color: progress > 50 ? '#fff' : fillColor,
            textShadow: progress > 50 ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
          }}
        >
          {node.title}
        </span>
        {progress > 0 && progress < 100 && (
          <span
            className="ml-1 shrink-0 text-[9px] font-bold opacity-80"
            style={{ color: progress > 50 ? 'rgba(255,255,255,0.9)' : fillColor }}
          >
            {Math.round(progress)}%
          </span>
        )}
      </div>
    </div>
  )
}
