/**
 * scripts/test-2shift-e2e.ts
 *
 * Engine-level E2E test untuk 18 cabang 2-shift × 4 skenario.
 *
 * Continuation of scripts/test-1shift-e2e.ts — extend ke 2-shift cabang.
 *
 * Hipotesis: Engine 2-shift sudah handle partial leave via MULTI-SHIFT
 * path (generator.ts line ~341-362). Test ini verify hipotesis.
 *
 * Tujuan additional check:
 *   - Verify mode='baseline-multishift' (bukan 'baseline' atau 'greedy')
 *   - Verify roster output contains 'II' tokens (not just 'I')
 *
 * Jalankan:
 *   npx tsx scripts/test-2shift-e2e.ts
 *
 * Output:
 *   - stdout: per-cabang log
 *   - outputs/E2E_TEST_RAW_LOG_2SHIFT.txt
 *   - outputs/E2E_TEST_RAW_RESULTS_2SHIFT.json
 *   - outputs/E2E_TEST_REPORT_2SHIFT.md
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"

import {
  generateRoster,
} from "../src/lib/roster-engine/index.ts"
import {
  computeMonthlyRolling,
} from "../src/lib/rolling-engine/index.ts"
import {
  computeAllowanceTable,
} from "../src/lib/ca-engine/index.ts"
import {
  getAirport, getUnit, getBaselineForMonth, getCAConstant,
} from "../src/lib/airport-data/index.ts"
import { leaveRangeFromDates } from "../src/lib/shared/index.ts"

// ============================================================
// CONFIG
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = path.resolve(__dirname, "..")
const OUTPUTS_DIR = path.join(ROOT, "outputs")

if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR, { recursive: true })

const YEAR = 2026
const MONTH = 5
const DAYS_IN_MONTH = 31

interface CabangSpec {
  name: string
  icao: string
  expected_n: number
  category: "single-unit" | "multi-unit"
}

const CABANG_2SHIFT: CabangSpec[] = [
  // Single-unit 2-shift (11 cabang)
  { name: "Aceh",            icao: "WITT", expected_n: 11, category: "single-unit" },
  { name: "Bandung",         icao: "WICC", expected_n: 7,  category: "single-unit" },
  { name: "Jambi",           icao: "WIJJ", expected_n: 8,  category: "single-unit" },
  { name: "Kertajati",       icao: "WICA", expected_n: 9,  category: "single-unit" },
  { name: "Labuan Bajo",     icao: "WATO", expected_n: 8,  category: "single-unit" },
  { name: "Lampung",         icao: "WILL", expected_n: 10, category: "single-unit" },
  { name: "Pangkal Pinang",  icao: "WIKK", expected_n: 9,  category: "single-unit" },
  { name: "Palangkaraya",    icao: "WAGG", expected_n: 9,  category: "single-unit" },
  { name: "Palu",            icao: "WAFF", expected_n: 9,  category: "single-unit" },
  { name: "Tarakan",         icao: "WAQQ", expected_n: 16, category: "single-unit" },
  { name: "Ternate",         icao: "WAEE", expected_n: 10, category: "single-unit" },
  // Multi-unit 2-shift — test TWR only (7 cabang)
  { name: "Banjarmasin",     icao: "WAOO", expected_n: 9,  category: "multi-unit" },
  { name: "Kendari",         icao: "WAWW", expected_n: 9,  category: "multi-unit" },
  { name: "Kupang",          icao: "WATT", expected_n: 10, category: "multi-unit" },
  { name: "Lombok",          icao: "WADL", expected_n: 15, category: "multi-unit" },
  { name: "Padang",          icao: "WIEE", expected_n: 12, category: "multi-unit" },
  { name: "Semarang",        icao: "WAHS", expected_n: 9,  category: "multi-unit" },
  { name: "Sorong",          icao: "WASS", expected_n: 10, category: "multi-unit" },
]

// ============================================================
// LOGGING
// ============================================================

const LOG_PATH = path.join(OUTPUTS_DIR, "E2E_TEST_RAW_LOG_2SHIFT.txt")
const logFd = fs.openSync(LOG_PATH, "w")
function log(msg: string) {
  process.stdout.write(msg + "\n")
  fs.writeSync(logFd, msg + "\n")
}

// ============================================================
// TYPES
// ============================================================

interface RosterChecks {
  success: boolean
  mode: string
  error: string | null
  n_cells_total: number
  // 2-shift specific: distribution of all shift tokens
  shift_distribution: Record<string, number>
  has_shift_ii: boolean
  has_shift_iii: boolean
  has_shift_iv: boolean
  has_shift_v: boolean
  is_multishift_mode: boolean
}

interface RollingChecks {
  has_rolling_config: boolean
  shift_start_utc: string | null
  n_slots: number | null
  n_personnel_expected: number | null
  days_with_rolling: number
  days_skipped: number
  sample_day?: number
  sample_on_duty?: string[]
  sample_n_slots?: number
  error?: string
}

interface CaChecks {
  has_ca_constant: boolean
  is_tma: boolean
  constant_per_hour: number
  n_rows: number
  total_kontrol_hours: number
  total_advance_hours: number
  total_extend_hours: number
  total_hours_all: number
  total_allowance_rp: number
  warnings: string[]
  error: string | null
}

interface ScenarioResult {
  cabang: string
  icao: string
  category: string
  scenario: string
  status: "PASS" | "FAIL"
  issues: string[]
  duration_ms: number
  roster: RosterChecks
  rolling: RollingChecks
  ca: CaChecks
  config_mismatch?: { expected: number, actual: number } | null
}

// ============================================================
// SCENARIO RUNNER
// ============================================================

interface ScenarioOpts {
  cuti: boolean
  overtime: Array<{ idx: number, type: "ADVANCE" | "EXTEND", duration_min: number }>
}

function runScenario(cabang: CabangSpec, scenarioName: string, opts: ScenarioOpts): ScenarioResult {
  const t0 = Date.now()
  const out: ScenarioResult = {
    cabang: cabang.name,
    icao: cabang.icao,
    category: cabang.category,
    scenario: scenarioName,
    status: "PASS",
    issues: [],
    duration_ms: 0,
    roster: {
      success: false,
      mode: "",
      error: null,
      n_cells_total: 0,
      shift_distribution: {},
      has_shift_ii: false,
      has_shift_iii: false,
      has_shift_iv: false,
      has_shift_v: false,
      is_multishift_mode: false,
    },
    rolling: {
      has_rolling_config: false,
      shift_start_utc: null,
      n_slots: null,
      n_personnel_expected: null,
      days_with_rolling: 0,
      days_skipped: 0,
    },
    ca: {
      has_ca_constant: false,
      is_tma: false,
      constant_per_hour: 0,
      n_rows: 0,
      total_kontrol_hours: 0,
      total_advance_hours: 0,
      total_extend_hours: 0,
      total_hours_all: 0,
      total_allowance_rp: 0,
      warnings: [],
      error: null,
    },
    config_mismatch: null,
  }

  try {
    const ap = getAirport(cabang.icao)
    if (!ap) {
      out.issues.push(`AIRPORT_NOT_FOUND in config (ICAO ${cabang.icao})`)
      out.status = "FAIL"
      out.duration_ms = Date.now() - t0
      return out
    }

    const twrUnit = getUnit(ap, "TWR")
    if (!twrUnit) {
      out.issues.push("UNIT_TWR_NOT_FOUND")
      out.status = "FAIL"
      out.duration_ms = Date.now() - t0
      return out
    }

    if (twrUnit.n_personnel !== cabang.expected_n) {
      out.config_mismatch = { expected: cabang.expected_n, actual: twrUnit.n_personnel }
    }

    // ===== Build personnel =====
    const initials = twrUnit.initials && twrUnit.initials.length > 0
      ? twrUnit.initials.slice(0, twrUnit.n_personnel)
      : Array.from({ length: twrUnit.n_personnel }, (_, i) => `P${i + 1}`)

    const leavesByIdx: Record<number, any[]> = {}
    if (opts.cuti) {
      const cutiRange = leaveRangeFromDates(
        `${YEAR}-${String(MONTH).padStart(2, "0")}-10`,
        `${YEAR}-${String(MONTH).padStart(2, "0")}-16`,
        YEAR, MONTH, "CUTI",
      )
      leavesByIdx[0] = cutiRange ? [cutiRange] : []
    }

    const personnel = initials.map((initial, idx) => ({
      id: `P${idx + 1}`,
      initial,
      leaves: (leavesByIdx[idx] || []).filter(Boolean) as any,
      priorityOrder: idx,
    }))

    const baseline = getBaselineForMonth(ap.airport_code, "TWR", DAYS_IN_MONTH)

    // ===== Roster generation =====
    let rosterResult: any
    try {
      rosterResult = generateRoster({
        year: YEAR,
        month: MONTH,
        personnel,
        baselinePattern: baseline,
        isTni: twrUnit.is_tni ?? false,
      })
      out.roster.success = !!rosterResult.success
      out.roster.mode = rosterResult.mode || ""
      out.roster.error = rosterResult.errorMessage || null
      out.roster.is_multishift_mode = rosterResult.mode === "baseline-multishift"
    } catch (e: any) {
      out.roster.success = false
      out.roster.error = `EXCEPTION: ${e?.message || String(e)}`
      out.issues.push(`ROSTER_EXCEPTION: ${e?.message || String(e)}`)
      rosterResult = null
    }

    if (rosterResult && rosterResult.success) {
      const dist = out.roster.shift_distribution
      for (const pid of Object.keys(rosterResult.roster)) {
        for (const cell of rosterResult.roster[pid]) {
          out.roster.n_cells_total++
          const s = cell.status as string
          dist[s] = (dist[s] || 0) + 1
        }
      }
      out.roster.has_shift_ii  = (dist["II"]  || 0) > 0
      out.roster.has_shift_iii = (dist["III"] || 0) > 0
      out.roster.has_shift_iv  = (dist["IV"]  || 0) > 0
      out.roster.has_shift_v   = (dist["V"]   || 0) > 0
    }

    // ===== Rolling =====
    out.rolling.has_rolling_config = !!twrUnit.rolling
    if (twrUnit.rolling) {
      out.rolling.shift_start_utc = twrUnit.rolling.shift_start_utc
      out.rolling.n_slots = twrUnit.rolling.n_slots
      out.rolling.n_personnel_expected = twrUnit.rolling.n_personnel ?? null
    }

    if (rosterResult && rosterResult.success && twrUnit.rolling) {
      try {
        const monthly = computeMonthlyRolling({
          result: rosterResult,
          priorityOrder: personnel.map(p => p.id),
          shiftStartUtc: twrUnit.rolling.shift_start_utc,
          nSlots: twrUnit.rolling.n_slots,
          slotDurationMin: twrUnit.rolling.slot_duration_min,
          positionsPerSlot: twrUnit.rolling.positions,
          slotDurations: twrUnit.rolling.slot_durations,
          nPersonnel: twrUnit.rolling.n_personnel,
        })
        // Multi-shift aware shape
        const dayKeys = Object.keys(monthly).filter(
          k => Object.keys(monthly[Number(k)] || {}).length > 0
        )
        out.rolling.days_with_rolling = dayKeys.length
        out.rolling.days_skipped = DAYS_IN_MONTH - dayKeys.length
        if (dayKeys.length > 0) {
          const firstDay = Number(dayKeys[0])
          const byShift = monthly[firstDay]
          const tokens = Object.keys(byShift)
          const primary = byShift["I"] || byShift[tokens[0]]
          if (primary) {
            out.rolling.sample_day = primary.day
            out.rolling.sample_on_duty = primary.on_duty
            out.rolling.sample_n_slots = primary.slots.length
          }
        }
      } catch (e: any) {
        out.rolling.error = e?.message || String(e)
      }
    }

    // ===== CA — probe constant independently to avoid false-positive =====
    const probedCaConst = getCAConstant(cabang.name)
    if (probedCaConst) {
      out.ca.has_ca_constant = true
      out.ca.is_tma = !!probedCaConst.is_tma
      out.ca.constant_per_hour = probedCaConst.constant_per_hour
    }

    const overtimeInput = opts.overtime.map(o => ({
      personnel_id: personnel[o.idx]?.id ?? "MISSING",
      type: o.type,
      duration_min: o.duration_min,
    }))
    const nameLookup = Object.fromEntries(personnel.map(p => [p.id, p.initial || p.id]))

    if (rosterResult && rosterResult.success) {
      try {
        const allowance = computeAllowanceTable({
          airportName: cabang.name,
          result: rosterResult,
          unitConfig: twrUnit,
          priorityOrder: personnel.map(p => p.id),
          nameLookup,
          nikLookup: {},
          rosterStatus: "FINAL",
          overtime: overtimeInput,
        })

        out.ca.has_ca_constant = out.ca.has_ca_constant || allowance.constant_per_hour > 0
        out.ca.is_tma = !!allowance.is_tma
        out.ca.constant_per_hour = allowance.constant_per_hour || out.ca.constant_per_hour
        out.ca.n_rows = allowance.rows.length
        out.ca.total_kontrol_hours = allowance.summary.total_kontrol_hours || 0
        out.ca.total_advance_hours = allowance.summary.total_advance_hours || 0
        out.ca.total_extend_hours = allowance.summary.total_extend_hours || 0
        out.ca.total_hours_all = allowance.summary.total_hours_all || 0
        out.ca.total_allowance_rp = allowance.summary.total_allowance_all || 0
        out.ca.warnings = allowance.warnings || []
        if (allowance.error) out.ca.error = allowance.error
      } catch (e: any) {
        out.ca.error = `EXCEPTION: ${e?.message || String(e)}`
        out.issues.push(`CA_EXCEPTION: ${e?.message || String(e)}`)
      }
    }

    // ===== Aggregate issues =====
    if (!out.roster.success) {
      out.issues.push(`ROSTER_FAILED: ${out.roster.error || "unknown"}`)
    } else {
      const expectedCells = personnel.length * DAYS_IN_MONTH
      if (out.roster.n_cells_total !== expectedCells) {
        out.issues.push(`CELLS_MISMATCH: expected ${expectedCells}, got ${out.roster.n_cells_total}`)
      }
      if (!out.roster.is_multishift_mode) {
        out.issues.push(`MODE_UNEXPECTED: ${out.roster.mode} (expected baseline-multishift)`)
      }
      if (!out.roster.has_shift_ii) {
        out.issues.push("NO_SHIFT_II_IN_OUTPUT (2-shift cabang tapi roster cuma I)")
      }
    }

    if (!out.rolling.has_rolling_config) {
      out.issues.push("NO_ROLLING_CONFIG")
    } else if (out.rolling.error) {
      out.issues.push(`ROLLING_ERROR: ${out.rolling.error}`)
    } else if (out.roster.success && out.rolling.days_with_rolling === 0) {
      out.issues.push("ROLLING_NO_DAYS_MATCH (engine count personnel != rolling.n_personnel)")
    }

    if (!out.ca.has_ca_constant) {
      out.issues.push(`NO_CA_CONSTANT (lookup '${cabang.name}' in ca-constants.json)`)
    }
    if (out.ca.error) {
      out.issues.push(`CA_ERROR: ${out.ca.error}`)
    }
    if (out.roster.success && out.ca.has_ca_constant && out.ca.total_allowance_rp === 0) {
      out.issues.push("CA_ZERO_ALLOWANCE (rolling missing or constant=0)")
    }
    if (out.config_mismatch) {
      out.issues.push(
        `N_PERSONNEL_MISMATCH: brief expects ${out.config_mismatch.expected}, JSON has ${out.config_mismatch.actual}`,
      )
    }

    out.status = out.issues.length === 0 ? "PASS" : "FAIL"
  } catch (e: any) {
    out.status = "FAIL"
    out.issues.push(`OUTER_EXCEPTION: ${e?.message || String(e)}`)
  }

  out.duration_ms = Date.now() - t0
  return out
}

// ============================================================
// MAIN
// ============================================================

interface CabangSummary {
  pass: number
  fail: number
  scenarios: Record<string, "PASS" | "FAIL">
}

const allResults: ScenarioResult[] = []
const summaryByCabang: Record<string, CabangSummary> = {}

const SCENARIOS = [
  { name: "A_baseline",       opts: { cuti: false, overtime: [] } },
  { name: "B_with_cuti",      opts: { cuti: true,  overtime: [] } },
  {
    name: "C_with_overtime",
    opts: {
      cuti: false,
      overtime: [
        { idx: 1, type: "ADVANCE" as const, duration_min: 120 },
        { idx: 2, type: "EXTEND"  as const, duration_min: 90  },
      ],
    },
  },
  {
    name: "D_combined",
    opts: {
      cuti: true,
      overtime: [
        { idx: 1, type: "ADVANCE" as const, duration_min: 120 },
        { idx: 2, type: "EXTEND"  as const, duration_min: 90  },
      ],
    },
  },
]

const startTs = Date.now()
log("=".repeat(72))
log(`E2E TEST — 18 cabang 2-shift × 4 skenario`)
log(`Period: ${MONTH}/${YEAR}, days_in_month = ${DAYS_IN_MONTH}`)
log(`Engine fix applied: ab5b1f2 (PATH 1 partial leave)`)
log(`Start: ${new Date(startTs).toISOString()}`)
log("=".repeat(72))

for (const cabang of CABANG_2SHIFT) {
  log("")
  log(`=== ${cabang.name} (${cabang.icao}) [${cabang.category}] — expected_n=${cabang.expected_n} ===`)
  summaryByCabang[cabang.name] = { pass: 0, fail: 0, scenarios: {} }

  for (const scenario of SCENARIOS) {
    const r = runScenario(cabang, scenario.name, scenario.opts)
    allResults.push(r)
    summaryByCabang[cabang.name].scenarios[scenario.name] = r.status
    if (r.status === "PASS") summaryByCabang[cabang.name].pass++
    else summaryByCabang[cabang.name].fail++

    const issuesStr = r.issues.length > 0 ? ` — ${r.issues.join(" | ")}` : ""
    log(`  ${scenario.name}: ${r.status} (${r.duration_ms}ms)${issuesStr}`)
    const distStr = Object.entries(r.roster.shift_distribution)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([k, v]) => `${k}=${v}`).join(" ")
    log(`    roster: success=${r.roster.success} mode=${r.roster.mode} cells=${r.roster.n_cells_total} dist={${distStr}} mshift=${r.roster.is_multishift_mode}`)
    log(`    rolling: has_cfg=${r.rolling.has_rolling_config} n_pers_expected=${r.rolling.n_personnel_expected} days_with=${r.rolling.days_with_rolling} days_skipped=${r.rolling.days_skipped}`)
    log(`    ca: has_const=${r.ca.has_ca_constant} const_per_hr=${r.ca.constant_per_hour} rows=${r.ca.n_rows} kontrol_hr=${r.ca.total_kontrol_hours.toFixed(2)} adv_hr=${r.ca.total_advance_hours.toFixed(2)} ext_hr=${r.ca.total_extend_hours.toFixed(2)} total_rp=${Math.round(r.ca.total_allowance_rp)}`)
  }
}

const endTs = Date.now()
log("")
log("=".repeat(72))
log(`Done in ${((endTs - startTs) / 1000).toFixed(1)}s`)
log("=".repeat(72))

// ============================================================
// WRITE RAW RESULTS
// ============================================================

const RAW_JSON_PATH = path.join(OUTPUTS_DIR, "E2E_TEST_RAW_RESULTS_2SHIFT.json")
fs.writeFileSync(RAW_JSON_PATH, JSON.stringify({
  meta: {
    year: YEAR,
    month: MONTH,
    days_in_month: DAYS_IN_MONTH,
    n_cabang: CABANG_2SHIFT.length,
    n_scenarios: SCENARIOS.length,
    n_total_runs: allResults.length,
    started_at: new Date(startTs).toISOString(),
    finished_at: new Date(endTs).toISOString(),
    duration_seconds: (endTs - startTs) / 1000,
    engine_fix_applied: "ab5b1f2 (PATH 1 partial leave)",
  },
  summary_by_cabang: summaryByCabang,
  results: allResults,
}, null, 2))
log(`Raw results: ${RAW_JSON_PATH}`)

// ============================================================
// COMPILE REPORT
// ============================================================

const REPORT_PATH = path.join(OUTPUTS_DIR, "E2E_TEST_REPORT_2SHIFT.md")

const totalRuns = allResults.length
const totalPass = allResults.filter(r => r.status === "PASS").length
const totalFail = totalRuns - totalPass

const fullyPass = CABANG_2SHIFT.filter(c => summaryByCabang[c.name].pass === SCENARIOS.length).map(c => c.name)
const fullyFail = CABANG_2SHIFT.filter(c => summaryByCabang[c.name].fail === SCENARIOS.length).map(c => c.name)
const partial   = CABANG_2SHIFT.filter(c =>
  summaryByCabang[c.name].pass > 0 && summaryByCabang[c.name].fail > 0,
).map(c => c.name)

const issueCount: Record<string, Set<string>> = {}
function bucketIssue(issue: string): string {
  if (issue.startsWith("ROSTER_FAILED")) return "ROSTER_FAILED"
  if (issue.startsWith("ROSTER_EXCEPTION")) return "ROSTER_EXCEPTION"
  if (issue.startsWith("MODE_UNEXPECTED")) return "MODE_UNEXPECTED"
  if (issue.startsWith("NO_SHIFT_II_IN_OUTPUT")) return "NO_SHIFT_II_IN_OUTPUT"
  if (issue.startsWith("CELLS_MISMATCH")) return "CELLS_MISMATCH"
  if (issue.startsWith("NO_ROLLING_CONFIG")) return "NO_ROLLING_CONFIG"
  if (issue.startsWith("ROLLING_ERROR")) return "ROLLING_ERROR"
  if (issue.startsWith("ROLLING_NO_DAYS_MATCH")) return "ROLLING_NO_DAYS_MATCH"
  if (issue.startsWith("NO_CA_CONSTANT")) return "NO_CA_CONSTANT"
  if (issue.startsWith("CA_ERROR")) return "CA_ERROR"
  if (issue.startsWith("CA_EXCEPTION")) return "CA_EXCEPTION"
  if (issue.startsWith("CA_ZERO_ALLOWANCE")) return "CA_ZERO_ALLOWANCE"
  if (issue.startsWith("N_PERSONNEL_MISMATCH")) return "N_PERSONNEL_MISMATCH"
  if (issue.startsWith("AIRPORT_NOT_FOUND")) return "AIRPORT_NOT_FOUND"
  if (issue.startsWith("UNIT_TWR_NOT_FOUND")) return "UNIT_TWR_NOT_FOUND"
  return "OTHER"
}
for (const r of allResults) {
  for (const issue of r.issues) {
    const bucket = bucketIssue(issue)
    if (!issueCount[bucket]) issueCount[bucket] = new Set()
    issueCount[bucket].add(r.cabang)
  }
}

const issueRows = Object.entries(issueCount)
  .sort((a, b) => b[1].size - a[1].size)
  .map(([bucket, set]) => `| ${bucket} | ${set.size} | ${[...set].sort().join(", ")} |`)

function fmtScenarioBlock(r: ScenarioResult): string {
  const head = `**Skenario ${r.scenario}:** ${r.status === "PASS" ? "✓ PASS" : "✗ FAIL"} (${r.duration_ms}ms)`
  const lines = [head]

  const distStr = Object.entries(r.roster.shift_distribution)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([k, v]) => `${k}=${v}`).join(", ")
  lines.push(`- Roster: success=\`${r.roster.success}\` mode=\`${r.roster.mode}\` cells=${r.roster.n_cells_total} | dist: ${distStr || "none"} | multishift_mode=${r.roster.is_multishift_mode}`)
  if (r.roster.error) lines.push(`  - Roster error: ${r.roster.error.slice(0, 200)}`)

  if (r.rolling.has_rolling_config) {
    lines.push(`- Rolling: config OK (start=${r.rolling.shift_start_utc}, slots=${r.rolling.n_slots}, n_pers=${r.rolling.n_personnel_expected}); days_with=${r.rolling.days_with_rolling}, skipped=${r.rolling.days_skipped}`)
    if (r.rolling.sample_n_slots !== undefined) {
      lines.push(`  - Sample day ${r.rolling.sample_day}: on_duty=[${(r.rolling.sample_on_duty || []).join(", ")}], n_slots=${r.rolling.sample_n_slots}`)
    }
    if (r.rolling.error) lines.push(`  - Rolling error: ${r.rolling.error}`)
  } else {
    lines.push(`- Rolling: NO_CONFIG (CA fallback ke roster-direct kontrol)`)
  }

  lines.push(`- CA: const=${r.ca.constant_per_hour} (TMA=${r.ca.is_tma}), rows=${r.ca.n_rows}, kontrol_hr=${r.ca.total_kontrol_hours.toFixed(2)}, adv_hr=${r.ca.total_advance_hours.toFixed(2)}, ext_hr=${r.ca.total_extend_hours.toFixed(2)}, **total Rp ${Math.round(r.ca.total_allowance_rp).toLocaleString("id-ID")}**`)
  if (r.ca.warnings.length > 0) {
    lines.push(`  - CA warnings: ${r.ca.warnings.slice(0, 3).map(w => w.replace(/[⚠️ℹ️]/g, "").trim()).join(" | ")}`)
  }
  if (r.ca.error) lines.push(`  - CA error: ${r.ca.error}`)

  if (r.issues.length > 0) {
    lines.push(`- Issues: ${r.issues.map(i => "`" + i + "`").join(", ")}`)
  }
  return lines.join("\n")
}

const perCabangBlocks = CABANG_2SHIFT.map(c => {
  const cabangResults = allResults.filter(r => r.cabang === c.name)
  const sum = summaryByCabang[c.name]
  const headLine = `### ${c.name} (${c.icao}) [${c.category}] — ${sum.pass}/${SCENARIOS.length} PASS`
  return [headLine, "", ...cabangResults.map(fmtScenarioBlock).map(b => b + "\n")].join("\n")
})

// Recommendations heuristic
const recommendations: string[] = []
if ((issueCount["MODE_UNEXPECTED"]?.size || 0) > 0) {
  const cabs = [...issueCount["MODE_UNEXPECTED"]].sort().join(", ")
  recommendations.push(`**High** — Roster mode bukan \`baseline-multishift\` untuk: ${cabs}. Engine MULTI-SHIFT detection (\`scanMultiShiftTokens\`) tidak menemukan II/III/IV/V di baseline pattern. Cek baseline JSON apakah ada token shift kedua di pattern row.`)
}
if ((issueCount["NO_SHIFT_II_IN_OUTPUT"]?.size || 0) > 0) {
  const cabs = [...issueCount["NO_SHIFT_II_IN_OUTPUT"]].sort().join(", ")
  recommendations.push(`**High** — Roster output tidak mengandung "II" shift token untuk: ${cabs}. Mungkin baseline pattern di config tidak ada shift II atau engine truncate. Verify visual di Roster ATC page.`)
}
if ((issueCount["NO_CA_CONSTANT"]?.size || 0) > 0) {
  const cabs = [...issueCount["NO_CA_CONSTANT"]].sort().join(", ")
  recommendations.push(`**High** — Tambah CA constant untuk: ${cabs}. File: \`src/lib/airport-data/data/ca-constants.json\`. Tanpa constant, Tunjangan section 0 Rp.`)
}
if ((issueCount["NO_ROLLING_CONFIG"]?.size || 0) > 0) {
  const cabs = [...issueCount["NO_ROLLING_CONFIG"]].sort().join(", ")
  recommendations.push(`**High** — Tambah rolling config untuk: ${cabs}. File: \`airport-configs.json\` → unit.rolling.`)
}
if ((issueCount["ROSTER_FAILED"]?.size || 0) > 0) {
  const cabs = [...issueCount["ROSTER_FAILED"]].sort().join(", ")
  recommendations.push(`**High** — Roster fail untuk: ${cabs}. Cek baseline pattern integrity (length, format).`)
}
if ((issueCount["ROLLING_NO_DAYS_MATCH"]?.size || 0) > 0) {
  const cabs = [...issueCount["ROLLING_NO_DAYS_MATCH"]].sort().join(", ")
  recommendations.push(`**Medium** — Rolling \`n_personnel\` mismatch dengan engine count untuk: ${cabs}. Engine produce 'I' tokens per hari ≠ \`rolling.n_personnel\` di config.`)
}
if ((issueCount["N_PERSONNEL_MISMATCH"]?.size || 0) > 0) {
  const cabs = [...issueCount["N_PERSONNEL_MISMATCH"]].sort().join(", ")
  recommendations.push(`**Low** — Brief vs JSON \`n_personnel\` mismatch untuk: ${cabs}.`)
}

// Per-scenario aggregate
const scenarioStats: Record<string, { pass: number, fail: number }> = {}
for (const sc of SCENARIOS) scenarioStats[sc.name] = { pass: 0, fail: 0 }
for (const r of allResults) {
  if (r.status === "PASS") scenarioStats[r.scenario].pass++
  else scenarioStats[r.scenario].fail++
}

const md: string[] = []
md.push(`# E2E Test Report — 18 Cabang 2-Shift × 4 Skenario`)
md.push("")
md.push(`**Date:** ${new Date(endTs).toISOString()}`)
md.push(`**Period tested:** ${MONTH}/${YEAR} (${DAYS_IN_MONTH} days)`)
md.push(`**Engine fix applied:** \`ab5b1f2\` (PATH 1 single-shift partial leave)`)
md.push(`**Total runs:** ${totalRuns} (${CABANG_2SHIFT.length} cabang × ${SCENARIOS.length} skenario)`)
md.push(`**Duration:** ${((endTs - startTs) / 1000).toFixed(1)}s`)
md.push("")
md.push(`## Executive Summary`)
md.push("")
md.push(`- **PASS:** ${totalPass}/${totalRuns} (${(totalPass / totalRuns * 100).toFixed(1)}%)`)
md.push(`- **FAIL:** ${totalFail}/${totalRuns} (${(totalFail / totalRuns * 100).toFixed(1)}%)`)
md.push(`- **Fully PASS (4/4 skenario):** ${fullyPass.length} cabang — ${fullyPass.length > 0 ? fullyPass.join(", ") : "_none_"}`)
md.push(`- **Fully FAIL (0/4 skenario):** ${fullyFail.length} cabang — ${fullyFail.length > 0 ? fullyFail.join(", ") : "_none_"}`)
md.push(`- **Partial (mixed pass/fail):** ${partial.length} cabang — ${partial.length > 0 ? partial.join(", ") : "_none_"}`)
md.push("")
md.push(`### Per-skenario breakdown`)
md.push("")
md.push(`| Skenario | PASS | FAIL | % |`)
md.push(`|---|---:|---:|---:|`)
for (const sc of SCENARIOS) {
  const stat = scenarioStats[sc.name]
  const pct = (stat.pass / CABANG_2SHIFT.length * 100).toFixed(1)
  md.push(`| ${sc.name} | ${stat.pass} | ${stat.fail} | ${pct}% |`)
}
md.push("")
md.push(`## Comparison vs 1-shift`)
md.push("")
md.push(`Untuk konteks (post-fix \`ab5b1f2\`):`)
md.push("")
md.push(`| Metric | 1-shift (33 cabang) | 2-shift (18 cabang) |`)
md.push(`|---|---|---|`)
md.push(`| Overall PASS | 124/132 (93.9%) | ${totalPass}/${totalRuns} (${(totalPass / totalRuns * 100).toFixed(1)}%) |`)
md.push(`| Skenario B (cuti) | 29/33 (87.9%) | ${scenarioStats["B_with_cuti"].pass}/${CABANG_2SHIFT.length} (${(scenarioStats["B_with_cuti"].pass / CABANG_2SHIFT.length * 100).toFixed(1)}%) |`)
md.push(`| Skenario D (cuti+OT) | 29/33 (87.9%) | ${scenarioStats["D_combined"].pass}/${CABANG_2SHIFT.length} (${(scenarioStats["D_combined"].pass / CABANG_2SHIFT.length * 100).toFixed(1)}%) |`)
md.push(`| Roster path | PATH 1 single-shift baseline | MULTI-SHIFT path (line 341-362) |`)
md.push("")
md.push(`## Aggregate Issues`)
md.push("")
if (issueRows.length > 0) {
  md.push(`| Issue | Cabang affected | Affected list |`)
  md.push(`|---|---:|---|`)
  md.push(...issueRows)
} else {
  md.push(`_No issues — all scenarios passed._`)
}
md.push("")
md.push(`## Recommendations untuk Cowork`)
md.push("")
if (recommendations.length === 0) {
  md.push("_All scenarios passed — engine 2-shift confirmed solid._")
} else {
  recommendations.forEach((r, i) => md.push(`${i + 1}. ${r}`))
}
md.push("")
md.push(`## Action items per cabang`)
md.push("")
md.push(`| Cabang | Status | Top issue |`)
md.push(`|---|---|---|`)
for (const c of CABANG_2SHIFT) {
  const s = summaryByCabang[c.name]
  const cabangResults = allResults.filter(r => r.cabang === c.name)
  const topIssue = cabangResults.find(r => r.issues.length > 0)?.issues[0] || "—"
  const statusStr = s.fail === 0 ? "✓ all PASS" : s.pass === 0 ? "✗ all FAIL" : `partial ${s.pass}/${SCENARIOS.length}`
  md.push(`| ${c.name} (${c.icao}) | ${statusStr} | ${topIssue} |`)
}
md.push("")
md.push(`## Detail per Cabang`)
md.push("")
md.push(...perCabangBlocks)
md.push("")
md.push(`---`)
md.push("")
md.push(`*Raw log: \`outputs/E2E_TEST_RAW_LOG_2SHIFT.txt\`*`)
md.push(`*Raw JSON: \`outputs/E2E_TEST_RAW_RESULTS_2SHIFT.json\`*`)

fs.writeFileSync(REPORT_PATH, md.join("\n"))
log(`Report:      ${REPORT_PATH}`)

fs.closeSync(logFd)
