// ============================================================
// src/pages/TunjanganPage.tsx — Standalone Tunjangan ATC page
// ──────────────────────────────────────────────────────────
// Extracted from CAPanel di src/pages/RosterPage.tsx (step 4 dari
// ROSTER_HANDOFF.md §9).
//
// Output-oriented: page ini cuma READ. Edit data sumber (roster,
// off-roster, jam tambahan) dilakukan di Roster ATC page.
//
// Status step 4:
//   ✓ Page skeleton + toolbar + topbar + status pill
//   ✓ Load roster + cells dari Supabase
//   ✓ Render existing computeAllowanceTable output
//   ✓ Empty state untuk roster DRAFT / belum ada
//   ✓ Stats strip + tabel + footer disclaimer
//   ✓ Kolom Jam Advance + Jam Extend (placeholder 0 — wired di step 9)
//   ✓ Export CSV (existing pattern)
//
// Step 9 nanti: tambah overtime fetch + total terupdate + tampilkan
// Advance/Extend hours real. Engine update di control-allowance.ts
// akan dipanggil dengan field `overtime` baru.
//
// Anti-pattern stability §10:
//   - toast lewat useRef (TIDAK di dependency array)
//   - AbortController di setiap fetch
//   - empty data → empty state UI, BUKAN toast.error
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../supabase.js"
import { useApp } from "../lib/context.jsx"
import { useToast } from "../components/Toast.jsx"
import { I } from "../components/Icons.jsx"
import {
  listAirports,
  getAirport,
  getUnit,
  getCAConstant,
} from "../lib/roster-engine/airport-config-loader"
import {
  computeAllowanceTable,
  type PersonnelAllowance,
} from "../lib/roster-engine/control-allowance"
import type { RosterCell } from "../lib/roster-engine/types"
import "../styles/tunjangan.css"

/* ----------------------------------------------------------------
   Types — local DB row shapes
   ---------------------------------------------------------------- */
interface DBPersonnel {
  id: string
  full_name?: string
  initial?: string
  nik?: string | null
  branch_code?: string | null
}

interface DBRoster {
  id: string
  airport_code: string
  unit: string
  year: number
  month: number
  status: "DRAFT" | "FINAL"
}

interface DBRosterCell {
  personnel_id: string
  day: number
  status: string
  locked?: boolean
}

/* ----------------------------------------------------------------
   Constants
   ---------------------------------------------------------------- */
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */
const isUuidLike = (s: string | undefined): boolean =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)

const deriveDisplayInitial = (name: string | undefined, fallback = "P"): string => {
  if (!name) return fallback
  const words = name.trim().split(/\s+/).filter(w => w.length > 0)
  if (words.length === 0) return fallback
  return words[0][0].toUpperCase() + (words[1]?.[0]?.toUpperCase() || "")
}

const formatRp = (n: number): string =>
  "Rp " + Math.round(n).toLocaleString("id-ID")

const formatHours = (n: number): string =>
  n === 0 ? "—" : n.toFixed(2)

/* ----------------------------------------------------------------
   Main page
   ---------------------------------------------------------------- */
export default function TunjanganPage() {
  const ctx: any = useApp()
  const toast: any = useToast()
  const user = ctx?.user
  const isAdmin = user?.role === "admin"
  const userBranchCode = (user?.branch_code || "").toUpperCase()

  // toast wajib via ref (anti-pattern §10)
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  /* ── Airport resolution (mirror RosterPage) ── */
  const allAirports = useMemo(() => listAirports(), [])

  const resolvedFromBranch = useMemo(() => {
    if (!userBranchCode) return null
    const direct = getAirport(userBranchCode)
    if (direct) return direct.airport_code
    const branchObj = ctx?.branches?.find((b: any) => b.code === userBranchCode)
    if (!branchObj) return null
    const branchName = (branchObj.name || "").toLowerCase()
    for (const a of allAirports) {
      const engName = a.airport_name.toLowerCase()
      if (engName === branchName) return a.airport_code
      if (branchName.includes(engName)) return a.airport_code
      if (engName.includes(branchName)) return a.airport_code
    }
    return null
  }, [userBranchCode, ctx?.branches, allAirports])

  /* ── Filter state ── */
  const [airportCode, setAirportCode] = useState<string>(
    resolvedFromBranch || userBranchCode || "WARR"
  )
  const [unit, setUnit] = useState<string>("TWR")
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1)

  /* ── Loaded data ── */
  const [dbPersonnel, setDbPersonnel] = useState<DBPersonnel[]>([])
  const [roster, setRoster] = useState<Record<string, RosterCell[]> | null>(null)
  const [rosterStatus, setRosterStatus] = useState<"DRAFT" | "FINAL" | "NONE">("NONE")
  const [loading, setLoading] = useState(false)

  /* ── Airport meta ── */
  const airport = useMemo(() => getAirport(airportCode), [airportCode])
  const airportName = airport?.airport_name || airportCode
  const availableUnits = useMemo(() => airport?.units?.map(u => u.unit) || ["TWR"], [airport])
  const unitConfig = useMemo(() => airport ? getUnit(airport, unit) : undefined, [airport, unit])
  const constInfo = useMemo(() => getCAConstant(airportName), [airportName])

  const selectableAirports = useMemo(() => {
    if (isAdmin) return allAirports
    const resolved = resolvedFromBranch || userBranchCode
    return allAirports.filter(a => a.airport_code === resolved)
  }, [isAdmin, allAirports, resolvedFromBranch, userBranchCode])

  /* ── Load personnel for airport/unit ── */
  useEffect(() => {
    if (!user) return
    const ctrl = new AbortController()
    const branchFilter = isAdmin ? null : userBranchCode
    const ctxPersonnel: any[] = ctx?.personnel || []
    const filtered = ctxPersonnel.filter((p: any) => {
      if (branchFilter && p.branch_code !== branchFilter) return false
      return true
    })
    if (!ctrl.signal.aborted) {
      setDbPersonnel(filtered.map((p: any, i: number) => {
        const name = p.name || p.full_name || ""
        const rawInit = p.initial && !isUuidLike(p.initial) ? p.initial : null
        const initial = rawInit || deriveDisplayInitial(name, `P${i + 1}`)
        return {
          id: p.id,
          full_name: name,
          initial,
          nik: p.nik || null,
          branch_code: p.branch_code,
        }
      }))
    }
    return () => ctrl.abort()
  }, [user, isAdmin, userBranchCode, ctx?.personnel])

  /* ── Load roster (status + cells) ── */
  const loadRoster = useCallback(async () => {
    if (!airportCode || !unit || !year || !month) return
    setLoading(true)
    const ctrl = new AbortController()
    try {
      const { data: rRow } = await supabase
        .from("atc_rosters")
        .select("id, status")
        .eq("airport_code", airportCode)
        .eq("unit", unit)
        .eq("year", year)
        .eq("month", month)
        .abortSignal(ctrl.signal)
        .maybeSingle()

      if (ctrl.signal.aborted) return

      if (!rRow) {
        setRoster(null)
        setRosterStatus("NONE")
        return
      }

      const r = rRow as DBRoster

      const { data: cells } = await supabase
        .from("atc_roster_cells")
        .select("personnel_id, day, status, locked")
        .eq("roster_id", r.id)
        .abortSignal(ctrl.signal)

      if (ctrl.signal.aborted) return

      if (cells && cells.length > 0) {
        const grouped: Record<string, RosterCell[]> = {}
        for (const c of cells as DBRosterCell[]) {
          if (!grouped[c.personnel_id]) grouped[c.personnel_id] = []
          grouped[c.personnel_id][c.day - 1] = { status: c.status, locked: !!c.locked }
        }
        setRoster(grouped)
      } else {
        setRoster({})
      }
      setRosterStatus(r.status)
    } catch (e: any) {
      if (e?.name === "AbortError") return
      // BUKAN error: empty data → empty state. Toast hanya untuk genuine error.
      if (e?.message && !/no rows/i.test(e.message)) {
        toastRef.current?.error?.("Gagal memuat roster", e.message)
      }
      setRoster(null)
      setRosterStatus("NONE")
    } finally {
      setLoading(false)
    }
    return () => ctrl.abort()
  }, [airportCode, unit, year, month])

  useEffect(() => { loadRoster() }, [loadRoster])

  /* ── Allowance computation ── */
  const allowance = useMemo(() => {
    if (!roster || !unitConfig?.rolling || dbPersonnel.length === 0) return null

    const daysInMonth = new Date(year, month, 0).getDate()
    // Mode "" (empty) is allowed by RosterMode union; we're not generating
    // a roster here — just feeding existing data to the allowance compute.
    const fakeResult = {
      success: true as const,
      year, month,
      daysInMonth,
      personnel: dbPersonnel.map(p => ({ id: p.id, initial: p.initial || p.id, leaves: [] })),
      roster,
      mode: "" as const,
      cutoffDay: 0,
      requiredPerDay: unitConfig.min_on_duty_baseline ?? 3,
      isTni: false,
    }

    const nameLookup: Record<string, string> = {}
    const nikLookup: Record<string, string> = {}
    for (const p of dbPersonnel) {
      nameLookup[p.id] = p.full_name || p.initial || p.id
      if (p.nik) nikLookup[p.id] = p.nik
    }

    return computeAllowanceTable({
      airportName,
      result: fakeResult,
      unitConfig,
      priorityOrder: dbPersonnel.map(p => p.id),
      nameLookup,
      nikLookup,
      rosterStatus: rosterStatus === "NONE" ? "DRAFT" : rosterStatus,
    })
  }, [roster, unitConfig, dbPersonnel, year, month, airportName, rosterStatus])

  /* ── Derived stats (with Advance/Extend placeholders = 0 in step 4) ── */
  const totalOvertimeHours = 0  // ← real value di step 9
  const totalOvertimeEntries = 0
  const stats = useMemo(() => {
    if (!allowance) return null
    return {
      personel: allowance.rows.length,
      jamTotal: allowance.summary.total_kontrol_hours + totalOvertimeHours,
      jamTambahan: totalOvertimeHours,
      jamTambahanEntries: totalOvertimeEntries,
      totalRp: allowance.summary.total_allowance,
      rate: allowance.constant_per_hour,
    }
  }, [allowance])

  /* ── Export CSV ── */
  const downloadCSV = () => {
    if (!allowance) return
    const headers = [
      "No", "Inisial", "Nama", "Hari Aktif",
      "Jam Reguler", "Jam Advance", "Jam Extend",
      "Total Jam", "Rate (Rp/jam)", "Total (Rp)",
    ]
    const lines = [
      `Tunjangan ATC — ${airportName} ${unit} — ${MONTHS[month - 1]} ${year}`,
      `Status: ${rosterStatus}`,
      `Konstanta: Rp ${allowance.constant_per_hour.toLocaleString("id-ID")}/jam`,
      "",
      headers.join(","),
      ...allowance.rows.map((r: PersonnelAllowance, i: number) => {
        // Days active = inferred dari kontrol_minutes / daily kontrol (best-effort)
        const daysActive = "—"
        const advance = 0  // step 9
        const extend = 0   // step 9
        const totalH = r.kontrol_hours + advance + extend
        return [
          i + 1, r.initial, `"${r.name}"`, daysActive,
          r.kontrol_hours.toFixed(2),
          advance.toFixed(2),
          extend.toFixed(2),
          totalH.toFixed(2),
          r.constant_per_hour.toFixed(0),
          Math.round(totalH * r.constant_per_hour).toString(),
        ].join(",")
      }),
      "",
      `TOTAL,,,,${allowance.summary.total_kontrol_hours.toFixed(2)},${(0).toFixed(2)},${(0).toFixed(2)},${(allowance.summary.total_kontrol_hours + totalOvertimeHours).toFixed(2)},,${Math.round(allowance.summary.total_allowance).toLocaleString("id-ID").replace(/\./g, "")}`,
    ]
    const csv = lines.join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `Tunjangan_${airportName.replace(/\s+/g, "_")}_${unit}_${year}_${String(month).padStart(2, "0")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const goRoster = () => ctx?.goPage?.("roster")

  /* ── Render ── */
  return (
    <div className="tj-page">
      {/* Topbar */}
      <header className="tj-topbar">
        <div>
          <h1>Tunjangan ATC</h1>
          <div className="tj-topbar-sub">
            <span>Cabang <b>{airportCode}</b>{airportName !== airportCode ? ` — ${airportName}` : ""}</span>
            <span className="tj-sep">·</span>
            <span>Unit <b>{unit}</b></span>
            <span className="tj-sep">·</span>
            <span>Periode <b>{MONTHS[month - 1]} {year}</b></span>
            {constInfo && (
              <>
                <span className="tj-sep">·</span>
                <span>Konstanta <b>{formatRp(constInfo.constant_per_hour)}</b>/jam</span>
              </>
            )}
          </div>
        </div>
        <div>
          {rosterStatus === "FINAL" && (
            <span className="tj-pill final">Roster · FINAL</span>
          )}
          {rosterStatus === "DRAFT" && (
            <span className="tj-pill draft">Roster · DRAFT</span>
          )}
          {rosterStatus === "NONE" && (
            <span className="tj-pill none">Roster · belum dibuat</span>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="tj-toolbar">
        <div className="tj-field">
          <label htmlFor="tj-airport">Cabang</label>
          <select
            id="tj-airport"
            value={airportCode}
            onChange={e => setAirportCode(e.target.value)}
            disabled={!isAdmin && selectableAirports.length <= 1}
          >
            {selectableAirports.map(a => (
              <option key={a.airport_code} value={a.airport_code}>
                {a.airport_code} — {a.airport_name}
              </option>
            ))}
          </select>
        </div>
        <div className="tj-field">
          <label htmlFor="tj-unit">Unit</label>
          <select id="tj-unit" value={unit} onChange={e => setUnit(e.target.value)}>
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="tj-field">
          <label htmlFor="tj-month">Bulan</label>
          <select id="tj-month" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="tj-field">
          <label htmlFor="tj-year">Tahun</label>
          <select id="tj-year" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="tj-spacer"/>
        <button className="tj-btn" type="button" onClick={loadRoster} disabled={loading}>
          <I n="refresh" s={14}/> Reload
        </button>
        <button
          className="tj-btn tj-btn-primary"
          type="button"
          onClick={downloadCSV}
          disabled={!allowance || rosterStatus !== "FINAL"}
        >
          <I n="download" s={14}/> Export CSV
        </button>
      </div>

      {/* Stats — hanya kalau ada data */}
      {stats && (
        <div className="tj-stats">
          <div className="tj-stat">
            <div className="tj-stat-ic acc"><I n="users" s={16}/></div>
            <div>
              <div className="tj-stat-l">Personel</div>
              <div className="tj-stat-v">{stats.personel}</div>
              <div className="tj-stat-s">terdaftar di {unit}</div>
            </div>
          </div>
          <div className="tj-stat">
            <div className="tj-stat-ic on"><I n="clock" s={16}/></div>
            <div>
              <div className="tj-stat-l">Jam Total</div>
              <div className="tj-stat-v">{stats.jamTotal.toFixed(0)} j</div>
              <div className="tj-stat-s">reguler + tambahan</div>
            </div>
          </div>
          <div className="tj-stat">
            <div className="tj-stat-ic warn"><I n="plus" s={16}/></div>
            <div>
              <div className="tj-stat-l">Jam Tambahan</div>
              <div className="tj-stat-v">{stats.jamTambahan.toFixed(2)} j</div>
              <div className="tj-stat-s">{stats.jamTambahanEntries} entries</div>
            </div>
          </div>
          <div className="tj-stat">
            <div className="tj-stat-ic vio"><I n="wallet" s={16}/></div>
            <div>
              <div className="tj-stat-l">Total Tunjangan</div>
              <div className="tj-stat-v">{formatRp(stats.totalRp)}</div>
              <div className="tj-stat-s">untuk {MONTHS[month - 1]} {year}</div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!allowance && !loading && (
        <div className="tj-empty">
          <div className="tj-empty-ic"><I n="clock" s={32}/></div>
          <h3>
            {rosterStatus === "NONE"
              ? `Roster ${MONTHS[month - 1]} ${year} belum dibuat`
              : `Roster ${MONTHS[month - 1]} ${year} masih ${rosterStatus}`}
          </h3>
          <p>
            Tunjangan ATC hanya dapat dihitung setelah roster bulan ini di-FINAL.
            Pergi ke <b>Roster ATC → Jadwal Bulanan</b> untuk{" "}
            {rosterStatus === "NONE" ? "generate roster + finalkan" : "review FRMS & finalkan"}.
          </p>
          <button className="tj-btn tj-btn-primary" type="button" onClick={goRoster}>
            → Buka Roster ATC
          </button>
        </div>
      )}

      {/* Tabel — hanya kalau ada allowance */}
      {allowance && (
        <>
          <div className="tj-table-wrap">
            <div className="tj-table-bar">
              <div className="tj-table-title">
                <I n="wallet" s={15}/> Rincian Tunjangan per Personel
              </div>
              <span className="tj-faint mono">
                {allowance.rows.length} personel · {new Date(year, month, 0).getDate()} hari
              </span>
            </div>
            <div className="tj-source-line">
              <span className="tj-source-badge">SOURCE</span>
              <span>
                Dihitung dari roster {rosterStatus} {MONTHS[month - 1]} {year}.
                Kolom Jam Tambahan masih placeholder (wire di step 9).
              </span>
              <span className="tj-faint" style={{ marginLeft: "auto" }}>
                Edit data sumber di{" "}
                <button type="button" className="tj-link" onClick={goRoster}>Roster ATC</button>.
              </span>
            </div>

            <div className="tj-table-scroll">
              <table className="tj-table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Personel</th>
                    <th className="num">Hari Aktif</th>
                    <th className="num">Jam Reguler</th>
                    <th className="num">Jam Advance</th>
                    <th className="num">Jam Extend</th>
                    <th className="num">Total Jam</th>
                    <th className="num">Rate / Jam</th>
                    <th className="num">Total Rp</th>
                  </tr>
                </thead>
                <tbody>
                  {allowance.rows.map((r: PersonnelAllowance, i: number) => {
                    const advance = 0  // step 9
                    const extend = 0   // step 9
                    const totalH = r.kontrol_hours + advance + extend
                    return (
                      <tr key={r.personnel_id}>
                        <td className="no mono">{i + 1}</td>
                        <td className="name">
                          {r.name}
                          <span className="nik">{r.initial}{r.personnel_id ? " · " + r.personnel_id.slice(0, 8) : ""}</span>
                        </td>
                        <td className="num">—</td>
                        <td className="num">{r.kontrol_hours.toFixed(2)}</td>
                        <td className="num col-adv">{formatHours(advance)}</td>
                        <td className="num col-ext">{formatHours(extend)}</td>
                        <td className="num total-jam">{totalH.toFixed(2)}</td>
                        <td className="num">{r.constant_per_hour.toLocaleString("id-ID")}</td>
                        <td className="num total-rp">{formatRp(totalH * r.constant_per_hour)}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="label" colSpan={2}>Total seluruh personel</td>
                    <td className="num">—</td>
                    <td className="num">{allowance.summary.total_kontrol_hours.toFixed(2)}</td>
                    <td className="num col-adv">{(0).toFixed(2)}</td>
                    <td className="num col-ext">{(0).toFixed(2)}</td>
                    <td className="num grand total-jam">
                      {(allowance.summary.total_kontrol_hours + totalOvertimeHours).toFixed(2)}
                    </td>
                    <td className="num faint">—</td>
                    <td className="num grand">{formatRp(allowance.summary.total_allowance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <p className="tj-faint" style={{ fontSize: 12, padding: "8px 4px 0" }}>
            Rate Advance &amp; Extend <b style={{ color: "var(--text-muted)" }}>sama</b> dengan rate jam reguler —
            tidak ada premium 1,5× atau 2×. Total Rp = Total Jam × Rate per jam.
          </p>

          {/* Warnings */}
          {allowance.warnings.length > 0 && (
            <div className="tj-warnings">
              <div className="tj-warnings-h">
                <I n="alert" s={14}/> {allowance.warnings.length} validation warning
              </div>
              <ul>
                {allowance.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
