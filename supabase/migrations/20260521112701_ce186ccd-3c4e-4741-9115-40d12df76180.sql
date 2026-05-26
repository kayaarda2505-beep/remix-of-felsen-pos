
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('open','paid','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES public.dining_tables(id) ON DELETE SET NULL,
  location_id uuid REFERENCES public.locations(id),
  status order_status NOT NULL DEFAULT 'open',
  guests integer DEFAULT 1,
  total numeric NOT NULL DEFAULT 0,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  opened_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_table_status ON public.orders(table_id, status);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  category text,
  unit_price numeric NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  modifiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read orders" ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage orders" ON public.orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Auth read order_items" ON public.order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage order_items" ON public.order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Update order total on item changes
CREATE OR REPLACE FUNCTION public.recalc_order_total()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE oid uuid;
BEGIN
  oid := COALESCE(NEW.order_id, OLD.order_id);
  UPDATE public.orders o
    SET total = COALESCE((SELECT SUM(unit_price * qty) FROM public.order_items WHERE order_id = oid), 0)
    WHERE o.id = oid;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_order_items_recalc ON public.order_items;
CREATE TRIGGER trg_order_items_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.recalc_order_total();
