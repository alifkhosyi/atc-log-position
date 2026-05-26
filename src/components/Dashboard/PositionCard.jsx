// ============================================================
// src/components/Dashboard/PositionCard.jsx
// ──────────────────────────────────────────────────────────
// Extracted from src/pages/cabang/Dashboard.jsx (Phase G refactor).
//
// READ-ONLY card. Per the Log Position deprecation:
//   • No off-mic button — Log Position is gone.
//   • Click / Enter / Space → onClick callback (parent navigates to
//     Roster, where the controller's row can be focused). The brief
//     suggests `/roster?focus={id}` but this app uses a state-driven
//     pager (ctx.goPage), so the parent passes the log to its own
//     handler — we just expose the intent.
//   • Two-hour FRMS marker (⚠) auto-shows when on-mic ≥ 120 min.
//
// All classes (.dash-pos-card etc.) live in src/styles/dashboard.css.
// ============================================================

import React from "react"
import { fmtT, durMin } from "../../lib/utils.js"
import { I } from "../Icons.jsx"

const pad = (n) => String(n).padStart(2, "0")
const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}j ${pad(m)}m` : `${m}m`
}

export const PositionCard = ({ log, now, onClick }) => {
  const mins = durMin(log.on_time, now.toISOString())
  const isWarn = mins >= 120

  const handleKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onClick?.(log)
    }
  }

  return (
    <div
      className={`dash-pos-card${isWarn ? " is-warn" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(log)}
      onKeyDown={handleKey}
      aria-label={`Buka detail ${log.atc_name} di Roster`}
    >
      <div className="dash-pos-row1">
        <span className="dash-pulse"/>
        <span className="dash-pos-unit">{log.unit}</span>
        <span className="dash-pos-sect">· {log.sector}</span>
      </div>
      <div className="dash-pos-cwp">{log.cwp}</div>
      <div className="dash-pos-name">{log.atc_name}</div>
      <div className={`dash-pos-foot${isWarn ? " is-warn" : ""}`}>
        <span>
          {fmtT(log.on_time)} · <b>{fmtDuration(mins)}{isWarn ? " ⚠" : ""}</b>
        </span>
        <span className="dash-pos-arrow"><I n="chevron-right" s={14}/></span>
      </div>
    </div>
  )
}

export default PositionCard
