import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ReminderRow {
  id: string
  event_id: string
  channel: 'in_app' | 'email'
  send_at: string
  offset_minutes: number
  recipient_user_id: string | null
  recipient_email: string | null
  attempt_count: number
}

interface EventRow {
  id: string
  title: string
  start_at: string
  location: string | null
  contact_id: string | null
  deal_id: string | null
  created_by: string
}

interface ContactRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

interface ProfileRow {
  id: string
  full_name: string | null
  email: string
}

function withTable(table: string) {
  return supabaseAdmin.from(table as never)
}

function formatDateLabel(isoString: string): string {
  const date = new Date(isoString)
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)
}

export async function POST(request: Request) {
  const secret = process.env.CRM_REMINDER_CRON_SECRET
  const headerSecret = request.headers.get('x-cron-secret')
  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const remindersTable = withTable('crm_event_reminders')
  const nowIso = new Date().toISOString()

  const { data: rawReminders, error: remindersError } = await remindersTable
    .select('id, event_id, channel, send_at, offset_minutes, recipient_user_id, recipient_email, attempt_count')
    .eq('status', 'pending')
    .lte('send_at', nowIso)
    .order('send_at', { ascending: true })
    .limit(200)

  if (remindersError) {
    return NextResponse.json({ error: remindersError.message }, { status: 400 })
  }

  const reminders = (rawReminders ?? []) as ReminderRow[]
  if (reminders.length === 0) {
    return NextResponse.json({ data: { processed: 0, sent: 0, failed: 0 } })
  }

  const eventIds = Array.from(new Set(reminders.map(reminder => reminder.event_id)))
  const userIds = Array.from(
    new Set(reminders.map(reminder => reminder.recipient_user_id).filter((value): value is string => Boolean(value))),
  )

  const { data: rawEvents, error: eventsError } = await supabaseAdmin
    .from('calendar_events')
    .select('id, title, start_at, location, contact_id, deal_id, created_by')
    .in('id', eventIds)

  if (eventsError) {
    return NextResponse.json({ error: eventsError.message }, { status: 400 })
  }

  const events = (rawEvents ?? []) as EventRow[]
  const eventMap = new Map(events.map(event => [event.id, event]))

  const contactIds = Array.from(new Set(events.map(event => event.contact_id).filter((value): value is string => Boolean(value))))
  const { data: rawContacts, error: contactsError } = contactIds.length
    ? await supabaseAdmin
      .from('contacts')
      .select('id, first_name, last_name, email')
      .in('id', contactIds)
    : { data: [], error: null }

  if (contactsError) {
    return NextResponse.json({ error: contactsError.message }, { status: 400 })
  }

  const contacts = (rawContacts ?? []) as ContactRow[]
  const contactMap = new Map(contacts.map(contact => [contact.id, contact]))

  const { data: rawProfiles, error: profilesError } = userIds.length
    ? await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    : { data: [], error: null }

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 400 })
  }

  const profiles = (rawProfiles ?? []) as ProfileRow[]
  const profileMap = new Map(profiles.map(profile => [profile.id, profile]))

  const resendApiKey = process.env.RESEND_API_KEY
  const reminderFrom = process.env.CRM_REMINDER_FROM_EMAIL
  const resend = resendApiKey ? new Resend(resendApiKey) : null

  let sent = 0
  let failed = 0

  for (const reminder of reminders) {
    const event = eventMap.get(reminder.event_id)
    if (!event) {
      await remindersTable
        .update({
          status: 'failed',
          attempt_count: reminder.attempt_count + 1,
          last_error: 'Evento relacionado no encontrado.',
        })
        .eq('id', reminder.id)
      failed += 1
      continue
    }

    try {
      if (reminder.channel === 'in_app') {
        const recipientProfile = reminder.recipient_user_id ? profileMap.get(reminder.recipient_user_id) : null
        const recipientLabel = recipientProfile?.full_name ?? recipientProfile?.email ?? 'colaborador'
        const activityBody = `Recordatorio automático para ${recipientLabel}: "${event.title}" el ${formatDateLabel(event.start_at)}.`

        const { error: activityError } = await supabaseAdmin.from('activities').insert({
          type: 'note',
          contact_id: event.contact_id,
          deal_id: event.deal_id,
          subject: `Recordatorio de cita: ${event.title}`,
          body: activityBody,
          due_at: event.start_at,
          created_by: event.created_by,
        })

        if (activityError) {
          throw new Error(activityError.message)
        }
      } else {
        const recipientProfile = reminder.recipient_user_id ? profileMap.get(reminder.recipient_user_id) : null
        const eventContact = event.contact_id ? contactMap.get(event.contact_id) ?? null : null
        const recipientEmail = reminder.recipient_email ?? recipientProfile?.email ?? eventContact?.email ?? null

        if (!recipientEmail) {
          throw new Error('No hay email de destino para este recordatorio.')
        }
        if (!resend || !reminderFrom) {
          throw new Error('Canal email no configurado (RESEND_API_KEY o CRM_REMINDER_FROM_EMAIL).')
        }

        const recipientName =
          recipientProfile?.full_name ||
          (eventContact ? `${eventContact.first_name} ${eventContact.last_name}` : null) ||
          recipientEmail

        const locationLabel = event.location ? `<p><strong>Ubicación:</strong> ${event.location}</p>` : ''
        const { error: emailError } = await resend.emails.send({
          from: reminderFrom,
          to: recipientEmail,
          subject: `Recordatorio de cita: ${event.title}`,
          html: `
            <div>
              <p>Hola ${recipientName},</p>
              <p>Este es un recordatorio automático de tu cita en Fotopzia.</p>
              <p><strong>Título:</strong> ${event.title}</p>
              <p><strong>Fecha:</strong> ${formatDateLabel(event.start_at)}</p>
              ${locationLabel}
            </div>
          `,
        })

        if (emailError) {
          throw new Error(emailError.message)
        }
      }

      const { error: updateError } = await remindersTable
        .update({
          status: 'sent',
          sent_at: nowIso,
          attempt_count: reminder.attempt_count + 1,
          last_error: null,
        })
        .eq('id', reminder.id)

      if (updateError) throw new Error(updateError.message)
      sent += 1
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : 'Error desconocido en dispatcher.'
      await remindersTable
        .update({
          status: 'failed',
          attempt_count: reminder.attempt_count + 1,
          last_error: message,
        })
        .eq('id', reminder.id)
      failed += 1
    }
  }

  return NextResponse.json({
    data: {
      processed: reminders.length,
      sent,
      failed,
    },
  })
}
