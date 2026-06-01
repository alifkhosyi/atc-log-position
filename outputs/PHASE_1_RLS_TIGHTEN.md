# Phase 1 — Critical Security: Tighten RLS

**Date:** 2026-06-01
**Branch:** visual-redesign
**Target:** Close security gap di 3 tabel core roster.

---

## Files Changed
- `supabase/migrations/20260601_tighten_roster_rls.sql` — **new** (~310 lines, idempotent, reversible)

## Why Changed

Audit identifikasi 3 tabel core punya RLS permisif (`using (true) with check (true)`):
- `atc_leaves`
- `atc_rosters`
- `atc_roster_cells`

Risiko: MO Surabaya (branch_code WARR) bisa CRUD roster Kupang (WATT). User cross-branch attack vector via JS console / API call direct.

Fix: mirror pattern dual-key RLS yang sudah proven works di:
- `20260528_fix_overtime_rls.sql` (atc_overtime)
- `20260530_personnel_crud.sql` (personnel)

3 OR clauses per policy:
1. Admin role (full bypass)
2. Direct ICAO match (`airport_code = accounts.branch_code`)
3. Engine-derived match (`airport_code = upper(replace(branches.name, ' ', '_'))`)

Untuk `atc_roster_cells` (tidak punya `airport_code` column), scope via JOIN ke parent `atc_rosters.roster_id`.

## Before (DB state — assumed pre-migration)

```sql
-- atc_leaves
create policy "atc_leaves_all" on public.atc_leaves
  for all using (true) with check (true);

-- atc_rosters
create policy "atc_rosters_all" on public.atc_rosters
  for all using (true) with check (true);

-- atc_roster_cells
create policy "atc_roster_cells_all" on public.atc_roster_cells
  for all using (true) with check (true);
```

= 3 wildcard policies, zero scope enforcement.

## After (post-migration target state)

12 policies total (3 tables × 4 commands SELECT/INSERT/UPDATE/DELETE):

```
atc_leaves       | atc_leaves_delete        | DELETE
atc_leaves       | atc_leaves_insert        | INSERT
atc_leaves       | atc_leaves_read          | SELECT
atc_leaves       | atc_leaves_update        | UPDATE
atc_roster_cells | atc_roster_cells_delete  | DELETE
atc_roster_cells | atc_roster_cells_insert  | INSERT
atc_roster_cells | atc_roster_cells_read    | SELECT
atc_roster_cells | atc_roster_cells_update  | UPDATE
atc_rosters      | atc_rosters_delete       | DELETE
atc_rosters      | atc_rosters_insert       | INSERT
atc_rosters      | atc_rosters_read         | SELECT
atc_rosters      | atc_rosters_update       | UPDATE
```

Each scope: admin role OR own branch (ICAO direct OR engine-derived via branches join).

## Risks

| Risk | Mitigation |
|---|---|
| MO cabang yang dulu insert pakai ICAO (`WATT`) tetap bisa baca, MO yang dulu pakai derived (`KUPANG`) tetap bisa baca → dual-key clause handle | Verified pattern di 2 migration sebelumnya, sudah live di prod |
| Bootstrap script run pakai service_role bypass RLS — tidak terganggu | service_role implicit bypass, RLS hanya enforce ke authenticated role |
| Performance — extra JOIN per query | Negligible: branches table kecil (~73 rows), accounts query pakai PK lookup, indexes ada |
| Cabang yang ada di personnel table tapi tidak ada di airport-configs / branches → no scope match | Defensive: legacy policies still drop, jadi tidak bocor. Admin role bypass remains |
| Roster lama di Surabaya broken karena airport_code = "SURABAYA" (derived) tapi user accounts.branch_code = WARR → OR clause 3 (engine-derived join) WAJIB match | Verified Surabaya `branches.name = 'Surabaya'` → `upper(replace())` → `SURABAYA` ✓ |
| atc_roster_cells subquery per row di big roster (33 personnel × 31 days = 1023 cells) | PostgreSQL query planner cache the EXISTS subquery; modern Postgres handles well. Worst case: add covering index `(roster_id)` di atc_roster_cells (already FK indexed via PK constraint) |
| Apply migration di Supabase Dashboard — user execute manual | Migration tulis idempotent (drop policy if exists). Reversible via DOWN section di bottom (commented out by default) |

## Verification

### Code-side (Claude Code can verify)
- ✅ Migration file syntactically valid SQL
- ✅ `npm run build`: **clean** (552ms — incremental, no code change)
- ✅ E2E 1-shift: **124/132 PASS** (identik baseline)
- ✅ E2E 2-shift: **68/72 PASS** (identik baseline)
- ✅ E2E multi-shift TMA: **104/104 PASS** (identik baseline)
- ✅ Total: **296/308 PASS (96.1%)** — zero regression (engine untouched)
- ✅ Bootstrap dry-run smoke OK (filter + iteration + error catch work)
- ✅ No source code edited — pure DB migration

### User-side (Cowork harus apply manual)
- [ ] **APPLY MIGRATION** via Supabase Dashboard SQL Editor (copy isi `supabase/migrations/20260601_tighten_roster_rls.sql`, execute)
- [ ] Verify 12 policies aktif (SQL inline di footer migration)
- [ ] Smoke test sebagai MO Surabaya:
  - [ ] Login MO Surabaya → Roster ATC TWR → roster muncul (read OK)
  - [ ] Off-Roster Surabaya → tambah leave → save OK
  - [ ] Roster ATC Surabaya → swap shift → save OK
  - [ ] Try query cabang lain via DevTools console (`supabase.from('atc_rosters').select('*').eq('airport_code', 'KUPANG')`) → expected: 0 rows (RLS reject)
- [ ] Smoke test sebagai admin INMC:
  - [ ] Dashboard INMC tampilkan SEMUA cabang status roster (admin role bypass)
  - [ ] Klik cabang manapun → SidePanel tab Roster → data muncul

## Test Result

E2E 3 suites — **296/308 PASS** (identik baseline pre-Phase-0):
```
1-shift:        124/132 PASS (93.9%)  ← no regression
2-shift:         68/72  PASS (94.4%)  ← no regression
multi-shift TMA: 104/104 PASS (100%)  ← no regression
```

Build:
```
dist/index.html                     0.46 kB
dist/assets/index-B-ZdnXQR.css    168.57 kB
dist/assets/index-*.js          1,145.81 kB │ gzip: 244.74 kB
✓ built in 552ms (incremental)
```

## Remaining Issues

**Migration BELUM diapply** (per brief: user run manual via Supabase Dashboard).

User decision needed:
1. **Timing:** Apply now sebelum lanjut Phase 2-13, atau apply nanti? Brief mandate apply DULU before commit code (Checkpoint 1 explicit).
2. **Pre-apply verification:** Saran run pre-flight SQL untuk capture current policy state sebelum DROP:
   ```sql
   select tablename, policyname, qual::text, with_check::text
   from pg_policies
   where tablename in ('atc_leaves', 'atc_rosters', 'atc_roster_cells')
   order by tablename, policyname;
   ```
   Screenshot/save output → rollback reference kalau bermasalah.
3. **Test sequence after apply:**
   - Verify 12 policies (post-apply SQL footer migration)
   - Smoke MO Surabaya (read own ✓, read cross-branch ✗)
   - Smoke admin (read all ✓)
   - Re-run bootstrap script (service_role bypass, should still work)

## Commits

- **Pending** — not committed yet. Sesuai brief Phase 1 verification: "Migration file created (TIDAK auto-apply — user run manual)" → migration file ready, commit setelah user OK + applied verified.

Saran commit message kalau user OK push:
```
fix(rls): tighten atc_leaves + atc_rosters + atc_roster_cells (dual-key)

Close security gap — 3 tabel core sebelumnya pakai policy
`using (true) with check (true)` (siapapun login bisa CRUD lintas cabang).

Migration baru pakai pattern dual-key dari 20260528_fix_overtime_rls.sql:
  - admin role bypass
  - ICAO direct match (airport_code = accounts.branch_code)
  - engine-derived match via branches.name join

atc_roster_cells (no airport_code column) scope via JOIN parent atc_rosters.

12 policies total (3 tables × 4 commands). Idempotent (drop if exists).
Reversible via DOWN section di footer (commented, manual revert).

VERIFICATION (user-side):
  - Apply via Supabase Dashboard SQL Editor manual
  - Smoke MO Surabaya/Kupang/dst — cross-branch read should return 0
  - admin role unaffected (bypass)
  - Bootstrap script service_role bypass — no change

NO source code modified. E2E 296/308 PASS identik baseline.
```

---

## 🛑 CHECKPOINT 1 — STOP

Per brief §3:
> Phase 1 verification ... Report ke Cowork: migration siap, user perlu apply via Supabase Dashboard, JANGAN push code sampai migration applied.
>
> 🛑 CHECKPOINT 1 — STOP, tunggu user konfirmasi migration applied + verified sebelum lanjut Phase 2.

**Status:**
- ✅ Phase 0 deliverable: `outputs/PHASE_0_DEPENDENCY_MAP.md`
- ✅ Phase 1 deliverable: `supabase/migrations/20260601_tighten_roster_rls.sql` + this report
- ⏸ **Waiting for user action:** apply migration via Supabase Dashboard
- ⏸ **Then user say "ok lanjut" / "lanjut Phase 2"** untuk continue

**Tidak akan lanjut tanpa konfirmasi explicit.**

---

*End of Phase 1 report.*
