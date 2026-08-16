CREATE TABLE public.review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  phone text,
  customer_name text,
  token text NOT NULL UNIQUE,
  send_after timestamptz NOT NULL DEFAULT now() + interval '30 minutes',
  sent_at timestamptz,
  send_error text,
  rating integer,
  comment text,
  newsletter_opt_in boolean,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_requests TO authenticated;
GRANT ALL ON public.review_requests TO service_role;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view review requests" ON public.review_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage review requests" ON public.review_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS newsletter_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS newsletter_opt_in_at timestamptz;

CREATE TABLE public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  recipient_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view campaigns" ON public.marketing_campaigns FOR SELECT TO authenticated USING (true);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'dispatch-review-sms',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://felsens-pos-glow.lovable.app/api/public/reviews/dispatch',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndxdG90dWVjaXBvbGxjaGJ4a2JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3OTcxOTgsImV4cCI6MjA5NTM3MzE5OH0.HQ2oYyA9JcWcE5cyMgKr3U_qP6EjCkjFwgshaV7AHTw"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);