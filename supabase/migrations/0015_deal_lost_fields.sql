-- Add lost capture fields to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_stage TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_notes TEXT;
