// ============================================================
// src/pages/cabang/RekapPersonnel.jsx — Personnel statistics
// ============================================================
import React, { useState } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, durMin, getAccessibleBranches } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

export const CabangRekapPersonnel = () => {
  const ctx = useApp()
  const myBranches  = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))
  const myLogs      = ctx.logs.filter(l => myBranches.includes(l.branch_code) && l.off_time)

  const [period, setPeriod] = useState("month")
  const [search, setSearch] = useState("")
  const [expandedName, setExpandedName] = useState(null)
  const [sortBy, setSortBy] = useState("hours")

  const filtered = myLogs.filter(l => {
    const d = (new Date() - new Date(l.on_time)) / 864e5
    return period === "today"
      ? new Date(l.on_time).toDateString() === new Date().toDateString()
      : period === "week" ? d <= 7 : d <= 30
  })

  // Build per-person stats
  const byPerson = {}
  filtered.forEach(l => {
    const nm = l.atc_name
    if (!byPerson[nm]) byPerson[nm] = { name: nm, count:0, totalMin:0, dep:0, arr:0, ovf:0,
                                         shifts:{ Morning:0, Afternoon:0, Night:0 }, sectors:new Set(), logs:[] }
    const p = byPerson[nm]
    p.count++
    p.totalMin += durMin(l.on_time, l.off_time)
    p.dep += l.departure_count || 0
    p.arr += l.arrival_count   || 0
    p.ovf += l.overfly_count   || 0
    if (l.shift)  p.shifts[l.shift] = (p.shifts[l.shift] || 0) + 1
    if (l.sector) p.sectors.add(l.sector)
    p.logs.push(l)
  })
  // Include personnel with 0 activity
  myPersonnel.forEach(p => {
    if (!byPerson[p.name]) byPerson[p.name] = { name:p.name, count:0, totalMin:0, dep:0, arr:0, ovf:0,
                                                 shifts:{ Morning:0, Afternoon:0, Night:0 }, sectors:new Set(), logs:[] }
  })

  let personList = Object.values(byPerson)
  if (search) personList = personList.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  personList.sort((a, b) => {
    if (sortBy === "hours") return b.totalMin - a.totalMin
    if (sortBy === "count") return b.count - a.count
    return (b.dep + b.arr + b.ovf) - (a.dep + a.arr + a.ovf)
  })

  const totalPersonnel  = myPersonnel.length
  const activePersonnel = Object.values(byPerson).filter(p => p.count > 0).length
  const totalHours      = Math.round(Object.values(byPerson).reduce((a, p) => a + p.totalMin, 0) / 60 * 10) / 10
  const totalTraffic    = Object.values(byPerson).reduce((a, p) => a + p.dep + p.arr + p.ovf, 0)
  const topMax          = personList.length > 0 ? personList[0].totalMin : 1

  const exportCSV = () => {
    const head = ["Nama","On Mic","Total Jam","Rata-rata (mnt)","DEP","ARR","OVF","Total Traffic","Shift Pagi","Shift Siang","Shift Malam","Sektor"]
    const rows = personList.map(p => [
      p.name, p.count, (p.totalMin / 60).toFixed(1),
      p.count ? Math.round(p.totalMin / p.count) : 0,
      p.dep, p.arr, p.ovf, p.dep + p.arr + p.ovf,
      p.shifts.Morning || 0, p.shifts.Afternoon || 0, p.shifts.Night || 0,
      [...p.sectors].join("; "),
    ])
    const csv = [head.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `rekap_personel_${ctx.user.branch_code}_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page-content">
      <Header title="Rekap Personel" sub={"Statistik personel ATC — " + ctx.user.branch_code}/>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, flexWrap:"wrap" }}>
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
          <option value="hours">Urutkan: Jam Kerja</option>
          <option value="count">Urutkan: Frekuensi</option>
          <option value="traffic">Urutkan: Traffic</option>
        </select>
      </div>

      <div className="stats-grid">
        <Stat icon="users" label="Total Personel" value={totalPersonnel} sub={activePersonnel + " aktif"} color="var(--purple)"/>
        <Stat icon="clock" label="Total Jam Kerja" value={totalHours + " jam"} color="var(--accent)"/>
        <Stat icon="mic"   label="Total On Mic"   value={filtered.length} sub="periode ini" color="var(--status-on)"/>
        <Stat icon="plane" label="Total Traffic"  value={totalTraffic} color="var(--status-warn)"/>
      </div>

      {personList.filter(p => p.count > 0).length > 0 && (
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Top Personel (Jam Kerja)</h2></div>
          <div className="panel-body">
            <div style={{ display:"grid", gridTemplateColumns:"140px 1fr 60px 50px 50px", gap:8,
                          marginBottom:8, paddingBottom:8, borderBottom:"1px solid var(--border)" }}>
              <span/><span/>
              <span style={{ fontSize:9, fontWeight:700, color:"var(--fg-muted)", textAlign:"right", textTransform:"uppercase", letterSpacing:".5px" }}>Jam</span>
              <span style={{ fontSize:9, fontWeight:700, color:"var(--fg-muted)", textAlign:"center", textTransform:"uppercase", letterSpacing:".5px" }}>On Mic</span>
              <span style={{ fontSize:9, fontWeight:700, color:"var(--fg-muted)", textAlign:"center", textTransform:"uppercase", letterSpacing:".5px" }}>Traffic</span>
            </div>
            <div className="simple-chart">
              {personList.filter(p => p.count > 0).slice(0, 10).map(p => {
                const hrs = Math.round(p.totalMin / 60 * 10) / 10
                const traffic = p.dep + p.arr + p.ovf
                return (
                  <div key={p.name} style={{ display:"grid", gridTemplateColumns:"140px 1fr 60px 50px 50px",
                                              gap:8, alignItems:"center", marginBottom:6 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:"var(--fg)", textAlign:"right",
                                   overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.name}</span>
                    <div className="chart-bar-track">
                      <div className="chart-bar-fill" style={{ width:((p.totalMin / topMax) * 100) + "%", minWidth:4 }}/>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:"var(--accent)", textAlign:"right" }}>{hrs}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:"var(--purple)", textAlign:"center" }}>{p.count}x</span>
                    <span style={{ fontSize:11, fontWeight:600, color:"var(--fg-muted)", textAlign:"center" }}>{traffic > 0 ? traffic : "—"}</span>
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
                const isExp = expandedName === p.name
                const hrs = Math.round(p.totalMin / 60 * 10) / 10
                const avg = p.count ? Math.round(p.totalMin / p.count) : 0
                return (
                  <div key={p.name} className="handover-card handover-normal"
                       style={{ cursor:"pointer", opacity: p.count > 0 ? 1 : .5, marginBottom:4 }}
                       onClick={() => setExpandedName(isExp ? null : p.name)}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 0" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:13 }}>{isExp ? "▾" : "▸"}</span>
                        <strong style={{ fontSize:13 }}>{p.name}</strong>
                        {p.count === 0 && <span style={{ fontSize:10, color:"var(--fg-muted)", fontStyle:"italic" }}>Belum on mic</span>}
                      </div>
                      {p.count > 0 && (
                        <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:11, fontWeight:600 }}>
                          <span style={{ color:"var(--accent)" }}>{hrs} jam</span>
                          <span style={{ color:"var(--status-on)" }}>{p.count}x</span>
                          <span style={{ color:"var(--traffic-dep)" }}>{p.dep}<span style={{ fontWeight:400, fontSize:9 }}> D</span></span>
                          <span style={{ color:"var(--traffic-arr)" }}>{p.arr}<span style={{ fontWeight:400, fontSize:9 }}> A</span></span>
                          <span style={{ color:"var(--traffic-ovf)" }}>{p.ovf}<span style={{ fontWeight:400, fontSize:9 }}> O</span></span>
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
                                  <td>{l.sector}</td>
                                  <td>{l.cwp}</td>
                                  <td>{durMin(l.on_time, l.off_time)}m</td>
                                  <td style={{ textAlign:"center", color:"var(--traffic-dep)", fontWeight:600 }}>{l.departure_count || 0}</td>
                                  <td style={{ textAlign:"center", color:"var(--traffic-arr)", fontWeight:600 }}>{l.arrival_count || 0}</td>
                                  <td style={{ textAlign:"center", color:"var(--traffic-ovf)", fontWeight:600 }}>{l.overfly_count || 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {p.logs.length > 20 && (
                          <div style={{ fontSize:10, color:"var(--fg-muted)", marginTop:4 }}>
                            Menampilkan 20 terbaru dari {p.logs.length} log
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
        </div>
      </div>

      {personList.filter(p => p.count > 0).length > 0 && (
        <button className="btn btn-primary" onClick={exportCSV} style={{ marginTop:4 }}>
          <I n="download" s={16}/> Export CSV
        </button>
      )}
    </div>
  )
}
