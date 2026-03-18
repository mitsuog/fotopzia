-- ============================================================
-- 0028_finances.sql — Finance module
-- ============================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('anticipo', 'abono', 'pago_final');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_method AS ENUM ('efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE expense_visibility AS ENUM ('all_internal', 'admin_only');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Helper function
CREATE OR REPLACE FUNCTION public.is_admin_or_pm()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
      AND is_active = true
  );
$$;

-- ============================================================
-- expense_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  is_fixed        BOOLEAN NOT NULL DEFAULT false,
  visibility      expense_visibility NOT NULL DEFAULT 'admin_only',
  is_system       BOOLEAN NOT NULL DEFAULT false,
  icon            TEXT,
  color           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'MXN',
  description     TEXT NOT NULL,
  date            DATE NOT NULL,
  reference       TEXT,
  receipt_url     TEXT,
  notes           TEXT,
  project_id      UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  period          TEXT, -- 'YYYY-MM'
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- project_payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.project_payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_id        UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  type            payment_type NOT NULL,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'MXN',
  method          payment_method NOT NULL DEFAULT 'transferencia',
  reference       TEXT,
  paid_at         DATE NOT NULL,
  notes           TEXT,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- payroll_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payroll_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_name   TEXT NOT NULL,
  employee_role   TEXT,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  base_salary     NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonuses         NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions      NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_total       NUMERIC(12,2) GENERATED ALWAYS AS (base_salary + bonuses - deductions) STORED,
  notes           TEXT,
  paid_at         DATE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER expenses_updated_at
    BEFORE UPDATE ON public.expenses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER project_payments_updated_at
    BEFORE UPDATE ON public.project_payments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TRIGGER payroll_entries_updated_at
    BEFORE UPDATE ON public.payroll_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_entries ENABLE ROW LEVEL SECURITY;

-- expense_categories: admin/pm can manage; internal staff can see all_internal
CREATE POLICY "expense_categories_select" ON public.expense_categories
  FOR SELECT
  USING (
    public.is_admin_or_pm()
    OR (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
      AND visibility = 'all_internal'
    )
  );

CREATE POLICY "expense_categories_insert" ON public.expense_categories
  FOR INSERT WITH CHECK (public.is_admin_or_pm());

CREATE POLICY "expense_categories_update" ON public.expense_categories
  FOR UPDATE USING (public.is_admin_or_pm());

CREATE POLICY "expense_categories_delete" ON public.expense_categories
  FOR DELETE USING (public.is_admin_or_pm() AND is_system = false);

-- expenses: admin/pm manage; visibility filter via category
CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT
  USING (
    public.is_admin_or_pm()
    OR (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active = true)
      AND EXISTS (
        SELECT 1 FROM public.expense_categories ec
        WHERE ec.id = category_id AND ec.visibility = 'all_internal'
      )
    )
  );

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (public.is_admin_or_pm());

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (public.is_admin_or_pm());

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (public.is_admin_or_pm());

-- project_payments: admin/pm full access
CREATE POLICY "project_payments_select" ON public.project_payments
  FOR SELECT USING (public.is_admin_or_pm());

CREATE POLICY "project_payments_insert" ON public.project_payments
  FOR INSERT WITH CHECK (public.is_admin_or_pm());

CREATE POLICY "project_payments_update" ON public.project_payments
  FOR UPDATE USING (public.is_admin_or_pm());

CREATE POLICY "project_payments_delete" ON public.project_payments
  FOR DELETE USING (public.is_admin_or_pm());

-- payroll_entries: admin only
CREATE POLICY "payroll_entries_select" ON public.payroll_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "payroll_entries_insert" ON public.payroll_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "payroll_entries_update" ON public.payroll_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

CREATE POLICY "payroll_entries_delete" ON public.payroll_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND is_active = true
    )
  );

-- ============================================================
-- Seed: system expense categories
-- ============================================================
INSERT INTO public.expense_categories (name, is_fixed, visibility, is_system, sort_order) VALUES
  ('Renta',                    true,  'all_internal', true,  1),
  ('Luz / Electricidad',       true,  'all_internal', true,  2),
  ('Telefonía / Internet',     true,  'admin_only',   true,  3),
  ('Limpieza',                 false, 'admin_only',   true,  4),
  ('Gasolina',                 false, 'admin_only',   true,  5),
  ('Pasivos y Créditos',       true,  'admin_only',   true,  6),
  ('Contabilidad',             true,  'admin_only',   true,  7),
  ('Suscripciones Web',        true,  'admin_only',   true,  8),
  ('Plataformas Multimedia',   true,  'admin_only',   true,  9),
  ('Plataformas de Música',    true,  'admin_only',   true, 10),
  ('Insumos de Oficina',       false, 'admin_only',   true, 11),
  ('Marketing',                false, 'admin_only',   true, 12),
  ('Depreciación de Equipos',  false, 'admin_only',   true, 13),
  ('Nóminas',                  true,  'admin_only',   true, 14)
ON CONFLICT DO NOTHING;
