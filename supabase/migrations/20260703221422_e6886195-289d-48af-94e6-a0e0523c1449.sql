CREATE OR REPLACE FUNCTION public.prevent_paid_order_without_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'paid'::public.order_status AND OLD.status IS DISTINCT FROM 'paid'::public.order_status THEN
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