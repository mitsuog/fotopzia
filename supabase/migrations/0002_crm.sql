-- Etapas del funnel como enum
CREATE TYPE public.deal_stage AS ENUM (
  'lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
);

CREATE TYPE public.activity_type AS ENUM (
  'note', 'call', 'email', 'meeting', 'task', 'stage_change', 'file'
);

-- Contactos
CREATE TABLE public.contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name  TEXT,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  source        TEXT, -- 'instagram','referral','website','cold','event'
  tags          TEXT[] DEFAULT '{}',
  assigned_to   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Deals (oportunidades)
CREATE TABLE public.deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  stage           public.deal_stage NOT NULL DEFAULT 'lead',
  value           NUMERIC(12,2),
  currency        TEXT NOT NULL DEFAULT 'MXN',
  probability     INTEGER CHECK (probability BETWEEN 0 AND 100),
  expected_close  DATE,
  lost_reason     TEXT,
  notes           TEXT,
  assigned_to     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  position        INTEGER NOT NULL DEFAULT 0, -- orden en columna Kanban
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Actividades / Timeline
CREATE TABLE public.activities (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  deal_id     UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  type        public.activity_type NOT NULL,
  subject     TEXT,
  body        TEXT,
  due_at      TIMESTAMPTZ,
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices de rendimiento
CREATE INDEX idx_contacts_assigned_to ON public.contacts(assigned_to);
CREATE INDEX idx_contacts_email ON public.contacts(email);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_deals_contact ON public.deals(contact_id);
CREATE INDEX idx_activities_contact ON public.activities(contact_id);
CREATE INDEX idx_activities_deal ON public.activities(deal_id);
