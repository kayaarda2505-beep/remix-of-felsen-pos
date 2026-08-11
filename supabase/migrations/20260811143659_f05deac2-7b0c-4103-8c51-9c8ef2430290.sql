ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric,
  ADD COLUMN IF NOT EXISTS geocoded_at timestamptz;

CREATE TABLE IF NOT EXISTS public.courier_locations (
  member_id uuid PRIMARY KEY REFERENCES public.team_members(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  accuracy numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.courier_locations TO authenticated;
GRANT SELECT ON public.courier_locations TO anon;
GRANT ALL ON public.courier_locations TO service_role;

ALTER TABLE public.courier_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff can read courier locations"
  ON public.courier_locations FOR SELECT
  USING (true);

CREATE POLICY "staff can write courier locations"
  ON public.courier_locations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "staff can update courier locations"
  ON public.courier_locations FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE TRIGGER courier_locations_touch_updated_at
  BEFORE UPDATE ON public.courier_locations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.courier_locations;