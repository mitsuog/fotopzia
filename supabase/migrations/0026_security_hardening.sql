-- 0026_security_hardening.sql
-- Fix security linter warnings from Supabase dashboard:
--   1. RLS not enabled on project tables (re-apply idempotently in case migrations ran out of order)
--   2. Functions with mutable search_path

-- ─── 1. Ensure RLS is enabled on project tables ────────────────────────────
ALTER TABLE public.projects             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_log ENABLE ROW LEVEL SECURITY;

-- ─── 2. Fix mutable search_path on functions ───────────────────────────────
-- Prevents malicious schemas prepended to search_path from hijacking calls.

ALTER FUNCTION public.set_updated_at()
  SET search_path = public;

ALTER FUNCTION public.compute_project_progress(UUID)
  SET search_path = public;

ALTER FUNCTION public.compute_wbs_node_progress(UUID)
  SET search_path = public;

ALTER FUNCTION public.sync_project_from_won_deal()
  SET search_path = public;

ALTER FUNCTION public.validate_deal_pipeline_rules()
  SET search_path = public;
