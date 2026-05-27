// ============================================================
// src/pages/RollingPage.tsx — Rolling Harian (MVP read-only)
// ──────────────────────────────────────────────────────────
// Step 5+6: load cells + engine wire.
// Grid + empty states di step 7+8, PDF export di step 9.
//
// Anti-pattern §8 stability dipatuhi:
//   - toast via useRef (TIDAK di deps array)
//   - AbortController OWNED by useEffect (signal passed to loader)
//   - Empty data → empty state UI, BUKAN toast.error
//   - Realtime subscription: tidak dipakai di MVP
// ============================================================

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { supabase } from "../supabase.js"
import { useApp } from "../lib/context.jsx"
import { useToast } from "../components/Toast.jsx"
import { I } from "../components/Icons.jsx"
import {
  listAirports, getAirport,
} from "../lib/roster-engine/airport-config-loader"
import {
  computeMonthlyRolling, computeRecap,
  type DailyRolling,
} from "../lib/roster-engine/rolling"
import type { RosterCell, GenerateResult } from "../lib/roster-engine/types"
import "../styles/rolling.css"

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
const DAYS_LONG = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu",
]

const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const parseISO = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number)
  return { year: y, month: m, day: d }
}
const fmtDateLong = (iso: string): string => {
  const { year, month, day } = parseISO(iso)
  const d = new Date(year, month - 1, day)
  return `${DAYS_LONG[d.getDay()]}, ${day} ${MONTHS_LONG[month - 1]} ${year}`
}
const addDays = (iso: string, n: number): string => {
  const { year, month, day } = parseISO(iso)
  const d = new Date(year, month - 1, day + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const isUuidLike = (s: string | undefined): boolean =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)

const deriveDisplayInitial = (name?: string, fallback = "P"): string => {
  if (!name) return fallback
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return fallback
  return words[0][0].toUpperCase() + (words[1]?.[0]?.toUpperCase() || "")
}

/* ----------------------------------------------------------------
   DB types
   ---------------------------------------------------------------- */
interface DBPersonnel {
  id: string
  full_name?: string
  initial?: string
  branch_code?: string | null
}

interface DBRosterCell {
  personnel_id: string
  day: number
  status: string
  locked?: boolean
}

type RosterStatusUi = "DRAFT" | "FINAL" | "NONE"

/* ----------------------------------------------------------------
   Airport resolution (mirror RosterPage / TunjanganPage)
   ---------------------------------------------------------------- */
function useResolvedAirport(branchCode: string, isAdmin: boolean) {
  const allAirports = useMemo(() => listAirports(), [])
  const ctx: any = useApp()
  const resolved = useMemo(() => {
    if (!branchCode) return null
    const direct = getAirport(branchCode)
    if (direct) return direct.airport_code
    const branchObj = ctx?.branches?.find((b: any) => b.code === branchCode)
    if (!branchObj) return null
    const branchName = (branchObj.name || "").toLowerCase()
    for (const a of allAirports) {
      const engName = a.airport_name.toLowerCase()
      if (engName === branchName) return a.airport_code
      if (branchName.includes(engName)) return a.airport_code
      if (engName.includes(branchName)) return a.airport_code
    }
    return null
  }, [branchCode, ctx?.branches, allAirports])
  const selectable = useMemo(() => {
    if (isAdmin) return allAirports
    return allAirports.filter(a => a.airport_code === (resolved || branchCode))
  }, [isAdmin, allAirports, resolved, branchCode])
  return { resolved, selectable }
}

/* ----------------------------------------------------------------
   Main
   ---------------------------------------------------------------- */
export default function RollingPage() {
  const ctx: any = useApp()
  const toast: any = useToast()
  const user = ctx?.user
  const isAdmin = user?.role === "admin"
  const userBranchCode = (user?.branch_code || "").toUpperCase()

  // toast via ref (anti-pattern §8)
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])

  // Airport / unit / date
  const { resolved, selectable } = useResolvedAirport(userBranchCode, isAdmin)
  const [airportCode, setAirportCode] = useState<string>(
    resolved || userBranchCode || "WARR"
  )
  const [date, setDate] = useState<string>(() => todayISO())
  const { year, month, day: selectedDay } = useMemo(() => parseISO(date), [date])

  const airport = useMemo(() => getAirport(airportCode), [airportCode])
  const availableUnits = useMemo(
    () => airport?.units?.map(u => u.unit) || ["TWR"],
    [airport]
  )
  const [unit, setUnit] = useState<string>("TWR")
  useEffect(() => {
    if (availableUnits.length > 0 && !availableUnits.includes(unit)) {
      setUnit(availableUnits[0])
    }
  }, [availableUnits, unit])

  const unitConfig = useMemo(
    () => airport && airport.units.find(u => u.unit === unit),
    [airport, unit]
  )

  /* ── Personnel (from context) — deduped by initial for engine ── */
  const dbPersonnel = useMemo<DBPersonnel[]>(() => {
    const branchFilter = isAdmin ? null : userBranchCode
    const ctxPersonnel: any[] = ctx?.personnel || []
    return ctxPersonnel
      .filter((p: any) => !branchFilter || p.branch_code === branchFilter)
      .map((p: any, i: number) => {
        const name = p.name || p.full_name || ""
        const rawInit = p.initial && !isUuidLike(p.initial) ? p.initial : null
        const initial = rawInit || deriveDisplayInitial(name, `P${i + 1}`)
        return {
          id: p.id, full_name: name, initial,
          branch_code: p.branch_code,
        }
      })
  }, [isAdmin, userBranchCode, ctx?.personnel])

  /* ── State: roster + cells + status ── */
  const [rosterStatus, setRosterStatus] = useState<RosterStatusUi>("NONE")
  // cellsByPersonnelId[uuid] = string[daysInMonth] of status tokens
  const [cellsByPersonnelId, setCellsByPersonnelId] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(false)

  /* ── Load roster + all cells for the month (signal-owned by useEffect) ── */
  const loadCellsWithSignal = useCallback(async (signal: AbortSignal) => {
    if (!airportCode || !unit || !year || !month) return
    if (signal.aborted) return
    setLoading(true)
    try {
      const { data: rRow, error: rErr } = await supabase
        .from("atc_rosters")
        .select("id, status")
        .eq("airport_code", airportCode)
        .eq("unit", unit)
        .eq("year", year)
        .eq("month", month)
        .abortSignal(signal)
        .maybeSingle()

      if (signal.aborted) return

      if (rErr && !/no rows/i.test(rErr.message)) {
        toastRef.current?.error?.("Gagal memuat roster", rErr.message)
        setRosterStatus("NONE")
        setCellsByPersonnelId({})
        return
      }
      if (!rRow) {
        setRosterStatus("NONE")
        setCellsByPersonnelId({})
        return
      }

      const { data: cells, error: cErr } = await supabase
        .from("atc_roster_cells")
        .select("personnel_id, day, status, locked")
        .eq("roster_id", rRow.id)
        .abortSignal(signal)

      if (signal.aborted) return

      if (cErr && !/no rows/i.test(cErr.message)) {
        toastRef.current?.error?.("Gagal memuat sel roster", cErr.message)
        setRosterStatus(rRow.status as RosterStatusUi)
        setCellsByPersonnelId({})
        return
      }

      const daysInMonth = new Date(year, month, 0).getDate()
      const grouped: Record<string, string[]> = {}
      for (const c of (cells || []) as DBRosterCell[]) {
        if (!grouped[c.personnel_id]) grouped[c.personnel_id] = Array(daysInMonth).fill("-")
        grouped[c.personnel_id][c.day - 1] = c.status
      }
      setCellsByPersonnelId(grouped)
      setRosterStatus(rRow.status as RosterStatusUi)
    } catch (e: any) {
      if (e?.name === "AbortError" || signal.aborted) return
      if (e?.message && !/no rows/i.test(e.message)) {
        toastRef.current?.error?.("Gagal memuat", e.message)
      }
      setRosterStatus("NONE")
      setCellsByPersonnelId({})
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [airportCode, unit, year, month])

  useEffect(() => {
    const ctrl = new AbortController()
    loadCellsWithSignal(ctrl.signal)
    return () => ctrl.abort()
  }, [loadCellsWithSignal])

  const reload = useCallback(() => {
    const ctrl = new AbortController()
    loadCellsWithSignal(ctrl.signal)
  }, [loadCellsWithSignal])

  /* ── Build fakeResult (keyed by INITIAL for display-friendly engine output) ── */
  const fakeResult = useMemo<GenerateResult | null>(() => {
    if (Object.keys(cellsByPersonnelId).length === 0) return null
    const daysInMonth = new Date(year, month, 0).getDate()

    // Build initial → personnel (dedup if duplicate initials — keep first)
    const initialToPersonnel: Record<string, DBPersonnel> = {}
    for (const p of dbPersonnel) {
      const ini = p.initial || p.id
      if (!initialToPersonnel[ini]) initialToPersonnel[ini] = p
    }

    const roster: Record<string, RosterCell[]> = {}
    for (const ini of Object.keys(initialToPersonnel)) {
      const p = initialToPersonnel[ini]
      const rawCells = cellsByPersonnelId[p.id]
      if (!rawCells) continue
      roster[ini] = rawCells.map(status => ({ status, locked: false }))
    }

    const personnel = Object.values(initialToPersonnel).map(p => ({
      id: p.initial || p.id,
      initial: p.initial || p.id,
      leaves: [],
    }))

    return {
      success: true as const,
      year, month, daysInMonth,
      personnel,
      roster,
      mode: "" as const,
      cutoffDay: 0,
      requiredPerDay: unitConfig?.min_on_duty_baseline ?? 3,
      isTni: false,
    }
  }, [cellsByPersonnelId, dbPersonnel, year, month, unitConfig?.min_on_duty_baseline])

  /* ── Engine: compute monthly rolling, slice to selectedDay ── */
  const dailyRolling = useMemo<DailyRolling | null>(() => {
    if (!fakeResult || !unitConfig?.rolling) return null
    const r = unitConfig.rolling
    const priorityOrder = fakeResult.personnel.map(p => p.id)

    try {
      const monthly = computeMonthlyRolling({
        result: fakeResult,
        priorityOrder,
        shiftStartUtc: r.shift_start_utc,
        nSlots: r.n_slots,
        slotDurationMin: r.slot_duration_min,
        positionsPerSlot: r.positions,
        slotDurations: r.slot_durations,
        nPersonnel: r.n_personnel,
      })
      return monthly[selectedDay] || null
    } catch (e: any) {
      // Engine throwing here means config is malformed. Log only — no toast.
      console.warn("[rolling] computeMonthlyRolling threw:", e)
      return null
    }
  }, [fakeResult, unitConfig, selectedDay])

  /* ── Recap (per personnel: kontrol/asisten/istirahat menit) ── */
  const recap = useMemo(() => {
    if (!dailyRolling) return null
    return computeRecap(dailyRolling)
  }, [dailyRolling])

  /* ── Personnel lookup (initial → DBPersonnel) for display ── */
  const personnelByInitial = useMemo(() => {
    const map: Record<string, DBPersonnel> = {}
    for (const p of dbPersonnel) {
      const ini = p.initial || p.id
      if (!map[ini]) map[ini] = p
    }
    return map
  }, [dbPersonnel])

  /* ── Render ── */
  return (
    <div className="rl-page">
      {/* Topbar */}
      <header className="rl-topbar">
        <div>
          <h1>Rolling Harian</h1>
          <div className="rl-topbar-sub">
            <span>Cabang <b>{airportCode}</b>{airport && airport.airport_name !== airportCode ? ` — ${airport.airport_name}` : ""}</span>
            <span className="rl-sep">·</span>
            <span>Unit <b>{unit}</b></span>
            <span className="rl-sep">·</span>
            <span>{fmtDateLong(date)}</span>
          </div>
        </div>
        <div className="rl-topbar-aside">
          {rosterStatus === "FINAL" && <span className="rl-pill final">Roster · FINAL</span>}
          {rosterStatus === "DRAFT" && <span className="rl-pill draft">Roster · DRAFT</span>}
          {rosterStatus === "NONE"  && <span className="rl-pill none">Roster · belum dibuat</span>}
        </div>
      </header>

      {/* Toolbar */}
      <div className="rl-toolbar">
        <div className="rl-field rl-field-date">
          <label htmlFor="rl-date">Tanggal</label>
          <div className="rl-date-row">
            <button
              type="button"
              className="rl-date-nav"
              onClick={() => setDate(addDays(date, -1))}
              aria-label="Tanggal sebelumnya"
            >‹</button>
            <input
              id="rl-date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            <button
              type="button"
              className="rl-date-nav"
              onClick={() => setDate(addDays(date, +1))}
              aria-label="Tanggal berikutnya"
            >›</button>
          </div>
        </div>
        <div className="rl-field">
          <label htmlFor="rl-airport">Cabang</label>
          <select
            id="rl-airport"
            value={airportCode}
            onChange={e => setAirportCode(e.target.value)}
            disabled={!isAdmin && selectable.length <= 1}
          >
            {selectable.map(a => (
              <option key={a.airport_code} value={a.airport_code}>
                {a.airport_code} — {a.airport_name}
              </option>
            ))}
          </select>
        </div>
        <div className="rl-field">
          <label htmlFor="rl-unit">Unit</label>
          <select id="rl-unit" value={unit} onChange={e => setUnit(e.target.value)}>
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="rl-spacer"/>
        <button className="rl-btn" type="button" onClick={() => setDate(todayISO())}>
          Hari ini
        </button>
        <button className="rl-btn" type="button" onClick={reload} disabled={loading}>
          <I n="refresh" s={14}/> Reload
        </button>
        <button
          className="rl-btn rl-btn-primary"
          type="button"
          disabled
          title="PDF export wired di step 9"
        >
          <I n="download" s={14}/> Export PDF
        </button>
      </div>

      {/* Body (step 5+6 placeholder — grid+empty di step 7+8) */}
      <div className="rl-placeholder">
        <div className="rl-placeholder-ic"><I n="refresh" s={32}/></div>
        <h2>Step 5+6: data + engine wired</h2>
        <p>
          Status: <b>roster {rosterStatus}</b> · personnel {dbPersonnel.length} ·{" "}
          cells loaded {Object.keys(cellsByPersonnelId).length} ·{" "}
          rolling config {unitConfig?.rolling ? "✓" : "✗"} ·{" "}
          daily rolling untuk hari {selectedDay}:{" "}
          {dailyRolling ? `${dailyRolling.on_duty.length} on-duty, ${dailyRolling.slots.length} slots` : "tidak tersedia"}
        </p>
        {recap && (
          <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
            Recap keys: {Object.keys(recap).join(", ")} ·{" "}
            Personnel lookup by initial: {Object.keys(personnelByInitial).length}
          </p>
        )}
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
          Grid + empty states di step 7+8, PDF export di step 9.
        </p>
      </div>
    </div>
  )
}
