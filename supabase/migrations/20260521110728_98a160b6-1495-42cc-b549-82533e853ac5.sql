
CREATE OR REPLACE FUNCTION public.create_team_member(
  _name TEXT,
  _role team_role,
  _pin TEXT,
  _color TEXT DEFAULT 'oklch(0.7 0.17 250)'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
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
  INSERT INTO public.team_members (name, role, pin_hash, color)
  VALUES (trim(_name), _role, crypt(_pin, gen_salt('bf', 8)), _color)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_team_member(TEXT, team_role, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_member(TEXT, team_role, TEXT, TEXT) TO authenticated;
