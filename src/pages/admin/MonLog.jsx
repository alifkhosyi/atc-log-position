// ============================================================
// src/pages/admin/MonLog.jsx — Monitoring log position (all branches)
// ============================================================
import React, { useState, useEffect } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, durMin } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

export const AdminMonLog = () => {
  const ctx = useApp()
  const [br, setBr] = useState(ctx.navBranch || "ALL")

  useEffect(() => {
    if (ctx.navBranch) {
      setBr(ctx.navBranch)
      ctx.setNavBranch(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.navBranch])

  const allActive = ctx.logs.filter(l => !l.off_time)
  const fa = br === "ALL" ? allActive : allActive.filter(l => l.branch_code === br)
  const todayAll = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const ft = br === "ALL" ? todayAll : todayAll.filter(l => l.branch_code === br)

  return (
    <div className="page-content">
      <Header title="Monitoring Log Position" sub="Real-time seluruh cabang"/>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
      </div>
      <div className="stats-grid">
        <Stat icon="mic" label="On Mic" value={fa.length} sub={br === "ALL" ? "Seluruh cabang" : br} color="var(--status-on)"/>
        <Stat icon="log" label="Log Hari Ini" value={ft.length} color="var(--accent)"/>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><Pulse s={10}/> ATC On Mic</h2>
          <span className="panel-badge">LIVE</span>
        </div>
        <div className="panel-body">
          {fa.length === 0
            ? <div className="empty-state"><I n="micOff" s={44}/><p>Tidak ada ATC on mic</p></div>
            : <div className="position-grid">
                {fa.map(l => {
                  const b = ctx.branches.find(a => a.code === l.branch_code)
                  return (
                    <div key={l.id} className="position-card">
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                        <Pulse s={7}/>
                        <span className="position-unit">{l.branch_code}</span>
                        <span className="position-sector">{b?.city}</span>
                      </div>
                      <div className="position-cwp">{l.unit} — {l.sector} — {l.cwp}</div>
                      <div className="position-name">{l.atc_name}</div>
                      <div className="position-time">
                        On: {fmtT(l.on_time)} ({durMin(l.on_time, new Date().toISOString())}m)
                      </div>
                    </div>
                  )
                })}
              </div>}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Log Hari Ini</h2>
          <span className="panel-counter">{ft.length}</span>
        </div>
        <div className="panel-body">
          {ft.length === 0
            ? <div className="empty-state"><p>Belum ada log</p></div>
            : <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Cabang</th><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>On</th><th>Off</th><th>Status</th></tr></thead>
                  <tbody>
                    {ft.map(l => (
                      <tr key={l.id}>
                        <td><span className="unit-tag">{l.branch_code}</span></td>
                        <td><strong>{l.atc_name}</strong></td>
                        <td>{l.unit}</td>
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
