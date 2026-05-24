// ============================================================
// src/pages/admin/MonPersonnel.jsx — INMC Monitoring Personnel (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: Admin_MonPersonnel_Redesign.html mockup
//
// Logic preserved:
//   - br state from ctx.globalBranch
//   - period filter (today/week/month) same date math
//   - search filter (name contains)
//   - sortBy (hours/count/traffic)
//   - byPerson aggregation from ctx.logs + ctx.personnel
//   - All stats computed identically
// New affordances from mockup:
//   - Topbar + INMC sticky toolbar (BranchPicker + filter pill + period chips)
//   - Search + sort row dengan .input-wrap + select
//   - Stats grid (4 cards) — Aktif/Sesi/Jam/Avg
//   - Top 10 Personnel panel dengan .rank-list / .rank-row
//   - Avatar dengan initials, ranking medal (top-1/top-3)
//   - .rank-bar-fill proportional dengan hours overlay
//   - Full personnel table dengan DEP/ARR/OVF semantic colors + shift dist
//   - DetailPanel drill-down with 3 tabs (Sesi/Shift/Traffic)
// ============================================================
import React, { useState, useEffect, useMemo } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, durMin } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { BranchPicker } from "../../components/BranchPicker.jsx"
import { useToast } from "../../components/Toast.jsx"

const initials = (name) =>
  (name || "").split(" ")
    .filter(s => s.length > 1 && !s.includes("."))
    .slice(0, 2)
    .map(s => s[0])
    .join("")
    .toUpperCase() || "?"

const DetailPanel = ({ p, branches, onClose }) => {
  const [tab, setTab] = useState("sesi")
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])
  const totalShifts = (p.shifts.Morning || 0) + (p.shifts.Afternoon || 0) + (p.shifts.Night || 0) || 1
  const hours = (p.totalMin / 60).toFixed(1)
  const avg = p.count > 0 ? Math.round(p.totalMin / p.count) : 0
  const branch = branches.find(b => b.code === p.branch)

  // Use actual logs for "Sesi" tab
  const sessions = (p.logs || []).slice(0, 12)

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
                {branch?.region === "west" ? "West" : branch?.region === "east" ? "East" : "—"} Region
              </span>
              <span className="unit-tag">{p.branch}</span>
            </div>
            <h3 className="side-panel-title">{p.name}</h3>
            <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", marginTop: 2 }}>
              {branch?.name || p.branch}{branch?.city ? ` · ${branch.city}` : ""}
            </p>
          </div>
          <button className="side-panel-close" onClick={onClose} aria-label="Close (ESC)">
            <I n="x" s={20}/>
          </button>
        </div>
        <div className="side-panel-tabs">
          <button className={"sp-tab" + (tab === "sesi" ? " active" : "")} onClick={() => setTab("sesi")}>Sesi On Mic</button>
          <button className={"sp-tab" + (tab === "shift" ? " active" : "")} onClick={() => setTab("shift")}>Distribusi Shift</button>
          <button className={"sp-tab" + (tab === "traffic" ? " active" : "")} onClick={() => setTab("traffic")}>Traffic</button>
        </div>
        <div className="side-panel-body">
          <div className="sp-stat-row">
            <div className="sp-stat"><div className="sp-stat-l">Sesi</div><div className="sp-stat-v">{p.count}</div></div>
            <div className="sp-stat"><div className="sp-stat-l">Jam Kerja</div><div className="sp-stat-v" style={{ color: "var(--accent)" }}>{hours}h</div></div>
            <div className="sp-stat"><div className="sp-stat-l">Rata² Sesi</div><div className="sp-stat-v">{avg}m</div></div>
          </div>

          {tab === "sesi" && (
            sessions.length === 0
              ? <div className="empty-state"><p>Belum ada sesi untuk periode ini</p></div>
              : <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr><th>Tanggal</th><th>On</th><th>Unit</th><th>Sektor</th><th>Durasi</th><th style={{ textAlign: "center" }}>D/A/O</th></tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={s.id || i}>
                        <td>{fmtD(s.on_time)}</td>
                        <td className="mono">{fmtT(s.on_time)}</td>
                        <td><span className="unit-tag">{s.unit}</span></td>
                        <td>{s.sector}</td>
                        <td className="mono">{s.off_time ? durMin(s.on_time, s.off_time) : 0}m</td>
                        <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                          <span style={{ color: "var(--traffic-dep)" }}>{s.departure_count || 0}</span>/
                          <span style={{ color: "var(--traffic-arr)" }}>{s.arrival_count || 0}</span>/
                          <span style={{ color: "var(--traffic-ovf)" }}>{s.overfly_count || 0}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}

          {tab === "shift" && (
            <div>
              <div className="shift-pie">
                {p.shifts.Morning > 0 && <div className="shift-pie-seg" style={{ width: `${p.shifts.Morning / totalShifts * 100}%`, background: "var(--status-warn)" }}>{p.shifts.Morning}</div>}
                {p.shifts.Afternoon > 0 && <div className="shift-pie-seg" style={{ width: `${p.shifts.Afternoon / totalShifts * 100}%`, background: "var(--accent)" }}>{p.shifts.Afternoon}</div>}
                {p.shifts.Night > 0 && <div className="shift-pie-seg" style={{ width: `${p.shifts.Night / totalShifts * 100}%`, background: "var(--purple)" }}>{p.shifts.Night}</div>}
              </div>
              <div className="shift-pie-leg" style={{ justifyContent: "center", marginTop: 8 }}>
                <span style={{ color: "var(--status-warn)" }}>● Pagi {p.shifts.Morning || 0}</span>
                <span style={{ color: "var(--accent)" }}>● Siang {p.shifts.Afternoon || 0}</span>
                <span style={{ color: "var(--purple)" }}>● Malam {p.shifts.Night || 0}</span>
              </div>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", marginTop: 16, textAlign: "center" }}>
                Total {totalShifts} sesi · Distribusi{" "}
                {(p.shifts.Morning || 0) > (p.shifts.Afternoon || 0) && (p.shifts.Morning || 0) > (p.shifts.Night || 0)
                  ? "dominasi pagi"
                  : (p.shifts.Night || 0) > (p.shifts.Morning || 0) && (p.shifts.Night || 0) > (p.shifts.Afternoon || 0)
                  ? "dominasi malam"
                  : "merata"}
              </p>
            </div>
          )}

          {tab === "traffic" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                <div className="sp-stat"><div className="sp-stat-l">DEP</div><div className="sp-stat-v" style={{ color: "var(--traffic-dep)" }}>{p.dep}</div></div>
                <div className="sp-stat"><div className="sp-stat-l">ARR</div><div className="sp-stat-v" style={{ color: "var(--traffic-arr)" }}>{p.arr}</div></div>
                <div className="sp-stat"><div className="sp-stat-l">OVF</div><div className="sp-stat-v" style={{ color: "var(--traffic-ovf)" }}>{p.ovf}</div></div>
              </div>
              <p style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", textAlign: "center" }}>
                Total <strong style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{p.dep + p.arr + p.ovf}</strong> movements ditangani
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export const AdminMonPersonnel = () => {
  const ctx = useApp()
  const toast = useToast()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)
  const [period, setPeriod] = useState("month")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("hours")
  const [drill, setDrill] = useState(null)

  // Filter logs by period + branch (preserved)
  const allDone = useMemo(() => ctx.logs.filter(l => {
    if (!l.off_time) return false
    const brOk = br === "ALL" || l.branch_code === br
    const d = (new Date() - new Date(l.on_time)) / 864e5
    const pOk = period === "today"
      ? new Date(l.on_time).toDateString() === new Date().toDateString()
      : period === "week" ? d <= 7 : d <= 30
    return brOk && pOk
  }), [ctx.logs, br, period])

  // Personnel registered (for "active vs registered" stat)
  const filteredPersonnel = useMemo(() =>
    br === "ALL" ? ctx.personnel : ctx.personnel.filter(p => p.branch_code === br),
    [ctx.personnel, br])

  // Aggregate by person (preserved logic)
  const byPerson = useMemo(() => {
    const m = {}
    allDone.forEach(l => {
      const k = l.atc_name + "||" + l.branch_code
      if (!m[k]) m[k] = {
        id: k, name: l.atc_name, branch: l.branch_code,
        count: 0, totalMin: 0, dep: 0, arr: 0, ovf: 0,
        shifts: { Morning: 0, Afternoon: 0, Night: 0 },
        logs: [],
      }
      const p = m[k]
      p.count++
      p.totalMin += durMin(l.on_time, l.off_time)
      p.dep += l.departure_count || 0
      p.arr += l.arrival_count || 0
      p.ovf += l.overfly_count || 0
      if (l.shift && p.shifts[l.shift] !== undefined) p.shifts[l.shift]++
      p.logs.push(l)
    })
    // Add registered personnel without logs (so they appear in "registered" count)
    filteredPersonnel.forEach(p => {
      const k = p.name + "||" + p.branch_code
      if (!m[k]) m[k] = {
        id: k, name: p.name, branch: p.branch_code,
        count: 0, totalMin: 0, dep: 0, arr: 0, ovf: 0,
        shifts: { Morning: 0, Afternoon: 0, Night: 0 },
        logs: [],
      }
    })
    return m
  }, [allDone, filteredPersonnel])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = Object.values(byPerson)
    if (search) list = list.filter(p => (p.name || "").toLowerCase().includes(search.toLowerCase()))
    return list.sort((a, b) =>
      sortBy === "hours" ? b.totalMin - a.totalMin
      : sortBy === "count" ? b.count - a.count
      : (b.dep + b.arr + b.ovf) - (a.dep + a.arr + a.ovf)
    )
  }, [byPerson, search, sortBy])

  // Stats
  const activeCount = Object.values(byPerson).filter(p => p.count > 0).length
  const totalOnMic = Object.values(byPerson).reduce((a, p) => a + p.count, 0)
  const totalHours = Math.round(Object.values(byPerson).reduce((a, p) => a + p.totalMin, 0) / 60 * 10) / 10
  const totalRegistered = (br === "ALL" ? ctx.personnel : ctx.personnel.filter(p => p.branch_code === br)).length
  const avgPerPerson = activeCount > 0 ? (totalHours / activeCount).toFixed(1) : "0"
  const topMax = Math.max(1, ...filtered.map(p => p.totalMin))

  // brAct for BranchPicker live indicator
  const brAct = useMemo(() => {
    const m = {}
    ctx.logs.filter(l => !l.off_time).forEach(l => { m[l.branch_code] = (m[l.branch_code] || 0) + 1 })
    return m
  }, [ctx.logs])
  const allBr = useMemo(() => ctx.branches.filter(b => b.region), [ctx.branches])

  const exportCSV = () => {
    const head = ["Nama", "Branch", "Sesi", "Jam Kerja", "DEP", "ARR", "OVF", "Total Traffic", "Pagi", "Siang", "Malam"]
    const rows = filtered.map(p => [
      p.name, p.branch, p.count, (p.totalMin / 60).toFixed(1),
      p.dep, p.arr, p.ovf, p.dep + p.arr + p.ovf,
      p.shifts.Morning || 0, p.shifts.Afternoon || 0, p.shifts.Night || 0,
    ])
    const csv = [head.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `monitoring_personnel_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Export berhasil", `${filtered.length} personnel diunduh`)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Monitoring Personnel</div>
          <div className="topbar-sub">Statistik beban kerja personnel ATC{br === "ALL" ? "" : ` · ${br}`}</div>
        </div>
        <button className="btn btn-sm" onClick={exportCSV}>
          <I n="download" s={14}/> Export CSV
        </button>
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
          <div className="period-chips">
            <button className={"period-chip" + (period === "today" ? " active" : "")} onClick={() => setPeriod("today")}>Hari Ini</button>
            <button className={"period-chip" + (period === "week" ? " active" : "")} onClick={() => setPeriod("week")}>Minggu</button>
            <button className={"period-chip" + (period === "month" ? " active" : "")} onClick={() => setPeriod("month")}>Bulan</button>
          </div>
        </div>
      </div>

      {/* SEARCH + SORT */}
      <div className="search-sort-row">
        <div className="input-wrap">
          <span className="input-wrap-ic"><I n="search" s={14}/></span>
          <input className="search-input" placeholder="Cari personnel..."
                 value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ padding: "7px 12px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--text)", fontSize: "var(--fs-sm)" }}>
          <option value="hours">Sort: Jam Kerja</option>
          <option value="count">Sort: Sesi On Mic</option>
          <option value="traffic">Sort: Traffic Total</option>
        </select>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="users" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Personnel Aktif</div>
            <div className="stat-v">{activeCount} / {totalRegistered}</div>
            <div className="stat-sub">yang on-mic periode ini</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-on-soft)", color: "var(--status-on)" }}>
            <I n="mic" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Total Sesi</div>
            <div className="stat-v" style={{ color: "var(--status-on)" }}>{totalOnMic.toLocaleString()}</div>
            <div className="stat-sub">on mic sessions</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
            <I n="time" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Total Jam</div>
            <div className="stat-v" style={{ color: "var(--purple)" }}>{totalHours}h</div>
            <div className="stat-sub">akumulasi jam kerja</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-warn-soft)", color: "var(--status-warn)" }}>
            <I n="chart" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Rata² per Personnel</div>
            <div className="stat-v">{avgPerPerson}h</div>
            <div className="stat-sub">jam kerja</div>
          </div>
        </div>
      </div>

      {/* TOP 10 RANKING */}
      {filtered.filter(p => p.count > 0).length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><I n="chart" s={16}/> 🏆 Top 10 Personnel</h2>
            <span className="panel-counter">by {sortBy === "hours" ? "Jam Kerja" : sortBy === "count" ? "Sesi" : "Traffic"}</span>
          </div>
          <div className="panel-body">
            <div className="rank-list">
              {filtered.filter(p => p.count > 0).slice(0, 10).map((p, i) => {
                const hrs = (p.totalMin / 60).toFixed(1)
                const traffic = p.dep + p.arr + p.ovf
                const val = sortBy === "hours" ? hrs + "h" : sortBy === "count" ? p.count + "x" : traffic
                const pct = (p.totalMin / topMax) * 100
                return (
                  <div key={p.id} className={"rank-row" + (i === 0 ? " top-1" : i < 3 ? " top-3" : "")}
                       onClick={() => setDrill(p)}>
                    <div className="rank-num">{(i + 1).toString().padStart(2, "0")}</div>
                    <div className="rank-avatar">{initials(p.name)}</div>
                    <div className="rank-name-block">
                      <span className="rank-name">{p.name}</span>
                      <span className="rank-meta">{p.shifts.Morning || 0}p · {p.shifts.Afternoon || 0}s · {p.shifts.Night || 0}m</span>
                    </div>
                    <div className="rank-branch">{p.branch}</div>
                    <div className="rank-bar-wrap">
                      <div className="rank-bar-fill" style={{ width: `${pct}%` }}>{hrs}h</div>
                    </div>
                    <div className="rank-val">{val}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ALL PERSONNEL TABLE */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Semua Personnel</h2>
          <span className="panel-counter">{filtered.length}</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="empty-state"><I n="users" s={44}/><p>Tidak ada personnel cocok</p></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Branch</th>
                    <th style={{ textAlign: "center" }}>Sesi</th>
                    <th style={{ textAlign: "center" }}>Jam</th>
                    <th style={{ textAlign: "center" }}>DEP</th>
                    <th style={{ textAlign: "center" }}>ARR</th>
                    <th style={{ textAlign: "center" }}>OVF</th>
                    <th style={{ textAlign: "center" }}>Total Traffic</th>
                    <th style={{ textAlign: "center" }}>Pagi</th>
                    <th style={{ textAlign: "center" }}>Siang</th>
                    <th style={{ textAlign: "center" }}>Malam</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 80).map(p => (
                    <tr key={p.id} onClick={() => setDrill(p)} style={{ cursor: "pointer" }}>
                      <td><strong>{p.name}</strong></td>
                      <td><span className="unit-tag">{p.branch}</span></td>
                      <td style={{ textAlign: "center" }} className="mono">{p.count || <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center" }} className="mono">{p.count > 0 ? (p.totalMin / 60).toFixed(1) + "h" : <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center", color: "var(--traffic-dep)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{p.dep || <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center", color: "var(--traffic-arr)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{p.arr || <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center", color: "var(--traffic-ovf)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{p.ovf || <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontWeight: 800 }}>{p.dep + p.arr + p.ovf || <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center" }} className="mono">{p.shifts.Morning || <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center" }} className="mono">{p.shifts.Afternoon || <span className="faint">—</span>}</td>
                      <td style={{ textAlign: "center" }} className="mono">{p.shifts.Night || <span className="faint">—</span>}</td>
                      <td><I n="chev" s={14}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 80 && (
                <div style={{ padding: 12, textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                  Menampilkan 80 dari {filtered.length} personnel · Export CSV untuk data lengkap
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {drill && <DetailPanel p={drill} branches={ctx.branches} onClose={() => setDrill(null)}/>}
    </div>
  )
}
