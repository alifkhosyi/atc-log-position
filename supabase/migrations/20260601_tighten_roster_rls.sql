-- ============================================================
-- 20260601_tighten_roster_rls.sql
-- Tighten RLS untuk atc_leaves, atc_rosters, atc_roster_cells.
--
-- Before: policy `using (true) with check (true)` — siapapun yang
-- login bisa CRUD data cabang manapun. Security gap.
--
-- After: 4 separate policy per table (read/insert/update/delete)
-- dengan scope:
--   - Admin: full CRUD via role check
--   - MO cabang: scope to own branch_code dengan dual-key match
--     (ICAO direct + engine-derived via branches.name)
--
-- Mirror pattern dari:
--   - 20260528_fix_overtime_rls.sql (atc_overtime — dual-key OR)
--   - 20260530_personnel_crud.sql (personnel — 4 policies separation)
--
-- atc_roster_cells: special case — no airport_code column.
-- Scope via JOIN ke parent atc_rosters table.
--
-- Idempotent: drop policy if exists then re-create.
-- Reversible: down migration di bottom (commented).
--
-- Verification (run after apply):
--   select tablename, policyname, cmd
--   from pg_policies
--   where tablename in ('atc_leaves', 'atc_rosters', 'atc_roster_cells')
--   order by tablename, cmd;
--   -- Should show 12 policies (3 tables × 4 commands).
-- ============================================================


-- ─── atc_leaves ─────────────────────────────────────────────
alter table public.atc_leaves enable row level security;

-- Cleanup legacy permissive policies (idempotent)
drop policy if exists "atc_leaves_all" on public.atc_leaves;
drop policy if exists "atc_leaves_read" on public.atc_leaves;
drop policy if exists "atc_leaves_insert" on public.atc_leaves;
drop policy if exists "atc_leaves_update" on public.atc_leaves;
drop policy if exists "atc_leaves_delete" on public.atc_leaves;

create policy "atc_leaves_read" on public.atc_leaves
  for select using (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

create policy "atc_leaves_insert" on public.atc_leaves
  for insert with check (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

create policy "atc_leaves_update" on public.atc_leaves
  for update
  using (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  )
  with check (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

create policy "atc_leaves_delete" on public.atc_leaves
  for delete using (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );


-- ─── atc_rosters ────────────────────────────────────────────
alter table public.atc_rosters enable row level security;

drop policy if exists "atc_rosters_all" on public.atc_rosters;
drop policy if exists "atc_rosters_read" on public.atc_rosters;
drop policy if exists "atc_rosters_insert" on public.atc_rosters;
drop policy if exists "atc_rosters_update" on public.atc_rosters;
drop policy if exists "atc_rosters_delete" on public.atc_rosters;

create policy "atc_rosters_read" on public.atc_rosters
  for select using (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

create policy "atc_rosters_insert" on public.atc_rosters
  for insert with check (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

create policy "atc_rosters_update" on public.atc_rosters
  for update
  using (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  )
  with check (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

create policy "atc_rosters_delete" on public.atc_rosters
  for delete using (
    exists (select 1 from public.accounts a where a.id = auth.uid() and a.role = 'admin')
    or airport_code = (select branch_code from public.accounts where id = auth.uid())
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );


-- ─── atc_roster_cells (scope via JOIN parent atc_rosters) ──
-- Special case: tabel ini tidak punya airport_code column sendiri.
-- Scope inherit dari parent atc_rosters via roster_id FK.
-- Inline subquery untuk avoid function security overhead.
alter table public.atc_roster_cells enable row level security;

drop policy if exists "atc_roster_cells_all" on public.atc_roster_cells;
drop policy if exists "atc_roster_cells_read" on public.atc_roster_cells;
drop policy if exists "atc_roster_cells_insert" on public.atc_roster_cells;
drop policy if exists "atc_roster_cells_update" on public.atc_roster_cells;
drop policy if exists "atc_roster_cells_delete" on public.atc_roster_cells;

create policy "atc_roster_cells_read" on public.atc_roster_cells
  for select using (
    exists (
      select 1 from public.atc_rosters r
      join public.accounts a on a.id = auth.uid()
      where r.id = atc_roster_cells.roster_id
      and (
        a.role = 'admin'
        or r.airport_code = a.branch_code
        or r.airport_code = (
          select upper(replace(b.name, ' ', '_'))
          from public.branches b
          where b.code = a.branch_code
        )
      )
    )
  );

create policy "atc_roster_cells_insert" on public.atc_roster_cells
  for insert with check (
    exists (
      select 1 from public.atc_rosters r
      join public.accounts a on a.id = auth.uid()
      where r.id = atc_roster_cells.roster_id
      and (
        a.role = 'admin'
        or r.airport_code = a.branch_code
        or r.airport_code = (
          select upper(replace(b.name, ' ', '_'))
          from public.branches b
          where b.code = a.branch_code
        )
      )
    )
  );

create policy "atc_roster_cells_update" on public.atc_roster_cells
  for update
  using (
    exists (
      select 1 from public.atc_rosters r
      join public.accounts a on a.id = auth.uid()
      where r.id = atc_roster_cells.roster_id
      and (
        a.role = 'admin'
        or r.airport_code = a.branch_code
        or r.airport_code = (
          select upper(replace(b.name, ' ', '_'))
          from public.branches b
          where b.code = a.branch_code
        )
      )
    )
  )
  with check (
    exists (
      select 1 from public.atc_rosters r
      join public.accounts a on a.id = auth.uid()
      where r.id = atc_roster_cells.roster_id
      and (
        a.role = 'admin'
        or r.airport_code = a.branch_code
        or r.airport_code = (
          select upper(replace(b.name, ' ', '_'))
          from public.branches b
          where b.code = a.branch_code
        )
      )
    )
  );

create policy "atc_roster_cells_delete" on public.atc_roster_cells
  for delete using (
    exists (
      select 1 from public.atc_rosters r
      join public.accounts a on a.id = auth.uid()
      where r.id = atc_roster_cells.roster_id
      and (
        a.role = 'admin'
        or r.airport_code = a.branch_code
        or r.airport_code = (
          select upper(replace(b.name, ' ', '_'))
          from public.branches b
          where b.code = a.branch_code
        )
      )
    )
  );


-- ─── Comments untuk audit trail ──────────────────────────────
comment on policy "atc_leaves_read" on public.atc_leaves is
  'Admin + MO own branch (ICAO atau engine-derived). Mirror 20260528_fix_overtime_rls.sql pattern.';
comment on policy "atc_rosters_read" on public.atc_rosters is
  'Admin + MO own branch (dual-key match).';
comment on policy "atc_roster_cells_read" on public.atc_roster_cells is
  'Scope via JOIN parent atc_rosters — no airport_code column sendiri.';


-- ============================================================
-- VERIFICATION (run after apply):
--
--   select tablename, policyname, cmd
--   from pg_policies
--   where tablename in ('atc_leaves', 'atc_rosters', 'atc_roster_cells')
--   order by tablename, cmd;
--
--   -- Expected output (12 rows):
--   --   atc_leaves       | atc_leaves_delete         | DELETE
--   --   atc_leaves       | atc_leaves_insert         | INSERT
--   --   atc_leaves       | atc_leaves_read           | SELECT
--   --   atc_leaves       | atc_leaves_update         | UPDATE
--   --   atc_roster_cells | atc_roster_cells_delete   | DELETE
--   --   atc_roster_cells | atc_roster_cells_insert   | INSERT
--   --   atc_roster_cells | atc_roster_cells_read     | SELECT
--   --   atc_roster_cells | atc_roster_cells_update   | UPDATE
--   --   atc_rosters      | atc_rosters_delete        | DELETE
--   --   atc_rosters      | atc_rosters_insert        | INSERT
--   --   atc_rosters      | atc_rosters_read          | SELECT
--   --   atc_rosters      | atc_rosters_update        | UPDATE
--
--   -- Sanity test as MO Surabaya (branch_code=WARR):
--   --   Can read own rosters → OK
--   --   Cannot read Kupang (WATT) rosters → returns 0 rows
--   --   Can insert/update/delete own roster cells via Roster ATC UI
-- ============================================================


-- ============================================================
-- DOWN MIGRATION (manual revert kalau perlu rollback).
--
-- COMMENTED OUT — uncomment + run only via Supabase SQL Editor
-- kalau ternyata break production. Saran: jangan langsung revert
-- semua, debug per-table dulu.
--
-- drop policy if exists "atc_leaves_read"            on public.atc_leaves;
-- drop policy if exists "atc_leaves_insert"          on public.atc_leaves;
-- drop policy if exists "atc_leaves_update"          on public.atc_leaves;
-- drop policy if exists "atc_leaves_delete"          on public.atc_leaves;
-- create policy "atc_leaves_all" on public.atc_leaves
--   for all using (true) with check (true);
--
-- drop policy if exists "atc_rosters_read"           on public.atc_rosters;
-- drop policy if exists "atc_rosters_insert"         on public.atc_rosters;
-- drop policy if exists "atc_rosters_update"         on public.atc_rosters;
-- drop policy if exists "atc_rosters_delete"         on public.atc_rosters;
-- create policy "atc_rosters_all" on public.atc_rosters
--   for all using (true) with check (true);
--
-- drop policy if exists "atc_roster_cells_read"      on public.atc_roster_cells;
-- drop policy if exists "atc_roster_cells_insert"    on public.atc_roster_cells;
-- drop policy if exists "atc_roster_cells_update"    on public.atc_roster_cells;
-- drop policy if exists "atc_roster_cells_delete"    on public.atc_roster_cells;
-- create policy "atc_roster_cells_all" on public.atc_roster_cells
--   for all using (true) with check (true);
-- ============================================================
