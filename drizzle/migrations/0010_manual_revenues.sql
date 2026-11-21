CREATE TABLE public.manual_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revenue_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  source text NOT NULL CHECK (source IN ('website', 'phone_courier', 'restaurant', 'just_eat', 'uber_eats', 'takeaway')),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_revenues TO authenticated;
GRANT ALL ON public.manual_revenues TO service_role;
ALTER TABLE public.manual_revenues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Managers manage manual revenues" ON public.manual_revenues FOR ALL TO authenticated USING (public.is_admin_or_manager(auth.uid())) WITH CHECK (public.is_admin_or_manager(auth.uid()));
CREATE INDEX manual_revenues_date_idx ON public.manual_revenues (revenue_date);