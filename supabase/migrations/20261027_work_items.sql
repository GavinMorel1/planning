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
