// ============================================================
// src/pages/admin/MonLog.jsx — INMC Monitoring Log Position (REDESIGN + ROSTER GAP)
// ──────────────────────────────────────────────────────────
// v2 (roster-linked):
//   - Panel BARU "Roster vs Actual" — gap per cabang antara
//     jadwal shift hari ini vs personel yang actually on-mic
//   - Sisanya sama dengan versi sebelumnya
// ============================================================
import React, { useState, useEffect, useMemo } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { fmtT, durMin } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { BranchPicker } from "../../components/BranchPicker.jsx"
import { useToast } from "../../components/Toast.jsx"

const SHIFT_TOKENS = ["I", "II", "III", "IV", "V"]

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

  // ============================================================
  // ROSTER GAP ANALYSIS — load all rosters for today, compare with logs
  // ============================================================
  const [rosterMap, setRosterMap] = useState(null)  // {airport_code: Set<personnel_name>}

  useEffect(() => {
    let cancelled = false
    async function loadRosterToday() {
      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth() + 1
      const day = today.getDate()

      // 1. Get all rosters for this month
      const { data: rosters, error: rErr } = await supabase
        .from('atc_rosters')
        .select('id, airport_code, unit')
        .eq('year', year)
        .eq('month', month)
      if (rErr || !rosters || rosters.length === 0) {
        if (!cancelled) setRosterMap({})
        return
      }
      const rosterIds = rosters.map(r => r.id)
      const idToBranch = {}
      for (const r of rosters) idToBranch[r.id] = r.airport_code

      // 2. Get cells for today across all rosters
      const { data: cells } = await supabase
        .from('atc_roster_cells')
        .select('roster_id, personnel_id, status')
        .in('roster_id', rosterIds)
        .eq('day', day)
      if (cancelled) return

      // 3. Group scheduled personnel names per branch
      const map = {}
      for (const c of cells || []) {
        if (!SHIFT_TOKENS.includes(c.status)) continue
        const ac = idToBranch[c.roster_id]
        if (!ac) continue
        // Resolve personnel_id → name via ctx.personnel
        const p = ctx.personnel.find(pp => pp.id === c.personnel_id) ||
                  ctx.personnel.find(pp => pp.name === c.personnel_id) ||
                  ctx.personnel.find(pp =>
                    (pp.initial || "").toLowerCase() === (c.personnel_id || "").toLowerCase()
                  )
        const name = p?.name || c.personnel_id
        if (!map[ac]) map[ac] = new Set()
        map[ac].add(name.toLowerCase())
      }
      setRosterMap(map)
    }
    loadRosterToday()
    return () => { cancelled = true }
  }, [ctx.personnel.length])

  // Compute gap per branch
  const gapAnalysis = useMemo(() => {
    if (!rosterMap) return null
    const branchCodes = br === "ALL"
      ? Object.keys(rosterMap)
      : (rosterMap[br] ? [br] : [])

    const result = branchCodes.map(code => {
      const scheduledNames = rosterMap[code] || new Set()
      const branchActive = allActive.filter(l => l.branch_code === code)
      const activeNames = new Set(branchActive.map(l => (l.atc_name || "").toLowerCase()))

      const onMicScheduled = [...activeNames].filter(n => scheduledNames.has(n))
      const late = [...scheduledNames].filter(n => !activeNames.has(n))
      const unscheduled = branchActive.filter(l => !scheduledNames.has((l.atc_name || "").toLowerCase()))

      return {
        code,
        scheduledCount: scheduledNames.size,
        onMicScheduledCount: onMicScheduled.length,
        lateCount: late.length,
        unscheduledCount: unscheduled.length,
        late,
        unscheduledNames: unscheduled.map(l => l.atc_name),
      }
    })

    // Sort: cabang dengan gap terbesar (late + unscheduled) di atas
    return result.sort((a, b) => {
      const aGap = a.lateCount + a.unscheduledCount
      const bGap = b.lateCount + b.unscheduledCount
      if (aGap !== bGap) return bGap - aGap
      return (a.code || "").localeCompare(b.code || "")
    })
  }, [rosterMap, br, allActive])

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

      {/* PANEL — ROSTER vs ACTUAL (BARU) */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <I n="checklist" s={16}/> Roster vs Actual
          </h2>
          <span className="panel-counter">
            {rosterMap === null ? "Loading…" :
              gapAnalysis?.length > 0 ? `${gapAnalysis.length} cabang` : "—"}
          </span>
        </div>
        <div className="panel-body" style={{ paddingTop: 0 }}>
          {rosterMap === null ? (
            <div className="empty-state"><p className="faint">Memuat roster...</p></div>
          ) : !gapAnalysis || gapAnalysis.length === 0 ? (
            <div className="empty-state">
              <p>{br !== "ALL"
                ? `Cabang ${br} belum punya roster untuk bulan ini.`
                : "Belum ada cabang yang generate roster untuk bulan ini."}
              </p>
              <p className="faint text-sm">MO cabang bisa generate dari menu Roster ATC.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Cabang</th>
                    <th style={{ textAlign: "center" }}>Jadwal Shift</th>
                    <th style={{ textAlign: "center" }}>Sudah On-Mic</th>
                    <th style={{ textAlign: "center" }}>Telat / Belum</th>
                    <th style={{ textAlign: "center" }}>Lembur / Override</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {gapAnalysis.map(g => {
                    const fullMatch = g.lateCount === 0 && g.unscheduledCount === 0 && g.scheduledCount > 0
                    return (
                      <tr key={g.code} style={{
                        background: fullMatch ? "var(--status-on-soft, rgba(34, 197, 94, 0.05))" : undefined,
                      }}>
                        <td>
                          <span className="unit-tag">{g.code}</span>
                          {fullMatch && (
                            <span style={{
                              marginLeft: 6,
                              fontSize: 10,
                              fontWeight: 700,
                              color: "var(--status-on, #22c55e)",
                              letterSpacing: 0.4,
                            }}>OK</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          {g.scheduledCount}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--status-on)" }}>
                          {g.onMicScheduledCount}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600,
                                     color: g.lateCount > 0 ? "var(--status-warn, #f59e0b)" : "var(--text-faint)" }}>
                          {g.lateCount || "—"}
                        </td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 600,
                                     color: g.unscheduledCount > 0 ? "var(--status-off, #ef4444)" : "var(--text-faint)" }}>
                          {g.unscheduledCount || "—"}
                        </td>
                        <td style={{ fontSize: 11 }}>
                          {g.lateCount === 0 && g.unscheduledCount === 0 ? (
                            <span className="faint">—</span>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              {g.lateCount > 0 && (
                                <span style={{ color: "var(--status-warn, #f59e0b)" }}>
                                  Telat: {g.late.slice(0, 3).join(", ")}
                                  {g.lateCount > 3 && ` +${g.lateCount - 3}`}
                                </span>
                              )}
                              {g.unscheduledCount > 0 && (
                                <span style={{ color: "var(--status-off, #ef4444)" }}>
                                  Lembur: {g.unscheduledNames.slice(0, 3).join(", ")}
                                  {g.unscheduledCount > 3 && ` +${g.unscheduledCount - 3}`}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
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
