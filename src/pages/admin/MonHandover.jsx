// ============================================================
// src/pages/admin/MonHandover.jsx — Monitoring handover (all branches)
// ============================================================
import React, { useState } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtD, fmtDT } from "../../lib/utils.js"
import { CHECKLIST_ITEMS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

// Status colors — semantic tokens (was light-theme hex in original)
const STATUS_CLR = {
  "OK":     { bg: "var(--status-on-soft)",    fg: "var(--status-on)" },
  "Not OK": { bg: "var(--status-alert-soft)", fg: "var(--status-alert)" },
  "N/A":    { bg: "var(--status-off-soft)",   fg: "var(--text-muted)" },
}

export const AdminMonHandover = () => {
  const ctx = useApp()
  const [br, setBr] = useState("ALL")
  const [filterDate, setFilterDate] = useState("")
  const [expandedId, setExpandedId] = useState(null)

  const clList = ctx.handoverChecklists.filter(c => {
    const brOk = br === "ALL" || c.branch_id === br
    const dOk = !filterDate || c.checklist_date === filterDate
    return brOk && dOk
  })

  const noteList = br === "ALL" ? ctx.handovers : ctx.handovers.filter(h => h.branch_code === br)

  const getAcctName = (bid) => {
    const found = ctx.branches.find(b => b.id === bid)
    return found ? found.code + " — " + found.city : bid?.slice(0, 8) + "..."
  }

  return (
    <div className="page-content">
      <Header title="Monitoring Handover/Takeover" sub="Checklist & catatan dari seluruh cabang"/>
      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, flexWrap:"wrap" }}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="br-select"/>
        {filterDate && <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate("")}>✕ Reset</button>}
      </div>

      <div className="stats-grid">
        <Stat icon="checklist" label="Total Checklist" value={clList.length} color="var(--purple)"/>
        <Stat icon="shield" label="Not OK Items"
              value={clList.reduce((a, c) => a + CHECKLIST_ITEMS.filter(it => c[it.key + "_status"] === "Not OK").length, 0)}
              color="var(--status-alert)" sub="Perlu perhatian"/>
        <Stat icon="note" label="Handover Notes" value={noteList.length} color="var(--accent)"/>
      </div>

      <div style={{ marginBottom:8, marginTop:8 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--fg)", display:"flex", alignItems:"center", gap:8 }}>
          <I n="checklist" s={18}/> Handover/Takeover Checklists
        </h2>
      </div>

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Checklists</h2><span className="panel-counter">{clList.length}</span></div>
        <div className="panel-body">
          {clList.length === 0
            ? <div className="empty-state"><I n="checklist" s={44}/><p>Tidak ada checklist ditemukan</p></div>
            : clList.map(cl => {
                const notOk = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "Not OK").length
                return (
                  <div key={cl.id} className={"handover-card " + (notOk > 0 ? "handover-high" : "handover-normal")}
                       style={{ cursor:"pointer" }} onClick={() => setExpandedId(expandedId === cl.id ? null : cl.id)}>
                    <div className="handover-header">
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:14 }}>{expandedId === cl.id ? "▾" : "▸"}</span>
                        <span style={{ background:"var(--purple-soft)", color:"var(--purple)",
                                       padding:"2px 10px", borderRadius:12, fontSize:12, fontWeight:700 }}>
                          {getAcctName(cl.branch_id)}
                        </span>
                        <strong>{fmtD(cl.checklist_date)}</strong>
                        {cl.shift && <span className="priority-tag priority-normal">{cl.shift}</span>}
                        {notOk > 0 && <span className="priority-tag priority-high">⚠ {notOk} Not OK</span>}
                      </div>
                      <span style={{ color:"var(--fg-muted)", fontSize:12 }}>MOD: {cl.manager_on_duty}</span>
                    </div>
                    {expandedId === cl.id && (
                      <div style={{ padding:"12px 0 4px", borderTop:"1px solid var(--border)" }}>
                        <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--fg-muted)", marginBottom:8 }}>
                          <span><strong>Waktu:</strong> {cl.checklist_time}</span>
                          <span><strong>MOD:</strong> {cl.manager_on_duty}</span>
                          <span><strong>Shift:</strong> {cl.shift}</span>
                        </div>
                        <table className="data-table" style={{ fontSize:12 }}>
                          <thead><tr><th>Item</th><th>Status</th><th>Catatan</th></tr></thead>
                          <tbody>
                            {CHECKLIST_ITEMS.map(it => {
                              const c = STATUS_CLR[cl[it.key + "_status"]] || STATUS_CLR["N/A"]
                              return (
                                <tr key={it.key}>
                                  <td>{it.label}</td>
                                  <td>
                                    <span style={{
                                      display:"inline-block", padding:"2px 10px", borderRadius:12,
                                      fontSize:11, fontWeight:600, background:c.bg, color:c.fg,
                                    }}>{cl[it.key + "_status"]}</span>
                                  </td>
                                  <td style={{ color:"var(--fg-muted)" }}>{cl[it.key + "_notes"] || "—"}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        <div style={{ display:"flex", gap:24, marginTop:12, padding:12, background:"var(--bg)", borderRadius:8 }}>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--fg-muted)", textTransform:"uppercase", marginBottom:4 }}>
                              Incoming ({(cl.incoming_personnel || "").split(",").filter(n => n.trim()).length})
                            </div>
                            {(cl.incoming_personnel || "").split(",").map((n, i) => n.trim() && (
                              <div key={i} style={{ fontSize:13, fontWeight:600, color:"var(--fg)", padding:"2px 0" }}>• {n.trim()}</div>
                            ))}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, fontWeight:600, color:"var(--fg-muted)", textTransform:"uppercase", marginBottom:4 }}>
                              Outgoing ({(cl.outgoing_personnel || "").split(",").filter(n => n.trim()).length})
                            </div>
                            {(cl.outgoing_personnel || "").split(",").map((n, i) => n.trim() && (
                              <div key={i} style={{ fontSize:13, fontWeight:600, color:"var(--fg)", padding:"2px 0" }}>• {n.trim()}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
        </div>
      </div>

      <div style={{ marginTop:32, marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--fg)", display:"flex", alignItems:"center", gap:8 }}>
          <I n="note" s={18}/> Handover Notes
        </h2>
      </div>

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Notes</h2><span className="panel-counter">{noteList.length}</span></div>
        <div className="panel-body">
          {noteList.length === 0
            ? <div className="empty-state"><p>Belum ada catatan</p></div>
            : noteList.map(n => {
                const b = ctx.branches.find(a => a.code === n.branch_code)
                return (
                  <div key={n.id} className={"handover-card handover-" + n.priority}>
                    <div className="handover-header">
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span className="handover-branch">{n.branch_code}{b ? " — " + b.city : ""}</span>
                        <span className={"priority-tag priority-" + n.priority}>{n.priority.toUpperCase()}</span>
                        <span className="handover-shift">Shift {n.from_shift} → {n.to_shift}</span>
                      </div>
                      <span className="handover-time">{fmtDT(n.created_at)}</span>
                    </div>
                    <div className="handover-body">{n.content}</div>
                    <div className="handover-author">— {n.author_name}</div>
                  </div>
                )
              })}
        </div>
      </div>
    </div>
  )
}
