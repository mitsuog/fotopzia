-- When a deal is confirmed (stage = won), provision client-facing assets:
-- - Ensure at least one active portal token
-- - Ensure a base portfolio album exists for the contact

CREATE OR REPLACE FUNCTION public.provision_confirmed_deal_assets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.stage = 'won' AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
    -- Portal token
    IF NOT EXISTS (
      SELECT 1
      FROM public.client_portal_tokens t
      WHERE t.contact_id = NEW.contact_id
        AND t.is_active = TRUE
    ) THEN
      INSERT INTO public.client_portal_tokens (
        contact_id,
        label,
        is_active,
        created_by
      )
      VALUES (
        NEW.contact_id,
        'Portal principal',
        TRUE,
        NEW.created_by
      );
    END IF;

    -- Base album
    IF NOT EXISTS (
      SELECT 1
      FROM public.albums a
      WHERE a.contact_id = NEW.contact_id
        AND a.title = 'Portafolio inicial'
    ) THEN
      INSERT INTO public.albums (
        contact_id,
        title,
        description,
        is_published,
        sort_order,
        created_by
      )
      VALUES (
        NEW.contact_id,
        'Portafolio inicial',
        'Album base generado al confirmar el proyecto comercial.',
        FALSE,
        0,
        NEW.created_by
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_provision_assets_on_confirmed ON public.deals;
CREATE TRIGGER deals_provision_assets_on_confirmed
  AFTER INSERT OR UPDATE OF stage
  ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_confirmed_deal_assets();
