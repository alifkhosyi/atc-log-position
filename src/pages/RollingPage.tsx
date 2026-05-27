// ============================================================
// src/pages/RollingPage.tsx — Rolling Harian (MVP read-only)
// ──────────────────────────────────────────────────────────
// Step 3+4: skeleton + toolbar + airport/unit/date state resolved.
// Engine wiring + grid + PDF di step 5-9.
//
// Refer ROLLING_HANDOFF.md (v1 MVP) untuk scope + AC.
// Anti-pattern §8 stability dipatuhi dari awal.
// ============================================================

import React, { useEffect, useMemo, useRef, useState } from "react"
import { useApp } from "../lib/context.jsx"
import { useToast } from "../components/Toast.jsx"
import { I } from "../components/Icons.jsx"
import {
  listAirports, getAirport,
} from "../lib/roster-engine/airport-config-loader"
import "../styles/rolling.css"

/* ----------------------------------------------------------------
   Local helpers
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

const parseISO = (iso: string): { year: number; month: number; day: number } => {
  // YYYY-MM-DD safe parse
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

  // Airport resolution
  const { resolved, selectable } = useResolvedAirport(userBranchCode, isAdmin)
  const [airportCode, setAirportCode] = useState<string>(
    resolved || userBranchCode || "WARR"
  )

  // Date (default = today)
  const [date, setDate] = useState<string>(() => todayISO())

  // Unit (default = first available, biasanya TWR)
  const airport = useMemo(() => getAirport(airportCode), [airportCode])
  const availableUnits = useMemo(
    () => airport?.units?.map(u => u.unit) || ["TWR"],
    [airport]
  )
  const [unit, setUnit] = useState<string>("TWR")
  // Auto-fallback kalau unit yang dipilih tidak ada di airport baru
  useEffect(() => {
    if (availableUnits.length > 0 && !availableUnits.includes(unit)) {
      setUnit(availableUnits[0])
    }
  }, [availableUnits, unit])

  const unitConfig = useMemo(
    () => airport && airport.units.find(u => u.unit === unit),
    [airport, unit]
  )

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
          {/* Status pill ditambah di step 5 saat data roster loaded */}
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
        <button
          className="rl-btn"
          type="button"
          onClick={() => setDate(todayISO())}
        >
          Hari ini
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

      {/* Placeholder body — diisi step 5-8 */}
      <div className="rl-placeholder">
        <div className="rl-placeholder-ic"><I n="refresh" s={32}/></div>
        <h2>Skeleton siap (step 3+4)</h2>
        <p>
          Engine + grid + empty states di-wire di step 5-8.
          Airport: <b>{airportCode}</b> · Unit: <b>{unit}</b> · Date: <b>{date}</b>
        </p>
        <p style={{ fontSize: 12, color: "var(--text-faint)" }}>
          Rolling config: {unitConfig?.rolling ? "✓ ada" : "✗ tidak ada"}
        </p>
      </div>
    </div>
  )
}
