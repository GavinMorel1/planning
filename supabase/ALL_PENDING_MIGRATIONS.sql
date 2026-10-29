-- ALL PENDING DATABASE UPDATES, in order. Paste this whole file into Supabase > SQL Editor > New query and click Run.
-- Safe to run more than once. Generated from supabase/migrations/* (28 Oct 2026).

-- ================ 20261027_work_items.sql ================
create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  kind text not null check (kind in ('project','task')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists work_items_family_idx on public.work_items (family_id, kind);
create or replace function public.work_items_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    insert into activity_log (actor, entity, entity_id, action, summary) values (current_email(), 'work', old.id::text, 'delete', old.kind || ': ' || coalesce(old.data ->> 'title', old.data ->> 'name', ''));
    return old;
  end if;
  new.updated_at := now();
  new.updated_by := current_email();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, current_email());
    insert into activity_log (actor, entity, entity_id, action, summary) values (current_email(), 'work', new.id::text, 'insert', new.kind || ': ' || coalesce(new.data ->> 'title', new.data ->> 'name', ''));
  end if;
  return new;
end $$;
revoke execute on function public.work_items_touch() from public, anon, authenticated;
drop trigger if exists work_items_touch on public.work_items;
create trigger work_items_touch before insert or update or delete on public.work_items for each row execute function public.work_items_touch();
alter table public.work_items enable row level security;
drop policy if exists work_items_team on public.work_items;
create policy work_items_team on public.work_items for all to authenticated using (public.is_paradiem()) with check (public.is_paradiem());
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'work_items') then alter publication supabase_realtime add table public.work_items; end if;
end $$;

-- ================ 20261029_work_seed_idempotent.sql ================
-- Idempotent workflow seeding: every project/task created from a template carries a seed_key
-- ("<workflow>:<step>" or "<workflow>:<step>:<task>"). The unique index makes a second copy impossible, even if two
-- browsers seed the same family at the same moment. Rows without a seed key (hand-made, imported tools) are unaffected
-- because NULLs never collide. Run supabase/cleanup/dedupe_work_items.sql once BEFORE or AFTER this migration to remove
-- duplicates that already exist (they have no seed key, so this index does not touch them).
alter table public.work_items add column if not exists seed_key text;
create unique index if not exists work_items_seed_uq on public.work_items (family_id, seed_key);

-- ================ 20261029_cashflow_model.sql ================
-- Cash-flow planning model: one typed JSON document per family (shape: src/cashflow/types.ts, CashflowModel) plus an
-- append-only history so every change is recorded with who and when. Depends on is_paradiem() and current_email()
-- (created in the earlier migrations).
create table if not exists public.cashflow_models (
  family_id uuid primary key references public.families(id) on delete cascade,
  data jsonb not null,
  version int not null default 1,
  last_source text,            -- what produced this save: 'manual', 'intake: <file> (approved by <email>)', 'restore v3', ...
  last_note text,
  created_at timestamptz not null default now(),
  created_by text,
  updated_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.cashflow_history (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families(id) on delete cascade,
  version int not null,
  data jsonb not null,
  source text,
  note text,
  changed_by text,
  changed_at timestamptz not null default now(),
  unique (family_id, version)
);
create index if not exists cashflow_history_family_idx on public.cashflow_history (family_id, version desc);

create or replace function public.cashflow_models_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.version := 1; new.created_by := coalesce(new.created_by, current_email());
  else
    new.version := old.version + 1;
    new.family_id := old.family_id;
    new.created_at := old.created_at; new.created_by := old.created_by;
  end if;
  new.updated_at := now(); new.updated_by := current_email();
  return new;
end $$;

create or replace function public.cashflow_models_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cashflow_history (family_id, version, data, source, note, changed_by, changed_at)
  values (new.family_id, new.version, new.data, new.last_source, new.last_note, new.updated_by, new.updated_at);
  return null;
end $$;

revoke execute on function public.cashflow_models_before() from public, anon, authenticated;
revoke execute on function public.cashflow_models_after() from public, anon, authenticated;
drop trigger if exists cashflow_models_before on public.cashflow_models;
create trigger cashflow_models_before before insert or update on public.cashflow_models for each row execute function public.cashflow_models_before();
drop trigger if exists cashflow_models_after on public.cashflow_models;
create trigger cashflow_models_after after insert or update on public.cashflow_models for each row execute function public.cashflow_models_after();

alter table public.cashflow_models enable row level security;
alter table public.cashflow_history enable row level security;
drop policy if exists cashflow_models_team on public.cashflow_models;
create policy cashflow_models_team on public.cashflow_models for all to authenticated using (public.is_paradiem()) with check (public.is_paradiem());
-- History is read-only to everyone: rows are written only by the trigger above (security definer), never updated or deleted.
drop policy if exists cashflow_history_read on public.cashflow_history;
create policy cashflow_history_read on public.cashflow_history for select to authenticated using (public.is_paradiem());

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cashflow_models') then alter publication supabase_realtime add table public.cashflow_models; end if;
end $$;

-- ================ 20261029_roles.sql ================
-- Role-based permissions. Roles:
--   admin    - can edit everything and manage roles
--   planning - Planning Team: can edit everything
--   rm       - Relationship Manager: read everything and export, cannot change data
-- A signed-in user with NO row in app_roles is treated as 'planning' so nobody is locked out the day this is applied.
-- Until an admin exists, any signed-in user may add roles (that is how the first admin is created, in Settings > Access).
create table if not exists public.app_roles (
  email text primary key,
  role text not null check (role in ('admin', 'planning', 'rm')),
  created_at timestamptz not null default now(),
  created_by text
);

create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.app_roles where email = public.current_email()), 'planning');
$$;
create or replace function public.can_edit() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.current_role_name() in ('admin', 'planning');
$$;
create or replace function public.can_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.current_role_name() = 'admin' or not exists (select 1 from public.app_roles where role = 'admin'));
$$;
revoke execute on function public.current_role_name() from anon;
revoke execute on function public.can_edit() from anon;
revoke execute on function public.can_admin() from anon;

alter table public.app_roles enable row level security;
drop policy if exists app_roles_read on public.app_roles;
create policy app_roles_read on public.app_roles for select to authenticated using (auth.uid() is not null);
drop policy if exists app_roles_write on public.app_roles;
create policy app_roles_write on public.app_roles for all to authenticated using (public.can_admin()) with check (public.can_admin());

-- Reads stay open to every signed-in user; writes need can_edit().
do $$
declare t text;
begin
  foreach t in array array['families', 'settings', 'work_items', 'cashflow_models'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I', t || '_team', t);
      execute format('drop policy if exists %I on public.%I', t || '_read', t);
      execute format('drop policy if exists %I on public.%I', t || '_write', t);
      execute format('create policy %I on public.%I for select to authenticated using (public.is_paradiem())', t || '_read', t);
      execute format('create policy %I on public.%I for all to authenticated using (public.can_edit()) with check (public.can_edit())', t || '_write', t);
    end if;
  end loop;
end $$;

drop policy if exists documents_team_insert on storage.objects;
create policy documents_team_insert on storage.objects for insert to authenticated with check (bucket_id = 'documents' and public.can_edit());
drop policy if exists documents_team_update on storage.objects;
create policy documents_team_update on storage.objects for update to authenticated using (bucket_id = 'documents' and public.can_edit());
drop policy if exists documents_team_delete on storage.objects;
create policy documents_team_delete on storage.objects for delete to authenticated using (bucket_id = 'documents' and public.can_edit());
