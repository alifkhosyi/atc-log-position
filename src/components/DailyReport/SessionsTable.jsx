// ============================================================
// src/components/DailyReport/SessionsTable.jsx
// ──────────────────────────────────────────────────────────
// Renders Section G's session list. One row per position_logs
// row for the selected (date, branch). Columns:
//
//   Shift · Unit · Sektor · ATC · On · Off · DEP · ARR · OVF · Status
//
// Cells are read-only EXCEPT DEP/ARR/OVF, which are inline-
// editable via <EditableCell/> as long as the month is not
// locked. The row gets an amber accent when at least one of
// the three counts is still null ("Belum diisi").
// ============================================================
import React from "react"
import { fmtT, durMin, getShift } from "../../lib/utils.js"
import { EditableCell } from "./EditableCell.jsx"

const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}j ${String(m).padStart(2, "0")}m` : `${m}m`
}

const isPending = (s) =>
  s.departure_count === null
  || s.arrival_count === null
  || s.overfly_count === null

const inferShift = (onTime) => {
  // Asia/Jakarta-ish shift bucketing — matches lib/utils.getShift() output
  // when only the time-of-day matters. Falls back to current-shift if
  // on_time is missing (open sessions before save).
  if (!onTime) return getShift()
  const h = new Date(onTime).getHours()
  if (h >= 6 && h < 14) return "Morning"
  if (h >= 14 && h < 22) return "Mid"
  return "Night"
}

export const SessionsTable = ({
  sessions,
  locked = false,
  onCellSave,
  filterShift = "all",
  pendingOnly = false,
}) => {
  const visible = sessions.filter((s) => {
    if (filterShift !== "all" && inferShift(s.on_time) !== filterShift) return false
    if (pendingOnly && !isPending(s)) return false
    return true
  })

  if (visible.length === 0) {
    return (
      <div className="sg-empty">
        <span>Tidak ada session untuk filter ini.</span>
      </div>
    )
  }

  const totals = visible.reduce(
    (a, s) => ({
      dep: a.dep + (s.departure_count || 0),
      arr: a.arr + (s.arrival_count   || 0),
      ovf: a.ovf + (s.overfly_count   || 0),
    }),
    { dep: 0, arr: 0, ovf: 0 },
  )

  return (
    <div className="sg-table-wrap">
      <table className="sg-table">
        <thead>
          <tr>
            <th>Shift</th>
            <th>Unit</th>
            <th>Sektor</th>
            <th>ATC</th>
            <th>On</th>
            <th>Off</th>
            <th>Durasi</th>
            <th className="sg-th-num">DEP</th>
            <th className="sg-th-num">ARR</th>
            <th className="sg-th-num">OVF</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((s) => {
            const pending = isPending(s)
            const open    = !s.off_time
            const dur = s.off_time
              ? durMin(s.on_time, s.off_time)
              : null
            return (
              <tr
                key={s.id}
                className={`sg-row${pending ? " sg-row-pending" : ""}${open ? " sg-row-open" : ""}`}
              >
                <td className="sg-td-shift">{inferShift(s.on_time)}</td>
                <td><span className="sg-unit">{s.unit}</span></td>
                <td className="sg-muted">{s.sector || "—"}</td>
                <td><b>{s.atc_name}</b></td>
                <td className="sg-mono">{fmtT(s.on_time)}</td>
                <td className="sg-mono">
                  {s.off_time ? fmtT(s.off_time) : <span className="sg-faint">— open</span>}
                </td>
                <td className="sg-mono">{dur === null ? "—" : fmtDuration(dur)}</td>
                <EditableCell
                  value={s.departure_count ?? null}
                  locked={locked || open}
                  onSave={(v) => onCellSave?.(s.id, "departure_count", v)}
                  ariaLabel={`DEP untuk ${s.atc_name} di ${s.unit} ${s.sector || ""}`}
                />
                <EditableCell
                  value={s.arrival_count ?? null}
                  locked={locked || open}
                  onSave={(v) => onCellSave?.(s.id, "arrival_count", v)}
                  ariaLabel={`ARR untuk ${s.atc_name} di ${s.unit} ${s.sector || ""}`}
                />
                <EditableCell
                  value={s.overfly_count ?? null}
                  locked={locked || open}
                  onSave={(v) => onCellSave?.(s.id, "overfly_count", v)}
                  ariaLabel={`OVF untuk ${s.atc_name} di ${s.unit} ${s.sector || ""}`}
                />
                <td>
                  {open ? (
                    <span className="sg-pill sg-pill-open">On Mic</span>
                  ) : locked ? (
                    <span className="sg-pill sg-pill-locked">Locked</span>
                  ) : pending ? (
                    <span className="sg-pill sg-pill-pending">Belum diisi</span>
                  ) : (
                    <span className="sg-pill sg-pill-done">✓ Lengkap</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={7} className="sg-tfoot-label">
              Total {visible.length} session{visible.length === 1 ? "" : "s"}
            </td>
            <td className="sg-mono sg-tfoot-num">{totals.dep || "—"}</td>
            <td className="sg-mono sg-tfoot-num">{totals.arr || "—"}</td>
            <td className="sg-mono sg-tfoot-num">{totals.ovf || "—"}</td>
            <td className="sg-tfoot-label">
              {locked ? "Read-only" : `${totals.dep + totals.arr + totals.ovf} mov`}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
