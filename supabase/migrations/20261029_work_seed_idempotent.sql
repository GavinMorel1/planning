-- Idempotent workflow seeding: every project/task created from a template carries a seed_key
-- ("<workflow>:<step>" or "<workflow>:<step>:<task>"). The unique index makes a second copy impossible, even if two
-- browsers seed the same family at the same moment. Rows without a seed key (hand-made, imported tools) are unaffected
-- because NULLs never collide. Run supabase/cleanup/dedupe_work_items.sql once BEFORE or AFTER this migration to remove
-- duplicates that already exist (they have no seed key, so this index does not touch them).
alter table public.work_items add column if not exists seed_key text;
create unique index if not exists work_items_seed_uq on public.work_items (family_id, seed_key);
