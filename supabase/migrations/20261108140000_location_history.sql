-- HOME SECURITY: opt-in private location history shared between the owner's own devices.
-- Supabase Auth + strict owner RLS. Rows are append-only (no update), visible only to their owner,
-- written only after the user explicitly enables route recording on a device.
create table if not exists public.hs_location_points (
 id bigint generated always as identity primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 device_id uuid not null,
 device_label text not null default 'Urządzenie' check (length(device_label) between 1 and 60),
 lat double precision not null check (lat between -90 and 90),
 lon double precision not null check (lon between -180 and 180),
 accuracy real check (accuracy is null or (accuracy>=0 and accuracy<=100000)),
 recorded_at timestamptz not null default now()
  check (recorded_at<=now()+interval '5 minutes' and recorded_at>=now()-interval '1 day'),
 created_at timestamptz not null default now()
);
create index if not exists hs_location_points_owner_time on public.hs_location_points(owner_id,recorded_at desc);
create index if not exists hs_location_points_owner_device on public.hs_location_points(owner_id,device_id,recorded_at desc);
alter table public.hs_location_points enable row level security;
revoke all on public.hs_location_points from anon;
revoke all on public.hs_location_points from authenticated;
grant select,insert,delete on public.hs_location_points to authenticated;
create policy hs_location_points_owner_read on public.hs_location_points
 for select to authenticated using (owner_id=(select auth.uid()));
create policy hs_location_points_owner_insert on public.hs_location_points
 for insert to authenticated with check (owner_id=(select auth.uid()));
create policy hs_location_points_owner_delete on public.hs_location_points
 for delete to authenticated using (owner_id=(select auth.uid()));
-- Retention: the owner's client calls this when recording starts; rows older than 30 days are removed.
create or replace function public.hs_prune_location_points()
returns void language sql security invoker set search_path=public
as $$ delete from public.hs_location_points where owner_id=(select auth.uid()) and recorded_at<now()-interval '30 days' $$;
revoke all on function public.hs_prune_location_points() from public,anon;
grant execute on function public.hs_prune_location_points() to authenticated;
comment on table public.hs_location_points is 'Opt-in route history of the account owner. Visible only to the owner, kept 30 days, deletable by the owner at any time.';
