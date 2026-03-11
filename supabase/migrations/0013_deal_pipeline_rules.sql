-- Deal pipeline business rules:
-- 1) Prevent duplicate contact in the same bucket (stage)
-- 2) Validate stage progression with quote/approval/contract checks

CREATE OR REPLACE FUNCTION public.validate_deal_pipeline_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  quote_ids UUID[];
  has_quote BOOLEAN := FALSE;
  has_approved_quote BOOLEAN := FALSE;
  has_negotiable_quote BOOLEAN := FALSE;
  has_quote_approval BOOLEAN := FALSE;
  has_signed_contract BOOLEAN := FALSE;
BEGIN
  -- Only validate when stage/contact change, or insert
  IF TG_OP = 'UPDATE'
     AND NEW.stage IS NOT DISTINCT FROM OLD.stage
     AND NEW.contact_id IS NOT DISTINCT FROM OLD.contact_id THEN
    RETURN NEW;
  END IF;

  -- No duplicates in same bucket for same contact
  IF EXISTS (
    SELECT 1
    FROM public.deals d
    WHERE d.contact_id = NEW.contact_id
      AND d.stage = NEW.stage
      AND d.id <> NEW.id
  ) THEN
    RAISE EXCEPTION 'No se permite duplicar el mismo cliente en el bucket "%" del pipeline.', NEW.stage
      USING ERRCODE = '23505';
  END IF;

  -- Related quotes (by deal, and fallback by contact)
  SELECT COALESCE(array_agg(q.id), ARRAY[]::UUID[]), COUNT(*) > 0
  INTO quote_ids, has_quote
  FROM public.quotes q
  WHERE q.deal_id = NEW.id
     OR q.contact_id = NEW.contact_id;

  -- Prospecto / Calificado / Propuesta / Negociacion / Confirmado require at least one quote
  IF NEW.stage IN ('prospect', 'qualified', 'proposal', 'negotiation', 'won') AND NOT has_quote THEN
    RAISE EXCEPTION 'Para mover este deal a "%" debe existir al menos una cotizacion.', NEW.stage;
  END IF;

  -- Qualified requires approved approval flow for a related quote
  IF NEW.stage = 'qualified' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.approval_flows af
      WHERE af.entity_type = 'quote'
        AND af.status = 'approved'
        AND af.entity_id = ANY (quote_ids)
    )
    INTO has_quote_approval;

    IF NOT has_quote_approval THEN
      RAISE EXCEPTION 'Para pasar a "Calificado" se requiere autorizacion del cliente sobre una cotizacion.';
    END IF;
  END IF;

  -- Negotiation requires sent/viewed/approved quote
  IF NEW.stage = 'negotiation' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = ANY (quote_ids)
        AND q.status IN ('sent', 'viewed', 'approved')
    )
    INTO has_negotiable_quote;

    IF NOT has_negotiable_quote THEN
      RAISE EXCEPTION 'Para negociar se requiere una cotizacion enviada o aprobada.';
    END IF;
  END IF;

  -- Won (UI label: Confirmado) requires approved quote + signed contract
  IF NEW.stage = 'won' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = ANY (quote_ids)
        AND q.status = 'approved'
    )
    INTO has_approved_quote;

    IF NOT has_approved_quote THEN
      RAISE EXCEPTION 'Para confirmar un deal se requiere una cotizacion aprobada.';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM public.contracts c
      WHERE c.status = 'signed'
        AND (c.quote_id = ANY (quote_ids) OR c.contact_id = NEW.contact_id)
    )
    INTO has_signed_contract;

    IF NOT has_signed_contract THEN
      RAISE EXCEPTION 'Para confirmar un deal se requiere contrato firmado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS deals_validate_pipeline_rules ON public.deals;
CREATE TRIGGER deals_validate_pipeline_rules
  BEFORE INSERT OR UPDATE OF stage, contact_id
  ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_deal_pipeline_rules();
