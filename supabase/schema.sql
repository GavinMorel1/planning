-- Paradiem Planning — Supabase schema. Run once in the SQL editor of a new project.
-- One JSON document per family; one settings document shared by the team; private storage
-- bucket for uploaded client documents. Access: any signed-in @paradiem.org user.

create table if not exists public.families (
  id uuid primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.is_paradiem() returns boolean language sql stable as $$
  select coalesce(right(lower(auth.jwt() ->> 'email'), 13) = '@paradiem.org', false);
$$;

alter table public.families enable row level security;
alter table public.settings enable row level security;

drop policy if exists families_team on public.families;
create policy families_team on public.families for all
  using (public.is_paradiem()) with check (public.is_paradiem());
drop policy if exists settings_team on public.settings;
create policy settings_team on public.settings for all
  using (public.is_paradiem()) with check (public.is_paradiem());

-- Realtime so every planner sees edits as they happen
alter publication supabase_realtime add table public.families;

-- Private bucket for client documents
insert into storage.buckets (id, name, public) values ('documents', 'documents', false)
  on conflict (id) do nothing;
drop policy if exists documents_team_select on storage.objects;
create policy documents_team_select on storage.objects for select
  using (bucket_id = 'documents' and public.is_paradiem());
drop policy if exists documents_team_insert on storage.objects;
create policy documents_team_insert on storage.objects for insert
  with check (bucket_id = 'documents' and public.is_paradiem());
drop policy if exists documents_team_delete on storage.objects;
create policy documents_team_delete on storage.objects for delete
  using (bucket_id = 'documents' and public.is_paradiem());
