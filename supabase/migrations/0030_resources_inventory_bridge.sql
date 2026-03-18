-- 0030_resources_inventory_bridge.sql
-- Link calendar resources to inventory equipment items + auto-create assignments via triggers

-- Add foreign key from resources to equipment_items
ALTER TABLE public.resources
  ADD COLUMN equipment_item_id UUID REFERENCES public.equipment_items(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: create equipment_assignment when a resource is added to a calendar event
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_event_resource_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
  v_event   public.calendar_events%ROWTYPE;
BEGIN
  -- Only applies if the resource is linked to an equipment item
  SELECT equipment_item_id INTO v_item_id FROM public.resources WHERE id = NEW.resource_id;
  IF v_item_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO v_event FROM public.calendar_events WHERE id = NEW.event_id;

  INSERT INTO public.equipment_assignments
    (equipment_id, calendar_event_id, assigned_at, expected_return_at, created_by)
  VALUES
    (v_item_id, NEW.event_id, v_event.start_at, v_event.end_at, v_event.created_by)
  ON CONFLICT DO NOTHING;

  -- Mark equipment as in use
  UPDATE public.equipment_items SET status = 'en_uso' WHERE id = v_item_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_event_resource_insert
  AFTER INSERT ON public.event_resources
  FOR EACH ROW EXECUTE FUNCTION public.handle_event_resource_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger: close assignment and restore availability when resource is removed from event
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_event_resource_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  SELECT equipment_item_id INTO v_item_id FROM public.resources WHERE id = OLD.resource_id;
  IF v_item_id IS NULL THEN RETURN OLD; END IF;

  -- Close assignment
  UPDATE public.equipment_assignments
    SET returned_at = now()
  WHERE equipment_id = v_item_id
    AND calendar_event_id = OLD.event_id
    AND returned_at IS NULL;

  -- Restore availability only if no other open assignments exist
  IF NOT EXISTS (
    SELECT 1 FROM public.equipment_assignments
    WHERE equipment_id = v_item_id AND returned_at IS NULL
  ) THEN
    UPDATE public.equipment_items SET status = 'disponible' WHERE id = v_item_id;
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_event_resource_delete
  AFTER DELETE ON public.event_resources
  FOR EACH ROW EXECUTE FUNCTION public.handle_event_resource_delete();
