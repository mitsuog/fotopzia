-- =============================================
-- HABILITAR RLS EN TODAS LAS TABLAS
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_portal_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY;

-- =============================================
-- FUNCIÓN HELPER: obtener rol del usuario actual
-- =============================================
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles
  WHERE id = auth.uid()
$$;

-- =============================================
-- FUNCIÓN HELPER: verificar si es admin
-- =============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
  )
$$;

-- =============================================
-- FUNCIÓN HELPER: verificar si es staff interno
-- =============================================
CREATE OR REPLACE FUNCTION public.is_internal_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'project_manager', 'operator')
    AND is_active = TRUE
  )
$$;

-- =============================================
-- PROFILES
-- =============================================

CREATE POLICY "staff_view_profiles" ON public.profiles
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_view_all_profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "own_profile_select" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "admin_manage_profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

CREATE POLICY "own_profile_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- =============================================
-- CONTACTS
-- =============================================

CREATE POLICY "staff_view_contacts" ON public.contacts
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_insert_contacts" ON public.contacts
  FOR INSERT WITH CHECK (public.is_internal_staff());

CREATE POLICY "admin_pm_update_contacts" ON public.contacts
  FOR UPDATE USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
    OR assigned_to = auth.uid()
  );

CREATE POLICY "admin_delete_contacts" ON public.contacts
  FOR DELETE USING (public.is_admin());

-- =============================================
-- DEALS
-- =============================================

CREATE POLICY "staff_view_deals" ON public.deals
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_insert_deals" ON public.deals
  FOR INSERT WITH CHECK (public.is_internal_staff());

CREATE POLICY "staff_update_assigned_deals" ON public.deals
  FOR UPDATE USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

CREATE POLICY "admin_pm_delete_deals" ON public.deals
  FOR DELETE USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

-- =============================================
-- ACTIVITIES
-- =============================================

CREATE POLICY "staff_view_activities" ON public.activities
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_insert_activities" ON public.activities
  FOR INSERT WITH CHECK (public.is_internal_staff());

CREATE POLICY "own_or_admin_update_activities" ON public.activities
  FOR UPDATE USING (
    created_by = auth.uid() OR public.is_admin()
  );

CREATE POLICY "own_or_admin_delete_activities" ON public.activities
  FOR DELETE USING (
    created_by = auth.uid() OR public.is_admin()
  );

-- =============================================
-- QUOTES + LINE ITEMS
-- =============================================

CREATE POLICY "staff_view_quotes" ON public.quotes
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_pm_manage_quotes" ON public.quotes
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

CREATE POLICY "operator_view_quotes" ON public.quotes
  FOR SELECT USING (
    public.get_current_user_role() = 'operator'
  );

CREATE POLICY "staff_manage_line_items" ON public.quote_line_items
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

CREATE POLICY "staff_view_line_items" ON public.quote_line_items
  FOR SELECT USING (public.is_internal_staff());

-- =============================================
-- CONTRACT TEMPLATES + CONTRACTS
-- =============================================

CREATE POLICY "staff_view_templates" ON public.contract_templates
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_pm_manage_templates" ON public.contract_templates
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

CREATE POLICY "staff_view_contracts" ON public.contracts
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_pm_manage_contracts" ON public.contracts
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

-- =============================================
-- APPROVAL FLOWS + STEPS
-- =============================================

CREATE POLICY "staff_view_approval_flows" ON public.approval_flows
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_pm_manage_approval_flows" ON public.approval_flows
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

CREATE POLICY "staff_view_approval_steps" ON public.approval_steps
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_pm_manage_approval_steps" ON public.approval_steps
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

-- =============================================
-- CALENDAR EVENTS + RECURSOS
-- =============================================

CREATE POLICY "staff_view_events" ON public.calendar_events
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_events" ON public.calendar_events
  FOR ALL USING (public.is_internal_staff());

CREATE POLICY "staff_view_attendees" ON public.event_attendees
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_attendees" ON public.event_attendees
  FOR ALL USING (public.is_internal_staff());

CREATE POLICY "staff_view_resources" ON public.resources
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "admin_manage_resources" ON public.resources
  FOR ALL USING (public.is_admin());

CREATE POLICY "staff_view_event_resources" ON public.event_resources
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "staff_manage_event_resources" ON public.event_resources
  FOR ALL USING (public.is_internal_staff());

-- =============================================
-- CLIENT PORTAL TOKENS
-- =============================================

CREATE POLICY "admin_pm_manage_tokens" ON public.client_portal_tokens
  FOR ALL USING (
    public.get_current_user_role() IN ('admin', 'project_manager')
  );

CREATE POLICY "staff_view_tokens" ON public.client_portal_tokens
  FOR SELECT USING (public.is_internal_staff());

-- =============================================
-- ALBUMS + MEDIA
-- =============================================

CREATE POLICY "staff_manage_albums" ON public.albums
  FOR ALL USING (public.is_internal_staff());

CREATE POLICY "staff_manage_media" ON public.media_items
  FOR ALL USING (public.is_internal_staff());
