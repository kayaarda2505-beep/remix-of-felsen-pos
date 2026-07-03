CREATE OR REPLACE FUNCTION public.prevent_paid_order_without_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'paid' AND COALESCE(OLD.status, '') IS DISTINCT FROM 'paid' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.payment_requests pr
      WHERE pr.order_id = NEW.id
        AND pr.status = 'paid'
    ) THEN
      RAISE EXCEPTION 'paid order requires a paid payment_request'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_paid_order_without_payment_trigger ON public.orders;
CREATE TRIGGER prevent_paid_order_without_payment_trigger
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.prevent_paid_order_without_payment();