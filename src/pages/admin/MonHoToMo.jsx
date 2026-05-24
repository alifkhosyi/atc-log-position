// ============================================================
// src/pages/admin/MonHoToMo.jsx — Monitoring HO/TO MO checklists (all branches)
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { MO_TABS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { BranchPicker, BranchFilterBadge } from "../../components/BranchPicker.jsx"
import { Stat } from "../../components/Stat.jsx"

export const AdminMonHoToMo = () => {
  const ctx = useApp()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)
  const [filterDate, setFilterDate] = useState("")
  const [activeTab, setActiveTab] = useState("pre_shift")
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  const currentTab = MO_TABS.find(t => t.id === activeTab)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let q = supabase.from("mo_checklists").select("*")
        .eq("checklist_type", activeTab).order("created_at", { ascending: false }).limit(200)
      if (br !== "ALL") q = q.eq("branch_code", br)
      if (filterDate) q = q.eq("checklist_date", filterDate)
      const { data: d } = await q
      if (d) setData(d)
      setLoading(false)
    }
    load()
  }, [activeTab, br, filterDate])

  const branchName = (code) => {
    const b = ctx.branches.find(x => x.code === code)
    return b ? code + " — " + b.city : code
  }

  const totalChecklists = data.length
  const totalChecked   = data.reduce((a, c) => a + (c.items||[]).filter(i => i.checked === true).length, 0)
  const totalUnchecked = data.reduce((a, c) => a + (c.items||[]).filter(i => i.checked === false).length, 0)
  const branchesWithData = [...new Set(data.map(d => d.branch_code))].length


  // brAct map for BranchPicker live indicator
  const brAct = {}
  ctx.logs.filter(l => !l.off_time).forEach(l => { brAct[l.branch_code] = (brAct[l.branch_code] || 0) + 1 })
  const allBr = ctx.branches.filter(b => b.region)

  return (
    <div className="page-content">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Monitoring HO/TO MO</h1>
          <p className="topbar-sub">Checklist PRKP Manager Operasi dari seluruh cabang{br === "ALL" ? "" : " · " + br}</p>
        </div>
      </div>

      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={br} onChange={setBr} branches={allBr} brAct={brAct}/>
          <BranchFilterBadge value={br} onClear={() => setBr("ALL")}/>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="br-select"/>
        {filterDate && <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate("")}>✕ Reset</button>}
        </div>
        <div className="inmc-topbar-l">
          <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        </div>
      </div>

      <div style={{ display:"flex", gap:6, marginBottom:20 }}>
        {MO_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:"10px 18px", borderRadius:8,
            border:"1px solid " + (activeTab === t.id ? "var(--accent)" : "var(--border)"),
            background: activeTab === t.id ? "var(--accent-soft)" : "transparent",
            color: activeTab === t.id ? "var(--accent)" : "var(--fg-muted)",
            fontSize:13, fontWeight:700, cursor:"pointer", transition:"all .2s",
            display:"flex", alignItems:"center", gap:6,
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      <div className="stats-grid">
        <Stat icon="checklist" label="Total Checklist" value={totalChecklists} color="var(--purple)"/>
        <Stat icon="check"     label="Item ✓"         value={totalChecked}    color="var(--status-on)"/>
        <Stat icon="shield"    label="Item ✗"         value={totalUnchecked}  color="var(--status-alert)" sub="Perlu perhatian"/>
        <Stat icon="users"     label="Cabang Submit"  value={branchesWithData} color="var(--accent)"/>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{currentTab.icon} {currentTab.label}</h2>
          <span className="panel-counter">{data.length}</span>
        </div>
        <div className="panel-body">
          {loading ? (
            <div style={{ textAlign:"center", padding:40, color:"var(--fg-muted)" }}>Memuat...</div>
          ) : data.length === 0 ? (
            <div className="empty-state"><I n="checklist" s={44}/><p>Tidak ada data ditemukan</p></div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {data.map(h => {
                const items = h.items || []
                const checked = items.filter(i => i.checked === true).length
                const unchecked = items.filter(i => i.checked === false).length
                const total = items.length
                const expanded = expandedId === h.id
                return (
                  <div key={h.id} style={{
                    padding:16, borderRadius:10,
                    border: "1px solid " + (unchecked > 0 ? "rgba(239,68,68,.3)" : "var(--border)"),
                    background: unchecked > 0 ? "rgba(239,68,68,.03)" : "var(--surface-2)",
                    cursor:"pointer", transition:"all .2s",
                  }} onClick={() => setExpandedId(expanded ? null : h.id)}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: expanded ? 12 : 0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                        <span style={{ fontSize:14 }}>{expanded ? "▾" : "▸"}</span>
                        <span style={{ background:"var(--purple-soft)", color:"var(--purple)",
                                       padding:"3px 10px", borderRadius:12, fontSize:11, fontWeight:700 }}>
                          {branchName(h.branch_code)}
                        </span>
                        <span style={{ fontSize:13, fontWeight:700, color:"var(--fg)" }}>
                          {new Date(h.checklist_date).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}
                        </span>
                        <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                                       background:"var(--accent-soft)", color:"var(--accent)" }}>{h.shift}</span>
                        {unchecked > 0 && (
                          <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                                         background:"var(--status-alert-soft)", color:"var(--status-alert)" }}>✗ {unchecked}</span>
                        )}
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"var(--status-on)", fontWeight:700 }}>✓ {checked}</span>
                        <span style={{ fontSize:11, color:"var(--fg-muted)" }}>/ {total}</span>
                      </div>
                    </div>

                    {expanded && (
                      <div style={{ borderTop:"1px solid var(--border)", paddingTop:12 }}>
                        <div style={{ display:"flex", gap:16, fontSize:12, color:"var(--fg-muted)", marginBottom:12 }}>
                          <span>MO: <strong style={{ color:"var(--fg)" }}>{h.incoming_mo}</strong></span>
                          <span>Waktu: {new Date(h.created_at).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })}</span>
                        </div>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                          <thead>
                            <tr style={{ background:"var(--accent-soft)" }}>
                              <th style={{ padding:"8px", textAlign:"center", width:36, borderBottom:"1px solid var(--border)", color:"var(--fg-muted)", fontSize:11 }}>NO</th>
                              <th style={{ padding:"8px 12px", textAlign:"left", width:160, borderBottom:"1px solid var(--border)", color:"var(--fg-muted)", fontSize:11 }}>ITEM</th>
                              <th style={{ padding:"8px 12px", textAlign:"left", borderBottom:"1px solid var(--border)", color:"var(--fg-muted)", fontSize:11 }}>STANDAR MINIMUM</th>
                              <th style={{ padding:"8px", textAlign:"center", width:50, borderBottom:"1px solid var(--border)", color:"var(--fg-muted)", fontSize:11 }}>CEK</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map(it => {
                              const refItem = currentTab.items.find(r => r.no === it.no)
                              return (
                                <tr key={it.no} style={{ borderBottom:"1px solid var(--border)" }}>
                                  <td style={{ padding:"8px", textAlign:"center", color:"var(--fg-muted)" }}>{it.no}</td>
                                  <td style={{ padding:"8px 12px", fontWeight:600, color:"var(--fg)" }}>{it.item}</td>
                                  <td style={{ padding:"8px 12px", color:"var(--fg-muted)", lineHeight:1.4 }}>{refItem?.std || "—"}</td>
                                  <td style={{ padding:"8px", textAlign:"center" }}>
                                    {it.checked === true  ? <span style={{ color:"var(--status-on)",    fontWeight:900, fontSize:16 }}>✓</span>
                                     : it.checked === false ? <span style={{ color:"var(--status-alert)", fontWeight:900, fontSize:16 }}>✗</span>
                                     : <span style={{ color:"var(--fg-muted)" }}>—</span>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        {h.notes && (
                          <div style={{ marginTop:12, padding:10, background:"var(--bg)", borderRadius:8,
                                        fontSize:12, color:"var(--fg-muted)", fontStyle:"italic" }}>📝 {h.notes}</div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
