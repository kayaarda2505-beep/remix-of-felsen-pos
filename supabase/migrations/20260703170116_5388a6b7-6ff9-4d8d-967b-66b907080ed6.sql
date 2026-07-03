
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  amount numeric NOT NULL,
  kind text NOT NULL DEFAULT 'deposit',
  note text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_movements TO authenticated;
GRANT ALL ON public.cash_movements TO service_role;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cm_all ON public.cash_movements;
CREATE POLICY cm_all ON public.cash_movements FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS cash_movements_time_idx ON public.cash_movements(occurred_at DESC);
