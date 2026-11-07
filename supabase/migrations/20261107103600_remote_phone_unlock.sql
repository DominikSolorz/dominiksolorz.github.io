-- HOME SECURITY: additive encrypted remote phone-to-Windows PIN unlock transport.
-- Supabase Auth + strict owner RLS. No PIN, bearer token, plaintext access key or recordings.
create table if not exists public.hs_remote_hosts (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 label text not null default 'Komputer HOME SECURITY' check (length(label) between 1 and 80),
 public_key jsonb not null check (jsonb_typeof(public_key)='object' and octet_length(public_key::text)<2048),
 last_seen_at timestamptz not null default now(),
 created_at timestamptz not null default now()
);
create table if not exists public.hs_remote_requests (
 id uuid primary key,
 owner_id uuid not null references auth.users(id) on delete cascade,
 host_id uuid not null references public.hs_remote_hosts(id) on delete cascade,
 phone_id uuid not null,
 kind text not null check (kind in ('pair','unlock')),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<4096),
 state text not null default 'pending' check (state in ('pending','paired','approved','denied','failed')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '90 seconds'),
 processed_at timestamptz,
 constraint remote_request_short_lived check (expires_at>created_at and expires_at<=created_at+interval '120 seconds')
);
create index if not exists hs_remote_hosts_owner_seen on public.hs_remote_hosts(owner_id,last_seen_at desc);
create index if not exists hs_remote_requests_waiting on public.hs_remote_requests(host_id,state,created_at desc);
create index if not exists hs_remote_requests_owner on public.hs_remote_requests(owner_id,created_at desc);
alter table public.hs_remote_hosts enable row level security;
alter table public.hs_remote_requests enable row level security;
revoke all on public.hs_remote_hosts from anon;
revoke all on public.hs_remote_requests from anon;
grant select,insert,update,delete on public.hs_remote_hosts to authenticated;
grant select,insert,update,delete on public.hs_remote_requests to authenticated;
create policy hs_remote_hosts_owner_read on public.hs_remote_hosts
 for select to authenticated using (owner_id=(select auth.uid()));
create policy hs_remote_hosts_owner_insert on public.hs_remote_hosts
 for insert to authenticated with check (owner_id=(select auth.uid()));
create policy hs_remote_hosts_owner_update on public.hs_remote_hosts
 for update to authenticated using (owner_id=(select auth.uid()))
 with check (owner_id=(select auth.uid()));
create policy hs_remote_hosts_owner_delete on public.hs_remote_hosts
 for delete to authenticated using (owner_id=(select auth.uid()));
create policy hs_remote_requests_owner_read on public.hs_remote_requests
 for select to authenticated using (owner_id=(select auth.uid()));
create policy hs_remote_requests_owner_insert on public.hs_remote_requests
 for insert to authenticated with check (
  owner_id=(select auth.uid())
  and exists(select 1 from public.hs_remote_hosts h where h.id=host_id and h.owner_id=(select auth.uid()))
 );
create policy hs_remote_requests_owner_update on public.hs_remote_requests
 for update to authenticated using (owner_id=(select auth.uid()))
 with check (owner_id=(select auth.uid()));
create policy hs_remote_requests_owner_delete on public.hs_remote_requests
 for delete to authenticated using (owner_id=(select auth.uid()));
comment on table public.hs_remote_requests is 'Short-lived, E2E-encrypted and signed phone-to-host messages. Never store PIN or plaintext key.';
