
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_manager(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.verify_team_pin(TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_team_pin(TEXT) TO authenticated;
