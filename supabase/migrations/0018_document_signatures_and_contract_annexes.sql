-- Signature and document packaging support for quotes/contracts

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS approved_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS approved_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS approved_ip TEXT,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signed_signature_data TEXT,
  ADD COLUMN IF NOT EXISTS signed_signature_name TEXT,
  ADD COLUMN IF NOT EXISTS initials_data JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS annexes JSONB NOT NULL DEFAULT '[]'::JSONB,
  ADD COLUMN IF NOT EXISTS page_count INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_page_count_positive;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_page_count_positive CHECK (page_count > 0);
