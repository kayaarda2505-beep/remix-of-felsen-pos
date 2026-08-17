ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_external_id_key ON public.orders (external_id) WHERE external_id IS NOT NULL;