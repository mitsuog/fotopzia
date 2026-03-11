CREATE TYPE public.approval_entity_type AS ENUM (
  'quote', 'contract', 'asset', 'custom'
);

CREATE TYPE public.approval_flow_status AS ENUM (
  'pending', 'in_progress', 'approved', 'rejected', 'cancelled'
);

CREATE TYPE public.approval_step_status AS ENUM (
  'pending', 'approved', 'rejected', 'skipped'
);

CREATE TYPE public.approver_type AS ENUM ('internal', 'client');

CREATE TABLE public.approval_flows (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  entity_type   public.approval_entity_type NOT NULL,
  entity_id     UUID NOT NULL,
  status        public.approval_flow_status NOT NULL DEFAULT 'pending',
  created_by    UUID NOT NULL REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER approval_flows_updated_at
  BEFORE UPDATE ON public.approval_flows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.approval_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         UUID NOT NULL REFERENCES public.approval_flows(id) ON DELETE CASCADE,
  step_order      INTEGER NOT NULL,
  title           TEXT,
  approver_type   public.approver_type NOT NULL,
  approver_id     UUID REFERENCES public.profiles(id),  -- si es interno
  approver_email  TEXT,                                   -- si es cliente
  approver_name   TEXT,
  status          public.approval_step_status NOT NULL DEFAULT 'pending',
  token           TEXT UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  responded_at    TIMESTAMPTZ,
  comment         TEXT
);

CREATE INDEX idx_approval_flows_entity ON public.approval_flows(entity_type, entity_id);
CREATE INDEX idx_approval_steps_flow ON public.approval_steps(flow_id);
CREATE INDEX idx_approval_steps_token ON public.approval_steps(token);
