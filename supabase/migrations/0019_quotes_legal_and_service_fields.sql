-- Datos legales y de servicio capturados en cotizacion para autocompletar contratos

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS client_entity_type TEXT NOT NULL DEFAULT 'persona_fisica',
  ADD COLUMN IF NOT EXISTS client_legal_name TEXT,
  ADD COLUMN IF NOT EXISTS client_representative_name TEXT,
  ADD COLUMN IF NOT EXISTS client_representative_role TEXT,
  ADD COLUMN IF NOT EXISTS client_legal_address TEXT,
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS service_description TEXT,
  ADD COLUMN IF NOT EXISTS service_date DATE,
  ADD COLUMN IF NOT EXISTS service_location TEXT;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_client_entity_type_check;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_client_entity_type_check
  CHECK (client_entity_type IN ('persona_fisica', 'persona_moral'));
