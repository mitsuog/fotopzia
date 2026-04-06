export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'SERVER_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: unknown
}

export interface ApiEnvelope<T> {
  data: T | null
  error: ApiError | null
  meta?: Record<string, unknown>
}
