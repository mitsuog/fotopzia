'use client'

import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
import { useCreateActivity } from '@/hooks/useActivities'

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0'))
const MINUTE_OPTIONS = ['00', '15', '30', '45'] as const

interface CalendarMetaUser {
  id: string
  full_name: string | null
  email: string | null
}

function buildIsoFromLocalParts(datePart?: string, hourPart?: string, minutePart?: string): string | undefined {
  if (!datePart || !hourPart || !minutePart) return undefined
  const parsed = new Date(`${datePart}T${hourPart}:${minutePart}:00`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

const activitySchema = z.object({
  type: z.enum(['call', 'email', 'meeting', 'task', 'note']),
  subject: z.string().min(1, 'El asunto es requerido'),
  start_date: z.string().optional(),
  start_hour: z.string().optional(),
  start_minute: z.enum(MINUTE_OPTIONS).optional(),
  end_hour: z.string().optional(),
  end_minute: z.enum(MINUTE_OPTIONS).optional(),
  assignee_user_id: z.string().optional(),
  body: z.string().optional(),
}).superRefine((values, context) => {
  const needsCalendarEvent = values.type === 'call' || values.type === 'meeting'
  if (!needsCalendarEvent) return

  if (!values.start_date) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['start_date'],
      message: 'Selecciona la fecha para agendar el seguimiento.',
    })
  }

  const startIso = buildIsoFromLocalParts(values.start_date, values.start_hour, values.start_minute)
  const endIso = buildIsoFromLocalParts(values.start_date, values.end_hour, values.end_minute)
  if (!startIso || !endIso) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_hour'],
      message: 'Selecciona hora de inicio y hora fin.',
    })
    return
  }

  if (new Date(endIso) <= new Date(startIso)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_hour'],
      message: 'La hora fin debe ser mayor a la hora de inicio.',
    })
  }
})
type ActivityForm = z.infer<typeof activitySchema>

export interface InlineActivityFormProps {
  contactId: string
  dealId?: string
  onDone: () => void
}

export function InlineActivityForm({ contactId, dealId, onDone }: InlineActivityFormProps) {
  const createActivity = useCreateActivity()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const { data: assignableUsers = [] } = useQuery({
    queryKey: ['crm-calendar-meta-users'],
    queryFn: async () => {
      const response = await fetch('/api/crm-calendar/meta')
      const payload = await response.json().catch(() => ({ error: 'No fue posible cargar usuarios.' })) as {
        error?: string
        data?: { users?: CalendarMetaUser[] }
      }
      if (!response.ok) throw new Error(payload.error ?? 'No fue posible cargar usuarios.')
      return payload.data?.users ?? []
    },
    staleTime: 1000 * 60 * 5,
  })

  const { register, control, handleSubmit, reset, formState: { isSubmitting, errors } } = useForm<ActivityForm>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      type: 'call',
      start_hour: '09',
      start_minute: '00',
      end_hour: '10',
      end_minute: '00',
      assignee_user_id: '',
    },
  })
  const activityType = useWatch({ control, name: 'type' })
  const createsCalendarEvent = activityType === 'call' || activityType === 'meeting'

  async function onSubmit(data: ActivityForm) {
    setSubmitError(null)
    const startAt = buildIsoFromLocalParts(data.start_date, data.start_hour, data.start_minute)
    const endAt = buildIsoFromLocalParts(data.start_date, data.end_hour, data.end_minute)

    try {
      await createActivity.mutateAsync({
        type: data.type,
        subject: data.subject,
        body: data.body,
        due_at: startAt,
        schedule_start_at: createsCalendarEvent ? startAt : undefined,
        schedule_end_at: createsCalendarEvent ? endAt : undefined,
        assignee_user_ids: data.assignee_user_id ? [data.assignee_user_id] : [],
        deal_id: dealId,
        contact_id: contactId,
      })
      reset({
        type: 'call',
        subject: '',
        body: '',
        start_date: '',
        start_hour: '09',
        start_minute: '00',
        end_hour: '10',
        end_minute: '00',
        assignee_user_id: '',
      })
      onDone()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No fue posible guardar la actividad.')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-brand-stone bg-brand-paper p-3 space-y-2 mt-2">
      <div className="flex gap-2">
        <select
          {...register('type')}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        >
          <option value="call">Llamada</option>
          <option value="email">Email</option>
          <option value="meeting">Reunion</option>
          <option value="task">Tarea</option>
          <option value="note">Nota</option>
        </select>
      </div>
      <input
        {...register('subject')}
        type="text"
        placeholder="Asunto..."
        className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
      />
      {errors.subject && <p className="text-xs text-red-500">{errors.subject.message}</p>}
      <textarea
        {...register('body')}
        rows={2}
        placeholder="Notas (opcional)..."
        className="w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          {...register('start_date')}
          type="date"
          className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
        />
        <div className="grid grid-cols-2 gap-2">
          <select {...register('start_hour')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
            {HOUR_OPTIONS.map(hour => <option key={hour} value={hour}>{hour}</option>)}
          </select>
          <select {...register('start_minute')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
            {MINUTE_OPTIONS.map(minute => <option key={minute} value={minute}>{minute}</option>)}
          </select>
        </div>
      </div>
      {createsCalendarEvent && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <p className="text-[11px] text-gray-500">Hora fin</p>
            <div className="grid grid-cols-2 gap-2">
              <select {...register('end_hour')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
                {HOUR_OPTIONS.map(hour => <option key={hour} value={hour}>{hour}</option>)}
              </select>
              <select {...register('end_minute')} className="rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40">
                {MINUTE_OPTIONS.map(minute => <option key={minute} value={minute}>{minute}</option>)}
              </select>
            </div>
          </div>
          <select
            {...register('assignee_user_id')}
            className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          >
            <option value="">Responsable: yo (por defecto)</option>
            {assignableUsers.map(user => (
              <option key={user.id} value={user.id}>
                {user.full_name ?? user.email ?? user.id}
              </option>
            ))}
          </select>
        </>
      )}
      {errors.start_date && <p className="text-xs text-red-500">{errors.start_date.message}</p>}
      {errors.end_hour && <p className="text-xs text-red-500">{errors.end_hour.message}</p>}
      {submitError && <p className="text-xs text-red-500">{submitError}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={isSubmitting} className="flex-1 rounded-md bg-brand-navy px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-navy-light disabled:opacity-50">
          Guardar
        </button>
      </div>
    </form>
  )
}
