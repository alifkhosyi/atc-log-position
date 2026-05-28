-- ============================================================
-- 20260528_fix_overtime_rls.sql
-- Fix RLS atc_overtime: support both ICAO branch_code dan
-- engine-derived airport_code di kolom airport_code.
--
-- Root cause:
--   `useResolvedAirport` (src/hooks/useResolvedAirport) return engine-
--   derived code (mis. "KUPANG") untuk MO cabang yang ada di
--   airport-configs.json dengan branch_code match. Hook ini bukan
--   regressi — by design ngerouter ke derived code supaya engine
--   roster (atc_rosters.airport_code = engine-derived name) konsisten.
--
--   Tapi RLS policy lama (migration 20260527_overtime.sql) strict
--   compare airport_code vs accounts.branch_code:
--       airport_code = (select branch_code from accounts ...)
--   Insert payload pakai "KUPANG", RLS check vs "WATT" → FALSE → DENY.
--   User dapat toast "Tidak punya izin untuk operasi ini".
--
--   atc_leaves tidak kena karena policy-nya sudah permissive (legacy).
--   Migration 20260527 yang baru aja strict, jadi cuma atc_overtime
--   yang affected.
--
-- Fix: Tambah OR clause yang accept engine-derived airport_code via
-- branches table mapping (upper(replace(name, ' ', '_'))). Mirror
-- behavior loader `deriveAirportCode` di
-- src/lib/airport-data/loader.ts line 24-26.
--
-- Idempotent: drop policy if exists then re-create.
--
-- Verify after apply:
--   select tablename, policyname, qual::text, with_check::text
--   from pg_policies
--   where tablename = 'atc_overtime';
-- ============================================================

drop policy if exists "atc_overtime_branch_scoped" on public.atc_overtime;

create policy "atc_overtime_branch_scoped" on public.atc_overtime
  for all
  using (
    -- Admin bypass
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid() and a.role = 'admin'
    )
    -- Case 1 (legacy): airport_code == user's branch_code (ICAO)
    or airport_code = (
      select branch_code from public.accounts where id = auth.uid()
    )
    -- Case 2 (NEW): airport_code == engine-derived from branches.name
    --   accounts.branch_code → branches.code → upper(replace(name,' ','_'))
    --   e.g. WATT → Kupang → KUPANG
    or airport_code = (
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
    or airport_code = (
      select branch_code from public.accounts where id = auth.uid()
    )
    or airport_code = (
      select upper(replace(b.name, ' ', '_'))
      from public.branches b
      join public.accounts a on a.branch_code = b.code
      where a.id = auth.uid()
    )
  );

comment on policy "atc_overtime_branch_scoped" on public.atc_overtime is
  'Admin sees all. MO sees own branch — accept both ICAO branch_code (legacy) and engine-derived airport_code (Kupang/Surabaya/dst). Mirror airport-data/loader.ts deriveAirportCode logic.';

-- ============================================================
-- End migration. Idempotent — safe to re-run.
-- ============================================================
