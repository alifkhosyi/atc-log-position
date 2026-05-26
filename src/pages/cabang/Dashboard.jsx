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

const DOW = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"]
const dayKey = (d) => {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
const dayLabel = (d) => `${DOW[d.getDay()]} ${pad(d.getDate())}`

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
   Alerts — derived from live data
   ---------------------------------------------------------------- */
const computeAlerts = ({ active, branchUnits, now }) => {
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
      })
    }
  })

  // Slot kosong: unit yang ada di branch tapi tidak ada active log
  const activeUnits = new Set(active.map(l => l.unit))
  ;(branchUnits || []).forEach((u) => {
    if (!activeUnits.has(u)) {
      out.push({
        kind: "info",
        title: `Slot ${u} kosong`,
        body: "Belum ada ATC on mic untuk unit ini di shift berjalan.",
        act: "Buka log",
      })
    }
  })

  return out
}

const Alerts = ({ items, onAct }) => (
  <div className="dash-panel">
    <div className="dash-panel-h">
      <div className="dash-panel-t"><I n="alert" s={15}/> Alerts &amp; Warnings</div>
      <span className="dash-panel-counter">{items.length} aktif</span>
    </div>
    {items.length === 0 ? (
      <div className="dash-alerts-empty">
        <I n="check" s={28}/>
        <span>Tidak ada peringatan. Semua sistem operasional normal.</span>
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

/* ----------------------------------------------------------------
   PositionCard — read-only navigation (click → Log Position page)
   ---------------------------------------------------------------- */
const PositionCard = ({ log, now, onClick }) => {
  const mins = durMin(log.on_time, now.toISOString())
  const isWarn = mins >= 120
  return (
    <div
      className={`dash-pos-card${isWarn ? " is-warn" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(log)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault(); onClick?.(log)
        }
      }}
      aria-label={`Buka detail ${log.atc_name} di Log Position`}
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

const ActivePositions = ({ logs, now, onSelect, goLog }) => (
  <div className={`dash-panel${logs.length > 0 ? " is-glow" : ""}`}>
    <div className="dash-panel-h">
      <div className="dash-panel-t"><span className="dash-pulse"/> Posisi Aktif</div>
      <span className="dash-panel-badge">● LIVE · {logs.length}</span>
    </div>
    {logs.length === 0 ? (
      <div className="dash-pos-empty">
        <I n="micOff" s={32}/>
        <span>Belum ada ATC on mic untuk shift ini.</span>
        <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
          Input pertama via menu{" "}
          <button type="button" className="dash-link" onClick={goLog}>
            <b>Log Position</b>
          </button>{" "}
          di kiri.
        </span>
      </div>
    ) : (
      <div className="dash-pos-grid">
        {logs.map((l) => (
          <PositionCard
            key={l.id}
            log={l}
            now={now}
            onClick={onSelect}
          />
        ))}
      </div>
    )}
  </div>
)

/* ----------------------------------------------------------------
   Traffic Harian — 7-day stacked bars from real ctx.logs
   ---------------------------------------------------------------- */
const buildTraffic7 = (allLogs, now, branchCodes) => {
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
  const byKey = Object.fromEntries(buckets.map(b => [b.key, b]))
  allLogs.forEach((l) => {
    if (branchCodes && !branchCodes.includes(l.branch_code)) return
    const k = dayKey(l.on_time)
    const b = byKey[k]
    if (!b) return
    b.dep += l.departure_count || 0
    b.arr += l.arrival_count   || 0
    b.ovf += l.overfly_count   || 0
  })
  return buckets
}

const TrafficHarian = ({ data }) => {
  const max = Math.max(1, ...data.map(d => d.dep + d.arr + d.ovf))
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
                  <div className="ln"><span>DEP</span><b style={{ color: "var(--accent)" }}>{d.dep}</b></div>
                  <div className="ln"><span>ARR</span><b style={{ color: "var(--status-warn)" }}>{d.arr}</b></div>
                  <div className="ln"><span>OVF</span><b style={{ color: "var(--text-faint)" }}>{d.ovf}</b></div>
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
        <span className="lg"><i style={{ background: "var(--accent)" }}/> DEP</span>
        <span className="lg"><i style={{ background: "var(--status-warn)" }}/> ARR</span>
        <span className="lg"><i style={{ background: "var(--text-faint)", opacity: .5 }}/> OVF</span>
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

/* ----------------------------------------------------------------
   Timeline — read-only (click row → Log Position page)
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
    () => computeAlerts({ active, branchUnits, now }),
    [active, branchUnits, now]
  )

  const traffic7 = useMemo(
    () => buildTraffic7(ctx.logs, now, myBranches),
    [ctx.logs, now, myBranches]
  )

  /* All interactions on this read-only page route to Log Position. */
  const goLog = () => ctx.goPage("log")

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

      <Alerts items={alerts} onAct={goLog} />

      <ActivePositions
        logs={active}
        now={now}
        onSelect={goLog}
        goLog={goLog}
      />

      <TrafficHarian data={traffic7} />

      <Timeline
        logs={today}
        now={now}
        onRowClick={goLog}
      />
    </div>
  )
}
