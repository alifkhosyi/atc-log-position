// ============================================================
// src/pages/admin/Dashboard.jsx — INMC Dashboard (REDESIGN sesi 5 + audit Phase 4)
// ──────────────────────────────────────────────────────────
// Phase 4 audit fix:
//   - C-02 full: REGION_COLOR hex → CSS tokens var(--region-*)
//                (East tidak lagi pakai --status-alert merah)
//   - N-02 partial: emoji 📋🤝📊 di Quick Actions → <I n="..."/>
// ============================================================
import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useApp } from "../../lib/context.jsx"
import { isStaleSince, getShift } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { BranchPicker, BranchFilterBadge } from "../../components/BranchPicker.jsx"
// INMC roster visibility P1 — batch roster status + per-branch scheduled detail
import { useAllRosterStatusByBranch } from "../../hooks/useAllRosterStatusByBranch"
import {
  useScheduledTodayPersonnel,
  detectCurrentShiftToken,
  formatShiftTimeWib,
} from "../../hooks/useScheduledTodayPersonnel"
// Phase 3+4 fix: CSS tokens untuk shift colors + region colors
import "../../styles/roster-tokens.css"

// ─── Helpers ───
// Phase 4 fix C-02: pakai CSS tokens, BUKAN hex inline yang collide dengan --status-alert
const REGION_COLOR = {
  west: "var(--region-west, #2563eb)",
  east: "var(--region-east, #0891b2)",
}

// ─── Alert Feed (aggregated from ctx data) ───
const useAlerts = (ctx) => useMemo(() => {
  const alerts = []
  let id = 0

  // Type 1: handover_checklists with Not OK items in last 24h
  const since24h = Date.now() - 24 * 3600 * 1000
  ctx.handoverChecklists?.forEach(cl => {
    const dt = cl.checklist_date || cl.created_at
    if (!dt || new Date(dt).getTime() < since24h) return
    const items = ["traffic_situation", "conflict_solution", "weather", "facilities", "coordination", "others"]
    const notOks = items.filter(it => cl[it + "_status"] === "Not OK")
    if (notOks.length === 0) return
    const bc = cl.branch_code || ctx.branches.find(b => b.code === cl.branch_code)?.code
    if (!bc) return
    alerts.push({
      id: ++id,
      branch: bc,
      sev: notOks.length >= 3 ? "crit" : "warn",
      msg: `${notOks.length} checklist Not OK (${notOks.slice(0, 2).join(", ")}${notOks.length > 2 ? "..." : ""})`,
      time: dt,
    })
  })

  // Type 2: Branches with no on-mic activity for >5 hours (stale)
  const onMicBranches = new Set(ctx.logs.filter(l => !l.off_time).map(l => l.branch_code))
  ctx.branches.filter(b => b.region).forEach(b => {
    if (onMicBranches.has(b.code)) return
    const lastLog = ctx.logs
      .filter(l => l.branch_code === b.code)
      .sort((a, z) => new Date(z.on_time) - new Date(a.on_time))[0]
    if (!lastLog) return
    const since = lastLog.off_time || lastLog.on_time
    if (isStaleSince(since, 5)) {
      const hours = Math.floor((Date.now() - new Date(since).getTime()) / 3600000)
      alerts.push({
        id: ++id,
        branch: b.code,
        sev: hours >= 8 ? "crit" : "warn",
        msg: `Tidak ada on mic ${hours} jam`,
        time: since,
      })
    }
  })

  const sevOrder = { crit: 0, warn: 1, info: 2 }
  return alerts.sort((a, b) => {
    const s = sevOrder[a.sev] - sevOrder[b.sev]
    if (s !== 0) return s
    return new Date(b.time) - new Date(a.time)
  })
}, [ctx.logs, ctx.handoverChecklists, ctx.branches])

const formatTimeAgo = (date, now) => {
  if (!date) return ""
  const ms = now - new Date(date).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s lalu`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h lalu`
  return `${Math.floor(hr / 24)}d lalu`
}

const AlertFeed = ({ alerts, now, onBranchClick }) => (
  <div className="alert-feed">
    <div className="alert-feed-head">
      <div className="alert-feed-title"><I n="bell" s={14}/> Alert Feed</div>
      <span className="panel-counter">{alerts.length}</span>
    </div>
    <div className="alert-feed-body">
      {alerts.length === 0 ? (
        <div className="empty-state" style={{ padding: "24px 16px" }}>
          <I n="check" s={28}/>
          <p style={{ fontSize: 12 }}>Semua cabang normal</p>
        </div>
      ) : alerts.map(a => (
        <div key={a.id} className="alert-item" onClick={() => onBranchClick(a.branch)}>
          <div className="alert-item-head">
            <span className={"alert-sev alert-sev-" + a.sev}>
              {a.sev === "crit" ? "CRITICAL" : a.sev.toUpperCase()}
            </span>
            <span className="alert-item-branch">{a.branch}</span>
            <span className="alert-item-time">{formatTimeAgo(a.time, now)}</span>
          </div>
          <div className="alert-item-msg">{a.msg}</div>
        </div>
      ))}
    </div>
  </div>
)

// ─── Region Card (2-up bars: active / onMic / traffic) ───
const RegionCard = ({ region, branches, brAct, brTraffic, personnelCount }) => {
  const color = REGION_COLOR[region]
  const onMic = branches.reduce((a, b) => a + (brAct[b.code] || 0), 0)
  const traffic = branches.reduce((a, b) => a + (brTraffic[b.code] || 0), 0)
  const liveBranches = branches.filter(b => (brAct[b.code] || 0) > 0).length
  const totalPersonnel = branches.reduce((a, b) => a + (personnelCount[b.code] || 0), 0)

  return (
    <div className={"region-card " + region}>
      <div className="region-head">
        <div className={"region-name " + region}>
          <I n="map-pin" s={14}/> {region === "west" ? "West Region" : "East Region"}
        </div>
        <div className="region-meta">{branches.length} cabang · {totalPersonnel} personel</div>
      </div>
      <div className="region-bars">
        <div className="region-bar-row">
          <span className="region-bar-l">Active</span>
          <div className="region-bar-track">
            <div className="region-bar-fill"
                 style={{ width: `${branches.length > 0 ? (liveBranches / branches.length * 100) : 0}%`, background: color }}/>
          </div>
          <span className="region-bar-v">{liveBranches}/{branches.length}</span>
        </div>
        <div className="region-bar-row">
          <span className="region-bar-l">On Mic</span>
          <div className="region-bar-track">
            <div className="region-bar-fill"
                 style={{ width: `${Math.min(onMic * 10, 100)}%`, background: color }}/>
          </div>
          <span className="region-bar-v">{onMic}</span>
        </div>
        <div className="region-bar-row">
          <span className="region-bar-l">Traffic</span>
          <div className="region-bar-track">
            <div className="region-bar-fill"
                 style={{ width: `${Math.min(traffic / 30, 100)}%`, background: color }}/>
          </div>
          <span className="region-bar-v">{traffic.toLocaleString()}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Branch Card (in region grid) ───
// ─── Roster Status Badge (INMC P1) ───
// Display kompak di BranchCard stats row. Color-coded per aggregate
// status: FINAL hijau, DRAFT kuning, MISSING merah. Tooltip detail per unit.
const RosterBadge = ({ rosterStatus }) => {
  if (!rosterStatus || rosterStatus.expectedUnits === 0) {
    return (
      <span className="branch-stat" title="Cabang belum dikonfigurasi engine roster">
        <I n="calendar" s={11}/>{" "}
        <span style={{ color: "var(--text-faint)" }}>—</span>
      </span>
    )
  }

  const { aggregate, unitsWithRoster, expectedUnits, byUnit } = rosterStatus
  const colorMap = {
    FINAL: "var(--status-on)",      // hijau
    DRAFT: "var(--status-warn)",    // kuning
    MISSING: "var(--status-alert)", // merah
  }
  const labelMap = {
    FINAL: `${expectedUnits}/${expectedUnits} FINAL`,
    DRAFT: `${unitsWithRoster}/${expectedUnits} DRAFT`,
    MISSING: `${unitsWithRoster}/${expectedUnits}`,
  }

  const tooltip = Object.entries(byUnit)
    .map(([u, s]) => `${u}: ${s}`)
    .join(" · ")

  return (
    <span
      className="branch-stat"
      style={{ color: colorMap[aggregate] }}
      title={tooltip}
    >
      <I n="calendar" s={11}/> <strong>{labelMap[aggregate]}</strong>
    </span>
  )
}

const BranchCard = ({ b, brAct, brTraffic, personnelCount, alertsByBranch, rosterStatus, children, moCodeSet, onClick }) => {
  const onMicCount = brAct[b.code] || 0
  const traffic = brTraffic[b.code] || 0
  const persCount = personnelCount[b.code] || 0
  const childOnMic = children.reduce((a, ch) => a + (brAct[ch.code] || 0), 0)
  const totalOnMic = onMicCount + childOnMic

  const branchAlerts = alertsByBranch[b.code] || []
  const childAlerts = children.flatMap(ch => alertsByBranch[ch.code] || [])
  const allAlerts = [...branchAlerts, ...childAlerts]
  const hasCrit = allAlerts.some(a => a.sev === "crit")
  const hasWarn = allAlerts.some(a => a.sev === "warn")

  const cls = "branch-card" +
    (hasCrit ? " has-crit" : hasWarn ? " has-alert" : totalOnMic > 0 ? " live" : "")

  return (
    <div className={cls} onClick={() => onClick(b.code)}>
      <div className="branch-card-head">
        <div className="branch-card-l">
          {totalOnMic > 0 && <Pulse on={true} s={6}/>}
          <span className="branch-code">{b.code}</span>
          <span className="branch-name">{b.city || b.name}</span>
          {(hasCrit || hasWarn) && (
            <span className={"alert-sev " + (hasCrit ? "alert-sev-crit" : "alert-sev-warn")} style={{ marginLeft: 4 }}>
              <I n="alert" s={9}/>{hasCrit ? "CRIT" : "WARN"}
            </span>
          )}
        </div>
        <div className="branch-stats">
          <span className={"branch-stat" + (totalOnMic > 0 ? " live" : "")}>
            <I n="mic" s={11}/> <strong>{totalOnMic}</strong>
          </span>
          <span className="branch-stat">
            <I n="plane" s={11}/> <strong>{traffic.toLocaleString()}</strong>
          </span>
          <span className="branch-stat">
            <I n="users" s={11}/> <strong>{persCount}</strong>
          </span>
          <RosterBadge rosterStatus={rosterStatus}/>
        </div>
      </div>
      {children.length > 0 && (
        <div className="branch-children">
          {children.map(ch => {
            const chLive = (brAct[ch.code] || 0) > 0
            const isMo = moCodeSet.has(ch.code)
            return (
              <div key={ch.code} className={"branch-child" + (chLive ? " live" : "")}
                   onClick={(e) => { e.stopPropagation(); onClick(ch.code) }}>
                {chLive && <Pulse on={true} s={5}/>}
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{ch.code}</span>
                {isMo && <span className={"branch-child-tag" + (b.region === "east" ? " east" : "")}>MO</span>}
                <span style={{ color: "var(--text-faint)" }}>· {ch.city || ch.name}</span>
                {chLive && <span style={{ color: "var(--status-on)", marginLeft: "auto", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{brAct[ch.code]}</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Roster Tab Content (INMC P1) ───
// Per-branch detail: status per unit (FINAL/DRAFT/MISSING), personnel
// terjadwal hari ini grouped per unit × shift token, plus "SEDANG
// BERJALAN" highlight untuk shift aktif. Lazy-load via parent —
// `sched` di-fetch hanya saat tab "roster" dibuka.
const RosterTabContent = ({ branchCode, branchName, rosterStatus, sched, ctx, onClose }) => {
  const currentShift = detectCurrentShiftToken(new Date())

  const handleOpenRoster = () => {
    if (ctx.setNavBranch) ctx.setNavBranch(branchCode)
    ctx.goPage("roster")
    onClose()
  }

  const STATUS_COLOR = {
    FINAL: "var(--status-on)",
    DRAFT: "var(--status-warn)",
    MISSING: "var(--status-alert)",
  }
  const STATUS_SUB = {
    FINAL: "Sudah di-publish",
    DRAFT: "Belum di-Mark FINAL",
    MISSING: "Belum ada roster",
  }

  return (
    <>
      {/* Status summary header */}
      <div className="sp-section">
        <div className="sp-section-h">Status Roster Bulan Ini</div>
        {rosterStatus && rosterStatus.expectedUnits > 0 ? (
          <div
            className="sp-stat-grid"
            style={{ gridTemplateColumns: "1fr 1fr" }}
          >
            {Object.entries(rosterStatus.byUnit).map(([unit, status]) => (
              <div key={unit} className="sp-stat">
                <div className="sp-stat-l">Unit {unit}</div>
                <div
                  className="sp-stat-v"
                  style={{ fontSize: 16, color: STATUS_COLOR[status] }}
                >
                  {status}
                </div>
                <div className="sp-stat-sub">{STATUS_SUB[status]}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: "16px 0" }}>
            <I n="alert" s={24}/>
            <p style={{ fontSize: 12 }}>
              Cabang ini belum dikonfigurasi di engine roster.
            </p>
          </div>
        )}
      </div>

      {/* Personnel terjadwal hari ini */}
      <div className="sp-section">
        <div className="sp-section-h">
          Personel Terjadwal Hari Ini ({sched.all.length})
        </div>

        {sched.loading && (
          <div className="empty-state" style={{ padding: "16px 0" }}>
            <span style={{ fontSize: 12 }}>Memuat jadwal…</span>
          </div>
        )}

        {!sched.loading && sched.error && (
          <div className="empty-state" style={{ padding: "16px 0" }}>
            <I n="alert" s={24}/>
            <p style={{ fontSize: 12 }}>{sched.error}</p>
          </div>
        )}

        {!sched.loading && !sched.error && sched.all.length === 0 && (
          <div className="empty-state" style={{ padding: "16px 0" }}>
            <I n="calendar" s={24}/>
            <p style={{ fontSize: 12 }}>
              Tidak ada personel terjadwal hari ini.
            </p>
          </div>
        )}

        {!sched.loading && sched.all.length > 0 && (
          <div className="sp-roster-units">
            {Object.entries(sched.byUnit).map(([unit, byShift]) => {
              const unitCount = Object.values(byShift).reduce(
                (s, arr) => s + arr.length, 0,
              )
              return (
                <div key={unit} className="sp-roster-unit" style={{ marginBottom: 12 }}>
                  <div
                    className="sp-roster-unit-h"
                    style={{ fontSize: 12, marginBottom: 4 }}
                  >
                    <strong>{unit}</strong>
                    <span style={{ color: "var(--text-faint)", marginLeft: 6 }}>
                      · {unitCount} personel
                    </span>
                  </div>
                  {Object.entries(byShift).map(([shiftToken, persons]) => {
                    const isActive = shiftToken === currentShift
                    const timeRange = persons[0]?.shiftStartUtc
                      ? formatShiftTimeWib(persons[0].shiftStartUtc)
                      : ""
                    return (
                      <div
                        key={shiftToken}
                        style={{
                          marginTop: 8,
                          padding: 8,
                          borderRadius: 6,
                          background: isActive
                            ? "var(--status-on-soft)"
                            : "var(--bg2)",
                          border: isActive
                            ? "1px solid var(--status-on)"
                            : "1px solid var(--border)",
                        }}
                      >
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 6,
                          fontSize: 11,
                        }}>
                          <span>
                            <b>Shift {shiftToken}</b>
                            {timeRange && (
                              <span style={{
                                color: "var(--text-faint)",
                                marginLeft: 6,
                              }}>
                                mulai {timeRange}
                              </span>
                            )}
                          </span>
                          {isActive && (
                            <span style={{
                              color: "var(--status-on)",
                              fontWeight: 700,
                              fontSize: 10,
                            }}>
                              SEDANG BERJALAN
                            </span>
                          )}
                        </div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                          {persons.map(p => (
                            <li
                              key={p.personnel_id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                padding: "4px 0",
                                fontSize: 12,
                              }}
                            >
                              <span style={{
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                color: "var(--accent)",
                                minWidth: 28,
                              }}>
                                {p.initial}
                              </span>
                              <span>{p.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Action button */}
      <div style={{ marginTop: 12 }}>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleOpenRoster}
          style={{ width: "100%" }}
          title={`Buka halaman Roster ATC dengan context cabang ${branchName || branchCode}`}
        >
          Buka Roster ATC →
        </button>
      </div>
    </>
  )
}

// ─── Side Panel (drill-down) ───
const SidePanel = ({ branchCode, ctx, brAct, brTraffic, personnelCount, alertsByBranch, rosterStatus, now, onClose }) => {
  const [tab, setTab] = useState("overview")
  const b = ctx.branches.find(x => x.code === branchCode)

  // Lazy-load scheduled personnel detail hanya saat tab "roster" dibuka.
  // Pass null kalau tab lain — hook return empty state.
  const sched = useScheduledTodayPersonnel(
    tab === "roster" ? branchCode : null,
  )

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!b) return null

  const onMic = brAct[b.code] || 0
  const traffic = brTraffic[b.code] || 0
  const personnel = personnelCount[b.code] || 0
  const branchAlerts = alertsByBranch[b.code] || []
  const branchLogs = ctx.logs.filter(l => l.branch_code === b.code && !l.off_time)

  const handleOpenLog = () => { ctx.setNavBranch(b.code); ctx.goPage("mon_log"); onClose() }
  const handleOpenHandover = () => { ctx.setNavBranch(b.code); ctx.goPage("mon_handover"); onClose() }
  const handleOpenReports = () => { ctx.setNavBranch(b.code); ctx.goPage("mon_reports"); onClose() }

  return (
    <>
      <div className="side-panel-backdrop" onClick={onClose}/>
      <div className="side-panel" role="dialog" aria-modal="true">
        <div className="side-panel-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: REGION_COLOR[b.region], fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase",
              }}>
                {b.region === "west" ? "West Region" : "East Region"}
              </span>
              {onMic > 0 && (
                <span className="status-badge status-on">
                  <Pulse on={true} s={6}/> Active
                </span>
              )}
            </div>
            <h2 className="side-panel-title">{b.name}</h2>
            <p className="side-panel-sub">
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text)" }}>{b.code}</span>
              {b.city ? ` · ${b.city}` : ""}
              {b.parent_code && <span className="muted"> · child of {b.parent_code}</span>}
            </p>
          </div>
          <button className="side-panel-close" onClick={onClose} aria-label="Close" title="Close (ESC)">
            <I n="x" s={18}/>
          </button>
        </div>

        <div className="side-panel-tabs">
          <button className={"sp-tab" + (tab === "overview" ? " active" : "")} onClick={() => setTab("overview")}>Overview</button>
          <button className={"sp-tab" + (tab === "roster" ? " active" : "")} onClick={() => setTab("roster")}>Roster</button>
          <button className={"sp-tab" + (tab === "log" ? " active" : "")} onClick={() => setTab("log")}>Log Position</button>
          <button className={"sp-tab" + (tab === "handover" ? " active" : "")} onClick={() => setTab("handover")}>Handover</button>
          <button className={"sp-tab" + (tab === "reports" ? " active" : "")} onClick={() => setTab("reports")}>Reports</button>
        </div>

        <div className="side-panel-body">
          {tab === "overview" && (
            <>
              <div className="sp-stat-grid">
                <div className="sp-stat">
                  <div className="sp-stat-l">On Mic</div>
                  <div className="sp-stat-v" style={{ color: onMic > 0 ? "var(--status-on)" : "var(--text)" }}>{onMic}</div>
                  <div className="sp-stat-sub">aktif sekarang</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-l">Traffic Hari Ini</div>
                  <div className="sp-stat-v">{traffic.toLocaleString()}</div>
                  <div className="sp-stat-sub">DEP + ARR + OVF</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-l">Personnel</div>
                  <div className="sp-stat-v">{personnel}</div>
                  <div className="sp-stat-sub">total terdaftar</div>
                </div>
                <div className="sp-stat">
                  <div className="sp-stat-l">Shift Now</div>
                  <div className="sp-stat-v" style={{ fontSize: 16 }}>{getShift()}</div>
                  <div className="sp-stat-sub">period sekarang</div>
                </div>
              </div>

              {branchAlerts.length > 0 && (
                <div className="sp-section">
                  <div className="sp-section-h" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <I n="alert" s={13}/> Alerts aktif
                  </div>
                  {branchAlerts.map(a => (
                    <div key={a.id} className="alert-item" style={{ marginBottom: 6, cursor: "default" }}>
                      <div className="alert-item-head">
                        <span className={"alert-sev alert-sev-" + a.sev}>
                          {a.sev === "crit" ? "CRITICAL" : "WARN"}
                        </span>
                        <span className="alert-item-time">{formatTimeAgo(a.time, now)}</span>
                      </div>
                      <div className="alert-item-msg">{a.msg}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="sp-section">
                <div className="sp-section-h">Quick Actions</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-sm" onClick={handleOpenLog}>
                    <I n="mic" s={13}/> Log Position
                  </button>
                  <button className="btn btn-sm" onClick={handleOpenHandover}>
                    <I n="checklist" s={13}/> Handover
                  </button>
                  <button className="btn btn-sm" onClick={handleOpenReports}>
                    <I n="chart" s={13}/> Reports
                  </button>
                </div>
              </div>
            </>
          )}

          {tab === "roster" && (
            <RosterTabContent
              branchCode={branchCode}
              branchName={b.name}
              rosterStatus={rosterStatus}
              sched={sched}
              ctx={ctx}
              onClose={onClose}
            />
          )}

          {tab === "log" && (
            <div className="sp-section">
              <div className="sp-section-h">Posisi Aktif ({branchLogs.length})</div>
              {branchLogs.length === 0 ? (
                <div className="empty-state" style={{ padding: "24px 0" }}>
                  <I n="mic" s={28}/>
                  <p style={{ fontSize: 12 }}>Belum ada ATC on mic</p>
                </div>
              ) : (
                <div className="sp-log-list">
                  {branchLogs.map(l => {
                    const since = Math.floor((now - new Date(l.on_time).getTime()) / 60000)
                    return (
                      <div key={l.id} className="sp-log">
                        <Pulse on={true} s={6}/>
                        <div className="sp-log-l">
                          <div className="sp-log-name">{l.atc_name}</div>
                          <div className="sp-log-meta">
                            {l.unit || "-"} · {l.sector || "-"} · {l.cwp || "-"} · {since}m
                          </div>
                        </div>
                        <span className="status-badge status-on">On</span>
                      </div>
                    )
                  })}
                </div>
              )}
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-sm btn-primary" onClick={handleOpenLog} style={{ width: "100%" }}>
                  Buka Monitoring Log Position →
                </button>
              </div>
            </div>
          )}

          {tab === "handover" && (
            <div className="sp-section">
              <div className="sp-section-h">Handover Activity</div>
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <I n="handover" s={28}/>
                <p style={{ fontSize: 12 }}>Lihat detail di halaman Monitoring Handover</p>
              </div>
              <button className="btn btn-sm btn-primary" onClick={handleOpenHandover} style={{ width: "100%" }}>
                Buka Monitoring Handover →
              </button>
            </div>
          )}

          {tab === "reports" && (
            <div className="sp-section">
              <div className="sp-section-h">Daily Reports</div>
              <div className="empty-state" style={{ padding: "24px 0" }}>
                <I n="file" s={28}/>
                <p style={{ fontSize: 12 }}>Lihat status submission di halaman Monitoring Reports</p>
              </div>
              <button className="btn btn-sm btn-primary" onClick={handleOpenReports} style={{ width: "100%" }}>
                Buka Monitoring Reports →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─── Main Page ───
export const AdminDash = () => {
  const ctx = useApp()
  const [drillBranch, setDrillBranch] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  const handleRefresh = useCallback(() => {
    setLastUpdated(new Date())
  }, [])

  // ─── Aggregate stats ───
  const allActive = ctx.logs.filter(l => !l.off_time)
  const todayLogs = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const todayTC = ctx.logs
    .filter(l => l.off_time && new Date(l.on_time).toDateString() === new Date().toDateString())
    .reduce((a, l) => a + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0), 0)

  const brAct = {}, brTraffic = {}, personnelCount = {}
  allActive.forEach(l => { brAct[l.branch_code] = (brAct[l.branch_code] || 0) + 1 })
  todayLogs.filter(l => l.off_time).forEach(l => {
    const t = (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)
    brTraffic[l.branch_code] = (brTraffic[l.branch_code] || 0) + t
  })
  ctx.personnel.forEach(p => { personnelCount[p.branch_code] = (personnelCount[p.branch_code] || 0) + 1 })

  // ─── Hierarchy helpers ───
  const moCodeSet = new Set(ctx.moBranchCodes)
  const allBr = ctx.branches.filter(b => b.region)
  const getDirectChildren = (code) => allBr.filter(b => b.parent_code === code)
  const getAllDescendants = (code) => {
    const kids = getDirectChildren(code)
    const result = []
    for (const k of kids) {
      result.push(k)
      if (!moCodeSet.has(k.code)) result.push(...getAllDescendants(k.code))
    }
    return result
  }

  // ─── Alerts ───
  const alerts = useAlerts(ctx)
  const alertsByBranch = useMemo(() => {
    const map = {}
    alerts.forEach(a => {
      if (!map[a.branch]) map[a.branch] = []
      map[a.branch].push(a)
    })
    return map
  }, [alerts])

  // ─── Roster status (INMC P1) ───
  // Single batch query atc_rosters bulan berjalan → Record<branch_code, ...>
  // Re-fetched kalau ctx.branches berubah (jarang) atau bulan ganti.
  const rosterStatus = useAllRosterStatusByBranch(ctx.branches)

  const critCount = alerts.filter(a => a.sev === "crit").length
  const totalAlerts = alerts.length

  // ─── Region partition ───
  const westTop = allBr.filter(b => b.region === "west" && !b.parent_code)
    .sort((a, z) => (brAct[z.code] || 0) - (brAct[a.code] || 0))
  const eastTop = allBr.filter(b => b.region === "east" && !b.parent_code)
    .sort((a, z) => (brAct[z.code] || 0) - (brAct[a.code] || 0))
  const westMoChildren = allBr.filter(b => b.region === "west" && b.parent_code && moCodeSet.has(b.code))
    .sort((a, z) => (brAct[z.code] || 0) - (brAct[a.code] || 0))
  const eastMoChildren = allBr.filter(b => b.region === "east" && b.parent_code && moCodeSet.has(b.code))
    .sort((a, z) => (brAct[z.code] || 0) - (brAct[a.code] || 0))
  const allWestFlat = allBr.filter(b => b.region === "west")
  const allEastFlat = allBr.filter(b => b.region === "east")

  // ─── Global filter ───
  const filter = ctx.globalBranch || "ALL"
  const filterApplied = filter !== "ALL"

  const matchesFilter = (b) => {
    if (!filterApplied) return true
    if (b.code === filter) return true
    const allDesc = getAllDescendants(b.code)
    return allDesc.some(d => d.code === filter)
  }
  const filterWestTop = westTop.filter(matchesFilter)
  const filterEastTop = eastTop.filter(matchesFilter)
  const filterWestMo = westMoChildren.filter(matchesFilter)
  const filterEastMo = eastMoChildren.filter(matchesFilter)

  // ─── Connection status ───
  const secondsAgo = Math.floor((now - lastUpdated.getTime()) / 1000)
  const connStatus = secondsAgo < 30 ? "live" : secondsAgo < 300 ? "stale" : "error"
  const connText = secondsAgo < 60 ? `${secondsAgo}s lalu`
    : secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)}m lalu`
    : `${Math.floor(secondsAgo / 3600)}h lalu`

  const handleBranchClick = (code) => setDrillBranch(code)

  return (
    <div className="page-content">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Dashboard INMC</h1>
          <p className="topbar-sub">Monitoring seluruh cabang · West &amp; East Region</p>
        </div>
      </div>

      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={filter} onChange={ctx.setGlobalBranch} branches={allBr} brAct={brAct}/>
          <BranchFilterBadge value={filter} onClear={() => ctx.setGlobalBranch("ALL")}/>
        </div>
        <div className="inmc-topbar-l">
          <span className={"conn-status " + connStatus}>
            <span className="conn-status-dot"/>
            {connStatus === "live" ? "LIVE" : connStatus === "stale" ? "STALE" : "DISCONNECTED"}
            <span className="faint" style={{ marginLeft: 4 }}>· {connText}</span>
          </span>
          <button className="btn btn-sm" onClick={handleRefresh} title="Refresh data">↻ Refresh</button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="radar" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Total Lokasi</div>
            <div className="stat-v">{allBr.length}</div>
            <div className="stat-sub">West {allWestFlat.length} · East {allEastFlat.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-on-soft)", color: "var(--status-on)" }}>
            <I n="mic" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">On Mic</div>
            <div className="stat-v">{allActive.length}</div>
            <div className="stat-sub">{allBr.filter(b => (brAct[b.code] || 0) > 0).length} cabang aktif</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "rgba(245,158,11,.15)", color: "var(--status-warn)" }}>
            <I n="plane" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Traffic Hari Ini</div>
            <div className="stat-v">{todayTC.toLocaleString()}</div>
            <div className="stat-sub">Shift {getShift()}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic"
               style={{
                 background: totalAlerts > 0 ? "var(--status-alert-soft)" : "var(--bg3)",
                 color: totalAlerts > 0 ? "var(--status-alert)" : "var(--text-muted)",
               }}>
            <I n="alert" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Alerts Aktif</div>
            <div className="stat-v" style={{ color: totalAlerts > 0 ? "var(--status-alert)" : "var(--text)" }}>{totalAlerts}</div>
            <div className="stat-sub">{critCount} critical</div>
          </div>
        </div>
      </div>

      <div className="regions-row">
        <RegionCard region="west" branches={allWestFlat} brAct={brAct} brTraffic={brTraffic} personnelCount={personnelCount}/>
        <RegionCard region="east" branches={allEastFlat} brAct={brAct} brTraffic={brTraffic} personnelCount={personnelCount}/>
      </div>

      <div className="layout-main">
        <div>
          <div className="branch-region-block">
            <div className="branch-region-head">
              <div className="branch-region-title west">
                <I n="map-pin" s={14}/> West Region
                {filterApplied && filterWestTop.length === 0 && filterWestMo.length === 0 &&
                  <span className="faint" style={{ fontWeight: 400, fontSize: 12, marginLeft: 4 }}>· tidak ada hasil</span>}
              </div>
              <span className="region-count">{filterWestTop.length} parent</span>
            </div>
            <div className="branch-grid">
              {filterWestTop.map(b => (
                <BranchCard key={b.code} b={b}
                            brAct={brAct} brTraffic={brTraffic}
                            personnelCount={personnelCount}
                            alertsByBranch={alertsByBranch}
                            rosterStatus={rosterStatus.byBranch[b.code]}
                            children={getAllDescendants(b.code)}
                            moCodeSet={moCodeSet}
                            onClick={handleBranchClick}/>
              ))}
            </div>

            {filterWestMo.length > 0 && (
              <>
                <div className="branch-region-head" style={{ marginTop: 14 }}>
                  <div className="branch-region-title" style={{ color: "var(--text-faint)", fontSize: 11 }}>
                    Cabang MO Bawahan
                  </div>
                  <span className="region-count">{filterWestMo.length} MO</span>
                </div>
                <div className="branch-grid">
                  {filterWestMo.map(b => (
                    <BranchCard key={b.code} b={b}
                                brAct={brAct} brTraffic={brTraffic}
                                personnelCount={personnelCount}
                                alertsByBranch={alertsByBranch}
                                rosterStatus={rosterStatus.byBranch[b.code]}
                                children={[]}
                                moCodeSet={moCodeSet}
                                onClick={handleBranchClick}/>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="branch-region-block">
            <div className="branch-region-head">
              <div className="branch-region-title east">
                <I n="map-pin" s={14}/> East Region
                {filterApplied && filterEastTop.length === 0 && filterEastMo.length === 0 &&
                  <span className="faint" style={{ fontWeight: 400, fontSize: 12, marginLeft: 4 }}>· tidak ada hasil</span>}
              </div>
              <span className="region-count">{filterEastTop.length} parent</span>
            </div>
            <div className="branch-grid">
              {filterEastTop.map(b => (
                <BranchCard key={b.code} b={b}
                            brAct={brAct} brTraffic={brTraffic}
                            personnelCount={personnelCount}
                            alertsByBranch={alertsByBranch}
                            rosterStatus={rosterStatus.byBranch[b.code]}
                            children={getAllDescendants(b.code)}
                            moCodeSet={moCodeSet}
                            onClick={handleBranchClick}/>
              ))}
            </div>

            {filterEastMo.length > 0 && (
              <>
                <div className="branch-region-head" style={{ marginTop: 14 }}>
                  <div className="branch-region-title" style={{ color: "var(--text-faint)", fontSize: 11 }}>
                    Cabang MO Bawahan
                  </div>
                  <span className="region-count">{filterEastMo.length} MO</span>
                </div>
                <div className="branch-grid">
                  {filterEastMo.map(b => (
                    <BranchCard key={b.code} b={b}
                                brAct={brAct} brTraffic={brTraffic}
                                personnelCount={personnelCount}
                                alertsByBranch={alertsByBranch}
                                rosterStatus={rosterStatus.byBranch[b.code]}
                                children={[]}
                                moCodeSet={moCodeSet}
                                onClick={handleBranchClick}/>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <AlertFeed alerts={alerts} now={now} onBranchClick={handleBranchClick}/>
      </div>

      {drillBranch && (
        <SidePanel branchCode={drillBranch} ctx={ctx}
                   brAct={brAct} brTraffic={brTraffic}
                   personnelCount={personnelCount}
                   alertsByBranch={alertsByBranch}
                   rosterStatus={rosterStatus.byBranch[drillBranch]}
                   now={now}
                   onClose={() => setDrillBranch(null)}/>
      )}
    </div>
  )
}
