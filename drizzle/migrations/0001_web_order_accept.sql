ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS web_accepted_at timestamptz;
UPDATE public.orders SET web_accepted_at = now() WHERE opened_by_name = 'Website' AND web_accepted_at IS NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='orders') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;