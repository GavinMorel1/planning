-- Paradiem Planning — database schema.
-- ALREADY APPLIED to project khpddtxiyacrivlliwdw on 2026-09-14 as three migrations
-- (planning_core_tables, planning_documents_bucket, planning_harden_functions).
-- Kept here as the reference copy; re-runnable on a fresh project.

create extension if not exists pgcrypto;

create or replace function public.is_paradiem() returns boolean
language sql stable security invoker set search_path = public as $$
  select coalesce(right(lower(auth.jwt() ->> 'email'), 13) = '@paradiem.org', false);
$$;
create or replace function public.current_email() returns text
language sql stable security invoker set search_path = public as $$
  select lower(auth.jwt() ->> 'email');
$$;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  name text generated always as (data ->> 'name') stored,
  stage text generated always as (data ->> 'stage') stored,
  tier text generated always as (data ->> 'tier') stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists families_updated_at_idx on public.families (updated_at desc);
create index if not exists families_name_idx on public.families (name);

create table if not exists public.settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.activity_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text,
  entity text not null,
  entity_id text not null,
  action text not null,
  summary text
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);
create index if not exists activity_log_entity_idx on public.activity_log (entity, entity_id);

create or replace function public.families_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into activity_log (actor, entity, entity_id, action, summary) values (current_email(), 'family', old.id::text, 'delete', old.data ->> 'name');
    return old;
  end if;
  new.updated_at := coalesce(new.updated_at, now());
  new.updated_by := current_email();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
    insert into activity_log (actor, entity, entity_id, action, summary) values (current_email(), 'family', new.id::text, 'insert', new.data ->> 'name');
  else
    insert into activity_log (actor, entity, entity_id, action, summary) values (current_email(), 'family', new.id::text, 'update', new.data ->> 'name');
  end if;
  return new;
end $$;
drop trigger if exists families_touch on public.families;
create trigger families_touch before insert or update or delete on public.families for each row execute function public.families_touch();

create or replace function public.settings_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := current_email();
  insert into activity_log (actor, entity, entity_id, action, summary) values (current_email(), 'settings', new.key, lower(tg_op), null);
  return new;
end $$;
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before insert or update on public.settings for each row execute function public.settings_touch();

alter table public.families enable row level security;
alter table public.settings enable row level security;
alter table public.activity_log enable row level security;
drop policy if exists families_team on public.families;
create policy families_team on public.families for all to authenticated using (public.is_paradiem()) with check (public.is_paradiem());
drop policy if exists settings_team on public.settings;
create policy settings_team on public.settings for all to authenticated using (public.is_paradiem()) with check (public.is_paradiem());
drop policy if exists activity_team_read on public.activity_log;
create policy activity_team_read on public.activity_log for select to authenticated using (public.is_paradiem());

revoke execute on function public.families_touch() from public, anon, authenticated;
revoke execute on function public.settings_touch() from public, anon, authenticated;
revoke execute on function public.is_paradiem() from anon;
revoke execute on function public.current_email() from anon;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'families') then alter publication supabase_realtime add table public.families; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'settings') then alter publication supabase_realtime add table public.settings; end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit) values ('documents', 'documents', false, 52428800)
  on conflict (id) do update set public = false, file_size_limit = 52428800;
drop policy if exists documents_team_select on storage.objects;
create policy documents_team_select on storage.objects for select to authenticated using (bucket_id = 'documents' and public.is_paradiem());
drop policy if exists documents_team_insert on storage.objects;
create policy documents_team_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.is_paradiem());
drop policy if exists documents_team_update on storage.objects;
create policy documents_team_update on storage.objects for update to authenticated using (bucket_id = 'documents' and public.is_paradiem());
drop policy if exists documents_team_delete on storage.objects;
create policy documents_team_delete on storage.objects for delete to authenticated using (bucket_id = 'documents' and public.is_paradiem());
