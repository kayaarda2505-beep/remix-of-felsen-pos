ALTER TABLE public.song_requests
  ADD COLUMN IF NOT EXISTS spotify_uri text,
  ADD COLUMN IF NOT EXISTS spotify_track_id text,
  ADD COLUMN IF NOT EXISTS image_url text;