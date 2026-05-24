// ============================================================
// src/pages/admin/Audit.jsx — Audit log viewer (extracted as-is)
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { fmtDT } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

export const AdminAudit = () => {
  const ctx = useApp()
  const [auditLogs,setAuditLogs] = useState([])
  const [loading,setLoading] = useState(true)
  const [br,setBr] = useState("ALL")
  const [actionFilter,setActionFilter] = useState("ALL")
  const [dateFilter,setDateFilter] = useState("")
  const [search,setSearch] = useState("")
  const [limit,setLimit] = useState(100)

  const fetchLogs = async () => {
    setLoading(true)
    let q = supabase.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(limit)
    if(br!=="ALL") q = q.eq("branch_code",br)
    if(actionFilter!=="ALL") q = q.eq("action",actionFilter)
    if(dateFilter) q = q.gte("created_at",dateFilter+"T00:00:00").lte("created_at",dateFilter+"T23:59:59")
    const {data} = await q
    if(data) setAuditLogs(data)
    setLoading(false)
  }

  useEffect(() => { fetchLogs() },[br,actionFilter,dateFilter,limit])

  const filtered = auditLogs.filter(l => {
    if(!search) return true
    const s = search.toLowerCase()
    return (l.user_name||"").toLowerCase().includes(s) || (l.detail||"").toLowerCase().includes(s) || (l.action||"").toLowerCase().includes(s)
  })

  const ACTION_COLORS = {
    LOGIN:{bg:"#dcfce7",fg:"#166534",icon:"🔓"},
    LOGOUT:{bg:"#f1f5f9",fg:"#475569",icon:"🔒"},
    ON_MIC:{bg:"#dbeafe",fg:"#1e40af",icon:"🎙️"},
    OFF_MIC:{bg:"#fef3c7",fg:"#92400e",icon:"🔇"},
    CHECKLIST_CREATE:{bg:"#f0fdf4",fg:"#166534",icon:"📋"},
    CHECKLIST_DELETE:{bg:"#fef2f2",fg:"#991b1b",icon:"🗑️"},
    NOTE_CREATE:{bg:"#eff6ff",fg:"#1d4ed8",icon:"📝"},
    MO_CHECKLIST:{bg:"#f5f3ff",fg:"#5b21b6",icon:"🛡️"},
    DAILY_REPORT_SUBMIT:{bg:"#ecfdf5",fg:"#065f46",icon:"📑"},
    EXPORT_EXCEL:{bg:"#f0fdf4",fg:"#166534",icon:"📊"},
    EXPORT_PDF:{bg:"#fef2f2",fg:"#991b1b",icon:"📄"},
  }

  const ALL_ACTIONS = ["LOGIN","LOGOUT","ON_MIC","OFF_MIC","CHECKLIST_CREATE","CHECKLIST_DELETE","NOTE_CREATE","MO_CHECKLIST","DAILY_REPORT_SUBMIT","EXPORT_EXCEL","EXPORT_PDF"]

  return (
    <div className="page-content">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Audit Log</h1>
          <p className="topbar-sub">Aktivitas seluruh sistem · {filtered.length} entries</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="shield" s={12}/> AUDIT</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          <option value="ADMIN">Admin</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
        <select className="br-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="ALL">Semua Aktivitas</option>
          {ALL_ACTIONS.map(a => <option key={a} value={a}>{(ACTION_COLORS[a]?.icon||"📌")+" "+a}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="br-select"/>
        {dateFilter && <button className="btn btn-ghost btn-sm" onClick={() => setDateFilter("")}>✕</button>}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama/detail..." style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12,minWidth:140}}/>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Stat icon="shield" label="Total Log" value={filtered.length} color="#8b5cf6"/>
        <Stat icon="log" label="Login" value={filtered.filter(l=>l.action==="LOGIN").length} color="#10b981"/>
        <Stat icon="mic" label="On Mic" value={filtered.filter(l=>l.action==="ON_MIC").length} color="#2563eb"/>
        <Stat icon="checklist" label="Checklist" value={filtered.filter(l=>l.action==="CHECKLIST_CREATE"||l.action==="MO_CHECKLIST").length} color="#f59e0b"/>
        <Stat icon="note" label="Daily Report" value={filtered.filter(l=>l.action==="DAILY_REPORT_SUBMIT").length} color="#059669"/>
        <Stat icon="download" label="Export" value={filtered.filter(l=>l.action==="EXPORT_EXCEL"||l.action==="EXPORT_PDF").length} color="#dc2626"/>
      </div>

      {/* Log list */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Riwayat Aktivitas</h2>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span className="panel-counter">{filtered.length}</span>
            <select value={limit} onChange={e => setLimit(+e.target.value)} style={{padding:"4px 8px",borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:11}}>
              <option value={50}>50</option><option value={100}>100</option><option value={200}>200</option><option value={500}>500</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={fetchLogs} style={{fontSize:11}}>↻ Refresh</button>
          </div>
        </div>
        <div className="panel-body">
          {loading ? <div className="empty-state"><span className="login-spinner"/></div> :
          filtered.length===0 ? <div className="empty-state"><I n="shield" s={44}/><p>Belum ada log aktivitas</p></div> :
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {filtered.map(l => {
              const ac = ACTION_COLORS[l.action] || {bg:"#f1f5f9",fg:"#475569",icon:"📌"}
              return (
                <div key={l.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,background:"var(--card)",borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:16,lineHeight:1,marginTop:2}}>{ac.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}>
                      <span style={{display:"inline-block",padding:"1px 8px",borderRadius:8,fontSize:10,fontWeight:700,background:ac.bg,color:ac.fg}}>{l.action}</span>
                      <span style={{fontSize:12,fontWeight:600,color:"var(--fg)"}}>{l.user_name}</span>
                      {l.branch_code && l.branch_code!=="-" && <span style={{fontSize:10,color:"var(--fg-muted)",background:"var(--bg)",padding:"1px 6px",borderRadius:6}}>{l.branch_code}</span>}
                    </div>
                    {l.detail && <div style={{fontSize:11,color:"var(--fg-muted)",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{l.detail}</div>}
                  </div>
                  <div style={{fontSize:10,color:"var(--fg-muted)",whiteSpace:"nowrap",textAlign:"right"}}>
                    <div>{new Date(l.created_at).toLocaleDateString("id-ID",{day:"2-digit",month:"short"})}</div>
                    <div>{new Date(l.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
                  </div>
                </div>
              )
            })}
          </div>}
        </div>
      </div>
    </div>
  )
}
