CREATE TABLE public.incoming_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  customer_id uuid NULL,
  customer_name text NULL,
  customer_address text NULL,
  handled_at timestamptz NULL,
  handled_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.incoming_calls TO authenticated;
GRANT ALL ON public.incoming_calls TO service_role;
ALTER TABLE public.incoming_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read calls" ON public.incoming_calls FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff handle calls" ON public.incoming_calls FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX incoming_calls_created_idx ON public.incoming_calls (created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.incoming_calls;