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
