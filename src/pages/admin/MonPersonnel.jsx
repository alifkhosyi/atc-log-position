// ============================================================
// src/pages/admin/MonPersonnel.jsx — Monitoring personnel (all branches)
// ============================================================
import React, { useState } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, durMin } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { BranchPicker, BranchFilterBadge } from "../../components/BranchPicker.jsx"
import { Stat } from "../../components/Stat.jsx"

export const AdminMonPersonnel = () => {
  const ctx = useApp()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)
  const [period, setPeriod] = useState("month")
  const [search, setSearch] = useState("")
  const [expandedName, setExpandedName] = useState(null)
  const [sortBy, setSortBy] = useState("hours")

  const allDone = ctx.logs.filter(l => {
    if (!l.off_time) return false
    const brOk = br === "ALL" || l.branch_code === br
    const d = (new Date() - new Date(l.on_time)) / 864e5
    const pOk = period === "today"
      ? new Date(l.on_time).toDateString() === new Date().toDateString()
      : period === "week" ? d <= 7 : d <= 30
    return brOk && pOk
  })

  const filteredPersonnel = br === "ALL" ? ctx.personnel : ctx.personnel.filter(p => p.branch_code === br)

  const byPerson = {}
  allDone.forEach(l => {
    const k = l.atc_name + "||" + l.branch_code
    if (!byPerson[k]) byPerson[k] = { name:l.atc_name, branch:l.branch_code, count:0, totalMin:0,
                                       dep:0, arr:0, ovf:0, shifts:{Morning:0, Afternoon:0, Night:0},
                                       sectors:new Set(), logs:[] }
    const p = byPerson[k]
    p.count++; p.totalMin += durMin(l.on_time, l.off_time)
    p.dep += l.departure_count||0; p.arr += l.arrival_count||0; p.ovf += l.overfly_count||0
    if (l.shift) p.shifts[l.shift] = (p.shifts[l.shift] || 0) + 1
    if (l.sector) p.sectors.add(l.sector)
    p.logs.push(l)
  })
  filteredPersonnel.forEach(p => {
    const k = p.name + "||" + p.branch_code
    if (!byPerson[k]) byPerson[k] = { name:p.name, branch:p.branch_code, count:0, totalMin:0,
                                      dep:0, arr:0, ovf:0, shifts:{Morning:0, Afternoon:0, Night:0},
                                      sectors:new Set(), logs:[] }
  })

  let personList = Object.values(byPerson)
  if (search) personList = personList.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  personList.sort((a, b) =>
    sortBy === "hours" ? b.totalMin - a.totalMin
    : sortBy === "count" ? b.count - a.count
    : (b.dep + b.arr + b.ovf) - (a.dep + a.arr + a.ovf))

  const activeCount = Object.values(byPerson).filter(p => p.count > 0).length
  const totalHours = Math.round(Object.values(byPerson).reduce((a, p) => a + p.totalMin, 0) / 60 * 10) / 10
  const totalTraffic = Object.values(byPerson).reduce((a, p) => a + p.dep + p.arr + p.ovf, 0)
  const topMax = personList.length > 0 && personList[0].totalMin > 0 ? personList[0].totalMin : 1

  const byBranch = {}
  Object.values(byPerson).filter(p => p.count > 0).forEach(p => {
    if (!byBranch[p.branch]) byBranch[p.branch] = { personnel:0, hours:0, traffic:0 }
    byBranch[p.branch].personnel++
    byBranch[p.branch].hours += p.totalMin
    byBranch[p.branch].traffic += p.dep + p.arr + p.ovf
  })
  const brKeys = Object.keys(byBranch).sort((a, b) => byBranch[b].hours - byBranch[a].hours)
  const brMax = brKeys.length > 0 ? byBranch[brKeys[0]].hours : 1

  const getBrName = (code) => { const b = ctx.branches.find(x => x.code === code); return b ? code + " — " + b.city : code }


  // brAct map for BranchPicker live indicator
  const brAct = {}
  ctx.logs.filter(l => !l.off_time).forEach(l => { brAct[l.branch_code] = (brAct[l.branch_code] || 0) + 1 })
  const allBr = ctx.branches.filter(b => b.region)

  return (
    <div className="page-content">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Monitoring Rekap Personel</h1>
          <p className="topbar-sub">Statistik personel seluruh cabang{br === "ALL" ? "" : " · " + br}</p>
        </div>
      </div>

      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={br} onChange={setBr} branches={allBr} brAct={brAct}/>
          <BranchFilterBadge value={br} onClear={() => setBr("ALL")}/>
          <div className="filter-bar" style={{ margin:0 }}>
          {[["today","Hari Ini"],["week","7 Hari"],["month","30 Hari"]].map(([k, v]) => (
            <button key={k} className={"filter-btn" + (period === k ? " filter-btn-active" : "")}
                    onClick={() => setPeriod(k)}>{v}</button>
          ))}
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama..."
               style={{ flex:1, minWidth:120, padding:"6px 10px", borderRadius:8,
                        border:"1px solid var(--border)", background:"var(--card)",
                        color:"var(--fg)", fontSize:12 }}/>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                style={{ padding:"6px 10px", borderRadius:8, border:"1px solid var(--border)",
                         background:"var(--card)", color:"var(--fg)", fontSize:12 }}>
          <option value="hours">Jam Kerja</option>
          <option value="count">Frekuensi</option>
          <option value="traffic">Traffic</option>
        </select>
        </div>
        <div className="inmc-topbar-l">
          <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon="users" label="Personel"      value={filteredPersonnel.length} sub={activeCount + " aktif"} color="var(--purple)"/>
        <Stat icon="clock" label="Total Jam"     value={totalHours + " jam"} color="var(--accent)"/>
        <Stat icon="mic"   label="Total On Mic"  value={allDone.length} color="var(--status-on)"/>
        <Stat icon="plane" label="Total Traffic" value={totalTraffic} color="var(--status-warn)"/>
      </div>

      {br === "ALL" && brKeys.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><I n="building" s={16}/> Jam Kerja Per Cabang</h2>
            <span className="panel-counter">{brKeys.length} cabang</span>
          </div>
          <div className="panel-body">
            <div className="simple-chart">
              {brKeys.map(code => {
                const d = byBranch[code], hrs = Math.round(d.hours / 60 * 10) / 10
                return (
                  <div key={code} className="chart-bar-row">
                    <span className="chart-label" style={{ minWidth:130, fontSize:11 }}>{getBrName(code)}</span>
                    <div className="chart-bar-track">
                      <div className="chart-bar-fill" style={{ width:(d.hours/brMax*100) + "%" }}>
                        <span className="chart-bar-value">{hrs}h • {d.personnel} org • {d.traffic} traffic</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {personList.filter(p => p.count > 0).length > 0 && (
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Top 10 Personel</h2></div>
          <div className="panel-body">
            <div className="simple-chart">
              {personList.filter(p => p.count > 0).slice(0, 10).map(p => {
                const hrs = Math.round(p.totalMin / 60 * 10) / 10
                return (
                  <div key={p.name + p.branch} className="chart-bar-row">
                    <span className="chart-label" style={{ minWidth:140, fontSize:11 }}>
                      {p.name}
                      {br === "ALL" && (
                        <span style={{ color:"var(--fg-muted)", fontSize:9, marginLeft:4 }}>({p.branch})</span>
                      )}
                    </span>
                    <div className="chart-bar-track">
                      <div className="chart-bar-fill" style={{ width:(p.totalMin / topMax * 100) + "%" }}>
                        <span className="chart-bar-value">{hrs}h ({p.count}x)</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Detail Personel</h2>
          <span className="panel-counter">{personList.length}</span>
        </div>
        <div className="panel-body">
          {personList.length === 0
            ? <div className="empty-state"><I n="users" s={44}/><p>Tidak ada data</p></div>
            : personList.map(p => {
                const isExp = expandedName === p.name + p.branch
                const hrs = Math.round(p.totalMin / 60 * 10) / 10
                const avg = p.count ? Math.round(p.totalMin / p.count) : 0
                return (
                  <div key={p.name + p.branch} className="handover-card handover-normal"
                       style={{ cursor:"pointer", opacity: p.count > 0 ? 1 : .45, marginBottom:4 }}
                       onClick={() => setExpandedName(isExp ? null : p.name + p.branch)}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:13 }}>{isExp ? "▾" : "▸"}</span>
                        <strong style={{ fontSize:13 }}>{p.name}</strong>
                        {br === "ALL" && (
                          <span style={{ fontSize:10, color:"var(--fg-muted)", background:"var(--bg)",
                                         padding:"1px 6px", borderRadius:6 }}>{p.branch}</span>
                        )}
                        {p.count === 0 && (
                          <span style={{ fontSize:10, color:"var(--fg-muted)", fontStyle:"italic" }}>Belum on mic</span>
                        )}
                      </div>
                      {p.count > 0 && (
                        <div style={{ display:"flex", alignItems:"center", gap:10, fontSize:11, fontWeight:600 }}>
                          <span style={{ color:"var(--accent)" }}>{hrs}h</span>
                          <span style={{ color:"var(--status-on)" }}>{p.count}x</span>
                          <span style={{ color:"var(--traffic-dep)" }}>{p.dep}<span style={{ fontWeight:400, fontSize:9 }}>D</span></span>
                          <span style={{ color:"var(--traffic-arr)" }}>{p.arr}<span style={{ fontWeight:400, fontSize:9 }}>A</span></span>
                          <span style={{ color:"var(--traffic-ovf)" }}>{p.ovf}<span style={{ fontWeight:400, fontSize:9 }}>O</span></span>
                        </div>
                      )}
                    </div>
                    {isExp && p.count > 0 && (
                      <div style={{ padding:"10px 0 4px", borderTop:"1px solid var(--border)" }}>
                        <div style={{ display:"flex", gap:12, marginBottom:10, fontSize:11 }}>
                          <span>Rata-rata: <strong>{avg} mnt</strong></span>
                          <span>Pagi: <strong>{p.shifts.Morning || 0}</strong></span>
                          <span>Siang: <strong>{p.shifts.Afternoon || 0}</strong></span>
                          <span>Malam: <strong>{p.shifts.Night || 0}</strong></span>
                          <span>Sektor: <strong>{[...p.sectors].join(", ") || "-"}</strong></span>
                        </div>
                        <div className="table-wrap">
                          <table className="data-table" style={{ fontSize:11 }}>
                            <thead>
                              <tr>
                                <th>Tanggal</th><th>On–Off</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>Durasi</th>
                                <th style={{ textAlign:"center", color:"var(--traffic-dep)" }}>D</th>
                                <th style={{ textAlign:"center", color:"var(--traffic-arr)" }}>A</th>
                                <th style={{ textAlign:"center", color:"var(--traffic-ovf)" }}>O</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.logs.sort((a, b) => new Date(b.on_time) - new Date(a.on_time)).slice(0, 20).map(l => (
                                <tr key={l.id}>
                                  <td style={{ whiteSpace:"nowrap" }}>{fmtD(l.on_time)}</td>
                                  <td style={{ whiteSpace:"nowrap", color:"var(--fg-muted)" }}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
                                  <td><span className="unit-tag">{l.unit}</span></td>
                                  <td>{l.sector}</td><td>{l.cwp}</td>
                                  <td>{durMin(l.on_time, l.off_time)}m</td>
                                  <td style={{ textAlign:"center", color:"var(--traffic-dep)", fontWeight:600 }}>{l.departure_count||0}</td>
                                  <td style={{ textAlign:"center", color:"var(--traffic-arr)", fontWeight:600 }}>{l.arrival_count||0}</td>
                                  <td style={{ textAlign:"center", color:"var(--traffic-ovf)", fontWeight:600 }}>{l.overfly_count||0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {p.logs.length > 20 && (
                          <div style={{ fontSize:10, color:"var(--fg-muted)", marginTop:4 }}>20 terbaru dari {p.logs.length}</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
        </div>
      </div>
    </div>
  )
}
