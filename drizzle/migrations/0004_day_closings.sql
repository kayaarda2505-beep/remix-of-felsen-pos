CREATE TABLE public.day_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  z_number serial NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL DEFAULT now(),
  closed_by text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.day_closings TO authenticated;
GRANT ALL ON public.day_closings TO service_role;
GRANT USAGE ON SEQUENCE public.day_closings_z_number_seq TO authenticated;
ALTER TABLE public.day_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read closings" ON public.day_closings FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff insert closings" ON public.day_closings FOR INSERT TO authenticated WITH CHECK (true);