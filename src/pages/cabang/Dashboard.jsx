// ============================================================
// src/pages/cabang/Dashboard.jsx — Cabang Dashboard (Redesign v2 · prototype 1:1)
// ──────────────────────────────────────────────────────────
// Ports "Dashboard Redesign v2" prototype VERBATIM. No extras.
//
// Sections (in order):
//   1. Topbar      — title + branch/shift/clock sub. NO buttons.
//   2. Stats       — 4-up: On Mic | Log Hari Ini | Traffic Hari Ini | Coverage
//   3. Alerts      — FRMS warnings + empty-unit info, derived live
//   4. Posisi Aktif — read-only cards (click → Log Position page)
//   5. Traffic Harian — 7-day stacked bars from real ctx.logs
//   6. Timeline    — read-only table of today's logs
//
// All write actions (off-mic, delete log) live on the Log Position
// page, not here. The dashboard is purely informational + navigation.
//
// Classes are namespaced `dash-*` (see src/styles/dashboard.css)
// to prevent collision with the global classes in src/index.css
// that other pages still use.
// ============================================================

import React, { useEffect, useMemo, useState } from "react"
import { useApp } from "../../lib/context.jsx"
import {
  fmtT, durMin, getShift,
  getAccessibleBranches,
} from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { AlertsPanel, computeAlerts } from "../../components/Dashboard/AlertsPanel.jsx"
import { PositionCard } from "../../components/Dashboard/PositionCard.jsx"
import { TrafficHarian, buildTraffic7 } from "../../components/Dashboard/TrafficHarian.jsx"
import {
  useScheduledTodayPersonnel,
  detectCurrentShiftToken,
  formatShiftTimeWib,
} from "../../hooks/useScheduledTodayPersonnel"
import "../../styles/dashboard.css"

/* ----------------------------------------------------------------
   helpers
   ---------------------------------------------------------------- */
const pad = (n) => String(n).padStart(2, "0")
const fmtHMS = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}j ${pad(m)}m` : `${m}m`
}

/* live ticking clock (1s) */
const useNow = (ms = 1000) => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/* ----------------------------------------------------------------
   Stats
   ---------------------------------------------------------------- */
const Stats = ({ activeCount, totalLogs, todayTraffic, coverage, coverageSub, shiftLabel }) => (
  <div className="dash-stats">
    <div className="dash-stat">
      <div className="dash-stat-ic on"><I n="mic" s={18}/></div>
      <div className="dash-stat-body">
        <div className="dash-stat-l">On Mic</div>
        <div className="dash-stat-v">{activeCount}</div>
        <div className="dash-stat-s">Saat ini</div>
      </div>
    </div>
    <div className="dash-stat">
      <div className="dash-stat-ic acc"><I n="log" s={18}/></div>
      <div className="dash-stat-body">
        <div className="dash-stat-l">Log Hari Ini</div>
        <div className="dash-stat-v">{totalLogs}</div>
        <div className="dash-stat-s">Shift {shiftLabel}</div>
      </div>
    </div>
    <div className="dash-stat">
      <div className="dash-stat-ic warn"><I n="plane" s={18}/></div>
      <div className="dash-stat-body">
        <div className="dash-stat-l">Traffic Hari Ini</div>
        <div className="dash-stat-v">{todayTraffic}</div>
        <div className="dash-stat-s">DEP + ARR + OVF</div>
      </div>
    </div>
    <div className="dash-stat">
      <div className="dash-stat-ic vio"><I n="tower" s={18}/></div>
      <div className="dash-stat-body">
        <div className="dash-stat-l">Coverage Unit</div>
        <div className="dash-stat-v sm">{coverage}</div>
        <div className="dash-stat-s">{coverageSub}</div>
      </div>
    </div>
  </div>
)

/* ----------------------------------------------------------------
   ScheduledTodayPositions — read-only display dari atc_roster_cells
   ----------------------------------------------------------------
   Replaces old ActivePositions yang read dari position_logs (sekarang
   deprecated). Sumber data: roster yang sudah di-Mark FINAL.
   ---------------------------------------------------------------- */
const ScheduledTodayPositions = ({ byUnit, all, loading, error, goRoster }) => {
  const currentShift = detectCurrentShiftToken(new Date())

  return (
    <div className={`dash-panel${all.length > 0 ? " is-glow" : ""}`}>
      <div className="dash-panel-h">
        <div className="dash-panel-t"><span className="dash-pulse"/> Posisi Aktif</div>
        <span className="dash-panel-badge">
          {all.length > 0 ? `● ${all.length} terjadwal` : "● 0 terjadwal"}
        </span>
      </div>

      {loading && (
        <div className="dash-pos-empty">
          <span>Memuat jadwal hari ini…</span>
        </div>
      )}

      {!loading && error && (
        <div className="dash-pos-empty">
          <I n="alert" s={28}/>
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && all.length === 0 && (
        <div className="dash-pos-empty">
          <I n="calendar" s={32}/>
          <span>Tidak ada personel terjadwal untuk hari ini.</span>
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            Pastikan roster bulan ini sudah di-Mark FINAL di{" "}
            <button type="button" className="dash-link" onClick={goRoster}>
              <b>Roster ATC</b>
            </button>.
          </span>
        </div>
      )}

      {!loading && !error && all.length > 0 && (
        <div className="dash-sched-units">
          {Object.entries(byUnit).map(([unitName, byShift]) => (
            <div key={unitName} className="dash-sched-unit">
              <div className="dash-sched-unit-h">
                <span className="dash-sched-unit-name">{unitName}</span>
                <span className="dash-sched-unit-count">
                  {Object.values(byShift).reduce((s, arr) => s + arr.length, 0)} personel
                </span>
              </div>
              {Object.entries(byShift).map(([shiftToken, personnels]) => {
                const isActive = shiftToken === currentShift
                const timeRange = personnels[0]?.shiftStartUtc
                  ? formatShiftTimeWib(personnels[0].shiftStartUtc)
                  : ""
                return (
                  <div
                    key={shiftToken}
                    className={`dash-sched-shift${isActive ? " is-active" : ""}`}
                  >
                    <div className="dash-sched-shift-h">
                      <span className="dash-sched-shift-label">Shift {shiftToken}</span>
                      {timeRange && (
                        <span className="dash-sched-shift-time">mulai {timeRange}</span>
                      )}
                      {isActive && (
                        <span className="dash-sched-shift-active">SEDANG BERJALAN</span>
                      )}
                    </div>
                    <ul className="dash-sched-list">
                      {personnels.map(p => (
                        <li key={p.personnel_id} className="dash-sched-person">
                          <span className="dash-sched-initial">{p.initial}</span>
                          <span className="dash-sched-name">{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------
   Timeline — read-only (click row → Daily Report)
   ---------------------------------------------------------------- */
const Timeline = ({ logs, now, onRowClick }) => (
  <div className="dash-panel">
    <div className="dash-panel-h">
      <div className="dash-panel-t"><I n="chart" s={15}/> Timeline Hari Ini</div>
      <span className="dash-panel-counter">{logs.length} log</span>
    </div>
    {logs.length === 0 ? (
      <div className="dash-alerts-empty">
        <span>Belum ada log hari ini.</span>
      </div>
    ) : (
      <div className="dash-t-wrap">
        <table className="dash-t-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Unit</th>
              <th>Sektor</th>
              <th>On</th>
              <th>Off</th>
              <th>Durasi</th>
              <th className="dash-th-center">DEP</th>
              <th className="dash-th-center">ARR</th>
              <th className="dash-th-center">OVF</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => {
              const offIso = l.off_time
              const dur = offIso
                ? durMin(l.on_time, offIso)
                : durMin(l.on_time, now.toISOString())
              const isWarn = !offIso && dur >= 120
              return (
                <tr
                  key={l.id}
                  onClick={() => onRowClick?.(l)}
                  style={{ cursor: "pointer" }}
                >
                  <td className="name"><b>{l.atc_name}</b></td>
                  <td><span className="dash-ut">{l.unit}</span></td>
                  <td className="muted">{l.sector}</td>
                  <td className="mono">{fmtT(l.on_time)}</td>
                  <td className="mono">
                    {offIso ? fmtT(offIso) : <span className="faint">—</span>}
                  </td>
                  <td className="mono" style={{
                    color: isWarn
                      ? "var(--status-warn)"
                      : (offIso ? "var(--text)" : "var(--status-on)"),
                  }}>
                    {fmtDuration(dur)}{isWarn ? " ⚠" : ""}
                  </td>
                  <td className="dash-td-dep">
                    {l.departure_count ?? <span className="faint">—</span>}
                  </td>
                  <td className="dash-td-arr">
                    {l.arrival_count ?? <span className="faint">—</span>}
                  </td>
                  <td className="dash-td-ovf">
                    {l.overfly_count ?? <span className="faint">—</span>}
                  </td>
                  <td>
                    {offIso
                      ? <span className="dash-sb-stat off">Off</span>
                      : <span className="dash-sb-stat on"><span className="dash-pulse"/> On</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
)

/* ----------------------------------------------------------------
   Page
   ---------------------------------------------------------------- */
export const CabangDash = () => {
  const ctx = useApp()
  const now = useNow(1000)

  // Scheduled personnel today (read-only dari atc_roster_cells).
  // Sumber data untuk section "Posisi Aktif" + alert "Tidak ada personnel".
  const scheduled = useScheduledTodayPersonnel(ctx.user?.branch_code || null)

  const myBranches = useMemo(
    () => getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes),
    [ctx.user.branch_code, ctx.branches, ctx.moBranchCodes]
  )

  const active = useMemo(
    () => ctx.logs.filter(l => !l.off_time && myBranches.includes(l.branch_code)),
    [ctx.logs, myBranches]
  )

  const today = useMemo(() => {
    const t = new Date().toDateString()
    return ctx.logs.filter(
      l => myBranches.includes(l.branch_code) && new Date(l.on_time).toDateString() === t
    )
  }, [ctx.logs, myBranches])

  const todayTC = useMemo(
    () => today
      .filter(l => l.off_time)
      .reduce((a, l) => a + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0), 0),
    [today]
  )

  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || { name: "", city: "", units: [] }

  const branchUnits = br.units || []
  const activeUnits = new Set(active.map(l => l.unit))
  const coverage    = `${activeUnits.size} / ${branchUnits.length || 0}`
  const coverageSub = branchUnits.length > 0 ? branchUnits.join(" · ") : "Tidak ada unit"

  const alerts = useMemo(
    () => computeAlerts({
      active,
      now,
      handoverChecklists: ctx.handoverChecklists,
      branchCode: ctx.user.branch_code,
      scheduledByUnit: scheduled.byUnit,
      emptyScheduledUnits: scheduled.emptyUnits,
      rosterStatusByUnit: scheduled.rosterStatusByUnit,
    }),
    [
      active,
      now,
      ctx.handoverChecklists,
      ctx.user.branch_code,
      scheduled.byUnit,
      scheduled.emptyUnits,
      scheduled.rosterStatusByUnit,
    ]
  )

  const traffic7 = useMemo(
    () => buildTraffic7(ctx.logs, now, myBranches),
    [ctx.logs, now, myBranches]
  )

  /* Log Position is deprecated. Dashboard now routes:
     - position cards / timeline rows → Daily Report (Section G)
     - alert actions → whatever they declared in `target` */
  const goReports = () => ctx.goPage("reports")
  const goRoster  = () => ctx.goPage("roster")
  const onAlertAct = (a) => ctx.goPage(a?.target || "reports")

  return (
    <div className="dash-page">
      <div className="dash-topbar">
        <div>
          <h1>Dashboard</h1>
          <div className="dash-topbar-sub">
            <span>
              Cabang <b>{ctx.user.branch_code}</b>
              {br.name ? ` — ${br.name}` : ""}
              {br.city ? ` · ${br.city}` : ""}
            </span>
            <span className="dash-sep">·</span>
            <span>Shift <b>{getShift()}</b></span>
            <span className="dash-sep">·</span>
            <time>{fmtHMS(now)} WIB</time>
          </div>
        </div>
      </div>

      <Stats
        activeCount={active.length}
        totalLogs={today.length}
        todayTraffic={todayTC}
        coverage={coverage}
        coverageSub={coverageSub}
        shiftLabel={getShift()}
      />

      <AlertsPanel items={alerts} onAct={onAlertAct} />

      <ScheduledTodayPositions
        byUnit={scheduled.byUnit}
        all={scheduled.all}
        loading={scheduled.loading}
        error={scheduled.error}
        goRoster={goRoster}
      />

      <TrafficHarian data={traffic7} />

      <Timeline
        logs={today}
        now={now}
        onRowClick={goReports}
      />
    </div>
  )
}
