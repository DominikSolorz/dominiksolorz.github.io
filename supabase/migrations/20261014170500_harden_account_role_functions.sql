-- Explicitly removes default anonymous execution of SECURITY DEFINER functions.
revoke execute on function public.claim_initial_owner() from anon;
revoke execute on function public.set_user_access_role(uuid, text) from anon;
revoke execute on function public.create_user_profile() from anon, authenticated;
