/**
 * scripts/test-multishift-tma-e2e.ts
 *
 * Engine-level E2E test untuk 13 cabang multi-shift TMA × 4 skenario.
 *
 * Cabang TMA besar punya multi-shift pattern (II/III/IV/V) di baseline,
 * jadi engine harus iterate per shift token (post commit refactor
 * `feat(rolling-engine): support multi-shift cabang TMA`).
 *
 * Test all units (TWR + APP + ACC kalau ada). Banyaknya unit ke-test
 * lebih besar dari cabang count.
 *
 * Jalankan:
 *   npx tsx scripts/test-multishift-tma-e2e.ts
 *
 * Output:
 *   - outputs/E2E_TEST_REPORT_MULTISHIFT_TMA.md
 *   - outputs/E2E_TEST_RAW_LOG_MULTISHIFT_TMA.txt
 *   - outputs/E2E_TEST_RAW_RESULTS_MULTISHIFT_TMA.json
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
  getAirport, getUnit, getBaselineForMonth, getCAConstant, listAirports,
} from "../src/lib/airport-data/index.ts"
import { leaveRangeFromDates } from "../src/lib/shared/index.ts"

// Build name→airport lookup once (handles dual-airport-with-same-ICAO
// like Jatsc ACC & Jatsc APP both WIII)
const _AIRPORTS_BY_NAME: Record<string, ReturnType<typeof getAirport>> = {}
for (const ap of listAirports()) {
  _AIRPORTS_BY_NAME[ap.airport_name] = ap as any
}
function getAirportByName(name: string) {
  return _AIRPORTS_BY_NAME[name]
}

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

interface CabangUnitSpec {
  name: string
  icao: string
  unit: string  // 'TWR' | 'APP' | 'ACC'
}

// 13 cabang × 1-3 units each = 26 unit total
const CABANG_TMA: CabangUnitSpec[] = [
  // Jatsc ACC — single unit ACC
  { name: "Jatsc ACC",      icao: "WIII", unit: "ACC" },
  // Jatsc APP — TWR + APP (separate engine entries with same ICAO)
  { name: "Jatsc APP",      icao: "WIII", unit: "TWR" },  // resolve via name lookup
  { name: "Jatsc APP",      icao: "WIII", unit: "APP" },
  // Multi-unit TWR+APP cabang
  { name: "Denpasar",       icao: "WADD", unit: "TWR" },
  { name: "Denpasar",       icao: "WADD", unit: "APP" },
  { name: "Surabaya",       icao: "WARR", unit: "TWR" },
  { name: "Surabaya",       icao: "WARR", unit: "APP" },
  { name: "Medan",          icao: "WIMM", unit: "TWR" },
  { name: "Medan",          icao: "WIMM", unit: "APP" },
  { name: "Tanjung Pinang", icao: "WIDN", unit: "TWR" },
  { name: "Tanjung Pinang", icao: "WIDN", unit: "APP" },
  // Matsc — 3 units
  { name: "Matsc",          icao: "WAAA", unit: "TWR" },
  { name: "Matsc",          icao: "WAAA", unit: "APP" },
  { name: "Matsc",          icao: "WAAA", unit: "ACC" },
  // Other TMA cabang
  { name: "Palembang",      icao: "WIPP", unit: "TWR" },
  { name: "Palembang",      icao: "WIPP", unit: "APP" },
  { name: "Balikpapan",     icao: "WALL", unit: "TWR" },
  { name: "Balikpapan",     icao: "WALL", unit: "APP" },
  { name: "Pekanbaru",      icao: "WIBB", unit: "TWR" },
  { name: "Pekanbaru",      icao: "WIBB", unit: "APP" },
  { name: "Pontianak",      icao: "WIOO", unit: "TWR" },
  { name: "Pontianak",      icao: "WIOO", unit: "APP" },
  { name: "Sentani",        icao: "WAJJ", unit: "TWR" },
  { name: "Sentani",        icao: "WAJJ", unit: "APP" },
  { name: "Manado",         icao: "WAMM", unit: "TWR" },
  { name: "Manado",         icao: "WAMM", unit: "APP" },
]

// ============================================================
// LOGGING
// ============================================================

const LOG_PATH = path.join(OUTPUTS_DIR, "E2E_TEST_RAW_LOG_MULTISHIFT_TMA.txt")
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
  shift_distribution: Record<string, number>
  detected_shift_tokens: string[]
  is_multishift_mode: boolean
}

interface RollingChecks {
  has_rolling_config: boolean
  shift_start_utc: string | null
  n_slots: number | null
  n_personnel_expected: number | null
  days_with_rolling: number
  days_skipped: number
  total_shift_entries: number  // total (day × shiftToken) entries across the month
  shift_tokens_seen: string[]  // unique shift tokens that produced rolling
  sample_day?: number
  sample_shift_tokens?: string[]
  sample_first_token?: string
  sample_first_on_duty?: string[]
  sample_first_n_slots?: number
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
  total_allowance_rp: number
  warnings: string[]
  error: string | null
}

interface ScenarioResult {
  cabang: string
  icao: string
  unit: string
  scenario: string
  status: "PASS" | "FAIL"
  issues: string[]
  duration_ms: number
  roster: RosterChecks
  rolling: RollingChecks
  ca: CaChecks
  n_personnel: number
}

// ============================================================
// SCENARIO RUNNER
// ============================================================

interface ScenarioOpts {
  cuti: boolean
  overtime: Array<{ idx: number, type: "ADVANCE" | "EXTEND", duration_min: number }>
}

function runScenario(spec: CabangUnitSpec, scenarioName: string, opts: ScenarioOpts): ScenarioResult {
  const t0 = Date.now()
  const out: ScenarioResult = {
    cabang: spec.name,
    icao: spec.icao,
    unit: spec.unit,
    scenario: scenarioName,
    status: "PASS",
    issues: [],
    duration_ms: 0,
    n_personnel: 0,
    roster: {
      success: false,
      mode: "",
      error: null,
      n_cells_total: 0,
      shift_distribution: {},
      detected_shift_tokens: [],
      is_multishift_mode: false,
    },
    rolling: {
      has_rolling_config: false,
      shift_start_utc: null,
      n_slots: null,
      n_personnel_expected: null,
      days_with_rolling: 0,
      days_skipped: 0,
      total_shift_entries: 0,
      shift_tokens_seen: [],
    },
    ca: {
      has_ca_constant: false,
      is_tma: false,
      constant_per_hour: 0,
      n_rows: 0,
      total_kontrol_hours: 0,
      total_advance_hours: 0,
      total_extend_hours: 0,
      total_allowance_rp: 0,
      warnings: [],
      error: null,
    },
  }

  try {
    // Use name lookup first (handles same-ICAO cabang like Jatsc),
    // fallback to ICAO lookup
    const realAp = getAirportByName(spec.name) || getAirport(spec.icao)
    if (!realAp) {
      out.issues.push(`AIRPORT_NOT_FOUND (name='${spec.name}' ICAO=${spec.icao})`)
      out.status = "FAIL"
      out.duration_ms = Date.now() - t0
      return out
    }

    const unitCfg = getUnit(realAp, spec.unit)
    if (!unitCfg) {
      out.issues.push(`UNIT_${spec.unit}_NOT_FOUND di ${spec.name}`)
      out.status = "FAIL"
      out.duration_ms = Date.now() - t0
      return out
    }

    out.n_personnel = unitCfg.n_personnel

    const initials = unitCfg.initials && unitCfg.initials.length > 0
      ? unitCfg.initials.slice(0, unitCfg.n_personnel)
      : Array.from({ length: unitCfg.n_personnel }, (_, i) => `P${i + 1}`)

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

    const baseline = getBaselineForMonth(realAp.airport_code, spec.unit, DAYS_IN_MONTH)

    // ===== Roster =====
    let rosterResult: any
    try {
      rosterResult = generateRoster({
        year: YEAR, month: MONTH, personnel,
        baselinePattern: baseline,
        isTni: unitCfg.is_tni ?? false,
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
          dist[cell.status as string] = (dist[cell.status as string] || 0) + 1
        }
      }
      out.roster.detected_shift_tokens = ["I", "II", "III", "IV", "V"].filter(
        t => (dist[t] || 0) > 0,
      )
    }

    // ===== Rolling =====
    out.rolling.has_rolling_config = !!unitCfg.rolling
    if (unitCfg.rolling) {
      out.rolling.shift_start_utc = unitCfg.rolling.shift_start_utc
      out.rolling.n_slots = unitCfg.rolling.n_slots
      out.rolling.n_personnel_expected = unitCfg.rolling.n_personnel ?? null
    }

    if (rosterResult && rosterResult.success && unitCfg.rolling) {
      try {
        const monthly = computeMonthlyRolling({
          result: rosterResult,
          priorityOrder: personnel.map(p => p.id),
          shiftStartUtc: unitCfg.rolling.shift_start_utc,
          nSlots: unitCfg.rolling.n_slots,
          slotDurationMin: unitCfg.rolling.slot_duration_min,
          positionsPerSlot: unitCfg.rolling.positions,
          slotDurations: unitCfg.rolling.slot_durations,
          nPersonnel: unitCfg.rolling.n_personnel,
        })
        // monthly[day] = Record<shiftToken, DailyRolling>
        const dayKeys = Object.keys(monthly)
        const validDays = dayKeys.filter(
          k => Object.keys(monthly[Number(k)] || {}).length > 0,
        )
        out.rolling.days_with_rolling = validDays.length
        out.rolling.days_skipped = DAYS_IN_MONTH - validDays.length

        const tokensSeen = new Set<string>()
        let totalEntries = 0
        for (const k of validDays) {
          const byShift = monthly[Number(k)]
          for (const tok of Object.keys(byShift)) {
            tokensSeen.add(tok)
            totalEntries++
          }
        }
        out.rolling.total_shift_entries = totalEntries
        out.rolling.shift_tokens_seen = [...tokensSeen].sort((a, b) => {
          const order = ["I", "II", "III", "IV", "V"]
          return order.indexOf(a) - order.indexOf(b)
        })

        if (validDays.length > 0) {
          const firstDay = Number(validDays[0])
          const sampleByShift = monthly[firstDay]
          const sampleTokens = Object.keys(sampleByShift)
          out.rolling.sample_day = firstDay
          out.rolling.sample_shift_tokens = sampleTokens
          const firstTok = sampleTokens[0]
          out.rolling.sample_first_token = firstTok
          out.rolling.sample_first_on_duty = sampleByShift[firstTok].on_duty
          out.rolling.sample_first_n_slots = sampleByShift[firstTok].slots.length
        }
      } catch (e: any) {
        out.rolling.error = e?.message || String(e)
      }
    }

    // ===== CA =====
    const probedCaConst = getCAConstant(spec.name)
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
          airportName: spec.name,
          result: rosterResult,
          unitConfig: unitCfg,
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
      out.issues.push(`ROSTER_FAILED: ${(out.roster.error || "unknown").slice(0, 150)}`)
    } else {
      const expectedCells = personnel.length * DAYS_IN_MONTH
      if (out.roster.n_cells_total !== expectedCells) {
        out.issues.push(`CELLS_MISMATCH: expected ${expectedCells}, got ${out.roster.n_cells_total}`)
      }
    }

    if (!out.rolling.has_rolling_config) {
      out.issues.push("NO_ROLLING_CONFIG")
    } else if (out.rolling.error) {
      out.issues.push(`ROLLING_ERROR: ${out.rolling.error}`)
    } else if (out.roster.success && out.rolling.days_with_rolling === 0) {
      out.issues.push("ROLLING_NO_DAYS (no shift token produced rolling)")
    } else if (
      out.roster.success
      && out.roster.is_multishift_mode
      && out.roster.detected_shift_tokens.length > 1
      && out.rolling.shift_tokens_seen.length < out.roster.detected_shift_tokens.length
    ) {
      out.issues.push(
        `MULTI_SHIFT_PARTIAL: roster punya ${out.roster.detected_shift_tokens.length} shift tokens (${out.roster.detected_shift_tokens.join("/")}), rolling cuma compute ${out.rolling.shift_tokens_seen.length} (${out.rolling.shift_tokens_seen.join("/")})`,
      )
    }

    if (!out.ca.has_ca_constant) {
      out.issues.push(`NO_CA_CONSTANT (lookup '${spec.name}')`)
    }
    if (out.ca.error) {
      out.issues.push(`CA_ERROR: ${out.ca.error}`)
    }
    if (out.roster.success && out.ca.has_ca_constant && out.ca.total_allowance_rp === 0) {
      out.issues.push("CA_ZERO_ALLOWANCE")
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

interface UnitSummary {
  pass: number
  fail: number
  scenarios: Record<string, "PASS" | "FAIL">
}

const allResults: ScenarioResult[] = []
const summaryByUnit: Record<string, UnitSummary> = {}

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
log(`E2E TEST — 13 cabang TMA multi-shift (${CABANG_TMA.length} unit) × 4 skenario`)
log(`Period: ${MONTH}/${YEAR}, days_in_month = ${DAYS_IN_MONTH}`)
log(`Engine refactor: rolling-engine multi-shift aware (per shift token iteration)`)
log(`Start: ${new Date(startTs).toISOString()}`)
log("=".repeat(72))

for (const spec of CABANG_TMA) {
  const key = `${spec.name} ${spec.unit}`
  log("")
  log(`=== ${key} (${spec.icao}) ===`)
  summaryByUnit[key] = { pass: 0, fail: 0, scenarios: {} }

  for (const scenario of SCENARIOS) {
    const r = runScenario(spec, scenario.name, scenario.opts)
    allResults.push(r)
    summaryByUnit[key].scenarios[scenario.name] = r.status
    if (r.status === "PASS") summaryByUnit[key].pass++
    else summaryByUnit[key].fail++

    const issuesStr = r.issues.length > 0 ? ` — ${r.issues.join(" | ")}` : ""
    log(`  ${scenario.name}: ${r.status} (${r.duration_ms}ms)${issuesStr}`)
    const distStr = Object.entries(r.roster.shift_distribution)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([k, v]) => `${k}=${v}`).join(" ")
    log(`    roster: success=${r.roster.success} mode=${r.roster.mode} cells=${r.roster.n_cells_total} n_pers=${r.n_personnel} dist={${distStr}} tokens=${r.roster.detected_shift_tokens.join(",")}`)
    log(`    rolling: has_cfg=${r.rolling.has_rolling_config} days_with=${r.rolling.days_with_rolling} total_entries=${r.rolling.total_shift_entries} tokens_seen=${r.rolling.shift_tokens_seen.join(",")}`)
    log(`    ca: has_const=${r.ca.has_ca_constant} const_per_hr=${r.ca.constant_per_hour.toFixed(0)} rows=${r.ca.n_rows} kontrol_hr=${r.ca.total_kontrol_hours.toFixed(2)} adv=${r.ca.total_advance_hours.toFixed(2)} ext=${r.ca.total_extend_hours.toFixed(2)} total_rp=${Math.round(r.ca.total_allowance_rp)}`)
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

const RAW_JSON_PATH = path.join(OUTPUTS_DIR, "E2E_TEST_RAW_RESULTS_MULTISHIFT_TMA.json")
fs.writeFileSync(RAW_JSON_PATH, JSON.stringify({
  meta: {
    year: YEAR,
    month: MONTH,
    days_in_month: DAYS_IN_MONTH,
    n_unit_specs: CABANG_TMA.length,
    n_scenarios: SCENARIOS.length,
    n_total_runs: allResults.length,
    started_at: new Date(startTs).toISOString(),
    finished_at: new Date(endTs).toISOString(),
    duration_seconds: (endTs - startTs) / 1000,
  },
  summary_by_unit: summaryByUnit,
  results: allResults,
}, null, 2))
log(`Raw results: ${RAW_JSON_PATH}`)

// ============================================================
// COMPILE REPORT
// ============================================================

const REPORT_PATH = path.join(OUTPUTS_DIR, "E2E_TEST_REPORT_MULTISHIFT_TMA.md")

const totalRuns = allResults.length
const totalPass = allResults.filter(r => r.status === "PASS").length
const totalFail = totalRuns - totalPass

const fullyPass = CABANG_TMA.filter(c => {
  const k = `${c.name} ${c.unit}`
  return summaryByUnit[k].pass === SCENARIOS.length
}).map(c => `${c.name} ${c.unit}`)

const fullyFail = CABANG_TMA.filter(c => {
  const k = `${c.name} ${c.unit}`
  return summaryByUnit[k].fail === SCENARIOS.length
}).map(c => `${c.name} ${c.unit}`)

const partial = CABANG_TMA.filter(c => {
  const k = `${c.name} ${c.unit}`
  return summaryByUnit[k].pass > 0 && summaryByUnit[k].fail > 0
}).map(c => `${c.name} ${c.unit}`)

const issueCount: Record<string, Set<string>> = {}
function bucketIssue(issue: string): string {
  if (issue.startsWith("ROSTER_FAILED")) return "ROSTER_FAILED"
  if (issue.startsWith("ROSTER_EXCEPTION")) return "ROSTER_EXCEPTION"
  if (issue.startsWith("CELLS_MISMATCH")) return "CELLS_MISMATCH"
  if (issue.startsWith("NO_ROLLING_CONFIG")) return "NO_ROLLING_CONFIG"
  if (issue.startsWith("ROLLING_ERROR")) return "ROLLING_ERROR"
  if (issue.startsWith("ROLLING_NO_DAYS")) return "ROLLING_NO_DAYS"
  if (issue.startsWith("MULTI_SHIFT_PARTIAL")) return "MULTI_SHIFT_PARTIAL"
  if (issue.startsWith("NO_CA_CONSTANT")) return "NO_CA_CONSTANT"
  if (issue.startsWith("CA_ERROR")) return "CA_ERROR"
  if (issue.startsWith("CA_EXCEPTION")) return "CA_EXCEPTION"
  if (issue.startsWith("CA_ZERO_ALLOWANCE")) return "CA_ZERO_ALLOWANCE"
  if (issue.startsWith("AIRPORT_NOT_FOUND")) return "AIRPORT_NOT_FOUND"
  if (issue.startsWith("UNIT_")) return "UNIT_NOT_FOUND"
  return "OTHER"
}
for (const r of allResults) {
  for (const issue of r.issues) {
    const bucket = bucketIssue(issue)
    if (!issueCount[bucket]) issueCount[bucket] = new Set()
    issueCount[bucket].add(`${r.cabang} ${r.unit}`)
  }
}

const issueRows = Object.entries(issueCount)
  .sort((a, b) => b[1].size - a[1].size)
  .map(([bucket, set]) => `| ${bucket} | ${set.size} | ${[...set].sort().join(", ")} |`)

const scenarioStats: Record<string, { pass: number, fail: number }> = {}
for (const sc of SCENARIOS) scenarioStats[sc.name] = { pass: 0, fail: 0 }
for (const r of allResults) {
  if (r.status === "PASS") scenarioStats[r.scenario].pass++
  else scenarioStats[r.scenario].fail++
}

function fmtScenarioBlock(r: ScenarioResult): string {
  const head = `**Skenario ${r.scenario}:** ${r.status === "PASS" ? "✓ PASS" : "✗ FAIL"} (${r.duration_ms}ms)`
  const lines = [head]
  const distStr = Object.entries(r.roster.shift_distribution)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([k, v]) => `${k}=${v}`).join(", ")
  lines.push(`- Roster: success=\`${r.roster.success}\` mode=\`${r.roster.mode}\` cells=${r.roster.n_cells_total} (${r.n_personnel} pers) | dist: ${distStr || "none"} | shifts_detected=[${r.roster.detected_shift_tokens.join(",")}]`)
  if (r.roster.error) lines.push(`  - Roster error: ${r.roster.error.slice(0, 200)}`)
  if (r.rolling.has_rolling_config) {
    lines.push(`- Rolling: cfg(start=${r.rolling.shift_start_utc}, slots=${r.rolling.n_slots}, n_pers_cfg=${r.rolling.n_personnel_expected}) | days_with=${r.rolling.days_with_rolling}, entries=${r.rolling.total_shift_entries}, tokens=[${r.rolling.shift_tokens_seen.join(",")}]`)
    if (r.rolling.sample_day !== undefined) {
      lines.push(`  - Sample day ${r.rolling.sample_day}: tokens=[${(r.rolling.sample_shift_tokens || []).join(",")}], first_token="${r.rolling.sample_first_token}" on_duty=[${(r.rolling.sample_first_on_duty || []).join(", ")}] (${r.rolling.sample_first_n_slots} slots)`)
    }
    if (r.rolling.error) lines.push(`  - Rolling error: ${r.rolling.error}`)
  } else {
    lines.push(`- Rolling: NO_CONFIG`)
  }
  lines.push(`- CA: const=${r.ca.constant_per_hour.toFixed(0)} (TMA=${r.ca.is_tma}), rows=${r.ca.n_rows}, kontrol_hr=${r.ca.total_kontrol_hours.toFixed(2)}, adv=${r.ca.total_advance_hours.toFixed(2)}, ext=${r.ca.total_extend_hours.toFixed(2)}, **total Rp ${Math.round(r.ca.total_allowance_rp).toLocaleString("id-ID")}**`)
  if (r.ca.error) lines.push(`  - CA error: ${r.ca.error}`)
  if (r.issues.length > 0) {
    lines.push(`- Issues: ${r.issues.map(i => "`" + i + "`").join(", ")}`)
  }
  return lines.join("\n")
}

const perUnitBlocks = CABANG_TMA.map(spec => {
  const key = `${spec.name} ${spec.unit}`
  const cabangResults = allResults.filter(r => r.cabang === spec.name && r.unit === spec.unit)
  const sum = summaryByUnit[key]
  const headLine = `### ${spec.name} — ${spec.unit} (${spec.icao}) — ${sum.pass}/${SCENARIOS.length} PASS`
  return [headLine, "", ...cabangResults.map(fmtScenarioBlock).map(b => b + "\n")].join("\n")
})

const md: string[] = []
md.push(`# E2E Test Report — 13 Cabang TMA Multi-Shift (${CABANG_TMA.length} units) × 4 Skenario`)
md.push("")
md.push(`**Date:** ${new Date(endTs).toISOString()}`)
md.push(`**Period tested:** ${MONTH}/${YEAR} (${DAYS_IN_MONTH} days)`)
md.push(`**Engine refactor:** rolling-engine multi-shift aware (per shift token iteration + adaptive nPersonnel)`)
md.push(`**Total runs:** ${totalRuns} (${CABANG_TMA.length} unit × ${SCENARIOS.length} skenario)`)
md.push(`**Duration:** ${((endTs - startTs) / 1000).toFixed(1)}s`)
md.push("")
md.push(`## Executive Summary`)
md.push("")
md.push(`- **PASS:** ${totalPass}/${totalRuns} (${(totalPass / totalRuns * 100).toFixed(1)}%)`)
md.push(`- **FAIL:** ${totalFail}/${totalRuns} (${(totalFail / totalRuns * 100).toFixed(1)}%)`)
md.push(`- **Fully PASS (4/4):** ${fullyPass.length} unit — ${fullyPass.length > 0 ? fullyPass.join("; ") : "_none_"}`)
md.push(`- **Fully FAIL (0/4):** ${fullyFail.length} unit — ${fullyFail.length > 0 ? fullyFail.join("; ") : "_none_"}`)
md.push(`- **Partial:** ${partial.length} unit — ${partial.length > 0 ? partial.join("; ") : "_none_"}`)
md.push("")
md.push(`### Per-skenario breakdown`)
md.push("")
md.push(`| Skenario | PASS | FAIL | % |`)
md.push(`|---|---:|---:|---:|`)
for (const sc of SCENARIOS) {
  const stat = scenarioStats[sc.name]
  md.push(`| ${sc.name} | ${stat.pass} | ${stat.fail} | ${(stat.pass / CABANG_TMA.length * 100).toFixed(1)}% |`)
}
md.push("")
md.push(`## Aggregate Issues`)
md.push("")
if (issueRows.length > 0) {
  md.push(`| Issue | Unit affected | Affected list |`)
  md.push(`|---|---:|---|`)
  md.push(...issueRows)
} else {
  md.push(`_No issues — all units passed._`)
}
md.push("")
md.push(`## Action items per unit`)
md.push("")
md.push(`| Cabang | Unit | Status | Top issue |`)
md.push(`|---|---|---|---|`)
for (const spec of CABANG_TMA) {
  const key = `${spec.name} ${spec.unit}`
  const s = summaryByUnit[key]
  const ur = allResults.filter(r => r.cabang === spec.name && r.unit === spec.unit)
  const topIssue = ur.find(r => r.issues.length > 0)?.issues[0] || "—"
  const statusStr = s.fail === 0 ? "✓ all PASS" : s.pass === 0 ? "✗ all FAIL" : `partial ${s.pass}/${SCENARIOS.length}`
  md.push(`| ${spec.name} | ${spec.unit} | ${statusStr} | ${topIssue.slice(0, 100)} |`)
}
md.push("")
md.push(`## Detail per Unit`)
md.push("")
md.push(...perUnitBlocks)
md.push("")
md.push(`---`)
md.push("")
md.push(`*Raw log: \`outputs/E2E_TEST_RAW_LOG_MULTISHIFT_TMA.txt\`*`)
md.push(`*Raw JSON: \`outputs/E2E_TEST_RAW_RESULTS_MULTISHIFT_TMA.json\`*`)

fs.writeFileSync(REPORT_PATH, md.join("\n"))
log(`Report:      ${REPORT_PATH}`)

fs.closeSync(logFd)
