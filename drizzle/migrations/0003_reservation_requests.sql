CREATE TABLE public.reservation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'reservation',
  name text,
  phone text,
  email text,
  event_date text,
  event_time text,
  guests integer,
  message text,
  raw jsonb,
  external_id text,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.reservation_requests TO authenticated;
GRANT ALL ON public.reservation_requests TO service_role;
ALTER TABLE public.reservation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read reservation requests" ON public.reservation_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff update reservation requests" ON public.reservation_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservation_requests;