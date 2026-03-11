CREATE TYPE public.quote_status AS ENUM (
  'draft', 'sent', 'viewed', 'approved', 'rejected', 'expired'
);

CREATE TYPE public.contract_status AS ENUM (
  'draft', 'sent', 'viewed', 'signed', 'rejected', 'voided'
);

-- Secuencia para numeración de cotizaciones
CREATE SEQUENCE public.quote_number_seq START 1;

-- Cotizaciones
CREATE TABLE public.quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number    TEXT UNIQUE NOT NULL
                  DEFAULT 'FOT-' || TO_CHAR(NOW(), 'YYYY') || '-'
                  || LPAD(NEXTVAL('public.quote_number_seq')::TEXT, 3, '0'),
  contact_id      UUID NOT NULL REFERENCES public.contacts(id),
  deal_id         UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  status          public.quote_status NOT NULL DEFAULT 'draft',
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5,2) NOT NULL DEFAULT 16.00, -- IVA México
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MXN',
  valid_until     DATE,
  notes           TEXT,         -- visible al cliente
  internal_notes  TEXT,         -- solo interno
  client_token    TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  approved_at     TIMESTAMPTZ,
  approved_by     TEXT,         -- nombre del cliente (no usuario)
  version         INTEGER NOT NULL DEFAULT 1,
  parent_id       UUID REFERENCES public.quotes(id), -- versiones anteriores
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Líneas de cotización
CREATE TABLE public.quote_line_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price    NUMERIC(12,2) NOT NULL,
  discount_pct  NUMERIC(5,2) NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL,
  category      TEXT -- 'photography','video','editing','travel','other'
);

-- Templates de contrato
CREATE TABLE public.contract_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  content     TEXT NOT NULL, -- Tiptap JSON string
  variables   JSONB DEFAULT '[]'::JSONB,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER contract_templates_updated_at
  BEFORE UPDATE ON public.contract_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Secuencia para contratos
CREATE SEQUENCE public.contract_number_seq START 1;

-- Contratos
CREATE TABLE public.contracts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number   TEXT UNIQUE NOT NULL
                    DEFAULT 'CONT-' || TO_CHAR(NOW(), 'YYYY') || '-'
                    || LPAD(NEXTVAL('public.contract_number_seq')::TEXT, 3, '0'),
  contact_id        UUID NOT NULL REFERENCES public.contacts(id),
  quote_id          UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  template_id       UUID REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL, -- contenido renderizado con variables sustituidas
  status            public.contract_status NOT NULL DEFAULT 'draft',
  client_token      TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  sent_at           TIMESTAMPTZ,
  viewed_at         TIMESTAMPTZ,
  signed_at         TIMESTAMPTZ,
  signed_by         TEXT,          -- nombre del cliente que firmó
  signature_ip      TEXT,          -- IP de quien firmó (trazabilidad)
  rejection_reason  TEXT,
  created_by        UUID NOT NULL REFERENCES public.profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_quotes_contact ON public.quotes(contact_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_contracts_contact ON public.contracts(contact_id);
CREATE INDEX idx_contracts_status ON public.contracts(status);
