ALTER TABLE public.orders ALTER COLUMN order_number DROP DEFAULT;
CREATE OR REPLACE FUNCTION public.assign_daily_order_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _start timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('daily_order_number'));
  SELECT max(period_end) INTO _start FROM public.day_closings;
  IF _start IS NULL THEN
    _start := (date_trunc('day', now() AT TIME ZONE 'Europe/Zurich')) AT TIME ZONE 'Europe/Zurich';
  END IF;
  SELECT coalesce(max(order_number),0)+1 INTO NEW.order_number
    FROM public.orders WHERE created_at >= _start;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS assign_daily_order_number_trg ON public.orders;
CREATE TRIGGER assign_daily_order_number_trg BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.assign_daily_order_number();
WITH s AS (SELECT coalesce(max(period_end),(date_trunc('day', now() AT TIME ZONE 'Europe/Zurich')) AT TIME ZONE 'Europe/Zurich') st FROM public.day_closings),
n AS (SELECT o.id, row_number() OVER (ORDER BY o.created_at) rn FROM public.orders o, s WHERE o.created_at >= s.st)
UPDATE public.orders o SET order_number = n.rn FROM n WHERE o.id = n.id;