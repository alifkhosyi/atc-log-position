// ============================================================
// src/pages/cabang/Dashboard.jsx — Cabang dashboard
// ============================================================
import React from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, durMin, getShift, getAccessibleBranches } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

export const CabangDash = () => {
  const ctx = useApp()
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const active = ctx.logs.filter(l => !l.off_time && myBranches.includes(l.branch_code))
  const today = ctx.logs.filter(l => myBranches.includes(l.branch_code) && new Date(l.on_time).toDateString() === new Date().toDateString())
  const todayTC = today.filter(l => l.off_time).reduce((a,l) => a+(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0), 0)
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || { name:"", city:"", units:[] }

  return (
    <div className="page-content">
      <Header title="Dashboard" sub={br.name + " (" + ctx.user.branch_code + ") — " + br.city}/>
      <div className="stats-grid">
        <Stat icon="mic"   label="On Mic"        value={active.length} sub="Saat ini" color="var(--status-on)"/>
        <Stat icon="log"   label="Log Hari Ini"  value={today.length}  sub={"Shift " + getShift()} color="var(--accent)"/>
        <Stat icon="plane" label="Traffic"       value={todayTC}       sub="Hari ini" color="var(--status-warn)"/>
        <Stat icon="tower" label="Unit"          value={br.units ? br.units.join(", ") : "-"}
              sub={(br.units ? br.units.length : 0) + " unit"} color="var(--purple)"/>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><Pulse s={10}/> Posisi Aktif</h2>
          <span className="panel-badge">LIVE</span>
        </div>
        <div className="panel-body">
          {active.length === 0
            ? <div className="empty-state"><I n="micOff" s={44}/><p>Belum ada ATC on mic</p></div>
            : <div className="position-grid">
                {active.map(l => (
                  <div key={l.id} className="position-card">
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                      <Pulse s={7}/>
                      <span className="position-unit">{l.unit}</span>
                      <span className="position-sector">{l.sector}</span>
                    </div>
                    <div className="position-cwp">{l.cwp}</div>
                    <div className="position-name">{l.atc_name}</div>
                    <div className="position-time">
                      On: {fmtT(l.on_time)} ({durMin(l.on_time, new Date().toISOString())}m)
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Timeline Hari Ini</h2>
          <span className="panel-counter">{today.length}</span>
        </div>
        <div className="panel-body">
          {today.length === 0
            ? <div className="empty-state"><p>Belum ada log</p></div>
            : <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>On</th><th>Off</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {today.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.atc_name}</strong></td>
                        <td><span className="unit-tag">{l.unit}</span></td>
                        <td>{l.sector}</td>
                        <td>{l.cwp}</td>
                        <td>{fmtT(l.on_time)}</td>
                        <td>{l.off_time ? fmtT(l.off_time) : "-"}</td>
                        <td>
                          {l.off_time
                            ? <span className="status-badge status-off">Off</span>
                            : <span className="status-badge status-on"><Pulse s={6}/> On</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>
      </div>
    </div>
  )
}
