-- 0031_projects_archive.sql
-- Add explicit archive fields for projects (independent from stage lifecycle).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_is_archived ON public.projects(is_archived);
