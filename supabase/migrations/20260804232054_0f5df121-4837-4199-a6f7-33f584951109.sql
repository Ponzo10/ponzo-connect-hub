REVOKE EXECUTE ON FUNCTION public.claim_ownership() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, app_role, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_share(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.increment_view(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.claim_ownership() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, app_role, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;