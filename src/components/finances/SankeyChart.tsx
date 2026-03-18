'use client'

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(n)
}

interface SankeyNode {
  label: string
  value: number
  color: string
}

interface Props {
  income: number
  op_fixed: number
  op_variable: number
  payroll: number
  net: number
}

const W = 520        // viewBox width
const H = 300        // viewBox height
const NODE_W = 110   // node rectangle width
const LEFT_X = 0
const RIGHT_X = W - NODE_W
const MID_X = W / 2
const NODE_GAP = 8   // gap between right-side nodes
const MIN_NODE_H = 28

export function SankeyChart({ income, op_fixed, op_variable, payroll, net }: Props) {
  if (income <= 0 && op_fixed <= 0 && op_variable <= 0 && payroll <= 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
        Sin datos suficientes
      </div>
    )
  }

  // Build destination nodes, skip zero-value ones
  const destinations: SankeyNode[] = [
    { label: 'G. Fijos',     value: op_fixed,   color: '#64748b' },
    { label: 'G. Variables', value: op_variable, color: '#2E3F5E' },
    { label: 'Nómina',       value: payroll,     color: '#6366f1' },
    net >= 0
      ? { label: 'Utilidad Neta', value: net,        color: '#10b981' }
      : { label: 'Pérdida Neta',  value: Math.abs(net), color: '#ef4444' },
  ].filter(d => d.value > 0)

  if (destinations.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-gray-200 text-sm text-gray-400">
        Sin datos suficientes
      </div>
    )
  }

  // Total value for proportions (use income or sum of destinations, whichever is larger)
  const destSum = destinations.reduce((s, d) => s + d.value, 0)
  const total = Math.max(income, destSum) || 1

  // Layout right-side nodes proportionally within available height
  const usableH = H - NODE_GAP * (destinations.length - 1)
  let rightY = 0
  const rightNodes = destinations.map(d => {
    const h = Math.max(MIN_NODE_H, (d.value / total) * usableH)
    const node = { ...d, x: RIGHT_X, y: rightY, h }
    rightY += h + NODE_GAP
    return node
  })

  // Left node — same total span as right nodes
  const leftTotalH = rightY - NODE_GAP
  const leftNode = {
    label: 'Ingresos',
    value: income,
    x: LEFT_X,
    y: 0,
    h: leftTotalH,
    color: '#C49A2A',
  }

  // For each flow: compute the slice on the left node and connect to right node center
  // Left node is sliced vertically to match right node proportions
  let leftSliceY = 0
  const flows = rightNodes.map(rn => {
    const sliceH = rn.h  // same height as destination node
    const srcY1 = leftSliceY
    const srcY2 = leftSliceY + sliceH
    leftSliceY += sliceH

    // Bezier control points
    const sx = LEFT_X + NODE_W
    const tx = RIGHT_X
    const sy1 = srcY1
    const sy2 = srcY2
    const ty1 = rn.y
    const ty2 = rn.y + rn.h

    const path = `
      M ${sx} ${sy1}
      C ${MID_X} ${sy1}, ${MID_X} ${ty1}, ${tx} ${ty1}
      L ${tx} ${ty2}
      C ${MID_X} ${ty2}, ${MID_X} ${sy2}, ${sx} ${sy2}
      Z
    `
    return { path, color: rn.color, rn }
  })

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[300px] w-full"
        style={{ minWidth: 320 }}
      >
        {/* Flow paths */}
        {flows.map((f, i) => (
          <path key={i} d={f.path} fill={f.color} opacity={0.25} />
        ))}

        {/* Left node — Ingresos */}
        <rect
          x={leftNode.x}
          y={leftNode.y}
          width={NODE_W}
          height={leftNode.h}
          rx={5}
          fill={leftNode.color}
        />
        <text
          x={leftNode.x + NODE_W / 2}
          y={leftNode.y + leftNode.h / 2 - 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={700}
          fill="white"
        >
          {leftNode.label}
        </text>
        <text
          x={leftNode.x + NODE_W / 2}
          y={leftNode.y + leftNode.h / 2 + 9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="white"
          opacity={0.85}
        >
          {fmt(leftNode.value)}
        </text>

        {/* Right nodes */}
        {rightNodes.map((rn, i) => (
          <g key={i}>
            <rect x={rn.x} y={rn.y} width={NODE_W} height={rn.h} rx={5} fill={rn.color} />
            {rn.h >= 40 ? (
              <>
                <text
                  x={rn.x + NODE_W / 2}
                  y={rn.y + rn.h / 2 - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={10}
                  fontWeight={700}
                  fill="white"
                >
                  {rn.label}
                </text>
                <text
                  x={rn.x + NODE_W / 2}
                  y={rn.y + rn.h / 2 + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="white"
                  opacity={0.85}
                >
                  {fmt(rn.value)}
                </text>
              </>
            ) : (
              <text
                x={rn.x + NODE_W / 2}
                y={rn.y + rn.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight={600}
                fill="white"
              >
                {rn.label}: {fmt(rn.value)}
              </text>
            )}
          </g>
        ))}

        {/* Percentage labels on the right of each flow, near destination */}
        {rightNodes.map((rn, i) => {
          const pct = income > 0 ? ((rn.value / income) * 100).toFixed(0) : '—'
          return (
            <text
              key={i}
              x={RIGHT_X - 6}
              y={rn.y + rn.h / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={9}
              fill={rn.color}
              fontWeight={600}
              opacity={0.8}
            >
              {pct}%
            </text>
          )
        })}
      </svg>
    </div>
  )
}
