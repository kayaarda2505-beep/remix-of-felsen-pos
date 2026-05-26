CREATE TABLE public.song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  table_name text,
  artist text,
  title text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_song_requests_status_created ON public.song_requests(status, created_at DESC);

ALTER TABLE public.song_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read song requests"
  ON public.song_requests FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Staff manage song requests"
  ON public.song_requests FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.song_requests;