-- ============================================================
-- 20260527_overtime.sql
-- Jam Tambahan (Advance/Extend) — overtime logging table.
--
-- Pairs with: ROSTER_HANDOFF.md §5 (v3 simplified).
--
-- v3 design notes:
--   * No start_time / end_time columns — user inputs duration directly
--     (hours + minutes picker), stored as duration_min integer.
--   * No cause enum — free-text `note` instead. Operations don't need
--     classified causes; they need fast capture.
--   * No airport opening/closing hour dependency. Validation lives in
--     the client (src/lib/overtime/validation.ts): required fields +
--     duration > 0 + sanity cap (≤ 24h).
--
-- airport_code conventions (verified pre-flight in Supabase):
--   * accounts.branch_code  = ICAO 4-letter (WARR, WIII, WADD, WAHI)
--   * atc_rosters.airport_code = mixed (ICAO when MO insert, engine-
--     derived name when admin picks from dropdown).
--   * atc_overtime.airport_code follows the SAME convention as
--     atc_rosters / atc_leaves — whatever value the shared `airportCode`
--     variable holds at insert time.
--   * For MO cabang: airportCode == user.branch_code (resolver falls
--     back when name doesn't match airport-configs.json). Direct
--     compare RLS works.
--   * For admin: bypass via role check.
-- ============================================================

-- 1) Table ---------------------------------------------------------
create table if not exists public.atc_overtime (
  id            uuid        primary key default gen_random_uuid(),
  personnel_id  uuid        not null references public.personnel(id) on delete restrict,
  airport_code  text        not null,
  unit          text        not null,            -- TWR | APP | ACC
  date          date        not null,
  type          text        not null check (type in ('ADVANCE','EXTEND')),
  duration_min  integer     not null check (duration_min > 0 and duration_min <= 24 * 60),
  note          text,                            -- free text: penyebab / konteks
  recorded_by   uuid        references public.accounts(id),
  recorded_at   timestamptz not null default now()
);

comment on table  public.atc_overtime is 'Jam Tambahan (Advance/Extend) — overtime logging per personnel × date.';
comment on column public.atc_overtime.airport_code is 'Matches atc_rosters.airport_code convention. For MO cabang == user.branch_code; for admin == whatever airport they picked from dropdown.';
comment on column public.atc_overtime.duration_min is 'Total durasi dalam menit. Range 1..1440 (1 minute to 24 hours).';
comment on column public.atc_overtime.note is 'Free-text catatan / penyebab. Optional.';

-- 2) Indexes -------------------------------------------------------
-- Lookup index: Tunjangan ATC join + sidebar badge count.
create index if not exists atc_overtime_lookup_idx
  on public.atc_overtime (airport_code, unit, date);

-- Per-personnel month aggregation: allowance calc.
create index if not exists atc_overtime_personnel_month_idx
  on public.atc_overtime (personnel_id, date);

-- 3) RLS -----------------------------------------------------------
alter table public.atc_overtime enable row level security;

-- Read + write: admin sees all; MO cabang sees own branch only.
drop policy if exists "atc_overtime_branch_scoped" on public.atc_overtime;
create policy "atc_overtime_branch_scoped" on public.atc_overtime
  for all
  using (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid() and a.role = 'admin'
    )
    or airport_code = (
      select branch_code from public.accounts where id = auth.uid()
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
  );

-- ============================================================
-- End migration. Idempotent — safe to re-run.
-- ============================================================
