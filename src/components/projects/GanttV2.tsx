'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import type { WBSNode, Dependency, GanttScale, NodeBarMap, GanttBarRect } from '@/types/wbs'
import type { TeamProfile } from '@/hooks/useProject'
import { GanttBar } from './GanttBar'
import { GanttTimescale, buildColumns, navigateWindow, snapWindowStart } from './GanttTimescale'
import { DependencyLayer } from './DependencyLayer'

const ROW_HEIGHT = 36
const LEFT_PANEL_WIDTH = 280

const SCALE_LABELS: Record<GanttScale, string> = {
  weekly: 'Semana',
  monthly: 'Mes',
  quarterly: 'Trimestre',
  yearly: 'Año',
}

interface GanttV2Props {
  nodes: WBSNode[]
  tree: WBSNode[]    // pre-built tree
  dependencies: Dependency[]
  profiles: TeamProfile[]
  getNodeProgress: (id: string) => number
  onOpenNode: (node: WBSNode) => void
}

export function GanttV2({ nodes, tree, dependencies, profiles, getNodeProgress, onOpenNode }: GanttV2Props) {
  const [scale, setScale] = useState<GanttScale>('monthly')
  const [windowStart, setWindowStart] = useState<Date>(() => {
    const earliest = nodes
      .filter(n => n.start_at || n.due_at)
      .map(n => new Date(n.start_at ?? n.due_at!).getTime())
    const base = earliest.length > 0 ? new Date(Math.min(...earliest)) : new Date()
    return snapWindowStart(base, 'monthly')
  })
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(nodes.filter(n => n.level !== 'task').map(n => n.id)),
  )
  const timelineRef = useRef<HTMLDivElement>(null)

  const { columns, windowEnd } = useMemo(
    () => buildColumns(scale, windowStart),
    [scale, windowStart],
  )

  const windowStartMs = windowStart.getTime()
  const windowEndMs = windowEnd.getTime()
  const windowDuration = windowEndMs - windowStartMs

  // Flatten visible nodes (respecting expand state)
  const visibleNodes = useMemo(() => {
    const result: WBSNode[] = []
    function walk(items: WBSNode[]) {
      for (const node of items) {
        result.push(node)
        if (expandedIds.has(node.id) && node.children?.length) {
          walk(node.children)
        }
      }
    }
    walk(tree)
    return result
  }, [tree, expandedIds])

  // Build nodeBarMap for DependencyLayer
  const nodeBarMap = useMemo<NodeBarMap>(() => {
    const map: NodeBarMap = new Map()
    visibleNodes.forEach((node, rowIndex) => {
      const startMs = node.start_at ? new Date(node.start_at).getTime() : null
      const endMs = node.due_at ? new Date(node.due_at).getTime() : startMs

      if (startMs === null || endMs === null) return

      const left = Math.max(0, (startMs - windowStartMs) / windowDuration)
      const right = Math.min(1, (endMs - windowStartMs) / windowDuration)

      if (right < 0 || left > 1) return

      const rect: GanttBarRect = {
        leftFraction: left,
        rightFraction: right,
        rowCenterY: rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2,
      }
      map.set(node.id, rect)
    })
    return map
  }, [visibleNodes, windowStartMs, windowDuration])

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleScaleChange(newScale: GanttScale) {
    setScale(newScale)
    setWindowStart(snapWindowStart(windowStart, newScale))
  }

  function goToToday() {
    setWindowStart(snapWindowStart(new Date(), scale))
  }

  const totalHeightPx = visibleNodes.length * ROW_HEIGHT

  // Today marker
  const todayFraction = (Date.now() - windowStartMs) / windowDuration
  const showToday = todayFraction >= 0 && todayFraction <= 1

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-brand-stone bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 border-b border-brand-stone px-4 py-2">
        {/* Scale tabs */}
        <div className="flex rounded-lg border border-brand-stone overflow-hidden">
          {(Object.keys(SCALE_LABELS) as GanttScale[]).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => handleScaleChange(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                scale === s ? 'bg-brand-navy text-white' : 'bg-white text-brand-navy hover:bg-brand-canvas'
              }`}
            >
              {SCALE_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWindowStart(navigateWindow(windowStart, scale, -1))}
            className="rounded p-1.5 text-brand-navy hover:bg-brand-canvas"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="flex items-center gap-1 rounded border border-brand-stone px-2 py-1 text-xs text-brand-navy hover:border-brand-gold"
          >
            <Calendar className="h-3.5 w-3.5" />
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setWindowStart(navigateWindow(windowStart, scale, 1))}
            className="rounded p-1.5 text-brand-navy hover:bg-brand-canvas"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left panel: WBS labels */}
        <div
          className="shrink-0 overflow-y-auto border-r border-brand-stone"
          style={{ width: LEFT_PANEL_WIDTH }}
        >
          {/* Header spacer matching timescale height (2 rows of ~28px each) */}
          <div className="h-[56px] border-b border-brand-stone bg-brand-canvas/50" />
          {/* Rows */}
          {visibleNodes.map(node => {
            const indent = node.level === 'macro' ? 8 : node.level === 'activity' ? 24 : 40
            const hasChildren = (node.children?.length ?? 0) > 0
            const isExpanded = expandedIds.has(node.id)
            return (
              <div
                key={node.id}
                className="flex cursor-pointer items-center gap-1.5 border-b border-brand-stone/30 px-2 hover:bg-brand-canvas/40"
                style={{ height: ROW_HEIGHT, paddingLeft: indent }}
                onClick={() => onOpenNode(node)}
              >
                {hasChildren && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); toggleExpand(node.id) }}
                    className="flex h-4 w-4 shrink-0 items-center justify-center text-brand-navy/50"
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>
                )}
                <span
                  className={`truncate text-xs ${
                    node.level === 'macro' ? 'font-semibold text-brand-navy' :
                    node.level === 'activity' ? 'font-medium text-brand-navy/80' :
                    'text-gray-600'
                  }`}
                >
                  {node.title}
                </span>
              </div>
            )
          })}
        </div>

        {/* Right panel: timeline */}
        <div className="flex-1 overflow-x-auto overflow-y-auto" ref={timelineRef}>
          {/* Timescale header */}
          <div className="sticky top-0 z-30 bg-white">
            <GanttTimescale scale={scale} windowStart={windowStart} columns={columns} />
          </div>

          {/* Rows + bars */}
          <div className="relative" style={{ minHeight: totalHeightPx }}>
            {/* Column backgrounds */}
            <div className="absolute inset-0 flex">
              {columns.map((col, i) => {
                const isWeekend = scale === 'weekly' && (col.getDay() === 0 || col.getDay() === 6)
                return (
                  <div
                    key={i}
                    className={`flex-1 border-r border-brand-stone/20 ${isWeekend ? 'bg-brand-canvas/40' : ''}`}
                  />
                )
              })}
            </div>

            {/* Today marker */}
            {showToday && (
              <div
                className="absolute top-0 z-10 w-0.5 bg-amber-400/80"
                style={{
                  left: `${todayFraction * 100}%`,
                  height: totalHeightPx,
                }}
              />
            )}

            {/* Row grid lines */}
            {visibleNodes.map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-b border-brand-stone/20"
                style={{ top: (i + 1) * ROW_HEIGHT }}
              />
            ))}

            {/* Bars */}
            {visibleNodes.map((node, rowIndex) => {
              const startMs = node.start_at ? new Date(node.start_at).getTime() : null
              const endMs = node.due_at ? new Date(node.due_at).getTime() : startMs

              if (startMs === null) return null

              const leftPct = Math.max(0, (startMs - windowStartMs) / windowDuration) * 100
              const widthPct = endMs
                ? (Math.min(endMs, windowEndMs) - Math.max(startMs, windowStartMs)) / windowDuration * 100
                : 0

              if (leftPct > 100) return null

              const progress = getNodeProgress(node.id)

              return (
                <div
                  key={node.id}
                  className="absolute w-full"
                  style={{ top: rowIndex * ROW_HEIGHT, height: ROW_HEIGHT }}
                >
                  <GanttBar
                    node={node}
                    leftPct={leftPct}
                    widthPct={widthPct}
                    progress={progress}
                    isMilestone={node.is_milestone}
                    onClick={() => onOpenNode(node)}
                    rowHeight={ROW_HEIGHT}
                  />
                </div>
              )
            })}

            {/* Dependency arrows */}
            <DependencyLayer
              dependencies={dependencies}
              nodeBarMap={nodeBarMap}
              totalWidthPx={timelineRef.current?.clientWidth ?? 800}
              totalHeightPx={totalHeightPx}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
