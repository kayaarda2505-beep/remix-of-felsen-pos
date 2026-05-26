
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS email TEXT;

CREATE TABLE IF NOT EXISTS public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.team_members(id) ON DELETE CASCADE NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  position TEXT NOT NULL DEFAULT 'Service',
  notes TEXT,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shifts_date_idx ON public.shifts(shift_date);
CREATE INDEX IF NOT EXISTS shifts_member_idx ON public.shifts(member_id);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read shifts" ON public.shifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers manage shifts" ON public.shifts
  FOR ALL TO authenticated
  USING (public.is_admin_or_manager(auth.uid()))
  WITH CHECK (public.is_admin_or_manager(auth.uid()));
