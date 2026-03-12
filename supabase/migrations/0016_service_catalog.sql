-- Catálogo de servicios rápidos para cotizaciones
CREATE TABLE public.service_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icon        TEXT NOT NULL DEFAULT '📷',
  label       TEXT NOT NULL,
  description TEXT NOT NULL,
  unit_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  category    TEXT,        -- 'photography','video','editing','album','digital','travel','drone','other'
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER service_catalog_updated_at
  BEFORE UPDATE ON public.service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_service_catalog_active ON public.service_catalog(is_active, sort_order);

-- RLS
ALTER TABLE public.service_catalog ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read active services
CREATE POLICY "service_catalog_select"
  ON public.service_catalog FOR SELECT
  TO authenticated
  USING (true);

-- Admin and project_manager can insert/update/delete
CREATE POLICY "service_catalog_write"
  ON public.service_catalog FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
    )
  );

-- Seed: servicios predeterminados (se ejecuta sólo si la tabla está vacía)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.service_catalog LIMIT 1) THEN
    INSERT INTO public.service_catalog (icon, label, description, unit_price, category, sort_order) VALUES
      ('📷', 'Fotografía',  'Cobertura fotográfica del evento',          15000, 'photography', 0),
      ('🎥', 'Video',       'Cobertura en video del evento',             20000, 'video',       1),
      ('✂️', 'Edición',     'Edición y retoque de fotografías',           5000, 'editing',     2),
      ('📚', 'Álbum',       'Álbum fotográfico profesional impreso',      8000, 'album',       3),
      ('💾', 'Digital',     'Galería digital + USB con fotografías',      2000, 'digital',     4),
      ('🚗', 'Viáticos',    'Gastos de viaje y traslado al evento',       1500, 'travel',      5),
      ('🚁', 'Drone',       'Toma aérea con dron (sujeto a permisos)',    5000, 'drone',       6),
      ('📸', '+Sesión',     'Sesión fotográfica adicional',               3500, 'photography', 7);
  END IF;
END $$;
