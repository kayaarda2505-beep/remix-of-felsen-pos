ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS courier_delivered_at timestamptz;

UPDATE public.orders
SET courier_delivered_at = COALESCE(closed_at, now())
WHERE order_type = 'delivery'
  AND status = 'paid'
  AND courier_started_at IS NOT NULL
  AND courier_delivered_at IS NULL;