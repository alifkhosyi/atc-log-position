// ============================================================
// src/components/Dashboard/AlertsPanel.jsx
// ──────────────────────────────────────────────────────────
// Extracted from src/pages/cabang/Dashboard.jsx (Phase G refactor).
// Read-only dashboard panel that surfaces three classes of alert:
//
//   1. FRMS warnings   — controller on mic ≥ 120 minutes
//   2. Handover gap    — no handover checklist saved for today
//   3. Coverage gap    — branch unit with no active log
//
// Empty state shows a calm "all clear" line per acceptance criteria
// (Dashboard §8). Every row has an action button whose target page
// id is declared in the alert object — the parent decides where to
// navigate via the onAct callback.
//
// All visuals come from .dash-panel / .dash-alert-row classes that
// already live in src/styles/dashboard.css. No new tokens needed.
// ============================================================

import React from "react"
import { durMin } from "../../lib/utils.js"
import { I } from "../Icons.jsx"

/* ----------------------------------------------------------------
   Local helpers (kept private so the panel is self-sufficient)
   ---------------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, "0")
const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}j ${pad(m)}m` : `${m}m`
}

/* ----------------------------------------------------------------
   computeAlerts — pure derivation, exported so callers can reuse it
   for badges or unit tests. Input shape:
     {
       active:              position_logs without off_time (current branch)
       branchUnits:         string[] of unit codes in this branch
       now:                 Date — "right now" tick
       handoverChecklists:  handover_checklists rows (any branch)
       branchCode:          string — current branch_code
     }
   Output: Array<{ kind:"crit"|"info", title, body, act, target }>
   ---------------------------------------------------------------- */
export const computeAlerts = ({
  active = [],
  branchUnits = [],
  now,
  handoverChecklists = [],
  branchCode,
}) => {
  const out = []

  // FRMS warning: on-mic ≥ 2 hours
  active.forEach((l) => {
    const mins = durMin(l.on_time, now.toISOString())
    if (mins >= 120) {
      out.push({
        kind: "crit",
        title: `FRMS: ${l.atc_name} on mic > 2 jam`,
        body: `${l.unit} ${l.sector || ""} — disarankan rotasi (saat ini ${fmtDuration(mins)}).`,
        act: "Tinjau",
        target: "roster",
      })
    }
  })

  // Handover not ready: no checklist saved for today/branch
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const hasHandoverToday = (handoverChecklists || []).some((h) => {
    if (h.branch_code && h.branch_code !== branchCode) return false
    const created = new Date(h.created_at)
    return created >= today && created < tomorrow
  })
  if (!hasHandoverToday) {
    out.push({
      kind: "info",
      title: "Handover hari ini belum diisi",
      body: "Manager Operasi belum menyimpan checklist handover untuk shift ini.",
      act: "Isi handover",
      target: "handover",
    })
  }

  // Coverage gap: branch unit without any active log
  const activeUnits = new Set(active.map((l) => l.unit))
  ;(branchUnits || []).forEach((u) => {
    if (!activeUnits.has(u)) {
      out.push({
        kind: "info",
        title: `Slot ${u} kosong`,
        body: "Belum ada ATC on mic untuk unit ini di shift berjalan.",
        act: "Lihat roster",
        target: "roster",
      })
    }
  })

  return out
}

/* ----------------------------------------------------------------
   AlertsPanel — visual component
   ---------------------------------------------------------------- */
export const AlertsPanel = ({ items = [], onAct }) => (
  <div className="dash-panel">
    <div className="dash-panel-h">
      <div className="dash-panel-t"><I n="alert" s={15}/> Alerts &amp; Warnings</div>
      <span className="dash-panel-counter">{items.length} aktif</span>
    </div>
    {items.length === 0 ? (
      <div className="dash-alerts-empty">
        <I n="check" s={28}/>
        <span>Semua sistem operasional normal.</span>
      </div>
    ) : (
      <div className="dash-alerts">
        {items.map((a, i) => (
          <div key={i} className={`dash-alert-row ${a.kind}`}>
            <span className="ic"><I n={a.kind === "info" ? "info" : "alert"} s={14}/></span>
            <div className="body">
              <b>{a.title}</b>
              {a.body}
            </div>
            <button className="act" onClick={() => onAct?.(a)} type="button">
              {a.act} →
            </button>
          </div>
        ))}
      </div>
    )}
  </div>
)

export default AlertsPanel
