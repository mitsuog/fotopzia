-- Auto-advance deal stage when a quote is already delivered to the prospect.
-- Rule: if quote linked to a deal reaches sent/viewed/approved,
-- and deal is currently in prospect, move it to proposal automatically.

CREATE OR REPLACE FUNCTION public.auto_advance_deal_to_proposal_on_quote_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IN ('sent', 'viewed', 'approved')
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.deal_id IS DISTINCT FROM NEW.deal_id
     ) THEN
    UPDATE public.deals
    SET stage = 'proposal'
    WHERE id = NEW.deal_id
      AND stage = 'prospect';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_auto_advance_deal_to_proposal ON public.quotes;
CREATE TRIGGER quotes_auto_advance_deal_to_proposal
  AFTER INSERT OR UPDATE OF status, deal_id
  ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_advance_deal_to_proposal_on_quote_status();
