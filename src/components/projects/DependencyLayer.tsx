'use client'

import type { Dependency, NodeBarMap, DependencyType } from '@/types/wbs'

// Color per dep type
const DEP_COLORS: Record<DependencyType, string> = {
  FS: '#1C2B4A',  // navy
  SS: '#0369a1',  // blue
  FF: '#64748b',  // slate
  SF: '#f59e0b',  // amber
}

const EXIT_GAP = 22   // px from bar edge before turning
const CORNER_R = 6    // corner radius for Q bezier turns

interface DependencyLayerProps {
  dependencies: Dependency[]
  nodeBarMap: NodeBarMap
  totalWidthPx: number
  totalHeightPx: number
}

export function DependencyLayer({
  dependencies,
  nodeBarMap,
  totalWidthPx,
  totalHeightPx,
}: DependencyLayerProps) {
  if (dependencies.length === 0 || totalWidthPx <= 0) return null

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width={totalWidthPx}
      height={totalHeightPx}
      overflow="visible"
      style={{ zIndex: 20 }}
    >
      <defs>
        {(['FS', 'SS', 'FF', 'SF'] as DependencyType[]).map(type => (
          <marker
            key={type}
            id={`arw-${type}`}
            markerWidth={10}
            markerHeight={10}
            refX={9}
            refY={5}
            orient="auto"
          >
            <path d="M 1.5 1.5 L 9 5 L 1.5 8.5 z" fill={DEP_COLORS[type]} />
          </marker>
        ))}
        {/* White halo marker — slightly larger, drawn first */}
        {(['FS', 'SS', 'FF', 'SF'] as DependencyType[]).map(type => (
          <marker
            key={`bg-${type}`}
            id={`arw-bg-${type}`}
            markerWidth={14}
            markerHeight={14}
            refX={12}
            refY={7}
            orient="auto"
          >
            <path d="M 2 2 L 12 7 L 2 12 z" fill="white" />
          </marker>
        ))}
      </defs>

      {dependencies.map(dep => {
        const pred = nodeBarMap.get(dep.predecessor_id)
        const succ = nodeBarMap.get(dep.successor_id)
        if (!pred || !succ) return null

        const type = dep.dep_type as DependencyType
        const color = DEP_COLORS[type]
        const W = totalWidthPx

        // Anchor points per dependency type
        let x1: number, y1: number, x2: number, y2: number
        switch (type) {
          case 'FS': // end of pred → start of succ
            x1 = pred.rightFraction * W;  y1 = pred.rowCenterY
            x2 = succ.leftFraction * W;   y2 = succ.rowCenterY
            break
          case 'SS': // start of pred → start of succ
            x1 = pred.leftFraction * W;   y1 = pred.rowCenterY
            x2 = succ.leftFraction * W;   y2 = succ.rowCenterY
            break
          case 'FF': // end of pred → end of succ
            x1 = pred.rightFraction * W;  y1 = pred.rowCenterY
            x2 = succ.rightFraction * W;  y2 = succ.rowCenterY
            break
          case 'SF': // start of pred → end of succ
            x1 = pred.leftFraction * W;   y1 = pred.rowCenterY
            x2 = succ.rightFraction * W;  y2 = succ.rowCenterY
            break
        }

        const d = routePath(x1, y1, x2, y2, type)

        // Badge at midpoint of the vertical segment
        const midY = (y1 + y2) / 2
        const badgeX = type === 'FS' || type === 'FF'
          ? Math.max(x1 + EXIT_GAP, type === 'FF' ? x2 + EXIT_GAP : x1 + EXIT_GAP) + 3
          : Math.min(x1 - EXIT_GAP, x2 - EXIT_GAP) - 3
        const showBadge = Math.abs(y2 - y1) > 28

        return (
          <g key={dep.id}>
            {/* White halo (drawn first, slightly thicker) */}
            <path
              d={d}
              fill="none"
              stroke="white"
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#arw-bg-${type})`}
            />
            {/* Colored arrow */}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#arw-${type})`}
            />
            {/* Dep-type badge at midpoint */}
            {showBadge && (
              <>
                <rect
                  x={badgeX - 1}
                  y={midY - 7}
                  width={16}
                  height={14}
                  rx={3}
                  fill="white"
                  stroke={color}
                  strokeWidth={0.75}
                  opacity={0.9}
                />
                <text
                  x={badgeX + 7}
                  y={midY + 4}
                  textAnchor="middle"
                  fontSize={8}
                  fontWeight="600"
                  fill={color}
                  fontFamily="system-ui, sans-serif"
                >
                  {type}
                </text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/**
 * Build a rounded H-V-H elbow path (Gantt-style MS Project routing).
 * For FS: exit right → vertical → enter left
 * For SS: exit left  → vertical → enter left
 * For FF: exit right → vertical → enter right
 * For SF: exit left  → vertical → enter right (unusual)
 */
function routePath(x1: number, y1: number, x2: number, y2: number, type: DependencyType): string {
  const dy = y2 - y1
  const sameRow = Math.abs(dy) < 2

  if (type === 'FS') {
    // Exit right of pred; enter left of succ
    // turnX = how far right to go before going vertical
    // If succ.left (x2) is well to the right of pred.right+GAP → simple forward path
    // Otherwise (retrograde or tight) → go further right to clear x2, then come back
    const forwardTurn = x1 + EXIT_GAP
    const turnX = x2 > forwardTurn ? forwardTurn : Math.max(forwardTurn, x2 + EXIT_GAP)

    if (sameRow) {
      if (x2 >= x1) return `M ${x1} ${y1} H ${x2}`
      // Same row retrograde: U-turn below the row
      const dy2 = 14
      return buildUTurn(x1, y1, turnX, dy2, x2, y2)
    }
    return buildElbow(x1, y1, turnX, x2, y2, dy > 0)
  }

  if (type === 'SS') {
    // Exit left of pred; enter left of succ (arrow enters right-going)
    const turnX = Math.min(x1 - EXIT_GAP, x2 - EXIT_GAP)
    if (sameRow) return `M ${x1} ${y1} H ${x2}`
    return buildElbow(x1, y1, turnX, x2, y2, dy > 0)
  }

  if (type === 'FF') {
    // Exit right of pred; enter right of succ (arrow enters going left)
    const turnX = Math.max(x1 + EXIT_GAP, x2 + EXIT_GAP)
    if (sameRow) return `M ${x1} ${y1} H ${x2}`
    return buildElbow(x1, y1, turnX, x2, y2, dy > 0)
  }

  // SF: exit left of pred; enter right of succ
  const turnX = Math.min(x1 - EXIT_GAP, x2 - EXIT_GAP) - EXIT_GAP
  if (sameRow) return `M ${x1} ${y1} H ${x2}`
  return buildElbow(x1, y1, turnX, x2, y2, dy > 0)
}

/**
 * H-V-H elbow with rounded corners.
 * Goes from (x1,y1) → horizontally to turnX → vertically to y2 → horizontally to (x2,y2).
 * Corners are rounded with quadratic bezier arcs of radius CORNER_R.
 */
function buildElbow(
  x1: number,
  y1: number,
  turnX: number,
  x2: number,
  y2: number,
  goDown: boolean,
): string {
  const sig = goDown ? 1 : -1
  const dy = Math.abs(y2 - y1)
  const r = Math.min(CORNER_R, dy / 2)

  // Determine which way the final H segment goes
  const finalGoRight = x2 > turnX

  // First corner: from H → V at (turnX, y1)
  // Coming from left (x1 < turnX) or right (x1 > turnX)?
  const firstHGoRight = turnX > x1
  const firstCornerBefore = firstHGoRight ? turnX - r : turnX + r
  const firstCornerAfter = y1 + sig * r

  // Second corner: from V → H at (turnX, y2)
  const secondCornerBefore = y2 - sig * r
  const secondCornerAfter = finalGoRight ? turnX + r : turnX - r

  return [
    `M ${x1} ${y1}`,
    `H ${firstCornerBefore}`,
    `Q ${turnX} ${y1} ${turnX} ${firstCornerAfter}`,
    `V ${secondCornerBefore}`,
    `Q ${turnX} ${y2} ${secondCornerAfter} ${y2}`,
    `H ${x2}`,
  ].join(' ')
}

/** U-turn for same-row retrograde: goes right, dips down, comes back left */
function buildUTurn(
  x1: number,
  y1: number,
  turnX: number,
  dipDown: number,
  x2: number,
  _y2: number,
): string {
  const r = Math.min(CORNER_R, dipDown / 2)
  const dipY = y1 + dipDown
  return [
    `M ${x1} ${y1}`,
    `H ${turnX - r}`,
    `Q ${turnX} ${y1} ${turnX} ${y1 + r}`,
    `V ${dipY - r}`,
    `Q ${turnX} ${dipY} ${turnX - r} ${dipY}`,
    `H ${x2 + r}`,
    `Q ${x2} ${dipY} ${x2} ${dipY - r}`,
    `V ${y1 + r}`,
    `Q ${x2} ${y1} ${x2 + r} ${y1}`,
    `H ${x2}`,
  ].join(' ')
}
