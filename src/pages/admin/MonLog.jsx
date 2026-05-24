// ============================================================
// src/pages/admin/MonLog.jsx — INMC Monitoring Log Position (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: Admin_MonLog_Redesign.html mockup
//
// Logic preserved:
//   - br state from ctx.globalBranch (sync via setBr → ctx.setGlobalBranch)
//   - ctx.navBranch one-shot from Dashboard drill-down
//   - ctx.logs filter (active = no off_time, today = today's logs)
//   - Real-time data via ctx.logs (channel subscription)
// New affordances from mockup:
//   - Topbar + INMC sticky toolbar (BranchPicker + LIVE indicator + Refresh)
//   - Filter pill with × clear button
//   - Stats grid (2 cards) — On Mic + Log Hari Ini
//   - Panel ATC On Mic with .position-grid-big and rich .pos-card
//   - Panel Log Hari Ini with sort dropdown + table dengan .unit-tag chip
//   - SidePanel drill-down with timeline + traffic breakdown + detail table
//   - ESC/click/× close pattern
// ============================================================
import React, { useState, useEffect, useMemo } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, durMin } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { BranchPicker } from "../../components/BranchPicker.jsx"
import { useToast } from "../../components/Toast.jsx"

// ── Side panel drill-down ──
const SidePanel = ({ log, branches, onClose }) => {
  const branch = branches.find(b => b.code === log.branch_code)
  const now = new Date()
  const dur = log.off_time ? durMin(log.on_time, log.off_time) : durMin(log.on_time, now.toISOString())
  const tc = (log.departure_count || 0) + (log.arrival_count || 0) + (log.overfly_count || 0)

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])

  return (
    <>
      <div className="side-panel-backdrop" onClick={onClose}/>
      <div className="side-panel" role="dialog" aria-modal="true">
        <div className="side-panel-head">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 10,
                color: branch?.region === "west" ? "#3b82f6" : "#dc2626",
                fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
              }}>
                {branch?.region === "west" ? "West Region" : branch?.region === "east" ? "East Region" : "—"}
              </span>
              {!log.off_time && <span className="status-badge status-on"><Pulse on/> On Mic</span>}
              {log.off_time && <span className="status-badge status-off">Completed</span>}
            </div>
            <h3 className="side-panel-title">{log.atc_name}</h3>
            <p className="side-panel-sub">
              <strong style={{ color: "var(--text)" }}>{log.branch_code}</strong>
              {branch?.city ? ` · ${branch.city}` : ""} · {log.unit} {log.sector}
            </p>
          </div>
          <button className="side-panel-close" onClick={onClose} aria-label="Close (ESC)">
            <I n="x" s={20}/>
          </button>
        </div>

        <div className="side-panel-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div className="stat-card" style={{ padding: 14 }}>
              <div>
                <div className="stat-l">Durasi</div>
                <div className="stat-v" style={{ color: log.off_time ? "var(--text)" : "var(--status-on)" }}>{dur}m</div>
              </div>
            </div>
            <div className="stat-card" style={{ padding: 14 }}>
              <div>
                <div className="stat-l">Traffic</div>
                <div className="stat-v">{tc}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div className="sb-section" style={{ padding: "0 0 8px" }}>Timeline</div>
            <div className="timeline-row">
              <div className="timeline-l">{fmtT(log.on_time)}</div>
              <div className="timeline-v"><Pulse on/> <strong>On Mic</strong> — masuk posisi</div>
            </div>
            {log.off_time && (
              <div className="timeline-row">
                <div className="timeline-l">{fmtT(log.off_time)}</div>
                <div className="timeline-v"><span style={{ color: "var(--status-off)" }}>● Off Mic</span> — durasi {dur} menit</div>
              </div>
            )}
          </div>

          {tc > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div className="sb-section" style={{ padding: "0 0 8px" }}>Traffic Handled</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                <div style={{ background: "var(--accent-soft)", padding: "10px 12px", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--traffic-dep)" }}>{log.departure_count || 0}</div>
                  <div style={{ fontSize: 10, color: "var(--traffic-dep)", fontWeight: 600, marginTop: 4 }}>DEP</div>
                </div>
                <div style={{ background: "var(--status-warn-soft)", padding: "10px 12px", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--traffic-arr)" }}>{log.arrival_count || 0}</div>
                  <div style={{ fontSize: 10, color: "var(--traffic-arr)", fontWeight: 600, marginTop: 4 }}>ARR</div>
                </div>
                <div style={{ background: "var(--status-off-soft)", padding: "10px 12px", borderRadius: 8, textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 24, fontWeight: 700, color: "var(--traffic-ovf)" }}>{log.overfly_count || 0}</div>
                  <div style={{ fontSize: 10, color: "var(--traffic-ovf)", fontWeight: 600, marginTop: 4 }}>OVF</div>
                </div>
              </div>
            </div>
          )}

          <div className="sb-section" style={{ padding: "0 0 8px" }}>Detail</div>
          <table className="data-table" style={{ fontSize: 13 }}>
            <tbody>
              <tr><td className="muted">CWP</td><td><strong>{log.cwp}</strong></td></tr>
              <tr><td className="muted">Unit</td><td><span className="unit-tag">{log.unit}</span></td></tr>
              <tr><td className="muted">Sektor</td><td>{log.sector}</td></tr>
              {log.shift && <tr><td className="muted">Shift</td><td>{log.shift}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export const AdminMonLog = () => {
  const ctx = useApp()
  const toast = useToast()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)

  const [drill, setDrill] = useState(null)
  const [sortBy, setSortBy] = useState("time")
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [, setTick] = useState(0)

  // Ticker for "Xs lalu" display
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(i)
  }, [])

  // navBranch one-shot from Dashboard drill-down
  useEffect(() => {
    if (ctx.navBranch) {
      ctx.setGlobalBranch(ctx.navBranch)
      ctx.setNavBranch(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.navBranch])

  // Filter logs
  const allActive = useMemo(() => ctx.logs.filter(l => !l.off_time), [ctx.logs])
  const fa = useMemo(() => br === "ALL" ? allActive : allActive.filter(l => l.branch_code === br), [br, allActive])

  const todayAll = useMemo(() =>
    ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString()),
    [ctx.logs])
  const ft = useMemo(() => {
    const f = br === "ALL" ? todayAll : todayAll.filter(l => l.branch_code === br)
    return [...f].sort((a, b) => {
      if (sortBy === "branch") return (a.branch_code || "").localeCompare(b.branch_code || "")
      if (sortBy === "name") return (a.atc_name || "").localeCompare(b.atc_name || "")
      return new Date(b.on_time) - new Date(a.on_time)
    })
  }, [br, todayAll, sortBy])

  // brAct map for BranchPicker live indicator
  const brAct = useMemo(() => {
    const m = {}
    allActive.forEach(l => { m[l.branch_code] = (m[l.branch_code] || 0) + 1 })
    return m
  }, [allActive])

  const allBr = useMemo(() => ctx.branches.filter(b => b.region), [ctx.branches])

  const secondsAgo = Math.floor((new Date() - lastUpdated) / 1000)
  const connText = secondsAgo < 60 ? `${secondsAgo}s lalu`
    : secondsAgo < 3600 ? `${Math.floor(secondsAgo / 60)}m lalu`
    : `${Math.floor(secondsAgo / 3600)}h lalu`

  const refresh = () => {
    setLastUpdated(new Date())
    toast.info("Memuat ulang...", "Sinkronisasi data dari Supabase")
  }

  const branchObj = ctx.branches.find(b => b.code === br)
  const subText = br === "ALL" ? "semua region" : `${br}${branchObj?.name ? " — " + branchObj.name : ""}`

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Monitoring Log Position</div>
          <div className="topbar-sub">Real-time seluruh cabang · {subText}</div>
        </div>
      </div>

      {/* INMC TOOLBAR */}
      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={br} onChange={setBr} branches={allBr} brAct={brAct}/>
          {br !== "ALL" && (
            <span className="filter-pill">
              <I n="eye" s={11}/> Filter: {br}
              <button className="filter-pill-x" onClick={() => setBr("ALL")} aria-label="Clear filter">×</button>
            </span>
          )}
        </div>
        <div className="inmc-topbar-l">
          <span className="monitor-label"><I n="eye" s={11}/> Monitoring</span>
          <span className="conn-status"><span className="live-dot"/> LIVE · diperbarui {connText}</span>
          <button className="btn btn-sm" onClick={refresh}>↻ Refresh</button>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-on-soft)", color: "var(--status-on)" }}>
            <I n="mic" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">On Mic</div>
            <div className="stat-v" style={{ color: "var(--status-on)" }}>{fa.length}</div>
            <div className="stat-sub">{br === "ALL" ? "Seluruh cabang" : br}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="file" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Log Hari Ini</div>
            <div className="stat-v">{ft.length}</div>
            <div className="stat-sub">total sesi (active + completed)</div>
          </div>
        </div>
      </div>

      {/* PANEL — ATC On Mic */}
      <div className={"panel" + (fa.length > 0 ? " panel-glow" : "")}>
        <div className="panel-header">
          <h2 className="panel-title"><Pulse on/> ATC On Mic</h2>
          <span className="panel-badge">● LIVE · {fa.length}</span>
        </div>
        <div className="panel-body">
          {fa.length === 0 ? (
            <div className="empty-state">
              <I n="micOff" s={44}/>
              <p>Tidak ada ATC on mic{br !== "ALL" ? ` di ${br}` : ""}</p>
              {br !== "ALL" && (
                <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => setBr("ALL")}>
                  <I n="eye" s={13}/> Lihat semua cabang
                </button>
              )}
            </div>
          ) : (
            <div className="position-grid-big">
              {fa.map(l => {
                const branch = ctx.branches.find(b => b.code === l.branch_code)
                return (
                  <div key={l.id} className="pos-card" onClick={() => setDrill(l)}>
                    <div className="pos-card-head">
                      <Pulse on/>
                      <span className="pos-branch">{l.branch_code}</span>
                      <span className="pos-city">{branch?.city}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span className="pos-unit">{l.unit}</span>
                      <span className="pos-sector">{l.sector}</span>
                    </div>
                    <div className="pos-cwp">{l.cwp}</div>
                    <div className="pos-name">{l.atc_name}</div>
                    <div className="pos-time">
                      <span>On {fmtT(l.on_time)}</span>
                      <span className="pos-dur">{durMin(l.on_time, new Date().toISOString())}m</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* PANEL — Log Hari Ini */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Log Hari Ini</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                padding: "6px 10px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                color: "var(--text)",
                fontSize: "var(--fs-sm)",
                fontFamily: "var(--font-sans)",
              }}
            >
              <option value="time">Urutkan: Waktu</option>
              <option value="branch">Urutkan: Cabang</option>
              <option value="name">Urutkan: Nama</option>
            </select>
            <span className="panel-counter">{ft.length}</span>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {ft.length === 0 ? (
            <div className="empty-state"><p>Tidak ada log untuk filter ini</p></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cabang</th>
                    <th>Nama</th>
                    <th>Unit</th>
                    <th>Sektor</th>
                    <th>CWP</th>
                    <th>On</th>
                    <th>Off</th>
                    <th>Status</th>
                    <th style={{ textAlign: "center" }}>Traffic</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {ft.slice(0, 60).map(l => {
                    const tc = (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)
                    return (
                      <tr key={l.id} onClick={() => setDrill(l)} style={{ cursor: "pointer" }}>
                        <td><span className="unit-tag">{l.branch_code}</span></td>
                        <td><strong>{l.atc_name}</strong></td>
                        <td className="mono">{l.unit}</td>
                        <td>{l.sector}</td>
                        <td className="muted">{l.cwp}</td>
                        <td className="mono">{fmtT(l.on_time)}</td>
                        <td className="mono">{l.off_time ? fmtT(l.off_time) : <span className="faint">—</span>}</td>
                        <td>
                          {l.off_time
                            ? <span className="status-badge status-off">Off</span>
                            : <span className="status-badge status-on"><Pulse on/> On</span>}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          {tc || <span className="faint">—</span>}
                        </td>
                        <td><I n="chev" s={14}/></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {ft.length > 60 && (
                <div style={{ padding: 12, textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                  Menampilkan 60 terbaru dari {ft.length} log
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {drill && <SidePanel log={drill} branches={ctx.branches} onClose={() => setDrill(null)}/>}
    </div>
  )
}
