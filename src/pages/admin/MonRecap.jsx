// ============================================================
// src/pages/admin/MonRecap.jsx — Monitoring traffic recap (all branches)
// ============================================================
import React, { useState } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { BranchPicker, BranchFilterBadge } from "../../components/BranchPicker.jsx"
import { Stat } from "../../components/Stat.jsx"

export const AdminMonRecap = () => {
  const ctx = useApp()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)
  const [period, setPeriod] = useState("today")
  const [expandBr, setExpandBr] = useState(null)

  const tc = l => (l.departure_count||0) + (l.arrival_count||0) + (l.overfly_count||0)

  const allTraffic = ctx.logs.filter(l => {
    if (!l.off_time || tc(l) === 0) return false
    const d = (new Date() - new Date(l.on_time)) / 864e5
    return period === "today"
      ? new Date(l.on_time).toDateString() === new Date().toDateString()
      : period === "week" ? d <= 7 : d <= 30
  })
  const filtered = br === "ALL" ? allTraffic : allTraffic.filter(l => l.branch_code === br)

  const totDep = filtered.reduce((a, l) => a + (l.departure_count||0), 0)
  const totArr = filtered.reduce((a, l) => a + (l.arrival_count||0), 0)
  const totOvf = filtered.reduce((a, l) => a + (l.overfly_count||0), 0)
  const totAll = totDep + totArr + totOvf

  const byBr = {}
  allTraffic.forEach(l => {
    if (!byBr[l.branch_code]) byBr[l.branch_code] = { dep:0, arr:0, ovf:0, tc:0, n:0, logs:[] }
    byBr[l.branch_code].dep += l.departure_count||0
    byBr[l.branch_code].arr += l.arrival_count||0
    byBr[l.branch_code].ovf += l.overfly_count||0
    byBr[l.branch_code].tc  += tc(l)
    byBr[l.branch_code].n++
    byBr[l.branch_code].logs.push(l)
  })
  const brKeys = Object.keys(byBr).sort((a, b) => byBr[b].tc - byBr[a].tc)

  const bySector = {}
  filtered.forEach(l => {
    const sk = (br === "ALL" ? l.branch_code + " › " : "") + l.unit + " — " + l.sector
    if (!bySector[sk]) bySector[sk] = { dep:0, arr:0, ovf:0 }
    bySector[sk].dep += l.departure_count||0
    bySector[sk].arr += l.arrival_count||0
    bySector[sk].ovf += l.overfly_count||0
  })
  const secKeys = Object.keys(bySector).sort((a, b) =>
    (bySector[b].dep + bySector[b].arr + bySector[b].ovf) -
    (bySector[a].dep + bySector[a].arr + bySector[a].ovf))
  const secMax = Math.max(1, ...secKeys.map(k => bySector[k].dep + bySector[k].arr + bySector[k].ovf))

  const byDate = {}
  filtered.forEach(l => {
    const dt = new Date(l.on_time).toISOString().slice(0, 10)
    if (!byDate[dt]) byDate[dt] = { dep:0, arr:0, ovf:0 }
    byDate[dt].dep += l.departure_count||0
    byDate[dt].arr += l.arrival_count||0
    byDate[dt].ovf += l.overfly_count||0
  })
  const dates = Object.keys(byDate).sort()
  const chartMax = Math.max(1, ...dates.map(d => byDate[d].dep + byDate[d].arr + byDate[d].ovf))

  const exportCSV = () => {
    const head = ["Cabang","Tanggal","On","Off","Controller","Unit","Sektor","Shift","DEP","ARR","OVF","Total"]
    const rows = filtered.sort((a, b) => new Date(b.on_time) - new Date(a.on_time)).map(l => {
      const dt = new Date(l.on_time).toISOString().slice(0, 10)
      return [l.branch_code, dt, fmtT(l.on_time), fmtT(l.off_time),
              l.atc_name||"", l.unit||"", l.sector||"", l.shift||"",
              l.departure_count||0, l.arrival_count||0, l.overfly_count||0, tc(l)]
    })
    const csv = [head.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `monitoring_traffic_${br}_${period}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const renderBranchDetail = (code) => {
    const d = byBr[code]
    if (!d) return null
    const b = ctx.branches.find(x => x.code === code)
    const brSec = {}
    d.logs.forEach(l => {
      const sk = l.unit + " — " + l.sector
      if (!brSec[sk]) brSec[sk] = { dep:0, arr:0, ovf:0 }
      brSec[sk].dep += l.departure_count||0
      brSec[sk].arr += l.arrival_count||0
      brSec[sk].ovf += l.overfly_count||0
    })
    const bsKeys = Object.keys(brSec).sort((a, b) =>
      (brSec[b].dep + brSec[b].arr + brSec[b].ovf) - (brSec[a].dep + brSec[a].arr + brSec[a].ovf))
    const bsMax = Math.max(1, ...bsKeys.map(k => brSec[k].dep + brSec[k].arr + brSec[k].ovf))

    return (
      <div style={{ padding:"12px 0 4px", borderTop:"1px solid var(--border)" }}>
        <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--fg-muted)", marginBottom:12, flexWrap:"wrap" }}>
          <span><strong>Bandara:</strong> {b?.name || code}</span>
          <span><strong>Kota:</strong> {b?.city || "-"}</span>
          <span><strong>Unit:</strong> {b?.units?.join(", ") || "-"}</span>
          <span><strong>Laporan:</strong> {d.n} controller off-mic</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
          {[["DEP", d.dep, "var(--traffic-dep)", "var(--accent-soft)"],
            ["ARR", d.arr, "var(--traffic-arr)", "var(--status-warn-soft)"],
            ["OVF", d.ovf, "var(--traffic-ovf)", "var(--status-off-soft)"]].map(([lbl, val, clr, bg]) => (
            <div key={lbl} style={{ background: bg, borderRadius:8, padding:"10px 8px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:800, color: clr, lineHeight:1 }}>{val}</div>
              <div style={{ fontSize:10, fontWeight:700, color: clr, marginTop:4 }}>{lbl}</div>
            </div>
          ))}
        </div>

        {bsKeys.length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:700, color:"var(--fg)", marginBottom:8 }}>Traffic Per Sektor</div>
            <div className="simple-chart" style={{ marginBottom:16 }}>
              {bsKeys.map(sk => {
                const t = brSec[sk].dep + brSec[sk].arr + brSec[sk].ovf
                return (
                  <div key={sk} className="chart-bar-row">
                    <span className="chart-label" style={{ minWidth:120 }}>{sk}</span>
                    <div className="chart-bar-track">
                      <div style={{ display:"flex", height:"100%", borderRadius:4, overflow:"hidden", width: (t / bsMax * 100) + "%" }}>
                        {brSec[sk].dep > 0 && <div style={{ width:(brSec[sk].dep/t*100)+"%", background:"var(--traffic-dep)", height:"100%" }}/>}
                        {brSec[sk].arr > 0 && <div style={{ width:(brSec[sk].arr/t*100)+"%", background:"var(--traffic-arr)", height:"100%" }}/>}
                        {brSec[sk].ovf > 0 && <div style={{ width:(brSec[sk].ovf/t*100)+"%", background:"var(--traffic-ovf)", height:"100%" }}/>}
                      </div>
                      <span className="chart-bar-value">{t}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display:"flex", gap:12, marginBottom:12, fontSize:10, color:"var(--fg-muted)" }}>
              {[["DEP", "var(--traffic-dep)"], ["ARR", "var(--traffic-arr)"], ["OVF", "var(--traffic-ovf)"]].map(([l, c]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background: c }}/>{l}
                </div>
              ))}
            </div>
          </>
        )}

        <div style={{ fontSize:12, fontWeight:700, color:"var(--fg)", marginBottom:8 }}>Log Detail</div>
        <div className="table-wrap">
          <table className="data-table" style={{ fontSize:12 }}>
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
              {d.logs.sort((a, b) => new Date(b.on_time) - new Date(a.on_time)).map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace:"nowrap" }}>{fmtD(l.on_time)}</td>
                  <td style={{ whiteSpace:"nowrap", color:"var(--fg-muted)" }}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
                  <td><strong>{l.atc_name}</strong></td>
                  <td><span className="unit-tag">{l.unit}</span></td>
                  <td>{l.sector}</td>
                  <td>{l.shift}</td>
                  <td style={{ textAlign:"center", color:"var(--traffic-dep)", fontWeight:700 }}>{l.departure_count||0}</td>
                  <td style={{ textAlign:"center", color:"var(--traffic-arr)", fontWeight:700 }}>{l.arrival_count||0}</td>
                  <td style={{ textAlign:"center", color:"var(--traffic-ovf)", fontWeight:700 }}>{l.overfly_count||0}</td>
                  <td style={{ textAlign:"center", fontWeight:800 }}>{tc(l)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight:700 }}>
                <td colSpan={6} style={{ textAlign:"right", color:"var(--fg-muted)" }}>TOTAL</td>
                <td style={{ textAlign:"center", color:"var(--traffic-dep)" }}>{d.dep}</td>
                <td style={{ textAlign:"center", color:"var(--traffic-arr)" }}>{d.arr}</td>
                <td style={{ textAlign:"center", color:"var(--traffic-ovf)" }}>{d.ovf}</td>
                <td style={{ textAlign:"center" }}>{d.tc}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    )
  }


  // brAct map for BranchPicker live indicator
  const brAct = {}
  ctx.logs.filter(l => !l.off_time).forEach(l => { brAct[l.branch_code] = (brAct[l.branch_code] || 0) + 1 })
  const allBr = ctx.branches.filter(b => b.region)

  return (
    <div className="page-content">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Monitoring Rekap Traffic</h1>
          <p className="topbar-sub">Detail traffic seluruh cabang{br === "ALL" ? "" : " · " + br}</p>
        </div>
      </div>
      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={br} onChange={setBr} branches={allBr} brAct={brAct}/>
          <BranchFilterBadge value={br} onClear={() => setBr("ALL")}/>
          <div className="filter-bar" style={{ margin:0 }}>
          {[["today","Hari Ini"],["week","Minggu"],["month","Bulan"]].map(([k, v]) => (
            <button key={k} className={"filter-btn" + (period === k ? " filter-btn-active" : "")}
                    onClick={() => setPeriod(k)}>{v}</button>
          ))}
        </div>
        </div>
        <div className="inmc-topbar-l">
          <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        </div>
      </div>

      <div className="stats-grid">
        <Stat icon="plane"    label="Total Traffic" value={totAll} color="var(--status-on)"/>
        <Stat icon="upload"   label="Departure"     value={totDep} color="var(--traffic-dep)"/>
        <Stat icon="download" label="Arrival"       value={totArr} color="var(--traffic-arr)"/>
        <Stat icon="radar"    label="Overfly"       value={totOvf} color="var(--traffic-ovf)"/>
      </div>

      {br === "ALL" && brKeys.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><I n="building" s={16}/> Traffic Per Cabang</h2>
            <span className="panel-counter">{brKeys.length} cabang</span>
          </div>
          <div className="panel-body">
            {brKeys.map(code => {
              const d = byBr[code], b = ctx.branches.find(x => x.code === code)
              const isExp = expandBr === code
              return (
                <div key={code} className="handover-card handover-normal" style={{ cursor:"pointer", marginBottom:6 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0" }}
                       onClick={() => setExpandBr(isExp ? null : code)}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                      <span style={{ fontSize:14 }}>{isExp ? "▾" : "▸"}</span>
                      <span className="unit-tag" style={{ fontWeight:700 }}>{code}</span>
                      <span style={{ fontSize:13, color:"var(--fg)" }}>{b?.city || ""}</span>
                      <span style={{ fontSize:12, color:"var(--fg-muted)" }}>{d.n} laporan</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:12, fontSize:12, fontWeight:700 }}>
                      <span style={{ color:"var(--traffic-dep)" }}>{d.dep} <span style={{ fontWeight:400, fontSize:10 }}>DEP</span></span>
                      <span style={{ color:"var(--traffic-arr)" }}>{d.arr} <span style={{ fontWeight:400, fontSize:10 }}>ARR</span></span>
                      <span style={{ color:"var(--traffic-ovf)" }}>{d.ovf} <span style={{ fontWeight:400, fontSize:10 }}>OVF</span></span>
                      <span style={{ color:"var(--fg)", fontSize:14, marginLeft:4 }}>{d.tc}</span>
                    </div>
                  </div>
                  <div style={{ height:4, borderRadius:2, overflow:"hidden", display:"flex", gap:1 }}>
                    {d.dep > 0 && <div style={{ width:(d.dep/d.tc*100)+"%", background:"var(--traffic-dep)", borderRadius:2 }}/>}
                    {d.arr > 0 && <div style={{ width:(d.arr/d.tc*100)+"%", background:"var(--traffic-arr)", borderRadius:2 }}/>}
                    {d.ovf > 0 && <div style={{ width:(d.ovf/d.tc*100)+"%", background:"var(--traffic-ovf)", borderRadius:2 }}/>}
                  </div>
                  {isExp && renderBranchDetail(code)}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {br !== "ALL" && (
        <>
          {secKeys.length > 0 && (
            <div className="panel">
              <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Traffic Per Sektor</h2></div>
              <div className="panel-body">
                <div className="simple-chart">
                  {secKeys.map(sk => {
                    const t = bySector[sk].dep + bySector[sk].arr + bySector[sk].ovf
                    return (
                      <div key={sk} className="chart-bar-row">
                        <span className="chart-label" style={{ minWidth:120 }}>{sk}</span>
                        <div className="chart-bar-track">
                          <div style={{ display:"flex", height:"100%", borderRadius:4, overflow:"hidden", width:(t/secMax*100)+"%" }}>
                            {bySector[sk].dep > 0 && <div style={{ width:(bySector[sk].dep/t*100)+"%", background:"var(--traffic-dep)", height:"100%" }}/>}
                            {bySector[sk].arr > 0 && <div style={{ width:(bySector[sk].arr/t*100)+"%", background:"var(--traffic-arr)", height:"100%" }}/>}
                            {bySector[sk].ovf > 0 && <div style={{ width:(bySector[sk].ovf/t*100)+"%", background:"var(--traffic-ovf)", height:"100%" }}/>}
                          </div>
                          <span className="chart-bar-value">{t}</span>
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
                      x: 46 + (dates.length === 1 ? 309 : (i/(dates.length-1)) * 618),
                      y: 16 + (1 - (byDate[d].dep+byDate[d].arr+byDate[d].ovf)/chartMax) * 150,
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
                            <text x={p.x} y={p.y-10} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--traffic-dep)">{p.v}</text>
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
            <div className="panel-header"><h2 className="panel-title">Log Detail</h2><span className="panel-counter">{filtered.length}</span></div>
            <div className="panel-body">
              {filtered.length === 0
                ? <div className="empty-state"><p>Tidak ada data</p></div>
                : <div className="table-wrap">
                    <table className="data-table" style={{ fontSize:12 }}>
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
                        {filtered.sort((a, b) => new Date(b.on_time) - new Date(a.on_time)).map(l => (
                          <tr key={l.id}>
                            <td style={{ whiteSpace:"nowrap" }}>{fmtD(l.on_time)}</td>
                            <td style={{ whiteSpace:"nowrap", color:"var(--fg-muted)" }}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
                            <td><strong>{l.atc_name}</strong></td>
                            <td><span className="unit-tag">{l.unit}</span></td>
                            <td>{l.sector}</td>
                            <td>{l.shift}</td>
                            <td style={{ textAlign:"center", color:"var(--traffic-dep)", fontWeight:700 }}>{l.departure_count||0}</td>
                            <td style={{ textAlign:"center", color:"var(--traffic-arr)", fontWeight:700 }}>{l.arrival_count||0}</td>
                            <td style={{ textAlign:"center", color:"var(--traffic-ovf)", fontWeight:700 }}>{l.overfly_count||0}</td>
                            <td style={{ textAlign:"center", fontWeight:800 }}>{tc(l)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>}
            </div>
          </div>
        </>
      )}

      {filtered.length > 0 && (
        <button className="btn btn-primary" onClick={exportCSV} style={{ marginTop:4 }}>
          <I n="download" s={16}/> Export CSV
        </button>
      )}
    </div>
  )
}
