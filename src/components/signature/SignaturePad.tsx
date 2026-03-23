'use client'

import { useEffect, useRef, useState } from 'react'

type SignaturePadVariant = 'default' | 'initial' | 'document-signature'

interface SignaturePadProps {
  label: string
  value?: string | null
  onChange: (value: string | null) => void
  width?: number
  height?: number
  variant?: SignaturePadVariant
  hintText?: string
  className?: string
}

export function SignaturePad({
  label,
  value,
  onChange,
  width = 520,
  height,
  variant = 'default',
  hintText,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawingRef = useRef(false)
  const [hasStroke, setHasStroke] = useState(Boolean(value))

  const resolvedHeight = height ?? (variant === 'initial' ? 82 : variant === 'document-signature' ? 140 : 180)
  const lineWidth = variant === 'initial' ? 1.6 : 2.1

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    if (!value) {
      context.clearRect(0, 0, canvas.width, canvas.height)
      setHasStroke(false)
      return
    }
    const image = new Image()
    image.onload = () => {
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
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
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
    context.lineWidth = lineWidth
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#102544'
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

  const defaultHint =
    variant === 'initial'
      ? 'Antefirma aqui.'
      : 'Firma aqui directamente sobre el documento.'

  return (
    <div className={['space-y-2', className ?? ''].join(' ').trim()}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-brand-stone px-2 py-1 text-[11px] text-gray-600 hover:bg-brand-paper"
        >
          Limpiar
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-brand-stone bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={resolvedHeight}
          className="h-auto w-full touch-none"
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerCancel={endDraw}
          onPointerLeave={endDraw}
        />
      </div>

      {!hasStroke && (
        <p className="text-[11px] text-gray-500">{hintText ?? defaultHint}</p>
      )}
    </div>
  )
}