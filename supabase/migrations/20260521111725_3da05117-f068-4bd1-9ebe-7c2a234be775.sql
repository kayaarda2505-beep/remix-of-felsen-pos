
-- Add account_number to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS account_number integer UNIQUE;

-- Backfill existing rows with sequential account numbers
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM public.team_members
  WHERE account_number IS NULL
)
UPDATE public.team_members tm
SET account_number = n.rn
FROM numbered n
WHERE tm.id = n.id;

-- Update verify_team_pin to require account_number + pin
CREATE OR REPLACE FUNCTION public.verify_team_pin(_account_number integer, _pin text)
RETURNS TABLE(id uuid, name text, role team_role, color text, account_number integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
    SELECT tm.id, tm.name, tm.role, tm.color, tm.account_number
    FROM public.team_members tm
    WHERE tm.active = true
      AND tm.account_number = _account_number
      AND tm.pin_hash = extensions.crypt(_pin, tm.pin_hash)
    LIMIT 1;
END;
$function$;

-- Drop old single-arg version if exists
DROP FUNCTION IF EXISTS public.verify_team_pin(text);

-- Update create_team_member to accept optional account_number (auto-assigns if null)
CREATE OR REPLACE FUNCTION public.create_team_member(
  _name text,
  _role team_role,
  _pin text,
  _color text DEFAULT 'oklch(0.7 0.17 250)'::text,
  _account_number integer DEFAULT NULL
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

  INSERT INTO public.team_members (name, role, pin_hash, color, account_number)
  VALUES (trim(_name), _role, extensions.crypt(_pin, extensions.gen_salt('bf', 8)), _color, assigned_no)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;
