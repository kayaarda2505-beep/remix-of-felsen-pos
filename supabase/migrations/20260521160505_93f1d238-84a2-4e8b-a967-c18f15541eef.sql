
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'CHF',
  category text NOT NULL DEFAULT 'Sonstiges',
  vendor text,
  description text,
  receipt_url text,
  vat_amount numeric,
  payment_method text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_date ON public.expenses(expense_date DESC);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth read expenses" ON public.expenses
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (is_admin_or_manager(auth.uid()))
  WITH CHECK (is_admin_or_manager(auth.uid()));

-- Storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Auth read receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

CREATE POLICY "Managers upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND is_admin_or_manager(auth.uid()));

CREATE POLICY "Managers delete receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND is_admin_or_manager(auth.uid()));
