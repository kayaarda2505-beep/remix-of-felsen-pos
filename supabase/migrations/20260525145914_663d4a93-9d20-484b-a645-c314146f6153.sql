CREATE POLICY "Public read active products"
  ON public.products FOR SELECT
  TO anon
  USING (active = true);