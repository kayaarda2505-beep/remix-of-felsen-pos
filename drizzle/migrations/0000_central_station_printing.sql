ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS station_printed boolean NOT NULL DEFAULT false;
UPDATE public.order_items SET station_printed = true;
CREATE INDEX IF NOT EXISTS order_items_unprinted_idx ON public.order_items (sent_at) WHERE station_printed = false;

CREATE OR REPLACE FUNCTION public.claim_station_print(_order_id uuid)
RETURNS SETOF public.order_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.order_items SET station_printed = true
  WHERE order_id = _order_id AND station_printed = false
  RETURNING *;
$$;
REVOKE ALL ON FUNCTION public.claim_station_print(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_station_print(uuid) TO authenticated;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;