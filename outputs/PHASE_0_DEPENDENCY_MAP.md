# Phase 0 — Dependency Map (no code change)

**Date:** 2026-06-01
**Branch:** visual-redesign
**HEAD:** ba3ebfe (pre-Phase-0 baseline)
**E2E baseline:** 296/308 PASS (124/132 + 68/72 + 104/104) — confirmed pre-Phase-0

Scope: audit-only, basis untuk Phases 1-13. Tidak ada code change.

---

## A. File inventory

| Layer | Count | Notes |
|---|---:|---|
| Total .{ts,tsx,js,jsx} di src/ | 91 | |
| Top-level src/ files | 12 | Mix of god components + dead duplicates |
| src/pages/ | 21 | 4 god components > 700 LOC |
| src/lib/ engine layer | 30 | 6 test files + 24 source (mature, 308 E2E) |
| src/hooks/ | 6 | 2 dengan own subscription/polling |
| src/components/ | 18 | Mix UI primitives + DailyReport/Dashboard sub-components |

### Top-level src/ files (suspicious cluster)

| File | LOC | Importers | Status |
|---|---:|---:|---|
| `02_DailyReport.jsx` | 1045 | **0** | ❌ DEAD (Phase 2 delete) |
| `03_Reports.jsx` | 45 | **0** | ❌ DEAD (Phase 2 delete) |
| `06_AdminReportMonitoring.jsx` | 375 | **0** | ❌ DEAD (Phase 2 delete) |
| `Toast.jsx` (root) | 69 | **0** | ❌ DEAD (Phase 2 delete) — `SectionG.jsx ../Toast.jsx` resolves ke `components/Toast.jsx` |
| `ConfirmDialog.jsx` (root) | 75 | **0** | ❌ DEAD (Phase 2 delete) |
| `DailyReport.jsx` | 851 | 1 (`Reports.jsx`) | ✅ LIVE (god component, Phase 12 decompose) |
| `MonthlyReport.jsx` | ~700 | 1 (`Reports.jsx`) | ✅ LIVE |
| `Reports.jsx` | ~30 | 1 (`App.jsx:46`) | ✅ LIVE (thin wrapper) |
| `AdminReportMonitoring.jsx` | 939 | 1 (`App.jsx:47`) | ✅ LIVE (god component, Phase 12 decompose) |
| `App.jsx` | ~120 | entry | ✅ LIVE |
| `main.jsx` | small | entry | ✅ LIVE |
| `supabase.js` | small | many | ✅ LIVE |

### src/pages/cabang dead candidate

| File | LOC | Importers | Status |
|---|---:|---:|---|
| `cabang/LogPosition.jsx` | 844 | **0** | ❌ DEAD (Phase 2 delete) — routed via `LogPositionRedirect` stub in App.jsx |

**Total dead LOC verified:** 1045 + 45 + 375 + 69 + 75 + 844 = **2,453 LOC** (matches brief estimate ~2,400)

---

## B. App.jsx route registry → file map

### PAGES_CABANG (line 57-68 di App.jsx)

| Route key | Component | Resolves to |
|---|---|---|
| `dashboard` | CabangDash | `src/pages/cabang/Dashboard.jsx` ✓ |
| `log` | LogPositionRedirect | **stub in App.jsx:29-33** (Phase 2 remove) |
| `rekap_personnel` | CabangRekapPersonnel | `src/pages/cabang/RekapPersonnel.jsx` ✓ |
| `rekap` | CabangRekap | `src/pages/cabang/RekapTraffic.jsx` ✓ |
| `handover` | CabangHandover | `src/pages/cabang/Handover.jsx` ✓ |
| `ho_to_mo` | CabangHoToMo | `src/pages/cabang/HoToMo.jsx` ✓ |
| `reports` | Reports | `src/Reports.jsx` → `DailyReport.jsx` + `MonthlyReport.jsx` ✓ |
| `roster` | RosterPage | `src/pages/RosterPage/index.tsx` ✓ |
| `tunjangan` | TunjanganPage | `src/pages/TunjanganPage.tsx` ✓ |
| `rolling` | RollingPage | `src/pages/RollingPage.tsx` ✓ |
| `personnel` | PersonnelPage | `src/pages/PersonnelPage.tsx` ✓ (BARU, commit `8c0bdc7`) |

### PAGES_ADMIN (line 69-83 di App.jsx)

| Route key | Component | Resolves to |
|---|---|---|
| `dashboard` | AdminDash | `src/pages/admin/Dashboard.jsx` ✓ (969 LOC, Phase 12 decompose) |
| `mon_log` | AdminMonLog | `src/pages/admin/MonLog.jsx` ✓ |
| `mon_recap` | AdminMonRecap | `src/pages/admin/MonRecap.jsx` ✓ |
| `mon_personnel` | AdminMonPersonnel | `src/pages/admin/MonPersonnel.jsx` ✓ (Phase 6 merge to PersonnelHub) |
| `personnel` | PersonnelPage | `src/pages/PersonnelPage.tsx` ✓ (Phase 6 merge to PersonnelHub) |
| `mon_handover` | AdminMonHandover | `src/pages/admin/MonHandover.jsx` ✓ |
| `mon_ho_to_mo` | AdminMonHoToMo | `src/pages/admin/MonHoToMo.jsx` ✓ |
| `mon_reports` | AdminReportMonitoring | `src/AdminReportMonitoring.jsx` ✓ (939 LOC, Phase 12) |
| `export` | AdminExport | `src/pages/admin/Export.jsx` ✓ (925 LOC, Phase 12) |
| `audit` | AdminAudit | `src/pages/admin/Audit.jsx` ✓ |
| `roster`, `tunjangan`, `rolling` | shared | ✓ |

**Total route entries:** 11 cabang + 13 admin = 24. Semua resolve ke file existing.

---

## C. Sidebar menu structure (src/components/Sidebar.jsx)

### ADMIN (line 31-64)

```
Monitoring:
  - dashboard         → "Dashboard INMC"
  - mon_log           → "Log Position"
  - mon_recap         → "Rekap Traffic"
  - personnel         → "Pengaturan Personel"   ← Phase 6 merge
  - mon_personnel     → "Statistik Personel"    ← Phase 6 merge
  - mon_handover      → "Handover"
  - mon_ho_to_mo      → "HO/TO MO"

Penjadwalan:
  - roster            → "Roster ATC"
  - tunjangan         → "Tunjangan ATC"
  - rolling           → "Rolling Harian"

Reports:
  - mon_reports       → "Daily Reports"

Tools:
  - export            → "Export"
  - audit             → "Audit Log"
```

### MO/CABANG (line 65-92)

```
Operasional:
  - dashboard         → "Dashboard"
  - handover          → "Handover/Takeover"
  - ho_to_mo          → "HO/TO MO"
  - personnel         → "Personel"
  - rekap_personnel   → "Rekap Personnel"       ← Phase 6 rename "Rekap Personel · Bulanan"
  - rekap             → "Rekap Traffic"         ← Phase 6 rename "Rekap Traffic · Bulanan"

Penjadwalan:
  - roster            → "Roster ATC" (badge: off_roster + overtime count)
  - tunjangan         → "Tunjangan ATC"
  - rolling           → "Rolling Harian"

Laporan:
  - reports           → "Report" (badge: pending count)  ← Phase 6 rename "Daily Report"
```

**Status:** All sidebar IDs match route registry. No orphan menu items.

---

## D. Context state shape (src/lib/context.jsx)

### useState declarations (15 total)

| Line | Field | Initial | Notes |
|---:|---|---|---|
| 22 | session | null | Supabase auth session |
| 23 | user | null | accounts row |
| 24 | loading | true | initial profile fetch state |
| 27 | page | "dashboard" | current route |
| 28 | col | false | sidebar collapsed |
| 29 | navBranch | null | dashboard → mon_log handoff |
| 34 | **logRedirectFlag** | false | **DEAD STATE** (Phase 2 remove) |
| 47 | globalBranch | localStorage \|\| "ALL" | persistent filter |
| 58 | branches | [] | static reference data |
| 59 | sectors | [] | static reference data |
| 60 | personnel | [] | static-ish (paginated load 1000/batch) |
| 61 | moBranchCodes | [] | computed once on login |
| 64 | logs | [] | **dynamic, limit 500** ← Phase 5 fix |
| 65 | handovers | [] | dynamic |
| 66 | handoverChecklists | [] | dynamic |

### useEffect blocks (3)

| Line | Deps | Purpose |
|---:|---|---|
| 77-82 | `[loadProfile]` | Initial session check → loadProfile |
| 134-151 | `[user, loadStaticData, loadDynamicData]` | Realtime subscribe + **120s polling** ← Phase 5 fix |

### Suspicious patterns

| Issue | Location | Phase fix |
|---|---|---|
| **Provider value NOT memoized** | line 168-179 | Phase 5 — wrap in useMemo |
| **120s setInterval polling** | line 145: `setInterval(loadDynamicData, 120000)` | Phase 5 — drop, keep realtime only |
| **`.limit(500)` silent truncation** | line 118: `position_logs.select().limit(500)` | Phase 5 — replace dengan 7-day window |
| **`logRedirectFlag` dead state** | line 34, 35-42 (goPage intercept) | Phase 2 — remove with LogPosition deletion |

### Realtime channels (1 active, in context.jsx)

- Line 139: `supabase.channel("db-changes")` → 3 postgres_changes listeners:
  - `position_logs` event `*` → loadDynamicData
  - `handover_notes` event `*` → loadDynamicData
  - `handover_checklists` event `*` → loadDynamicData

### Additional channels (in sub-components)

- `src/components/DailyReport/SectionG.jsx:111` — channel per branch+date combination. **Risk:** no `removeChannel()` cleanup di unmount → potential leak saat user switch branches rapidly. (Phase 5 sub-task / atau defer to known-issues)

---

## E. Supabase usage matrix (top 30)

| File | Line | Table | Operation |
|---|---:|---|---|
| `context.jsx` | 70 | accounts | select (single) |
| `context.jsx` | 88 | personnel | select + range paginate (1000/batch) |
| `context.jsx` | 102 | branches | select |
| `context.jsx` | 103 | sectors | select |
| `context.jsx` | 106 | accounts | select (like 'mo_%') |
| `context.jsx` | 118 | position_logs | select **limit(500)** |
| `context.jsx` | 119 | handover_notes | select limit(200) |
| `context.jsx` | 120 | handover_checklists | select limit(200) |
| `utils.js` | 47 | audit_logs | insert |
| `DailyReport.jsx` | 162-291 | 8 tables | select/insert/update/delete (god component) |
| `MonthlyReport.jsx` | 44-47 | 4 tables | select (nested) |
| `AdminReportMonitoring.jsx` | 480, 704-706 | branches + daily_reports + position_logs + handover_checklists | select |
| `RosterPage/Legacy.tsx` | 296, 315, 350, 400, 431, 446, 460, 547, 553, 568 | atc_rosters + atc_roster_cells | full CRUD |
| `TunjanganPage.tsx` | 247-251 | atc_roster_cells | select (post split-query fix) |
| `OffRosterTab.tsx` | ~205 | atc_leaves | full CRUD |
| `OvertimeTab.tsx` | ~205 | atc_overtime | full CRUD |
| `PersonnelPage.tsx` | 113, 235-242 | personnel | select/insert/update |
| `useScheduledTodayPersonnel.ts` | ~150, 167 | atc_rosters + atc_roster_cells + personnel | select (split query post-fix) |
| `useAllRosterStatusByBranch.ts` | ~110 | atc_rosters | batch select |
| `MonHoToMo.jsx` | 50 | mo_checklists | select |
| `cabang/HoToMo.jsx` | 87, 127 | mo_checklists | select + insert |

---

## F. Custom hooks audit

| File | Hook | Subscription? | Polling? | Notes |
|---|---|:---:|:---:|---|
| `useMonthLock.js` | useMonthLock | ❌ | ❌ | Pure compute |
| `usePendingSessions.js` | usePendingSessions | ✅ (position_logs) | ❌ | **Duplicate** of context subscription — Phase 5 simplify to consume ctx.logs |
| `useOffRosterCount.js` | useOffRosterCount | ❌ | ✅ (60s) | Badge counter |
| `useOvertimeCount.js` | useOvertimeCount | ❌ | ✅ (60s) | Badge counter |
| `useAllRosterStatusByBranch.ts` | useAllRosterStatusByBranch | ❌ | ❌ | Single batch query |
| `useScheduledTodayPersonnel.ts` | useScheduledTodayPersonnel + helpers | ❌ | ❌ | Per-branch fetch |

**Phase 5 finding:** `usePendingSessions` subscribes `position_logs` separately walaupun context sudah subscribe yang sama → duplicate channel. Simplify ke `useMemo(() => logs.filter(...), [logs, branchCode])`.

---

## G. Migrations history

| File | Purpose |
|---|---|
| `20260526_section_g.sql` | Add position_logs columns (DEP/ARR/OVF counts) |
| `20260527_overtime.sql` | Create atc_overtime + initial RLS branch-scoped |
| `20260527_personnel_unit.sql` | Add personnel.unit column + index |
| `20260528_fix_overtime_rls.sql` | Fix atc_overtime RLS dual-key (ICAO + derived) |
| `20260528_seed_personnel_unit.sql` | Bulk seed personnel.unit per cabang |
| `20260530_personnel_crud.sql` | Add personnel.priority_order + nik + 4 RLS policies |

**Phase 1 target:** `20260601_tighten_roster_rls.sql` — tighten `atc_leaves`, `atc_rosters`, `atc_roster_cells` (currently permissive).

---

## H. CSS inventory

| File | LOC | Notes |
|---|---:|---|
| `src/index.css` | **2,859** | God CSS file — Phase 9 split |
| `src/styles/dashboard.css` | 713 | Per-page CSS |
| `src/styles/login-clean.css` | 535 | |
| `src/styles/rolling.css` | 403 | |
| `src/styles/section-g.css` | 363 | |
| `src/styles/tunjangan.css` | 351 | |
| `src/App.css` | 184 | |
| `src/styles/a11y-focus.css` | 69 | |
| `src/styles/roster-tokens.css` | 58 | Phase 9 token starter |
| `src/pages/RosterPage/roster-shell.css` | ~400 | OR design system classes |

**Total CSS:** ~6,000 LOC across 10 files.

---

## I. Emoji audit (corrected)

**Brief stated 134; actual count via grep di src/**/*.{jsx,tsx}: **66 occurrences across 9 files.**

Breakdown:
- ⚠ (13) — alert/warning indicators
- 📋 (7) — checklist
- ✏ (6) — edit action
- ✈ (6) — aircraft icon
- 📡 (5) — communication
- 📊 (5) — chart indicator
- 🌐 (4) — global/general
- 🗑 (3) — delete action
- ⚠️ (3) — alert variant
- ✅ (3) — success
- ⤴ (2), ⤵ (2), ➕ (2), ⛈ (2), 🚫 (2) — misc
- ❌ (1)

**Files affected (9):**
- `MonthlyReport.jsx`, `DailyReport.jsx`, `AdminReportMonitoring.jsx` (root god components)
- `pages/admin/Dashboard.jsx`, `pages/cabang/Dashboard.jsx`
- `pages/RosterPage/OffRosterTab.tsx`, `pages/RosterPage/OvertimeTab.tsx`
- `pages/PersonnelPage.tsx`
- `components/Dashboard/PositionCard.jsx`

**Note:** Brief estimated 134 might have included .md/.css/migration files. Phase 10 actual scope: 66 occurrences, 9 files. Still worth-doing (consistency + icon component), but smaller than briefed.

---

## J. Duplications confirmed (Phase 4 targets)

### `deriveDisplayInitial`-like function
| File | Location |
|---|---|
| `pages/TunjanganPage.tsx` | line ~89 |
| `pages/RosterPage/OffRosterTab.tsx` | line ~51 |
| `pages/RosterPage/Legacy.tsx` | line ~65 |
| `pages/RosterPage/OvertimeTab.tsx` | line ~65 |
| `pages/RollingPage.tsx` | line ~66 |
| `pages/PersonnelPage.tsx` | line ~60 |
| `hooks/useScheduledTodayPersonnel.ts` | line ~238 (variant `deriveInitial`) |
| `scripts/bootstrap-rosters.ts` | line ~100 |

= **8 callsites** (brief says 8 — matches)

### `useResolvedAirport`-like hook
| File | Location |
|---|---|
| `pages/RosterPage/OffRosterTab.tsx` | line ~93 |
| `pages/RosterPage/OvertimeTab.tsx` | line ~103 |
| `pages/RollingPage.tsx` | line ~95 |

= **3 callsites** (brief says 3 — matches)

### Toast / ConfirmDialog root files
= **already covered by Phase 2 dead-code deletion**

---

## K. FINDINGS — actionable surprises

1. **Brief LOC estimates accurate** — 2,453 LOC dead code matches brief's ~2,400.
2. **Brief emoji count overstated** — 66 actual vs 134 estimate (half). Phase 10 scope smaller.
3. **SectionG channel leak risk** — `components/DailyReport/SectionG.jsx:111` create channel without cleanup. Worth tracking di Phase 5 follow-up atau Phase 13 audit.
4. **`usePendingSessions` duplicate subscription** — already in context, hook re-subscribes. Phase 5 simplify confirmed.
5. **Engine layer mature** — 30 files, 6 test files (296/308 PASS). Touch ZERO di Phases 0-11. Phase 12 PR untuk consumer decomposition, BUKAN engine itself.
6. **Migration history clean** — 6 migration files, dual-key RLS pattern stable sejak `20260528_fix_overtime_rls.sql`. Phase 1 mirror pattern.
7. **CSS god file confirmed** — index.css 2,859 LOC. Phase 9 split-by-domain candidate.
8. **Top-level `src/` file pollution** — campuran live + dead (DailyReport.jsx LIVE, 02_DailyReport.jsx DEAD). Risk salah-delete. Phase 2 hapus berdasarkan importer verification (NOT filename pattern).

---

## L. Phase 1 prerequisites verified

- ✅ `branches` table exists dan punya `code` + `name` columns (verified via src/AdminReportMonitoring.jsx:480)
- ✅ `accounts` table has `role` + `branch_code` (verified via context.jsx:70-71)
- ✅ Dual-key RLS pattern proven works (commits `6cd4345`, `6f60658`)
- ✅ `atc_roster_cells.roster_id` FK to atc_rosters confirmed (schema in Legacy.tsx insert)
- ✅ E2E suite 296/308 PASS baseline confirmed

**READY untuk Phase 1.**

---

*End of Phase 0 dependency map. Total scope verified. No code change made.*
