
CREATE TABLE public.spotify_auth (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  token_type text DEFAULT 'Bearer',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.spotify_auth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage spotify auth"
  ON public.spotify_auth FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));
