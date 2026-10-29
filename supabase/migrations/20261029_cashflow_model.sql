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
