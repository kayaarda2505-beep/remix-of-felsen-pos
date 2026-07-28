CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  last_name text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  street text NOT NULL DEFAULT '',
  house_no text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  phone2 text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT ON public.customers TO anon;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers readable" ON public.customers FOR SELECT USING (true);
CREATE POLICY "customers insert" ON public.customers FOR INSERT WITH CHECK (true);
CREATE POLICY "customers update" ON public.customers FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "customers delete admin" ON public.customers FOR DELETE TO authenticated USING (public.is_admin_or_manager(auth.uid()));

CREATE INDEX customers_phone_idx ON public.customers (phone);
CREATE INDEX customers_name_idx ON public.customers (last_name, first_name);

CREATE TRIGGER customers_touch_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_note text;

CREATE INDEX IF NOT EXISTS orders_order_type_idx ON public.orders (order_type);