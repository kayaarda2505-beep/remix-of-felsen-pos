ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS tracking_token text,
  ADD COLUMN IF NOT EXISTS tracking_sms_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_key ON public.orders (tracking_token) WHERE tracking_token IS NOT NULL;