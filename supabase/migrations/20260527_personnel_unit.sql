-- ============================================================
-- 20260527_personnel_unit.sql
-- Tambah kolom `unit` ke table personnel + index lookup.
--
-- Latar belakang:
-- Engine roster generator butuh tahu personnel masuk ke unit mana
-- (TWR/APP/ACC) supaya bisa apply patterns_baseline yang sesuai.
-- Tanpa kolom ini, cabang multi-unit (Surabaya, Denpasar, Medan,
-- Palembang, Sentani, Tanjung Pinang, Matsc) gagal apply baseline
-- karena personnel.length tidak match dengan patterns_baseline.length.
--
-- Step 2 (seed data WARR) ada di file terpisah supaya tidak
-- bercampur dengan schema migration.
-- ============================================================

-- 1) Tambah kolom unit
alter table public.personnel
  add column if not exists unit text;

comment on column public.personnel.unit is
  'Unit operasional: TWR | APP | ACC. Untuk filter personnel saat generate roster di cabang multi-unit. Null = belum di-assign (engine akan fallback ke greedy).';

-- 2) Index untuk lookup cepat saat filter di Roster ATC
create index if not exists personnel_branch_unit_idx
  on public.personnel (branch_code, unit)
  where is_active = true;

-- 3) Optional sanity check constraint (commented out untuk fleksibilitas)
-- alter table public.personnel
--   add constraint personnel_unit_check
--   check (unit is null or unit in ('TWR', 'APP', 'ACC'));

-- ============================================================
-- End migration. Idempotent — safe to re-run.
-- ============================================================
