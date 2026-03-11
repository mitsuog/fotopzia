-- Admin control-plane configuration tables
CREATE TABLE IF NOT EXISTS public.roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key          TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  is_system    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  key          TEXT PRIMARY KEY,
  module       TEXT NOT NULL,
  action       TEXT NOT NULL,
  label        TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id         UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_key  TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  allowed         BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.catalog_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_key  TEXT NOT NULL,
  item_key     TEXT NOT NULL,
  label        TEXT NOT NULL,
  value        JSONB NOT NULL DEFAULT '{}'::JSONB,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (catalog_key, item_key)
);

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_key TEXT NOT NULL,
  module       TEXT NOT NULL,
  name         TEXT NOT NULL,
  definition   JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.branding_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_key   TEXT NOT NULL UNIQUE DEFAULT 'default',
  data         JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS roles_updated_at ON public.roles;
CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS catalog_items_updated_at ON public.catalog_items;
CREATE TRIGGER catalog_items_updated_at
  BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workflow_templates_updated_at ON public.workflow_templates;
CREATE TRIGGER workflow_templates_updated_at
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS branding_settings_updated_at ON public.branding_settings;
CREATE TRIGGER branding_settings_updated_at
  BEFORE UPDATE ON public.branding_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.roles (key, name, description, is_system)
VALUES
  ('admin', 'Admin', 'Acceso total al sistema', TRUE),
  ('project_manager', 'Project Manager', 'Gestion operativa y comercial', TRUE),
  ('operator', 'Operator', 'Operacion diaria', TRUE),
  ('client', 'Client', 'Acceso portal cliente', TRUE)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.permissions (key, module, action, label, description)
VALUES
  ('manage_users', 'settings', 'manage', 'Gestionar usuarios', 'Alta, baja y edicion de usuarios'),
  ('manage_settings', 'settings', 'manage', 'Gestionar configuracion', 'Modificar catalogos y plantillas'),
  ('manage_crm', 'crm', 'manage', 'Gestionar CRM', 'Crear y editar contactos/deals/actividades'),
  ('view_crm', 'crm', 'view', 'Ver CRM', 'Consulta de CRM'),
  ('manage_quotes', 'quotes', 'manage', 'Gestionar cotizaciones', 'Crear y editar cotizaciones'),
  ('view_quotes', 'quotes', 'view', 'Ver cotizaciones', 'Consulta de cotizaciones'),
  ('manage_contracts', 'contracts', 'manage', 'Gestionar contratos', 'Crear y editar contratos'),
  ('view_contracts', 'contracts', 'view', 'Ver contratos', 'Consulta de contratos'),
  ('manage_approvals', 'approvals', 'manage', 'Gestionar aprobaciones', 'Crear y operar flujos'),
  ('view_approvals', 'approvals', 'view', 'Ver aprobaciones', 'Consulta de aprobaciones'),
  ('manage_calendar', 'calendar', 'manage', 'Gestionar calendario', 'Crear y editar eventos'),
  ('view_calendar', 'calendar', 'view', 'Ver calendario', 'Consulta de calendario'),
  ('manage_portfolios', 'portfolios', 'manage', 'Gestionar portafolios', 'Gestion de albumes y media'),
  ('view_portfolios', 'portfolios', 'view', 'Ver portafolios', 'Consulta de portafolios'),
  ('upload_media', 'portfolios', 'upload', 'Subir media', 'Carga de foto y video'),
  ('view_portal', 'portal', 'view', 'Ver portal cliente', 'Acceso al portal de cliente')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.branding_settings (tenant_key, data)
VALUES (
  'default',
  jsonb_build_object(
    'font', 'Montserrat',
    'palette', jsonb_build_object(
      'brand_navy', '#1C2B4A',
      'brand_navy_light', '#2E3F5E',
      'brand_gold', '#C49A2A',
      'brand_gold_light', '#DDB84A',
      'brand_canvas', '#F0EEE8',
      'brand_paper', '#FAFAF7',
      'brand_stone', '#E8E5DC'
    )
  )
)
ON CONFLICT (tenant_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_roles_key ON public.roles(key);
CREATE INDEX IF NOT EXISTS idx_catalog_items_catalog ON public.catalog_items(catalog_key, sort_order);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_module ON public.workflow_templates(module, workflow_key);
