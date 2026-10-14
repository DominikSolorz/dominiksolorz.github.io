-- Account roles are created by the auth.users trigger only.
-- No browser user receives a callable SECURITY DEFINER role-changing function.
create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  initial_role text := case
    when lower(new.email) = 'goldservicepoland@gmail.com' then 'owner'
    else 'viewer'
  end;
begin
  insert into public.user_profiles (user_id, display_name, first_name, last_name, address_line, postal_code, phone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'address_line', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'postal_code', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), '')
  ) on conflict (user_id) do nothing;

  insert into public.user_recording_preferences(user_id) values (new.id)
  on conflict (user_id) do nothing;

  insert into public.user_access_roles(user_id, role) values (new.id, initial_role)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke execute on function public.claim_initial_owner() from authenticated;
revoke execute on function public.set_user_access_role(uuid, text) from authenticated;
