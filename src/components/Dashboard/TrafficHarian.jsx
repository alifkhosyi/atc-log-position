// ============================================================
// src/components/Dashboard/TrafficHarian.jsx
// ──────────────────────────────────────────────────────────
// Extracted from src/pages/cabang/Dashboard.jsx (Phase G refactor).
//
// Replaces the old per-hour traffic chart with a 7-day stacked
// view (DEP / ARR / OVF). Acceptance criteria (Dashboard §8):
//   • 7-day window, today is right-most and highlighted
//   • Stacked DEP / ARR / OVF using --traffic-* tokens
//   • Summary line: average movements/day + Δ vs yesterday
//
// Implemented with pure CSS bars (no Chart.js dep) — matches the
// prototype exactly and avoids adding a runtime library that is
// not currently in package.json.
//
// Tokens used (all already in src/index.css):
//   --accent       → DEP
//   --status-warn  → ARR
//   --text-faint   → OVF
//   --border, --text, --text-faint, --status-on, --status-alert
// ============================================================

import React from "react"
import { I } from "../Icons.jsx"

const pad = (n) => String(n).padStart(2, "0")
const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
const dayKey = (d) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
const dayLabel = (d) => `${DOW[d.getDay()]} ${pad(d.getDate())}`

/* ----------------------------------------------------------------
   buildTraffic7 — exported for callers (Dashboard page, tests).
   Aggregates ctx.logs into 7 day-buckets ending today.
   ---------------------------------------------------------------- */
export const buildTraffic7 = (allLogs = [], now = new Date(), branchCodes = null) => {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const buckets = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    buckets.push({
      date: d,
      key: dayKey(d),
      label: dayLabel(d),
      dep: 0, arr: 0, ovf: 0,
      today: i === 0,
    })
  }
  const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]))

  allLogs.forEach((l) => {
    if (branchCodes && !branchCodes.includes(l.branch_code)) return
    const b = byKey[dayKey(l.on_time)]
    if (!b) return
    b.dep += l.departure_count || 0
    b.arr += l.arrival_count   || 0
    b.ovf += l.overfly_count   || 0
  })

  return buckets
}

/* ----------------------------------------------------------------
   TrafficHarian — visual component
   ---------------------------------------------------------------- */
export const TrafficHarian = ({ data = [] }) => {
  if (data.length === 0) return null

  const max = Math.max(1, ...data.map((d) => d.dep + d.arr + d.ovf))
  const total = data.reduce((a, d) => a + d.dep + d.arr + d.ovf, 0)
  const avg = Math.round(total / data.length)
  const today = data[data.length - 1]
  const yesterday = data[data.length - 2]
  const yTotal = (yesterday?.dep || 0) + (yesterday?.arr || 0) + (yesterday?.ovf || 0)
  const tTotal = today.dep + today.arr + today.ovf
  const delta = yTotal === 0 ? null : Math.round(((tTotal - yTotal) / yTotal) * 100)

  return (
    <div className="dash-panel">
      <div className="dash-panel-h">
        <div className="dash-panel-t"><I n="chart" s={15}/> Traffic Harian</div>
        <span className="dash-panel-counter">7 hari terakhir</span>
      </div>

      <div className="dash-traf-wrap">
        <div className="dash-traf-bars">
          {data.map((d, i) => {
            const dh = (d.dep / max) * 100
            const ah = (d.arr / max) * 100
            const oh = (d.ovf / max) * 100
            const dayTotal = d.dep + d.arr + d.ovf
            return (
              <div key={i} className={`dash-traf-day${d.today ? " today" : ""}`}>
                <div className="dash-traf-tip">
                  <span className="l">{d.label}</span>
                  <div className="ln"><span>DEP</span><b style={{ color: "var(--traffic-dep)" }}>{d.dep}</b></div>
                  <div className="ln"><span>ARR</span><b style={{ color: "var(--traffic-arr)" }}>{d.arr}</b></div>
                  <div className="ln"><span>OVF</span><b style={{ color: "var(--traffic-ovf)" }}>{d.ovf}</b></div>
                  <div className="ln" style={{ borderTop: "1px solid var(--border)", paddingTop: 4, marginTop: 4 }}>
                    <span>Total</span><b>{dayTotal}</b>
                  </div>
                </div>
                <div className="dash-traf-stack">
                  <div className="dash-traf-bar dep" style={{ height: `${dh}%` }}/>
                  <div className="dash-traf-bar arr" style={{ height: `${ah}%` }}/>
                  <div className="dash-traf-bar ovf" style={{ height: `${oh}%` }}/>
                </div>
              </div>
            )
          })}
        </div>
        <div className="dash-traf-axis">
          {data.map((d, i) => (
            <div key={i} className={d.today ? "today" : ""}>{d.label}</div>
          ))}
        </div>
      </div>

      <div className="dash-traf-foot">
        <span className="lg"><i style={{ background: "var(--traffic-dep)" }}/> DEP</span>
        <span className="lg"><i style={{ background: "var(--traffic-arr)" }}/> ARR</span>
        <span className="lg"><i style={{ background: "var(--traffic-ovf)", opacity: .5 }}/> OVF</span>
        <span className="summary">
          Rata-rata <b>{avg} mov/hari</b>
          {delta !== null && (
            <>
              {" · Hari ini "}
              {delta >= 0
                ? <span className="up">+{delta}%</span>
                : <span className="down">{delta}%</span>}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

export default TrafficHarian
