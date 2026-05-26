
CREATE TABLE IF NOT EXISTS public.floor_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'bar',
  shape text NOT NULL DEFAULT 'rounded',
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 10,
  width numeric NOT NULL DEFAULT 60,
  height numeric NOT NULL DEFAULT 10,
  rotation numeric NOT NULL DEFAULT 0,
  label text,
  color text,
  z_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.floor_elements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read floor_elements"
  ON public.floor_elements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers manage floor_elements"
  ON public.floor_elements FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

INSERT INTO public.floor_elements (kind, shape, x, y, width, height, label)
SELECT 'bar', 'rounded', 50, 10, 70, 12, 'Bar'
WHERE NOT EXISTS (SELECT 1 FROM public.floor_elements WHERE kind = 'bar');
