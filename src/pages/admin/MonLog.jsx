// ============================================================
// src/pages/admin/MonLog.jsx — Monitoring Log Position (REDESIGN sesi 6)
// ──────────────────────────────────────────────────────────
// Class-based styling consistent with INMC Dashboard.
// Uses globalBranch + BranchPicker shared component.
// Logic 1:1 with pre-redesign version.
// ============================================================
import React, { useEffect } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, durMin } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { BranchPicker, BranchFilterBadge } from "../../components/BranchPicker.jsx"

export const AdminMonLog = () => {
  const ctx = useApp()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)

  // navBranch (one-shot from Dashboard drill-down) sets globalBranch
  useEffect(() => {
    if (ctx.navBranch) {
      ctx.setGlobalBranch(ctx.navBranch)
      ctx.setNavBranch(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.navBranch])

  const allActive = ctx.logs.filter(l => !l.off_time)
  const fa = br === "ALL" ? allActive : allActive.filter(l => l.branch_code === br)
  const todayAll = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const ft = br === "ALL" ? todayAll : todayAll.filter(l => l.branch_code === br)

  // brAct map for BranchPicker live indicator
  const brAct = {}
  allActive.forEach(l => { brAct[l.branch_code] = (brAct[l.branch_code] || 0) + 1 })

  const allBr = ctx.branches.filter(b => b.region)

  return (
    <div className="page-content">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Monitoring Log Position</h1>
          <p className="topbar-sub">Real-time seluruh cabang · {br === "ALL" ? "semua region" : br}</p>
        </div>
      </div>

      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={br} onChange={setBr} branches={allBr} brAct={brAct}/>
          <BranchFilterBadge value={br} onClear={() => setBr("ALL")}/>
        </div>
        <div className="inmc-topbar-l">
          <span className="monitor-label"><I n="eye" s={12}/> MONITORING · LIVE</span>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-on-soft)", color: "var(--status-on)" }}>
            <I n="mic" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">On Mic</div>
            <div className="stat-v">{fa.length}</div>
            <div className="stat-sub">{br === "ALL" ? "Seluruh cabang" : br}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="log" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Log Hari Ini</div>
            <div className="stat-v">{ft.length}</div>
            <div className="stat-sub">total sesi</div>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><Pulse on={true} s={8}/> ATC On Mic</h2>
          <span className="panel-badge">LIVE</span>
        </div>
        <div className="panel-body">
          {fa.length === 0 ? (
            <div className="empty-state"><I n="micOff" s={44}/><p>Tidak ada ATC on mic</p></div>
          ) : (
            <div className="position-grid">
              {fa.map(l => {
                const b = ctx.branches.find(a => a.code === l.branch_code)
                return (
                  <div key={l.id} className="position-card">
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Pulse on={true} s={7}/>
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
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Log Hari Ini</h2>
          <span className="panel-counter">{ft.length}</span>
        </div>
        <div className="panel-body">
          {ft.length === 0 ? (
            <div className="empty-state"><p>Belum ada log</p></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Cabang</th><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>On</th><th>Off</th><th>Status</th></tr>
                </thead>
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
                          : <span className="status-badge status-on"><Pulse on={true} s={6}/> On</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
