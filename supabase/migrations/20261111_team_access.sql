-- My Team: only people listed in app_roles may use the app. Run after 20261029_roles.sql (safe to run more than once).
--   admin    - can edit everything and add or remove people (My Team tab)
--   planning - Planning Team: can edit everything
--   rm       - Relationship Manager: read and export only
--   (not listed) - no access: every table, file and Claude call is refused. Until the first Admin exists, everyone signed in is
--   treated as Planning Team so nobody is locked out by accident.
alter table public.app_roles add column if not exists name text;
alter table public.app_roles add column if not exists title text;

-- Emails are stored lowercase, and the last Admin can never be removed or demoted.
create or replace function public.app_roles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('INSERT', 'UPDATE') then new.email := lower(trim(new.email)); end if;
  if (tg_op = 'DELETE' and old.role = 'admin') or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    if not exists (select 1 from public.app_roles a where a.role = 'admin' and a.email <> old.email) then
      raise exception 'There must always be at least one Admin.';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke execute on function public.app_roles_guard() from public, anon, authenticated;
drop trigger if exists app_roles_guard on public.app_roles;
create trigger app_roles_guard before insert or update or delete on public.app_roles for each row execute function public.app_roles_guard();

-- A signed-in account that is not on the team has role 'none'.
create or replace function public.current_role_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select r.role from public.app_roles r where r.email = public.current_email()),
    case when exists (select 1 from public.app_roles a where a.role = 'admin') then 'none' else 'planning' end);
$$;
-- is_paradiem() guards every table, file and policy: it is now "signed in AND on the team".
create or replace function public.is_paradiem() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.current_role_name() <> 'none';
$$;
revoke execute on function public.current_role_name() from anon;
revoke execute on function public.is_paradiem() from anon;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.is_paradiem() to authenticated;

-- Only team members can read the team list (the app asks current_role_name() for the caller's own role).
drop policy if exists app_roles_read on public.app_roles;
create policy app_roles_read on public.app_roles for select to authenticated using (public.is_paradiem());

-- Admin-only list of accounts that signed up but are not on the team yet (the "Pending sign-ups" card).
create or replace function public.pending_signups() returns table (email text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if public.current_role_name() <> 'admin' then raise exception 'Only an Admin can see sign-ups.'; end if;
  return query
    select lower(u.email)::text, u.created_at, u.last_sign_in_at
    from auth.users u
    where u.email is not null and lower(u.email) not in (select a.email from public.app_roles a)
    order by u.created_at desc;
end $$;
revoke all on function public.pending_signups() from public, anon;
grant execute on function public.pending_signups() to authenticated;

-- The Admin account.
insert into public.app_roles (email, role, name, created_by)
values ('gavin.morel@paradiem.org', 'admin', 'Gavin Morel', 'bootstrap')
on conflict (email) do update set role = 'admin', name = coalesce(public.app_roles.name, excluded.name);

-- OPTIONAL: let everyone who has already created an account keep working as Planning Team (otherwise they appear under
-- "Pending sign-ups" in My Team and you approve each one). Remove the leading dashes on the next 4 lines to use it.
-- insert into public.app_roles (email, role, created_by)
--   select lower(u.email), 'planning', 'grandfathered' from auth.users u
--   where u.email is not null and lower(u.email) <> 'gavin.morel@paradiem.org'
--   on conflict (email) do nothing;

-- Make the API pick up the new columns and functions right away.
notify pgrst, 'reload schema';
