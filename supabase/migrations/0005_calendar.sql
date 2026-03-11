CREATE TYPE public.event_type AS ENUM ('meeting', 'production_session');
CREATE TYPE public.event_status AS ENUM ('tentative', 'confirmed', 'cancelled');
CREATE TYPE public.rsvp_status AS ENUM ('pending', 'yes', 'no', 'maybe');
CREATE TYPE public.resource_type AS ENUM ('studio', 'equipment', 'personnel');

CREATE TABLE public.calendar_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type         public.event_type NOT NULL,
  title        TEXT NOT NULL,
  description  TEXT,
  start_at     TIMESTAMPTZ NOT NULL, -- siempre UTC
  end_at       TIMESTAMPTZ NOT NULL,
  all_day      BOOLEAN NOT NULL DEFAULT FALSE,
  location     TEXT,
  video_url    TEXT,
  color        TEXT DEFAULT '#1C2B4A',
  contact_id   UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id      UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  status       public.event_status NOT NULL DEFAULT 'confirmed',
  created_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_attendees (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id  UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email     TEXT,
  name      TEXT,
  rsvp      public.rsvp_status NOT NULL DEFAULT 'pending'
);

-- Recursos del estudio (equipos, salas, personal)
CREATE TABLE public.resources (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL,
  type      public.resource_type NOT NULL,
  color     TEXT DEFAULT '#C49A2A',
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE public.event_resources (
  event_id    UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES public.resources(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, resource_id)
);

CREATE INDEX idx_events_start ON public.calendar_events(start_at);
CREATE INDEX idx_events_type ON public.calendar_events(type);
CREATE INDEX idx_events_contact ON public.calendar_events(contact_id);
