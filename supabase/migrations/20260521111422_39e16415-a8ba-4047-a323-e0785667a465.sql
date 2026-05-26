
CREATE OR REPLACE FUNCTION public.verify_team_pin(_pin text)
 RETURNS TABLE(id uuid, name text, role team_role, color text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
    SELECT tm.id, tm.name, tm.role, tm.color
    FROM public.team_members tm
    WHERE tm.active = true
      AND tm.pin_hash = extensions.crypt(_pin, tm.pin_hash)
    LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_team_member(_name text, _role team_role, _pin text, _color text DEFAULT 'oklch(0.7 0.17 250)'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  VALUES (trim(_name), _role, extensions.crypt(_pin, extensions.gen_salt('bf', 8)), _color)
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;
