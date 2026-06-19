DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'song_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.song_requests;
  END IF;
END $$;