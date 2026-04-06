import { NextResponse } from 'next/server'
import type { ApiEnvelope, ApiErrorCode } from '@/types/api'

export function apiSuccess<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json<ApiEnvelope<T>>({
    data,
    error: null,
    ...(meta ? { meta } : {}),
  })
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  options?: {
    status?: number
    details?: unknown
    meta?: Record<string, unknown>
  },
) {
  const status = options?.status ?? 400

  return NextResponse.json<ApiEnvelope<null>>(
    {
      data: null,
      error: {
        code,
        message,
        ...(options?.details !== undefined ? { details: options.details } : {}),
      },
      ...(options?.meta ? { meta: options.meta } : {}),
    },
    { status },
  )
}
