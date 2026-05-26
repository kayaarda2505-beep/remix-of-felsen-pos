
-- Erweitere team_members um Lohn-/Personaldaten
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS ahv_number text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS birthdate date,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS hourly_wage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholding_tax boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS withholding_tax_rate numeric NOT NULL DEFAULT 0;

-- Erweitere create_team_member RPC um neue Felder
CREATE OR REPLACE FUNCTION public.create_team_member(
  _name text,
  _role team_role,
  _pin text,
  _color text DEFAULT 'oklch(0.7 0.17 250)'::text,
  _account_number integer DEFAULT NULL::integer,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _ahv_number text DEFAULT NULL,
  _birthdate date DEFAULT NULL,
  _iban text DEFAULT NULL,
  _hourly_wage numeric DEFAULT 0,
  _withholding_tax boolean DEFAULT false,
  _withholding_tax_rate numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  new_id UUID;
  assigned_no INTEGER;
BEGIN
  IF NOT public.is_admin_or_manager(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _pin !~ '^\d{4,6}$' THEN
    RAISE EXCEPTION 'invalid pin';
  END IF;
  IF length(trim(_name)) = 0 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;

  IF _account_number IS NULL THEN
    SELECT COALESCE(MAX(account_number), 0) + 1 INTO assigned_no FROM public.team_members;
  ELSE
    assigned_no := _account_number;
  END IF;

  INSERT INTO public.team_members (
    name, role, pin_hash, color, account_number,
    email, phone, address, ahv_number, birthdate, iban,
    hourly_wage, withholding_tax, withholding_tax_rate
  )
  VALUES (
    trim(_name), _role,
    extensions.crypt(_pin, extensions.gen_salt('bf', 8)),
    _color, assigned_no,
    _email, _phone, _address, _ahv_number, _birthdate, _iban,
    COALESCE(_hourly_wage, 0),
    COALESCE(_withholding_tax, false),
    COALESCE(_withholding_tax_rate, 0)
  )
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

-- Zeit-Erfassung
CREATE TABLE IF NOT EXISTS public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  break_minutes integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_entries_member ON public.time_entries(member_id, clock_in DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_open ON public.time_entries(member_id) WHERE clock_out IS NULL;

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read time_entries" ON public.time_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth manage time_entries" ON public.time_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lohnabrechnungen
CREATE TABLE IF NOT EXISTS public.payrolls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  hourly_wage numeric NOT NULL DEFAULT 0,
  gross numeric NOT NULL DEFAULT 0,
  ahv_iv_eo numeric NOT NULL DEFAULT 0,
  alv numeric NOT NULL DEFAULT 0,
  nbu numeric NOT NULL DEFAULT 0,
  withholding_tax numeric NOT NULL DEFAULT 0,
  total_deductions numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  rates jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_payrolls_member ON public.payrolls(member_id, period_start DESC);

ALTER TABLE public.payrolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read payrolls" ON public.payrolls
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage payrolls" ON public.payrolls
  FOR ALL TO authenticated USING (is_admin_or_manager(auth.uid())) WITH CHECK (is_admin_or_manager(auth.uid()));
