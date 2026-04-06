-- 0031_inventory_hardening.sql
-- Robust inventory lifecycle: decommissioning, activity log, and assignment safeguards.

ALTER TABLE public.equipment_items
  ADD COLUMN IF NOT EXISTS is_decommissioned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decommissioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decommissioned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decommission_reason TEXT;

CREATE TABLE IF NOT EXISTS public.equipment_activity_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment_items(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_activity_equipment
  ON public.equipment_activity_log(equipment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_activity_created_at
  ON public.equipment_activity_log(created_at DESC);

-- Close duplicate open assignments before creating uniqueness guard.
WITH open_ranked AS (
  SELECT id,
         equipment_id,
         row_number() OVER (PARTITION BY equipment_id ORDER BY assigned_at DESC, created_at DESC) AS rn
  FROM public.equipment_assignments
  WHERE returned_at IS NULL
)
UPDATE public.equipment_assignments ea
SET returned_at = now(),
    notes = CONCAT(COALESCE(ea.notes, ''), CASE WHEN COALESCE(ea.notes, '') = '' THEN '' ELSE ' | ' END, 'Cierre automatico por normalizacion de asignaciones abiertas')
FROM open_ranked r
WHERE ea.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_assignments_single_open
  ON public.equipment_assignments (equipment_id)
  WHERE returned_at IS NULL;

ALTER TABLE public.equipment_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_activity_log_select" ON public.equipment_activity_log;
DROP POLICY IF EXISTS "equipment_activity_log_insert" ON public.equipment_activity_log;

CREATE POLICY "equipment_activity_log_select" ON public.equipment_activity_log
  FOR SELECT USING (public.is_internal_staff());

CREATE POLICY "equipment_activity_log_insert" ON public.equipment_activity_log
  FOR INSERT WITH CHECK (public.is_internal_staff());

-- Keep calendar bridge compatible with decommissioned inventory and traceability.
CREATE OR REPLACE FUNCTION public.handle_event_resource_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
  v_event   public.calendar_events%ROWTYPE;
  v_item    public.equipment_items%ROWTYPE;
BEGIN
  SELECT equipment_item_id INTO v_item_id FROM public.resources WHERE id = NEW.resource_id;
  IF v_item_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_event FROM public.calendar_events WHERE id = NEW.event_id;
  SELECT * INTO v_item FROM public.equipment_items WHERE id = v_item_id;

  IF v_item.id IS NULL THEN RETURN NEW; END IF;

  IF COALESCE(v_item.is_decommissioned, false) = true OR v_item.status = 'retirado' THEN
    RAISE EXCEPTION 'El equipo % esta retirado o dado de baja y no puede asignarse.', v_item.asset_tag;
  END IF;

  INSERT INTO public.equipment_assignments
    (equipment_id, calendar_event_id, assigned_to, assigned_at, expected_return_at, created_by)
  VALUES
    (v_item_id, NEW.event_id, v_event.created_by, v_event.start_at, v_event.end_at, v_event.created_by)
  ON CONFLICT DO NOTHING;

  UPDATE public.equipment_items
  SET status = 'en_uso',
      is_decommissioned = false,
      decommissioned_at = NULL,
      decommissioned_by = NULL,
      decommission_reason = NULL
  WHERE id = v_item_id;

  INSERT INTO public.equipment_activity_log (equipment_id, event_type, actor_id, payload)
  VALUES (
    v_item_id,
    'calendar_assignment_opened',
    v_event.created_by,
    jsonb_build_object('event_id', NEW.event_id, 'resource_id', NEW.resource_id)
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_event_resource_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  SELECT equipment_item_id INTO v_item_id FROM public.resources WHERE id = OLD.resource_id;
  IF v_item_id IS NULL THEN RETURN OLD; END IF;

  UPDATE public.equipment_assignments
    SET returned_at = now()
  WHERE equipment_id = v_item_id
    AND calendar_event_id = OLD.event_id
    AND returned_at IS NULL;

  IF NOT EXISTS (
    SELECT 1 FROM public.equipment_assignments
    WHERE equipment_id = v_item_id AND returned_at IS NULL
  ) THEN
    UPDATE public.equipment_items
    SET status = CASE WHEN COALESCE(is_decommissioned, false) THEN 'retirado' ELSE 'disponible' END
    WHERE id = v_item_id;
  END IF;

  INSERT INTO public.equipment_activity_log (equipment_id, event_type, actor_id, payload)
  VALUES (
    v_item_id,
    'calendar_assignment_closed',
    NULL,
    jsonb_build_object('event_id', OLD.event_id, 'resource_id', OLD.resource_id)
  );

  RETURN OLD;
END;
$$;
