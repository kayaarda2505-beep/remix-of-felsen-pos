CREATE TABLE public.ingredient_suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ingredient_id uuid NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  contact text,
  price numeric NOT NULL DEFAULT 0,
  is_preferred boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingredient_suppliers_ingredient ON public.ingredient_suppliers(ingredient_id);

ALTER TABLE public.ingredient_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read ingredient_suppliers"
  ON public.ingredient_suppliers FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins manage ingredient_suppliers"
  ON public.ingredient_suppliers FOR ALL
  TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Migrate existing single-supplier data into new table
INSERT INTO public.ingredient_suppliers (ingredient_id, name, address, contact, price, is_preferred)
SELECT id, supplier_name, supplier_address, supplier_contact, cost_per_unit, true
FROM public.ingredients
WHERE supplier_name IS NOT NULL AND length(trim(supplier_name)) > 0;