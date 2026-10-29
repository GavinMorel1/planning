-- Find and remove test records ("Texst", "LAsjawe") from the live database. Run STEP 1 first and look at what it lists.
-- Nothing is deleted until you run STEP 2.

-- STEP 1: preview. Families whose name looks like test data, and work/cash-flow rows that belong to them.
select f.id, f.name, f.created_at, f.updated_at,
       (select count(*) from public.work_items w where w.family_id = f.id) as work_rows,
       (select count(*) from public.cashflow_models c where c.family_id = f.id) as cashflow_models
from public.families f
where f.name ~* '^\s*(texst|lasjawe)' or f.name ~* '(texst|lasjawe)'
order by f.created_at;

-- Settings-level leftovers (roster entries, memos) that contain the same words:
select key, jsonb_path_query_array(data, '$.**.name ? (@ like_regex "(texst|lasjawe)" flag "i")') as matches
from public.settings
where data::text ~* '(texst|lasjawe)';

-- STEP 2: delete (families cascade to work_items and cashflow tables). Uncomment, run, and check the NOTICE.
-- do $$
-- declare n int;
-- begin
--   delete from public.families where name ~* '(texst|lasjawe)';
--   get diagnostics n = row_count;
--   raise notice 'deleted % test families (their work items and cash-flow data cascade)', n;
-- end $$;
-- Files uploaded for those families stay in the private "documents" bucket under <family id>/...; remove them in
-- Supabase > Storage > documents (the family ids are in the STEP 1 list).
