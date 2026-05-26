-- Products table (replaces hard-coded mockData)
CREATE TABLE IF NOT EXISTS public.products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  description text,
  meta text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  -- Array of groups: [{ label: string, multi: boolean, items: [{ label: string, price_delta: number }] }]
  modifier_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read products"
  ON public.products FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_products_updated ON public.products;
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_products_category_sort
  ON public.products (category, sort_order);