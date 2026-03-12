'use client'

import { useEffect, useRef, useState } from 'react'

interface SignaturePadProps {
  label: string
  value?: string | null
  onChange: (value: string | null) => void
  width?: number
  height?: number
}

export function SignaturePad({
  label,
  value,
  onChange,
  width = 520,
  height = 180,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(Boolean(value))

  useEffect(() => {
    if (!value || !canvasRef.current) return
    const image = new Image()
    image.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const context = canvas.getContext('2d')
      if (!context) return
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      setHasStroke(true)
    }
    image.src = value
  }, [value])

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const { x, y } = getPoint(event)
    drawingRef.current = true
    context.beginPath()
    context.moveTo(x, y)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const { x, y } = getPoint(event)
    context.lineWidth = 2
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#1C2B4A'
    context.lineTo(x, y)
    context.stroke()
    setHasStroke(true)
  }

  function endDraw() {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    onChange(dataUrl)
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-brand-navy">{label}</p>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-brand-stone px-2 py-1 text-xs text-gray-600 hover:bg-brand-paper"
        >
          Limpiar
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-brand-stone bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="h-auto w-full touch-none"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          onPointerLeave={endDraw}
        />
      </div>
      {!hasStroke && <p className="text-xs text-gray-500">Firma en el recuadro para continuar.</p>}
    </div>
  )
}
