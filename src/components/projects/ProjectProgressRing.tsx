'use client'

interface ProjectProgressRingProps {
  progress: number   // 0-100
  size?: number      // px, default 32
  strokeWidth?: number
  className?: string
}

export function ProjectProgressRing({ progress, size = 32, strokeWidth = 3, className }: ProjectProgressRingProps) {
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - clamp(progress, 0, 100) / 100 * circumference

  const color =
    progress >= 75 ? '#22c55e' :
    progress >= 40 ? '#f59e0b' :
    '#94a3b8'

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-label={`${progress}%`}
    >
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={strokeWidth}
      />
      {/* Fill */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      {/* Label */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.28}
        fontWeight="600"
        fill="#1C2B4A"
      >
        {Math.round(progress)}
      </text>
    </svg>
  )
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}
