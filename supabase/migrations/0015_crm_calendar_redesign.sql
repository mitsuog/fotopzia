-- CRM calendar redesign: follow-up issues, comments, logs and reminders

CREATE TYPE public.crm_followup_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
CREATE TYPE public.crm_followup_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.crm_reminder_channel AS ENUM ('in_app', 'email');
CREATE TYPE public.crm_reminder_status AS ENUM ('pending', 'sent', 'failed', 'cancelled');

CREATE TABLE public.crm_event_followups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       public.crm_followup_status NOT NULL DEFAULT 'todo',
  priority     public.crm_followup_priority NOT NULL DEFAULT 'medium',
  assignee_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at       TIMESTAMPTZ,
  closed_at    TIMESTAMPTZ,
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER crm_event_followups_updated_at
  BEFORE UPDATE ON public.crm_event_followups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.crm_event_followup_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id UUID NOT NULL REFERENCES public.crm_event_followups(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.crm_event_followup_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_id UUID NOT NULL REFERENCES public.crm_event_followups(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.crm_event_reminders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  channel           public.crm_reminder_channel NOT NULL,
  send_at           TIMESTAMPTZ NOT NULL,
  offset_minutes    INTEGER NOT NULL,
  status            public.crm_reminder_status NOT NULL DEFAULT 'pending',
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_email   TEXT,
  attempt_count     INTEGER NOT NULL DEFAULT 0,
  last_error        TEXT,
  sent_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER crm_event_reminders_updated_at
  BEFORE UPDATE ON public.crm_event_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_crm_followups_event ON public.crm_event_followups(event_id);
CREATE INDEX idx_crm_followups_assignee ON public.crm_event_followups(assignee_id);
CREATE INDEX idx_crm_followup_comments_followup ON public.crm_event_followup_comments(followup_id);
CREATE INDEX idx_crm_followup_log_followup ON public.crm_event_followup_log(followup_id);
CREATE INDEX idx_crm_followup_log_event ON public.crm_event_followup_log(event_id);
CREATE INDEX idx_crm_event_reminders_event ON public.crm_event_reminders(event_id);
CREATE INDEX idx_crm_event_reminders_send_at ON public.crm_event_reminders(send_at, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'calendar_meeting_requires_contact'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_meeting_requires_contact
      CHECK (type <> 'meeting' OR contact_id IS NOT NULL)
      NOT VALID;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.can_manage_crm_calendar_event(target_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_active = TRUE
      AND p.role IN ('admin', 'project_manager')
  )
  OR EXISTS (
    SELECT 1
    FROM public.calendar_events e
    WHERE e.id = target_event_id
      AND e.created_by = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.event_attendees a
    WHERE a.event_id = target_event_id
      AND a.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_crm_calendar_event(target_event_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_internal_staff()
    AND EXISTS (
      SELECT 1 FROM public.calendar_events e WHERE e.id = target_event_id
    );
$$;

CREATE OR REPLACE FUNCTION public.set_crm_followup_closed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'done'::public.crm_followup_status AND OLD.status <> 'done'::public.crm_followup_status THEN
    NEW.closed_at := NOW();
  ELSIF NEW.status <> 'done'::public.crm_followup_status THEN
    NEW.closed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_followup_set_closed_at
  BEFORE UPDATE ON public.crm_event_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_crm_followup_closed_at();

CREATE OR REPLACE FUNCTION public.log_crm_followup_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  actor UUID;
  changed JSONB;
BEGIN
  actor := auth.uid();

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_event_followup_log (followup_id, event_id, action, payload, actor_id)
    VALUES (
      NEW.id,
      NEW.event_id,
      'created',
      jsonb_build_object(
        'title', NEW.title,
        'status', NEW.status,
        'priority', NEW.priority,
        'assignee_id', NEW.assignee_id,
        'due_at', NEW.due_at
      ),
      actor
    );
    RETURN NEW;
  END IF;

  changed := '{}'::jsonb;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    changed := changed || jsonb_build_object('status', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    changed := changed || jsonb_build_object('priority', jsonb_build_object('from', OLD.priority, 'to', NEW.priority));
  END IF;
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    changed := changed || jsonb_build_object('assignee_id', jsonb_build_object('from', OLD.assignee_id, 'to', NEW.assignee_id));
  END IF;
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    changed := changed || jsonb_build_object('due_at', jsonb_build_object('from', OLD.due_at, 'to', NEW.due_at));
  END IF;
  IF NEW.title IS DISTINCT FROM OLD.title THEN
    changed := changed || jsonb_build_object('title', jsonb_build_object('from', OLD.title, 'to', NEW.title));
  END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    changed := changed || jsonb_build_object('description', jsonb_build_object('from', OLD.description, 'to', NEW.description));
  END IF;

  IF changed <> '{}'::jsonb THEN
    INSERT INTO public.crm_event_followup_log (followup_id, event_id, action, payload, actor_id)
    VALUES (NEW.id, NEW.event_id, 'updated', changed, actor);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER crm_followup_log_on_insert
  AFTER INSERT ON public.crm_event_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_followup_changes();

CREATE TRIGGER crm_followup_log_on_update
  AFTER UPDATE ON public.crm_event_followups
  FOR EACH ROW
  EXECUTE FUNCTION public.log_crm_followup_changes();

DROP POLICY IF EXISTS "staff_manage_events" ON public.calendar_events;
DROP POLICY IF EXISTS "staff_manage_attendees" ON public.event_attendees;

CREATE POLICY "crm_insert_events" ON public.calendar_events
  FOR INSERT WITH CHECK (
    public.is_internal_staff()
    AND created_by = auth.uid()
    AND (type <> 'meeting' OR contact_id IS NOT NULL)
  );

CREATE POLICY "crm_update_events" ON public.calendar_events
  FOR UPDATE USING (
    CASE
      WHEN type = 'meeting' THEN public.can_manage_crm_calendar_event(id)
      ELSE public.is_internal_staff()
    END
  )
  WITH CHECK (
    CASE
      WHEN type = 'meeting' THEN public.can_manage_crm_calendar_event(id)
      ELSE public.is_internal_staff()
    END
  );

CREATE POLICY "crm_delete_events" ON public.calendar_events
  FOR DELETE USING (
    CASE
      WHEN type = 'meeting' THEN public.can_manage_crm_calendar_event(id)
      ELSE public.is_internal_staff()
    END
  );

CREATE POLICY "crm_manage_attendees" ON public.event_attendees
  FOR ALL USING (
    public.can_manage_crm_calendar_event(event_id)
  )
  WITH CHECK (
    public.can_manage_crm_calendar_event(event_id)
  );

ALTER TABLE public.crm_event_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_event_followup_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_event_followup_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_view_crm_followups" ON public.crm_event_followups
  FOR SELECT USING (public.can_view_crm_calendar_event(event_id));

CREATE POLICY "staff_insert_crm_followups" ON public.crm_event_followups
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND public.can_manage_crm_calendar_event(event_id)
  );

CREATE POLICY "staff_update_crm_followups" ON public.crm_event_followups
  FOR UPDATE USING (public.can_manage_crm_calendar_event(event_id))
  WITH CHECK (public.can_manage_crm_calendar_event(event_id));

CREATE POLICY "staff_delete_crm_followups" ON public.crm_event_followups
  FOR DELETE USING (public.can_manage_crm_calendar_event(event_id));

CREATE POLICY "staff_view_crm_followup_comments" ON public.crm_event_followup_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.crm_event_followups f
      WHERE f.id = followup_id
        AND public.can_view_crm_calendar_event(f.event_id)
    )
  );

CREATE POLICY "staff_insert_crm_followup_comments" ON public.crm_event_followup_comments
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.crm_event_followups f
      WHERE f.id = followup_id
        AND public.can_manage_crm_calendar_event(f.event_id)
    )
  );

CREATE POLICY "staff_view_crm_followup_log" ON public.crm_event_followup_log
  FOR SELECT USING (public.can_view_crm_calendar_event(event_id));

CREATE POLICY "staff_insert_crm_followup_log" ON public.crm_event_followup_log
  FOR INSERT WITH CHECK (
    public.can_manage_crm_calendar_event(event_id)
  );

CREATE POLICY "staff_view_crm_event_reminders" ON public.crm_event_reminders
  FOR SELECT USING (
    public.can_view_crm_calendar_event(event_id)
  );

CREATE POLICY "staff_manage_crm_event_reminders" ON public.crm_event_reminders
  FOR ALL USING (
    public.can_manage_crm_calendar_event(event_id)
  )
  WITH CHECK (
    public.can_manage_crm_calendar_event(event_id)
  );
