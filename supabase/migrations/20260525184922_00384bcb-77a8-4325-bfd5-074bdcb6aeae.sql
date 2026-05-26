ALTER TABLE public.ingredients
  ADD COLUMN IF NOT EXISTS sale_price numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_address text,
  ADD COLUMN IF NOT EXISTS supplier_contact text;