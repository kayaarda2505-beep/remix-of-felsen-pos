CREATE TABLE public.weekly_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label text NOT NULL,
  subtitle text NOT NULL DEFAULT 'Menù della Settimana',
  footer text,
  dishes jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_menus TO authenticated;
GRANT ALL ON public.weekly_menus TO service_role;
ALTER TABLE public.weekly_menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read weekly menus" ON public.weekly_menus FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage weekly menus" ON public.weekly_menus FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));