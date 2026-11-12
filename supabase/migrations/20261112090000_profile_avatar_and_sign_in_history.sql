-- HOME SECURITY: zdjęcie profilu i historia logowań w „Moim profilu”.
-- Każdy użytkownik widzi i zmienia wyłącznie własne dane (RLS). Nic nie jest publiczne.

-- 1. Zdjęcie profilu: prywatny schowek „avatars”, jeden plik na konto: <user_id>/avatar (WebP albo JPEG).
alter table public.user_profiles
  add column if not exists avatar_path text
  check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/avatar$');
grant update (avatar_path) on public.user_profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 1048576, array['image/webp','image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists hs_avatars_owner_read on storage.objects;
drop policy if exists hs_avatars_owner_insert on storage.objects;
drop policy if exists hs_avatars_owner_update on storage.objects;
drop policy if exists hs_avatars_owner_delete on storage.objects;
create policy hs_avatars_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy hs_avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text and name = (select auth.uid())::text || '/avatar');
create policy hs_avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');
create policy hs_avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 2. Historia logowań: wiersz powstaje po stronie serwera przy każdym nowym zalogowaniu
--    (hasło, Google — nowa sesja w auth.sessions). Przeglądarka nie może go dopisać ani zmienić.
create table if not exists public.hs_sign_in_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  user_agent text check (user_agent is null or length(user_agent) <= 300)
);
create index if not exists hs_sign_in_events_user_time on public.hs_sign_in_events (user_id, created_at desc);
alter table public.hs_sign_in_events enable row level security;
revoke all on public.hs_sign_in_events from anon, authenticated;
grant select on public.hs_sign_in_events to authenticated;
drop policy if exists hs_sign_in_events_owner_read on public.hs_sign_in_events;
create policy hs_sign_in_events_owner_read on public.hs_sign_in_events
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.hs_record_sign_in()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.hs_sign_in_events (user_id, user_agent)
  values (new.user_id, left(to_jsonb(new) ->> 'user_agent', 300));
  -- Przechowujemy 180 dni historii.
  delete from public.hs_sign_in_events where user_id = new.user_id and created_at < now() - interval '180 days';
  return new;
exception when others then
  return new; -- zapis historii nigdy nie blokuje logowania
end $$;
revoke all on function public.hs_record_sign_in() from public, anon, authenticated;

drop trigger if exists hs_record_sign_in on auth.sessions;
create trigger hs_record_sign_in after insert on auth.sessions
  for each row execute function public.hs_record_sign_in();

comment on table public.hs_sign_in_events is 'Historia logowań konta (180 dni). Widoczna tylko dla właściciela konta; zapisywana przez bazę przy nowej sesji.';
