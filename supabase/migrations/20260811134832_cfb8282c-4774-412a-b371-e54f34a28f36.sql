ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS no_pin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.login_without_pin(_account_number integer)
RETURNS TABLE(id uuid, name text, role team_role, color text, account_number integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT tm.id, tm.name, tm.role, tm.color, tm.account_number
  FROM public.team_members tm
  WHERE tm.active = true
    AND tm.no_pin = true
    AND tm.account_number = _account_number
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.login_without_pin(integer) TO anon, authenticated;

INSERT INTO public.team_members (name, role, pin_hash, color, account_number, no_pin, active)
VALUES
  ('Kaya', 'manager', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf', 8)), 'oklch(0.7 0.17 250)', 1, true, true),
  ('Service', 'service', extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf', 8)), 'oklch(0.75 0.15 150)', 2, true, true);