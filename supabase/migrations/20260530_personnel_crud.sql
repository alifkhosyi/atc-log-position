-- ============================================================
-- 20260530_personnel_crud.sql
-- Personnel CRUD support:
--   1. Add columns: priority_order, nik
--   2. RLS policy update untuk MO cabang scope + admin bypass
--
-- Existing personnel table schema (verified pre-flight):
--   id, name, branch_code, is_active, created_at, unit
--
-- Tambah:
--   priority_order INTEGER DEFAULT 0  -- roster ordering tie-break
--   nik TEXT                          -- untuk Tunjangan ATC lookup
--
-- RLS 4 separate policies (read/insert/update/delete) untuk:
--   - Admin: full CRUD (role check via accounts.role = 'admin')
--   - MO cabang: SELECT/INSERT/UPDATE scoped to own branch_code
--     (accept ICAO + engine-derived via branches join — mirror
--     20260528_fix_overtime_rls.sql pattern)
--   - DELETE: admin only (MO pakai soft delete via UPDATE is_active=false)
--
-- Idempotent: alter ... if not exists + drop policy if exists.
-- ============================================================

-- ─── 1) Add columns ───────────────────────────────────────────
alter table public.personnel
  add column if not exists priority_order integer not null default 0;

alter table public.personnel
  add column if not exists nik text;

comment on column public.personnel.priority_order is
  'Urutan prioritas untuk roster ordering. Default 0 = first-in-first-out (creation order). Makin kecil makin awal.';
comment on column public.personnel.nik is
  'Nomor Induk Karyawan. Optional. Untuk lookup Tunjangan ATC + payroll integration.';

create index if not exists personnel_priority_idx
  on public.personnel (branch_code, unit, priority_order)
  where is_active = true;

create index if not exists personnel_nik_idx
  on public.personnel (nik)
  where nik is not null;

-- ─── 2) RLS — enable + drop legacy policies ──────────────────
alter table public.personnel enable row level security;

drop policy if exists "personnel_all" on public.personnel;
drop policy if exists "personnel_read" on public.personnel;
drop policy if exists "personnel_branch_scoped" on public.personnel;
drop policy if exists "personnel_read_scoped" on public.personnel;
drop policy if exists "personnel_insert_scoped" on public.personnel;
drop policy if exists "personnel_update_scoped" on public.personnel;
drop policy if exists "personnel_delete_admin_only" on public.personnel;

-- ─── 3) SELECT policy ────────────────────────────────────────
-- Admin: all. MO: own branch (ICAO atau engine-derived match).
create policy "personnel_read_scoped" on public.personnel
  for select
  using (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid() and a.role = 'admin'
    )
    or branch_code = (
      select branch_code from public.accounts where id = auth.uid()
    )
    or branch_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

-- ─── 4) INSERT policy ────────────────────────────────────────
-- Admin: bebas. MO: branch_code WAJIB own branch (legacy ICAO atau
-- engine-derived — kedua format accepted untuk consistency dengan
-- atc_overtime fix).
create policy "personnel_insert_scoped" on public.personnel
  for insert
  with check (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid() and a.role = 'admin'
    )
    or branch_code = (
      select branch_code from public.accounts where id = auth.uid()
    )
    or branch_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

-- ─── 5) UPDATE policy ────────────────────────────────────────
-- Admin: bebas. MO: branch_code WAJIB own branch untuk BOTH old row
-- (using) DAN new row (with check) — prevent lintas-cabang move.
create policy "personnel_update_scoped" on public.personnel
  for update
  using (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid() and a.role = 'admin'
    )
    or branch_code = (
      select branch_code from public.accounts where id = auth.uid()
    )
    or branch_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid() and a.role = 'admin'
    )
    or branch_code = (
      select branch_code from public.accounts where id = auth.uid()
    )
    or branch_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

-- ─── 6) DELETE policy ────────────────────────────────────────
-- Admin only. MO pakai soft delete via UPDATE is_active=false.
-- Hard delete reserved untuk admin/IT (cleanup data, GDPR, dst).
create policy "personnel_delete_admin_only" on public.personnel
  for delete
  using (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid() and a.role = 'admin'
    )
  );

-- Comments untuk audit trail
comment on policy "personnel_read_scoped" on public.personnel is
  'Admin + MO own branch (ICAO atau engine-derived).';
comment on policy "personnel_insert_scoped" on public.personnel is
  'Admin + MO own branch. with-check sama dengan SELECT scope.';
comment on policy "personnel_update_scoped" on public.personnel is
  'Admin + MO own branch. Cannot move personnel ke cabang lain (with check sama).';
comment on policy "personnel_delete_admin_only" on public.personnel is
  'Hard delete admin only. MO pakai soft delete via UPDATE is_active.';

-- ============================================================
-- Verification (run after apply):
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'personnel'
--   order by ordinal_position;
--   -- Should include: priority_order (integer), nik (text)
--
--   select policyname, cmd, qual::text, with_check::text
--   from pg_policies where tablename = 'personnel';
--   -- Should show 4 policies (SELECT/INSERT/UPDATE/DELETE).
-- ============================================================
