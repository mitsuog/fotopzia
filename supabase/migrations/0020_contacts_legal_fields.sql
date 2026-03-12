-- Datos legales del cliente en contacto CRM

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS legal_entity_type TEXT NOT NULL DEFAULT 'persona_fisica',
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_name TEXT,
  ADD COLUMN IF NOT EXISTS legal_representative_role TEXT,
  ADD COLUMN IF NOT EXISTS legal_address TEXT;

ALTER TABLE public.contacts
  DROP CONSTRAINT IF EXISTS contacts_legal_entity_type_check;

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_legal_entity_type_check
  CHECK (legal_entity_type IN ('persona_fisica', 'persona_moral'));
