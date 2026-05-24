// ============================================================
// src/pages/cabang/RekapTraffic.jsx — Traffic recap with charts
// ============================================================
import React, { useState } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, getAccessibleBranches } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

export const CabangRekap = () => {
  const ctx = useApp()
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myLogs = ctx.logs.filter(l =>
    myBranches.includes(l.branch_code) && l.off_time &&
    ((l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)) > 0
  )

  const [period, setPeriod] = useState("month")
  const [filterName, setFilterName] = useState("")
  const [filterSector, setFilterSector] = useState("")

  const filtered = myLogs.filter(l => {
    const d = (new Date() - new Date(l.on_time)) / 864e5
    const pOk = period === "today"
      ? new Date(l.on_time).toDateString() === new Date().toDateString()
      : period === "week" ? d <= 7 : d <= 30
    const nmOk = !filterName  || (l.atc_name || "").toLowerCase().includes(filterName.toLowerCase())
    const secOk = !filterSector || (l.sector  || "").toLowerCase().includes(filterSector.toLowerCase())
    return pOk && nmOk && secOk
  }).sort((a, b) => new Date(b.on_time) - new Date(a.on_time))

  const totals = filtered.reduce((a, l) => ({
    dep: a.dep + (l.departure_count || 0),
    arr: a.arr + (l.arrival_count || 0),
    ovf: a.ovf + (l.overfly_count || 0),
    tc:  a.tc  + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0),
  }), { dep: 0, arr: 0, ovf: 0, tc: 0 })

  // Per-date breakdown
  const byDate = {}
  filtered.forEach(l => {
    const dt = new Date(l.on_time).toISOString().slice(0, 10)
    if (!byDate[dt]) byDate[dt] = { dep: 0, arr: 0, ovf: 0 }
    byDate[dt].dep += l.departure_count || 0
    byDate[dt].arr += l.arrival_count   || 0
    byDate[dt].ovf += l.overfly_count   || 0
  })
  const dates = Object.keys(byDate).sort()
  const chartMax = Math.max(1, ...dates.map(d => byDate[d].dep + byDate[d].arr + byDate[d].ovf))

  // Per-sector breakdown
  const bySector = {}
  filtered.forEach(l => {
    const sk = l.unit + " — " + l.sector
    if (!bySector[sk]) bySector[sk] = { dep: 0, arr: 0, ovf: 0 }
    bySector[sk].dep += l.departure_count || 0
    bySector[sk].arr += l.arrival_count   || 0
    bySector[sk].ovf += l.overfly_count   || 0
  })
  const sectorKeys = Object.keys(bySector).sort((a, b) =>
    (bySector[b].dep + bySector[b].arr + bySector[b].ovf) -
    (bySector[a].dep + bySector[a].arr + bySector[a].ovf)
  )
  const sectorMax = Math.max(1, ...sectorKeys.map(k => bySector[k].dep + bySector[k].arr + bySector[k].ovf))

  const exportCSV = () => {
    const head = ["Tanggal","On","Off","Controller","Unit","Sektor","Shift","DEP","ARR","OVF","Total"]
    const rows = filtered.map(l => {
      const dt = new Date(l.on_time).toISOString().slice(0, 10)
      return [dt, fmtT(l.on_time), fmtT(l.off_time), l.atc_name || "", l.unit || "", l.sector || "",
              l.shift || "", l.departure_count || 0, l.arrival_count || 0, l.overfly_count || 0,
              (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)]
    })
    const csv = [head.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `rekap_traffic_${ctx.user.branch_code}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page-content">
      <Header title="Rekap Traffic" sub={"Data traffic per sektor — " + ctx.user.branch_code}/>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16, flexWrap:"wrap" }}>
        <div className="filter-bar" style={{ margin:0 }}>
          {[["today","Hari Ini"],["week","7 Hari"],["month","30 Hari"]].map(([k,v]) => (
            <button key={k} className={"filter-btn" + (period === k ? " filter-btn-active" : "")}
                    onClick={() => setPeriod(k)}>{v}</button>
          ))}
        </div>
        <input value={filterName} onChange={e => setFilterName(e.target.value)}
               placeholder="Filter controller..."
               style={{ flex:1, minWidth:100, padding:"6px 10px", borderRadius:8,
                        border:"1px solid var(--border)", background:"var(--card)",
                        color:"var(--fg)", fontSize:12 }}/>
        <input value={filterSector} onChange={e => setFilterSector(e.target.value)}
               placeholder="Sektor..."
               style={{ width:100, padding:"6px 10px", borderRadius:8,
                        border:"1px solid var(--border)", background:"var(--card)",
                        color:"var(--fg)", fontSize:12 }}/>
      </div>

      <div className="stats-grid">
        <Stat icon="plane"    label="Total Traffic" value={totals.tc}  sub={filtered.length + " laporan"} color="var(--status-on)"/>
        <Stat icon="upload"   label="Departure"     value={totals.dep} color="var(--traffic-dep)"/>
        <Stat icon="download" label="Arrival"       value={totals.arr} color="var(--traffic-arr)"/>
        <Stat icon="radar"    label="Overfly"       value={totals.ovf} color="var(--traffic-ovf)"/>
      </div>

      {sectorKeys.length > 0 && (
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Traffic Per Sektor</h2></div>
          <div className="panel-body">
            <div className="simple-chart">
              {sectorKeys.map(sk => {
                const t = bySector[sk].dep + bySector[sk].arr + bySector[sk].ovf
                return (
                  <div key={sk} className="chart-bar-row">
                    <span className="chart-label">{sk}</span>
                    <div className="chart-bar-track">
                      <div className="chart-bar-fill" style={{ width: (t / sectorMax * 100) + "%" }}>
                        <span className="chart-bar-value">{t}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {dates.length > 1 && (
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Trend Harian</h2></div>
          <div className="panel-body">
            <svg viewBox="0 0 680 200" width="100%" style={{ display:"block" }}>
              {[0,.25,.5,.75,1].map(f => {
                const y = 16 + (1 - f) * 150
                return <line key={f} x1="46" y1={y} x2="664" y2={y} stroke="var(--border)" strokeWidth=".5"/>
              })}
              {(() => {
                const pts = dates.map((d, i) => ({
                  x: 46 + (dates.length === 1 ? 309 : (i / (dates.length - 1)) * 618),
                  y: 16 + (1 - (byDate[d].dep + byDate[d].arr + byDate[d].ovf) / chartMax) * 150,
                  v: byDate[d].dep + byDate[d].arr + byDate[d].ovf,
                  d,
                }))
                const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
                return (
                  <>
                    <path d={`${pathD} L${pts[pts.length-1].x},166 L${pts[0].x},166 Z`} fill="var(--traffic-dep)" opacity=".1"/>
                    <path d={pathD} fill="none" stroke="var(--traffic-dep)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4" fill="var(--card)" stroke="var(--traffic-dep)" strokeWidth="2"/>
                        <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--traffic-dep)">{p.v}</text>
                        <text x={p.x} y={185} textAnchor="middle" fontSize="9" fill="var(--fg-muted)">{p.d.slice(5)}</text>
                      </g>
                    ))}
                  </>
                )
              })()}
            </svg>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Data Detail</h2>
          <span className="panel-counter">{filtered.length}</span>
        </div>
        <div className="panel-body">
          {filtered.length === 0
            ? <div className="empty-state"><p>Tidak ada data untuk filter ini</p></div>
            : <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th><th>On–Off</th><th>Controller</th><th>Unit</th><th>Sektor</th><th>Shift</th>
                      <th style={{ textAlign:"center", color:"var(--traffic-dep)" }}>DEP</th>
                      <th style={{ textAlign:"center", color:"var(--traffic-arr)" }}>ARR</th>
                      <th style={{ textAlign:"center", color:"var(--traffic-ovf)" }}>OVF</th>
                      <th style={{ textAlign:"center" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(l => {
                      const tc = (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)
                      return (
                        <tr key={l.id}>
                          <td style={{ whiteSpace:"nowrap" }}>{fmtD(l.on_time)}</td>
                          <td style={{ whiteSpace:"nowrap", color:"var(--fg-muted)", fontSize:12 }}>
                            {fmtT(l.on_time)}–{fmtT(l.off_time)}
                          </td>
                          <td><strong>{l.atc_name || "-"}</strong></td>
                          <td><span className="unit-tag">{l.unit}</span></td>
                          <td>{l.sector || "-"}</td>
                          <td>{l.shift || "-"}</td>
                          <td style={{ textAlign:"center", color:"var(--traffic-dep)", fontWeight:700 }}>{l.departure_count || 0}</td>
                          <td style={{ textAlign:"center", color:"var(--traffic-arr)", fontWeight:700 }}>{l.arrival_count || 0}</td>
                          <td style={{ textAlign:"center", color:"var(--traffic-ovf)", fontWeight:700 }}>{l.overfly_count || 0}</td>
                          <td style={{ textAlign:"center", fontWeight:800 }}>{tc}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight:700 }}>
                      <td colSpan={6} style={{ textAlign:"right", color:"var(--fg-muted)" }}>TOTAL</td>
                      <td style={{ textAlign:"center", color:"var(--traffic-dep)" }}>{totals.dep}</td>
                      <td style={{ textAlign:"center", color:"var(--traffic-arr)" }}>{totals.arr}</td>
                      <td style={{ textAlign:"center", color:"var(--traffic-ovf)" }}>{totals.ovf}</td>
                      <td style={{ textAlign:"center" }}>{totals.tc}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>}
        </div>
      </div>

      {filtered.length > 0 && (
        <button className="btn btn-primary" onClick={exportCSV} style={{ marginTop:4 }}>
          <I n="download" s={16}/> Export CSV
        </button>
      )}
    </div>
  )
}
