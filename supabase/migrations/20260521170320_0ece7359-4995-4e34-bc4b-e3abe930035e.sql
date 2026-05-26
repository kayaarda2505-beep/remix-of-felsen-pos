
CREATE TABLE public.service_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  table_name text,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_at timestamptz
);

ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY sc_select ON public.service_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY sc_update ON public.service_calls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.service_calls;
ALTER TABLE public.service_calls REPLICA IDENTITY FULL;
