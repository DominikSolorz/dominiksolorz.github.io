-- Separate support counters; never stores conversation text, addresses or API keys.
create table if not exists public.home_support_budget (
  bucket text primary key,
  used integer not null check(used >= 0),
  expires_at timestamptz not null
);
alter table public.home_support_budget enable row level security;
revoke all on public.home_support_budget from public, anon, authenticated;
grant all on public.home_support_budget to service_role;
create or replace function public.home_support_take_budget(client_bucket text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  minute_key text := 'minute:' || client_bucket || ':' || to_char(now() at time zone 'UTC','YYYYMMDDHH24MI');
  day_key text := 'day:' || client_bucket || ':' || to_char(now() at time zone 'UTC','YYYYMMDD');
  global_key text := 'global:' || to_char(now() at time zone 'UTC','YYYYMMDD');
begin
  if client_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(743218905);
  delete from public.home_support_budget where expires_at < now();
  if coalesce((select used from public.home_support_budget where bucket=minute_key),0) >= 6
    or coalesce((select used from public.home_support_budget where bucket=day_key),0) >= 40
    or coalesce((select used from public.home_support_budget where bucket=global_key),0) >= 300 then return false; end if;
  insert into public.home_support_budget(bucket,used,expires_at)
    values(minute_key,1,now()+interval '2 minutes'),(day_key,1,now()+interval '2 days'),(global_key,1,now()+interval '2 days')
    on conflict(bucket) do update set used=public.home_support_budget.used+1;
  return true;
end $$;
revoke all on function public.home_support_take_budget(text) from public,anon,authenticated;
grant execute on function public.home_support_take_budget(text) to service_role;
