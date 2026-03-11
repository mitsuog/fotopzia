-- RLS policies for newly added tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- Projects: internal staff can view/manage
CREATE POLICY "staff_view_projects" ON public.projects
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_projects" ON public.projects
  FOR ALL USING (public.is_internal_staff());

CREATE POLICY "staff_view_project_tasks" ON public.project_tasks
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_project_tasks" ON public.project_tasks
  FOR ALL USING (public.is_internal_staff());

CREATE POLICY "staff_view_project_deliverables" ON public.project_deliverables
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_project_deliverables" ON public.project_deliverables
  FOR ALL USING (public.is_internal_staff());

CREATE POLICY "staff_view_project_activity_log" ON public.project_activity_log
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_insert_project_activity_log" ON public.project_activity_log
  FOR INSERT WITH CHECK (public.is_internal_staff());

-- Admin control-plane
CREATE POLICY "admin_manage_roles" ON public.roles
  FOR ALL USING (public.is_admin());

CREATE POLICY "staff_view_roles" ON public.roles
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_view_permissions" ON public.permissions
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_manage_permissions" ON public.permissions
  FOR ALL USING (public.is_admin());

CREATE POLICY "staff_view_role_permissions" ON public.role_permissions
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_manage_role_permissions" ON public.role_permissions
  FOR ALL USING (public.is_admin());

CREATE POLICY "staff_view_catalog_items" ON public.catalog_items
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_manage_catalog_items" ON public.catalog_items
  FOR ALL USING (public.is_admin());

CREATE POLICY "staff_view_workflow_templates" ON public.workflow_templates
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_manage_workflow_templates" ON public.workflow_templates
  FOR ALL USING (public.is_admin());

CREATE POLICY "staff_view_branding_settings" ON public.branding_settings
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_manage_branding_settings" ON public.branding_settings
  FOR ALL USING (public.is_admin());
