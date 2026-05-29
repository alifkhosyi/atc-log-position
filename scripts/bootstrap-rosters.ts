/**
 * scripts/bootstrap-rosters.ts
 *
 * One-time bootstrap script untuk seed roster DRAFT semua cabang ×
 * all expected unit × current month + N month ahead.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/bootstrap-rosters.ts
 *   npx tsx --env-file=.env.local scripts/bootstrap-rosters.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/bootstrap-rosters.ts --only=WARR,WAOO
 *   npx tsx --env-file=.env.local scripts/bootstrap-rosters.ts --months=2
 *
 * Flags:
 *   --months=N         number of months ahead beyond current (default: 1 =
 *                      current + 1 next; total 2 months processed)
 *   --dry-run          print actions tanpa actual insert
 *   --only=W1,W2       filter cabang specific (ICAO atau airport code), CSV
 *
 * Env (.env.local):
 *   SUPABASE_URL (or VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 *   Pakai Node 24 native --env-file flag — TIDAK perlu dotenv package.
 *
 * Behavior:
 *   - Idempotent: SELECT-first → kalau roster (airport_code, unit, year, month)
 *     sudah ada → SKIP (no overwrite of DRAFT/FINAL roster MO).
 *   - Dual-key detection: check both ICAO branch_code dan derived airport_code
 *     supaya tidak duplicate untuk cabang yang dulu MO insert pakai ICAO.
 *   - Resilient: error 1 cabang → log + lanjut next, no crash.
 *   - FK-safe: cabang dengan 0 real personnel di DB → SKIPPED_NO_PERSONNEL
 *     (TIDAK insert synthetic karena personnel_id FK ke personnel.id UUID;
 *     synthetic string id akan violate FK constraint).
 *
 * Mirror Legacy.tsx generation flow (line 425-461):
 *   1. Load personnel dari `personnel` table (filter branch_code + unit)
 *   2. Load leaves dari `atc_leaves` (filter month)
 *   3. Load prev month tail dari `atc_rosters.metadata.pattern_phase_at_eom`
 *   4. Load baseline dari `getBaselineForMonth`
 *   5. Call `generateRoster()` engine
 *   6. Insert atc_rosters row + bulk insert atc_roster_cells (chunk 500)
 *   7. Rollback (delete atc_rosters row) kalau cells insert fail mid-way
 */

import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

import {
  generateRoster,
} from "../src/lib/roster-engine/index.ts"
import {
  listAirports, getUnit, getBaselineForMonth,
} from "../src/lib/airport-data/index.ts"
import type {
  Personnel, LeaveRange, LeaveCategory,
} from "../src/lib/shared/index.ts"
import {
  leaveRangeFromDates,
} from "../src/lib/shared/index.ts"
import type { AirportConfig } from "../src/lib/airport-data/types.ts"

// ============================================================
// __dirname/__filename for ESM (not used directly but for completeness)
// ============================================================
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, "..")

// ============================================================
// CLI args parsing (minimal)
// ============================================================
const args = process.argv.slice(2)
const flagMonths = parseInt(
  args.find(a => a.startsWith("--months="))?.split("=")[1] || "1",
  10,
)
const flagDryRun = args.includes("--dry-run")
const flagOnly = args.find(a => a.startsWith("--only="))?.split("=")[1]
const onlyBranches = flagOnly
  ? new Set(flagOnly.split(",").map(s => s.trim().toUpperCase()))
  : null

// ============================================================
// Supabase service role client
// ============================================================
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Missing env vars in .env.local")
  console.error("   Required:")
  console.error("     SUPABASE_URL (or VITE_SUPABASE_URL)")
  console.error("     SUPABASE_SERVICE_ROLE_KEY (admin / service role)")
  console.error("")
  console.error("   Run with: npx tsx --env-file=.env.local scripts/bootstrap-rosters.ts")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ============================================================
// Types & helpers
// ============================================================

type BootstrapStatus =
  | "CREATED"
  | "SKIPPED_EXISTING"
  | "SKIPPED_NO_PERSONNEL"
  | "SKIPPED_NO_BASELINE"
  | "ERROR"

interface BootstrapResult {
  airport_code: string
  airport_name: string
  branch_code: string | null
  unit: string
  year: number
  month: number
  status: BootstrapStatus
  detail?: string
  mode?: string
  personnel_count?: number
}

function deriveDisplayInitial(name: string, fallback = "P"): string {
  if (!name) return fallback
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return fallback
  const a = words[0][0]?.toUpperCase() || ""
  const b = words[1]?.[0]?.toUpperCase() || ""
  return (a + b) || fallback
}

// ============================================================
// Bootstrap one (airport, unit, year, month)
// ============================================================

async function bootstrapOne(
  airport: AirportConfig,
  unitName: string,
  year: number,
  month: number,
): Promise<BootstrapResult> {
  const airportCode = airport.airport_code
  const branchCode = airport.branch_code || null
  const base: Omit<BootstrapResult, "status"> = {
    airport_code: airportCode,
    airport_name: airport.airport_name,
    branch_code: branchCode,
    unit: unitName, year, month,
  }

  // Dual-key set untuk idempotency check
  const candidateAirportCodes = [airportCode, branchCode].filter(Boolean) as string[]

  // STEP 1: Idempotent check — skip kalau sudah ada (regardless DRAFT/FINAL)
  const { data: existing, error: existingErr } = await supabase
    .from("atc_rosters")
    .select("id, status, airport_code")
    .in("airport_code", candidateAirportCodes)
    .eq("unit", unitName)
    .eq("year", year)
    .eq("month", month)
    .limit(1)
    .maybeSingle()

  if (existingErr) {
    return { ...base, status: "ERROR", detail: `idempotency check: ${existingErr.message}` }
  }
  if (existing) {
    return {
      ...base, status: "SKIPPED_EXISTING",
      detail: `id=${existing.id} status=${existing.status} key=${existing.airport_code}`,
    }
  }

  // STEP 2: Unit config + baseline
  const unitCfg = getUnit(airport, unitName)
  if (!unitCfg) {
    return { ...base, status: "ERROR", detail: `unit '${unitName}' not in airport config` }
  }
  const daysInMonth = new Date(year, month, 0).getDate()
  const baseline = getBaselineForMonth(airportCode, unitName, daysInMonth) || null

  // STEP 3: Load real personnel dari DB (filter branch + unit + active).
  // FK constraint: atc_roster_cells.personnel_id → personnel.id (UUID),
  // jadi kita TIDAK boleh insert synthetic non-UUID id.
  if (!branchCode) {
    return { ...base, status: "ERROR", detail: "no branch_code in airport config" }
  }
  const { data: dbPersonnelRaw, error: pErr } = await supabase
    .from("personnel")
    .select("id, name, unit, branch_code, is_active")
    .eq("branch_code", branchCode)
    .neq("is_active", false)

  if (pErr) {
    return { ...base, status: "ERROR", detail: `personnel query: ${pErr.message}` }
  }

  const filteredPersonnel = (dbPersonnelRaw || [])
    .filter((p: any) => !p.unit || p.unit === unitName)

  if (filteredPersonnel.length === 0) {
    return {
      ...base, status: "SKIPPED_NO_PERSONNEL",
      detail: `0 active personnel di DB untuk branch=${branchCode}/${unitName}. `
        + `MO perlu tambah personnel dulu lewat admin/seed migration.`,
    }
  }

  const personnel: Personnel[] = filteredPersonnel.map((p: any, i: number) => ({
    id: p.id as string,
    initial: deriveDisplayInitial(p.name || "", `P${i + 1}`),
    leaves: [],
    priorityOrder: i,
  }))

  // STEP 4: Load leaves dari atc_leaves untuk month, project ke LeaveRange
  const monthStartIso = `${year}-${String(month).padStart(2, "0")}-01`
  const monthEndIso = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`
  const { data: dbLeavesRaw, error: lvErr } = await supabase
    .from("atc_leaves")
    .select("personnel_id, start_date, end_date, category")
    .in("airport_code", candidateAirportCodes)
    .eq("unit", unitName)
    .lte("start_date", monthEndIso)
    .gte("end_date", monthStartIso)

  if (lvErr) {
    // Non-fatal — leaves optional. Log + continue dengan empty leaves.
    console.warn(`  [warn] leaves query for ${airportCode}/${unitName} ${year}-${month}: ${lvErr.message}`)
  }

  for (const lv of (dbLeavesRaw || []) as any[]) {
    const p = personnel.find(pp => pp.id === lv.personnel_id)
    if (!p) continue
    const projected: LeaveRange | null = leaveRangeFromDates(
      lv.start_date as string,
      lv.end_date as string,
      year, month,
      (lv.category as LeaveCategory) || "CUTI",
    )
    if (projected) p.leaves.push(projected)
  }

  // STEP 5: Prev month tail dari atc_rosters.metadata.pattern_phase_at_eom
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const { data: prevRow } = await supabase
    .from("atc_rosters")
    .select("metadata")
    .in("airport_code", candidateAirportCodes)
    .eq("unit", unitName)
    .eq("year", prevYear)
    .eq("month", prevMonth)
    .limit(1)
    .maybeSingle()
  const prevTail: Record<string, string[]> | null =
    (prevRow as any)?.metadata?.pattern_phase_at_eom || null

  // STEP 6: Run engine
  const result = generateRoster({
    year, month, personnel,
    requiredPerDay: unitCfg.min_on_duty_baseline ?? 3,
    isTni: unitCfg.is_tni ?? false,
    baselinePattern: baseline,
    prevMonthTail: prevTail,
  })

  if (!result.success) {
    return {
      ...base, status: "ERROR",
      detail: `engine: ${(result.errorMessage || "unknown").split("\n")[0].slice(0, 200)}`,
    }
  }

  if (flagDryRun) {
    return {
      ...base, status: "CREATED",
      mode: result.mode, personnel_count: personnel.length,
      detail: "DRY-RUN — would create",
    }
  }

  // STEP 7: Build phase metadata (last 7 days, for next-month tail seed)
  const tailLen = Math.min(7, result.daysInMonth)
  const phase: Record<string, string[]> = {}
  for (const [pid, cells] of Object.entries(result.roster)) {
    phase[pid] = cells.slice(-tailLen).map(c => c.status)
  }

  // STEP 8: Insert atc_rosters row
  const { data: rosterRow, error: insertErr } = await supabase
    .from("atc_rosters")
    .insert({
      airport_code: airportCode,  // engine-derived (KUPANG/SURABAYA/dst)
      unit: unitName,
      year, month,
      days_in_month: result.daysInMonth,
      status: "DRAFT",  // MO Mark FINAL manually
      mode: result.mode,
      required_per_day: result.requiredPerDay,
      is_tni: result.isTni,
      metadata: {
        pattern_phase_at_eom: phase,
        bootstrap: true,
        bootstrap_at: new Date().toISOString(),
      },
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertErr || !rosterRow) {
    return {
      ...base, status: "ERROR",
      detail: `insert atc_rosters: ${insertErr?.message || "unknown"}`,
    }
  }

  // STEP 9: Bulk insert cells (chunked 500), rollback on fail
  const cellsToInsert: Array<{
    roster_id: string
    personnel_id: string
    day: number
    status: string
    locked: boolean
  }> = []
  for (const [pid, cells] of Object.entries(result.roster)) {
    for (let i = 0; i < cells.length; i++) {
      cellsToInsert.push({
        roster_id: rosterRow.id,
        personnel_id: pid,
        day: i + 1,
        status: cells[i].status,
        locked: cells[i].locked,
      })
    }
  }
  for (let i = 0; i < cellsToInsert.length; i += 500) {
    const chunk = cellsToInsert.slice(i, i + 500)
    const { error: cellErr } = await supabase
      .from("atc_roster_cells")
      .insert(chunk)
    if (cellErr) {
      // Rollback atc_rosters row supaya tidak dangling
      await supabase.from("atc_rosters").delete().eq("id", rosterRow.id)
      return {
        ...base, status: "ERROR",
        detail: `insert atc_roster_cells chunk ${i}: ${cellErr.message}`,
      }
    }
  }

  return {
    ...base, status: "CREATED",
    mode: result.mode, personnel_count: personnel.length,
  }
}

// ============================================================
// Main runner
// ============================================================

async function main() {
  const startTs = Date.now()
  console.log("━".repeat(72))
  console.log("Bootstrap Rosters — Mass seed atc_rosters via service role")
  console.log("━".repeat(72))

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Build month list — current + N future
  const targetMonths: Array<{ year: number; month: number }> = []
  for (let i = 0; i <= flagMonths; i++) {
    const ym = new Date(currentYear, currentMonth - 1 + i, 1)
    targetMonths.push({ year: ym.getFullYear(), month: ym.getMonth() + 1 })
  }

  const airports = listAirports()
  const filteredAirports = onlyBranches
    ? airports.filter(a =>
      onlyBranches!.has(a.branch_code?.toUpperCase() || "")
      || onlyBranches!.has(a.airport_code.toUpperCase()))
    : airports

  if (onlyBranches && filteredAirports.length === 0) {
    console.error(`❌ --only=${flagOnly} tidak match cabang manapun di config.`)
    console.error("   Cek ICAO 4-letter atau airport_code (e.g. KUPANG).")
    process.exit(1)
  }

  console.log(`Mode:           ${flagDryRun ? "DRY-RUN (no DB write)" : "LIVE (insert ke Supabase)"}`)
  console.log(`Target months:  ${targetMonths.map(m => `${m.year}-${String(m.month).padStart(2, "0")}`).join(", ")}`)
  console.log(`Target airports: ${filteredAirports.length}${onlyBranches ? ` (filtered: --only=${flagOnly})` : ` (all)`}`)
  console.log(`Total iterations: ${filteredAirports.reduce((s, a) => s + a.units.length, 0) * targetMonths.length}`)
  console.log("━".repeat(72))

  const results: BootstrapResult[] = []
  let idx = 0
  const total = filteredAirports.reduce((s, a) => s + a.units.length, 0) * targetMonths.length

  for (const airport of filteredAirports) {
    for (const unitCfg of airport.units) {
      for (const ym of targetMonths) {
        idx++
        const tag = `${airport.airport_code}/${unitCfg.unit} ${ym.year}-${String(ym.month).padStart(2, "0")}`
        process.stdout.write(`[${idx}/${total}] ${tag} ... `)
        try {
          const r = await bootstrapOne(airport, unitCfg.unit, ym.year, ym.month)
          results.push(r)
          const icon: Record<BootstrapStatus, string> = {
            CREATED: "✓",
            SKIPPED_EXISTING: "⏭",
            SKIPPED_NO_PERSONNEL: "⚠",
            SKIPPED_NO_BASELINE: "⚠",
            ERROR: "✗",
          }
          const modeStr = r.mode ? ` (${r.mode})` : ""
          const countStr = r.personnel_count ? ` × ${r.personnel_count}p` : ""
          const detailStr = r.detail ? ` — ${r.detail}` : ""
          console.log(`${icon[r.status]} ${r.status}${modeStr}${countStr}${detailStr}`)
        } catch (e: any) {
          const r: BootstrapResult = {
            airport_code: airport.airport_code,
            airport_name: airport.airport_name,
            branch_code: airport.branch_code || null,
            unit: unitCfg.unit, year: ym.year, month: ym.month,
            status: "ERROR",
            detail: e?.message || String(e),
          }
          results.push(r)
          console.log(`✗ EXCEPTION — ${r.detail}`)
        }
      }
    }
  }

  // ============================================================
  // Summary
  // ============================================================
  const endTs = Date.now()
  console.log("")
  console.log("━".repeat(72))
  console.log(`Summary (${((endTs - startTs) / 1000).toFixed(1)}s)`)
  console.log("━".repeat(72))

  const counts: Record<string, number> = {}
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1
  console.log(`Total processed: ${results.length}`)
  for (const [status, count] of Object.entries(counts).sort()) {
    console.log(`  ${status.padEnd(24)} ${count}`)
  }

  const errors = results.filter(r => r.status === "ERROR")
  if (errors.length > 0) {
    console.log("\nErrors (need investigation):")
    for (const e of errors) {
      console.log(`  - ${e.airport_name} (${e.airport_code}) ${e.unit} ${e.year}-${String(e.month).padStart(2, "0")}:`)
      console.log(`      ${e.detail}`)
    }
  }

  const noPersonnel = results.filter(r => r.status === "SKIPPED_NO_PERSONNEL")
  if (noPersonnel.length > 0) {
    console.log("\nSkipped — no personnel di DB (need seed/onboard):")
    // Group by (airport, branch) untuk dedup yang sama beda month
    const byAirport = new Map<string, { airport: BootstrapResult; units: Set<string> }>()
    for (const r of noPersonnel) {
      const key = `${r.airport_name}|${r.branch_code}`
      if (!byAirport.has(key)) {
        byAirport.set(key, { airport: r, units: new Set() })
      }
      byAirport.get(key)!.units.add(r.unit)
    }
    for (const { airport, units } of byAirport.values()) {
      console.log(`  - ${airport.airport_name} (${airport.airport_code} / branch ${airport.branch_code}) — units: ${[...units].join(", ")}`)
    }
  }

  console.log("")
  if (flagDryRun) {
    console.log("DRY-RUN finished. No DB changes were made.")
  } else {
    console.log("Done.")
  }
  process.exit(errors.length > 0 ? 1 : 0)
}

main().catch(e => {
  console.error("Fatal error:", e?.stack || e)
  process.exit(1)
})
