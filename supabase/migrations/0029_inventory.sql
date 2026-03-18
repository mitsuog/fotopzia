-- ============================================================
-- 0029_inventory.sql — Equipment inventory module
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE equipment_condition AS ENUM ('excelente', 'bueno', 'regular', 'malo', 'fuera_de_servicio');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE equipment_status AS ENUM ('disponible', 'en_uso', 'mantenimiento', 'retirado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE equipment_location AS ENUM ('estudio', 'almacen', 'en_campo', 'prestado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE depreciation_method AS ENUM ('linea_recta', 'ninguno');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE maintenance_type AS ENUM ('preventivo', 'correctivo', 'calibracion', 'limpieza');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Sequence for asset tags
CREATE SEQUENCE IF NOT EXISTS public.equipment_asset_seq START 1;

-- ============================================================
-- equipment_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipment_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  color       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- equipment_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipment_items (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id              UUID REFERENCES public.equipment_categories(id) ON DELETE SET NULL,
  asset_tag                TEXT UNIQUE NOT NULL DEFAULT ('FOT-INV-' || LPAD(nextval('public.equipment_asset_seq')::TEXT, 3, '0')),
  name                     TEXT NOT NULL,
  brand                    TEXT,
  model                    TEXT,
  serial_number            TEXT,
  condition                equipment_condition NOT NULL DEFAULT 'bueno',
  status                   equipment_status NOT NULL DEFAULT 'disponible',
  purchase_date            DATE,
  purchase_cost            NUMERIC(12,2),
  currency                 TEXT NOT NULL DEFAULT 'MXN',
  depreciation_method      depreciation_method NOT NULL DEFAULT 'ninguno',
  useful_life_years        INT,
  salvage_value            NUMERIC(12,2),
  warranty_expires_at      DATE,
  insurance_policy_number  TEXT,
  insurance_expires_at     DATE,
  insurance_provider       TEXT,
  location                 equipment_location NOT NULL DEFAULT 'estudio',
  notes                    TEXT,
  photo_url                TEXT,
  created_by               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- equipment_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipment_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id        UUID NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  calendar_event_id   UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  assigned_to         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_return_at  TIMESTAMPTZ,
  returned_at         TIMESTAMPTZ,
  condition_out       equipment_condition,
  condition_in        equipment_condition,
  notes               TEXT,
  created_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- equipment_maintenance
-- ============================================================
CREATE TABLE IF NOT EXISTS public.equipment_maintenance (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  UUID NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  type          maintenance_type NOT NULL,
  description   TEXT NOT NULL,
  performed_by  TEXT,
  cost          NUMERIC(12,2),
  performed_at  DATE NOT NULL,
  next_due_at   DATE,
  vendor        TEXT,
  notes         TEXT,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at trigger for equipment_items
DO $$ BEGIN
  CREATE TRIGGER equipment_items_updated_at
    BEFORE UPDATE ON public.equipment_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- Compute book value function
-- ============================================================
CREATE OR REPLACE FUNCTION public.compute_book_value(
  p_purchase_cost     NUMERIC,
  p_salvage_value     NUMERIC,
  p_useful_life_years INT,
  p_purchase_date     DATE,
  p_method            depreciation_method
) RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  years_elapsed NUMERIC;
  book_value    NUMERIC;
BEGIN
  IF p_method = 'ninguno' OR p_purchase_cost IS NULL THEN
    RETURN p_purchase_cost;
  END IF;

  -- linea_recta
  IF p_purchase_date IS NULL OR p_useful_life_years IS NULL OR p_useful_life_years <= 0 THEN
    RETURN p_purchase_cost;
  END IF;

  years_elapsed := EXTRACT(EPOCH FROM (CURRENT_DATE - p_purchase_date)) / (365.25 * 86400);
  book_value := p_purchase_cost - ((p_purchase_cost - COALESCE(p_salvage_value, 0)) / p_useful_life_years) * years_elapsed;

  RETURN GREATEST(COALESCE(p_salvage_value, 0), book_value);
END;
$$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_maintenance ENABLE ROW LEVEL SECURITY;

-- equipment_categories: internal staff read; admin/pm manage
CREATE POLICY "equipment_categories_select" ON public.equipment_categories
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "equipment_categories_insert" ON public.equipment_categories
  FOR INSERT WITH CHECK (public.is_admin_or_pm());

CREATE POLICY "equipment_categories_update" ON public.equipment_categories
  FOR UPDATE USING (public.is_admin_or_pm());

CREATE POLICY "equipment_categories_delete" ON public.equipment_categories
  FOR DELETE USING (public.is_admin_or_pm());

-- equipment_items: internal staff read; admin/pm manage
CREATE POLICY "equipment_items_select" ON public.equipment_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "equipment_items_insert" ON public.equipment_items
  FOR INSERT WITH CHECK (public.is_admin_or_pm());

CREATE POLICY "equipment_items_update" ON public.equipment_items
  FOR UPDATE USING (public.is_admin_or_pm());

CREATE POLICY "equipment_items_delete" ON public.equipment_items
  FOR DELETE USING (public.is_admin_or_pm());

-- equipment_assignments
CREATE POLICY "equipment_assignments_select" ON public.equipment_assignments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "equipment_assignments_insert" ON public.equipment_assignments
  FOR INSERT WITH CHECK (public.is_admin_or_pm());

CREATE POLICY "equipment_assignments_update" ON public.equipment_assignments
  FOR UPDATE USING (public.is_admin_or_pm());

CREATE POLICY "equipment_assignments_delete" ON public.equipment_assignments
  FOR DELETE USING (public.is_admin_or_pm());

-- equipment_maintenance
CREATE POLICY "equipment_maintenance_select" ON public.equipment_maintenance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
  );

CREATE POLICY "equipment_maintenance_insert" ON public.equipment_maintenance
  FOR INSERT WITH CHECK (public.is_admin_or_pm());

CREATE POLICY "equipment_maintenance_update" ON public.equipment_maintenance
  FOR UPDATE USING (public.is_admin_or_pm());

CREATE POLICY "equipment_maintenance_delete" ON public.equipment_maintenance
  FOR DELETE USING (public.is_admin_or_pm());

-- ============================================================
-- Seed: equipment categories
-- ============================================================
INSERT INTO public.equipment_categories (name, sort_order) VALUES
  ('Cámaras',              1),
  ('Lentes',               2),
  ('Iluminación',          3),
  ('Audio',                4),
  ('Grip / Soportes',      5),
  ('Computadoras',         6),
  ('Almacenamiento',       7),
  ('Licencias Software',   8),
  ('Accesorios',           9)
ON CONFLICT DO NOTHING;
