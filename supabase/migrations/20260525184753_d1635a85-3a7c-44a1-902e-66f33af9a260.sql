DROP POLICY IF EXISTS "Managers read ingredients" ON public.ingredients;

CREATE POLICY "Auth read ingredients"
ON public.ingredients
FOR SELECT
TO authenticated
USING (true);