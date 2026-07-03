
ALTER TABLE public.payment_requests ADD COLUMN IF NOT EXISTS tip numeric NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.cash_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Zurich')::date,
  counted_amount numeric NOT NULL DEFAULT 0,
  expected_amount numeric NOT NULL DEFAULT 0,
  note text,
  counted_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_counts TO authenticated;
GRANT ALL ON public.cash_counts TO service_role;
ALTER TABLE public.cash_counts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_all ON public.cash_counts;
CREATE POLICY cc_all ON public.cash_counts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS cash_counts_date_idx ON public.cash_counts(count_date DESC);
