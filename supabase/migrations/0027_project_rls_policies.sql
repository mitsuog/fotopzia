-- 0027_project_rls_policies.sql
-- Re-create RLS policies for project tables.
-- These were defined in 0011 but not applied in production
-- (likely because 0011 ran before the tables existed from 0009).

-- Drop first to avoid duplicate-policy errors if run twice
DROP POLICY IF EXISTS "staff_view_projects"             ON public.projects;
DROP POLICY IF EXISTS "staff_manage_projects"           ON public.projects;
DROP POLICY IF EXISTS "staff_view_project_tasks"        ON public.project_tasks;
DROP POLICY IF EXISTS "staff_manage_project_tasks"      ON public.project_tasks;
DROP POLICY IF EXISTS "staff_view_project_deliverables" ON public.project_deliverables;
DROP POLICY IF EXISTS "staff_manage_project_deliverables" ON public.project_deliverables;
DROP POLICY IF EXISTS "staff_view_project_activity_log" ON public.project_activity_log;
DROP POLICY IF EXISTS "staff_insert_project_activity_log" ON public.project_activity_log;

-- projects
CREATE POLICY "staff_view_projects" ON public.projects
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_projects" ON public.projects
  FOR ALL USING (public.is_internal_staff());

-- project_tasks
CREATE POLICY "staff_view_project_tasks" ON public.project_tasks
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_project_tasks" ON public.project_tasks
  FOR ALL USING (public.is_internal_staff());

-- project_deliverables
CREATE POLICY "staff_view_project_deliverables" ON public.project_deliverables
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_project_deliverables" ON public.project_deliverables
  FOR ALL USING (public.is_internal_staff());

-- project_activity_log (append-only for staff, no UPDATE/DELETE)
CREATE POLICY "staff_view_project_activity_log" ON public.project_activity_log
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_insert_project_activity_log" ON public.project_activity_log
  FOR INSERT WITH CHECK (public.is_internal_staff());
