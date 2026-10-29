-- ONE-TIME cleanup of duplicated workflow projects and tasks in public.work_items.
-- Safe to re-run (it finds nothing the second time). Run in the Supabase SQL Editor.
--
-- 1. Duplicate PROJECTS: same family + same workflow + same name (workflow projects, or projects named like the generic
--    template). The oldest is kept; tasks of the removed copies are moved onto it.
-- 2. Duplicate TASKS: same family + project + title. The oldest is kept. A duplicate is removed ONLY if it is untouched
--    (status To do, no owner, no subtasks, files or comments), so nothing anyone has worked on is ever deleted.
-- It reports what it did under "Messages" / NOTICE output.
do $$
declare
  n_proj int; n_task int;
begin
  -- 1. projects
  create temp table _wi_dup_projects on commit drop as
  select id, keep_id from (
    select id,
           first_value(id) over w as keep_id,
           row_number() over w as rn
    from public.work_items
    where kind = 'project'
      and (data ? 'workflow' or lower(btrim(data ->> 'name')) in ('data gathering', 'gap analysis build', 'presentation & decision', 'blueprint implementation'))
    window w as (partition by family_id, coalesce(data ->> 'workflow', ''), lower(btrim(data ->> 'name')) order by created_at, id)
  ) x where rn > 1;

  select count(*) into n_proj from _wi_dup_projects;

  update public.work_items t
     set data = jsonb_set(t.data, '{projectId}', to_jsonb(d.keep_id::text))
    from _wi_dup_projects d
   where t.kind = 'task' and t.data ->> 'projectId' = d.id::text;

  delete from public.work_items w using _wi_dup_projects d where w.id = d.id;

  -- 2. tasks
  create temp table _wi_dup_tasks on commit drop as
  select id from (
    select id,
           row_number() over (
             partition by family_id, data ->> 'projectId', lower(btrim(coalesce(data ->> 'title', '')))
             order by (case when coalesce(data ->> 'status', 'todo') <> 'todo'
                              or coalesce(data ->> 'owner', '') <> ''
                              or jsonb_array_length(coalesce(data -> 'subtasks', '[]'::jsonb)) > 0
                              or jsonb_array_length(coalesce(data -> 'files', '[]'::jsonb)) > 0
                              or jsonb_array_length(coalesce(data -> 'comments', '[]'::jsonb)) > 0 then 0 else 1 end),
                      created_at, id) as rn,
           (coalesce(data ->> 'status', 'todo') = 'todo'
              and coalesce(data ->> 'owner', '') = ''
              and jsonb_array_length(coalesce(data -> 'subtasks', '[]'::jsonb)) = 0
              and jsonb_array_length(coalesce(data -> 'files', '[]'::jsonb)) = 0
              and jsonb_array_length(coalesce(data -> 'comments', '[]'::jsonb)) = 0) as untouched
    from public.work_items
    where kind = 'task' and btrim(coalesce(data ->> 'title', '')) <> ''
  ) x where rn > 1 and untouched;

  select count(*) into n_task from _wi_dup_tasks;
  delete from public.work_items w using _wi_dup_tasks d where w.id = d.id;

  raise notice 'work_items cleanup: removed % duplicate project(s) and % duplicate task(s)', n_proj, n_task;
end $$;
