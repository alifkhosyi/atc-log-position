-- ============================================================
-- 20260526_section_g.sql
-- Daily Report Section G ("Pelaporan Personnel") schema additions.
--
-- Maps the brief's design to the REAL table names in this repo:
--   - brief calls it `log_position_entries`  → actually `position_logs`
--   - brief calls it `roster_entries`        → actually `atc_roster_cells`
--
-- `position_logs` already has departure_count / arrival_count /
-- overfly_count, so the only additive columns are submission
-- metadata + per-row free-text notes.
-- ============================================================

-- 1) Section G metadata on existing position_logs ------------------
alter table public.position_logs
  add column if not exists notes        text,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references public.accounts(id);

-- A "pending" position log = on-mic ended but at least one of
-- DEP / ARR / OVF is still null. Expose as a view for convenience.
create or replace view public.position_logs_status as
select
  pl.*,
  case
    when pl.off_time is null then 'open'
    when pl.departure_count is null
      or pl.arrival_count   is null
      or pl.overfly_count   is null then 'pending'
    else 'done'
  end as fill_status
from public.position_logs pl;

-- 2) Month locks ---------------------------------------------------
create table if not exists public.daily_report_locks (
  branch_code text        not null references public.branches(code),
  month       date        not null,            -- first day of month, Asia/Jakarta
  locked_at   timestamptz not null default now(),
  locked_by   uuid        references public.accounts(id),
  primary key (branch_code, month)
);

create index if not exists daily_report_locks_month_idx
  on public.daily_report_locks (month);

-- 3) RLS -----------------------------------------------------------
alter table public.daily_report_locks enable row level security;

-- Read: anyone authenticated in the branch can see the lock state.
drop policy if exists "lock_select_own_branch" on public.daily_report_locks;
create policy "lock_select_own_branch"
  on public.daily_report_locks for select
  to authenticated
  using (
    branch_code in (
      select branch_code from public.accounts where id = auth.uid()
    )
    or exists (
      select 1 from public.accounts where id = auth.uid() and role = 'admin'
    )
  );

-- Write: only admin or branch's Manager Operasi can lock a month.
drop policy if exists "lock_insert_admin_or_mo" on public.daily_report_locks;
create policy "lock_insert_admin_or_mo"
  on public.daily_report_locks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.accounts a
      where a.id = auth.uid()
        and (a.role = 'admin' or a.username like 'mo\_%' escape '\')
        and (a.role = 'admin' or a.branch_code = daily_report_locks.branch_code)
    )
  );

-- 4) One-time backfill from any legacy table ----------------------
-- The brief mentioned `log_position_entries`. That table does not
-- exist in this database — position_logs is the canonical source —
-- so no backfill is required. Guarded just in case a partial dump
-- with the legacy name was ever loaded.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'log_position_entries'
  ) then
    update public.position_logs pl
       set departure_count = coalesce(pl.departure_count, l.dep),
           arrival_count   = coalesce(pl.arrival_count,   l.arr),
           overfly_count   = coalesce(pl.overfly_count,   l.ovf)
      from public.log_position_entries l
     where l.atc_name = pl.atc_name
       and date(l.on_time at time zone 'Asia/Jakarta') =
           date(pl.on_time at time zone 'Asia/Jakarta');
  end if;
end$$;

-- 5) Helpful index for Section G queries --------------------------
-- The page filters by (branch_code, on_time::date) so a composite
-- expression index keeps the table scan in check on busy branches.
create index if not exists position_logs_branch_day_idx
  on public.position_logs (
    branch_code,
    ((on_time at time zone 'Asia/Jakarta')::date)
  );
