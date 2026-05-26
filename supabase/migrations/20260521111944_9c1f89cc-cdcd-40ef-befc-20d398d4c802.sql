
DO $$ BEGIN
  CREATE TYPE table_area AS ENUM ('indoor','outdoor','bar');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.dining_tables
  ADD COLUMN IF NOT EXISTS area table_area NOT NULL DEFAULT 'indoor';
