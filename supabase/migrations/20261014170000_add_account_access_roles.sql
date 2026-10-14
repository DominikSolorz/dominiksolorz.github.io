-- HOME SECURITY: role-based access for authenticated accounts.
-- Applied to Supabase project ksacbcrzuwdahnmggfxg on 2026-10-14.

create table if not exists public.user_access_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'administrator', 'operator', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_access_roles is 'Poziomy dostępu kont HOME SECURITY. Modyfikacja poziomu odbywa się wyłącznie przez funkcje właściciela.';
comment on column public.user_access_roles.role is 'owner: pełna administracja; administrator: zarządzanie konfiguracją; operator: obsługa kamer; viewer: bezpieczny podgląd.';

alter table public.user_access_roles enable row level security;
revoke all on table public.user_access_roles from anon;
revoke all on table public.user_access_roles from authenticated;
grant select on table public.user_access_roles to authenticated;
grant all on table public.user_access_roles to service_role;

create policy "users read own access role"
on public.user_access_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.create_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
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

  insert into public.user_access_roles(user_id, role) values (new.id, 'viewer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.create_user_profile() from public, anon, authenticated;

create or replace function public.claim_initial_owner()
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  existing_owner uuid;
begin
  if caller_id is null then raise exception 'Wymagane jest zalogowane konto.'; end if;
  select lower(email) into caller_email from auth.users where id = caller_id;
  if caller_email is distinct from 'goldservicepoland@gmail.com' then
    raise exception 'To konto nie jest uprawnione do pierwszego właściciela.';
  end if;
  perform pg_advisory_xact_lock(hashtext('home-security-initial-owner'));
  select user_id into existing_owner from public.user_access_roles where role = 'owner' limit 1;
  if existing_owner is not null and existing_owner <> caller_id then
    raise exception 'Właściciel został już ustawiony.';
  end if;
  insert into public.user_access_roles(user_id, role, updated_at) values (caller_id, 'owner', now())
  on conflict (user_id) do update set role = 'owner', updated_at = excluded.updated_at;
  return 'owner';
end;
$$;

create or replace function public.set_user_access_role(target_user_id uuid, new_role text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller_id uuid := auth.uid();
  caller_role text;
  owner_count integer;
begin
  if caller_id is null then raise exception 'Wymagane jest zalogowane konto.'; end if;
  select role into caller_role from public.user_access_roles where user_id = caller_id;
  if caller_role <> 'owner' then raise exception 'Tylko właściciel może zmieniać poziomy dostępu.'; end if;
  if new_role not in ('owner', 'administrator', 'operator', 'viewer') then raise exception 'Nieprawidłowy poziom dostępu.'; end if;
  if not exists (select 1 from auth.users where id = target_user_id) then raise exception 'Nie znaleziono konta.'; end if;
  select count(*) into owner_count from public.user_access_roles where role = 'owner';
  if target_user_id = caller_id and new_role <> 'owner' and owner_count <= 1 then raise exception 'Nie można usunąć ostatniego właściciela.'; end if;
  insert into public.user_access_roles(user_id, role, updated_at) values (target_user_id, new_role, now())
  on conflict (user_id) do update set role = excluded.role, updated_at = excluded.updated_at;
  return new_role;
end;
$$;

revoke all on function public.claim_initial_owner() from public, anon;
revoke all on function public.set_user_access_role(uuid, text) from public, anon;
grant execute on function public.claim_initial_owner() to authenticated;
grant execute on function public.set_user_access_role(uuid, text) to authenticated;
