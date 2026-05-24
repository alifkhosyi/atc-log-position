// ============================================================
// src/pages/admin/Audit.jsx — INMC Audit Log (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: Admin_Audit_Redesign.html mockup
//
// Logic preserved:
//   - INDEPENDENT filter (NOT wired to ctx.globalBranch)
//   - supabase.from('audit_logs').select with filters + limit
//   - auditLogs state + reload on filter/limit change
//   - br, actionFilter, dateFilter, search, limit state
// New affordances from mockup:
//   - Topbar with entry count subtitle
//   - .filter-row dengan 5 inputs (search, action, branch, date, limit) + Reset
//   - Stats grid (4 cards): Total / Logins Today / Submits Today / Unique Users
//   - Distribusi Action Type panel:
//     - .action-list with .action-row per action type
//     - .action-badge (ab-login/ab-onmic/...) with semantic color
//     - .action-bar proportional fill
//     - Click bar → set actionFilter (toggle off if same)
//   - Audit log table with .audit-table:
//     - .audit-time dual-line (datetime + date below)
//     - .audit-user with .audit-avatar (initials) + .audit-user-name
//     - .audit-detail truncated cell
//     - Click branch chip → filter by that branch
//   - Load more button (load +100 up to 1000)
// ============================================================
import React, { useState, useEffect, useMemo } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { I } from "../../components/Icons.jsx"
import { useToast } from "../../components/Toast.jsx"

// Action types (match real app's audit_logs.action values)
const ACTIONS = [
  { id: "LOGIN", label: "LOGIN", icon: "unlock", cls: "ab-login" },
  { id: "LOGOUT", label: "LOGOUT", icon: "lock", cls: "ab-logout" },
  { id: "ON_MIC", label: "ON_MIC", icon: "mic", cls: "ab-onmic" },
  { id: "OFF_MIC", label: "OFF_MIC", icon: "micOff", cls: "ab-offmic" },
  { id: "CHECKLIST_CREATE", label: "CHECKLIST_CREATE", icon: "check", cls: "ab-create" },
  { id: "CHECKLIST_DELETE", label: "CHECKLIST_DELETE", icon: "trash", cls: "ab-delete" },
  { id: "NOTE_CREATE", label: "NOTE_CREATE", icon: "note", cls: "ab-note" },
  { id: "MO_CHECKLIST", label: "MO_CHECKLIST", icon: "shield", cls: "ab-mo" },
  { id: "DAILY_REPORT_SUBMIT", label: "DAILY_REPORT_SUBMIT", icon: "file", cls: "ab-submit" },
]

const colorMap = {
  "ab-login": "var(--status-on)",
  "ab-logout": "var(--text-faint)",
  "ab-onmic": "var(--accent)",
  "ab-offmic": "var(--status-warn)",
  "ab-create": "var(--status-on)",
  "ab-delete": "var(--status-alert)",
  "ab-note": "var(--accent)",
  "ab-mo": "var(--purple)",
  "ab-submit": "var(--status-on)",
}

const initials = (name) =>
  (name || "?").split(" ")
    .filter(s => s.length > 1 && !s.includes("."))
    .slice(0, 2)
    .map(s => s[0])
    .join("").toUpperCase() || "?"

const fmtFull = (s) => {
  if (!s) return "—"
  const d = new Date(s)
  return d.getDate().toString().padStart(2, "0") + "/" +
    (d.getMonth() + 1).toString().padStart(2, "0") + " " +
    d.toTimeString().slice(0, 8)
}
const fmtDateOnly = (s) => s ? new Date(s).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—"

export const AdminAudit = () => {
  const ctx = useApp()
  const toast = useToast()
  const [auditLogs, setAuditLogs] = useState([])
  const [loading, setLoading] = useState(true)
  // LOCAL state — NOT wired to globalBranch (audit is independent tool)
  const [br, setBr] = useState("ALL")
  const [actionFilter, setActionFilter] = useState("ALL")
  const [dateFilter, setDateFilter] = useState("")
  const [search, setSearch] = useState("")
  const [limit, setLimit] = useState(100)

  // Load from supabase (preserved logic)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let q = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit)
      if (actionFilter !== "ALL") q = q.eq("action", actionFilter)
      if (br !== "ALL") q = q.eq("branch_code", br)
      if (dateFilter) q = q.gte("created_at", dateFilter + "T00:00:00").lte("created_at", dateFilter + "T23:59:59")
      const { data } = await q
      if (data) setAuditLogs(data)
      setLoading(false)
    }
    load()
  }, [actionFilter, br, dateFilter, limit])

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!search) return auditLogs
    const q = search.toLowerCase()
    return auditLogs.filter(l =>
      (l.user_name || "").toLowerCase().includes(q) ||
      (l.detail || "").toLowerCase().includes(q) ||
      (l.action || "").toLowerCase().includes(q)
    )
  }, [auditLogs, search])

  // Stats
  const todayDate = new Date().toISOString().slice(0, 10)
  const todayLogs = auditLogs.filter(l => (l.created_at || "").startsWith(todayDate))
  const loginsToday = todayLogs.filter(l => l.action === "LOGIN").length
  const submitsToday = todayLogs.filter(l => l.action === "DAILY_REPORT_SUBMIT").length
  const uniqueUsers = new Set(filtered.map(l => l.user_id)).size

  // Action distribution
  const actionCounts = useMemo(() => {
    const m = {}
    ACTIONS.forEach(a => { m[a.id] = 0 })
    filtered.forEach(l => { m[l.action] = (m[l.action] || 0) + 1 })
    return m
  }, [filtered])
  const maxAction = Math.max(1, ...Object.values(actionCounts))

  const allBranches = useMemo(() => ctx.branches.filter(b => b.region), [ctx.branches])

  const reset = () => {
    setBr("ALL"); setActionFilter("ALL"); setDateFilter(""); setSearch(""); setLimit(100)
  }

  const exportCSV = () => {
    const head = ["Time", "User", "Branch", "Action", "Detail"]
    const rows = filtered.map(l => [
      l.created_at, l.user_name || "", l.branch_code || "",
      l.action || "", (l.detail || "").replace(/"/g, '""'),
    ])
    const csv = [head.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Export berhasil", `${filtered.length} entries diunduh sebagai CSV`)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Audit Log</div>
          <div className="topbar-sub">Aktivitas seluruh sistem · {filtered.length.toLocaleString()} entries (filtered)</div>
        </div>
        <button className="btn btn-sm" onClick={exportCSV} disabled={filtered.length === 0}>
          <I n="download" s={14}/> Export CSV
        </button>
      </div>

      {/* FILTER ROW (independent — NOT inmc-topbar / NOT wired to globalBranch) */}
      <div className="filter-row">
        <div className="input-wrap">
          <span className="input-wrap-ic"><I n="search" s={14}/></span>
          <input className="filter-input" placeholder="Cari detail / user / action..."
                 value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <select className="filter-input" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="ALL">Semua Action</option>
          {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <select className="filter-input" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Branch</option>
          {allBranches.map(b => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
        </select>
        <input type="date" className="filter-input" value={dateFilter} onChange={e => setDateFilter(e.target.value)}/>
        <select className="filter-input" value={limit} onChange={e => setLimit(+e.target.value)}>
          <option value={50}>Limit: 50</option>
          <option value={100}>Limit: 100</option>
          <option value={500}>Limit: 500</option>
          <option value={1000}>Limit: 1000</option>
        </select>
        {(br !== "ALL" || actionFilter !== "ALL" || dateFilter || search) && (
          <button className="btn btn-sm btn-ghost" onClick={reset}>Reset</button>
        )}
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="audit" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Total Entries</div>
            <div className="stat-v">{filtered.length.toLocaleString()}</div>
            <div className="stat-sub">filtered</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-on-soft)", color: "var(--status-on)" }}>
            <I n="check" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Logins Today</div>
            <div className="stat-v" style={{ color: "var(--status-on)" }}>{loginsToday}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>
            <I n="file" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Submits Today</div>
            <div className="stat-v" style={{ color: "var(--purple)" }}>{submitsToday}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-warn-soft)", color: "var(--status-warn)" }}>
            <I n="users" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Unique Users</div>
            <div className="stat-v" style={{ color: "var(--status-warn)" }}>{uniqueUsers}</div>
          </div>
        </div>
      </div>

      {/* ACTION DISTRIBUTION */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><I n="chart" s={16}/> Distribusi Action Type</h2>
          <span className="panel-counter">Klik bar untuk filter</span>
        </div>
        <div className="panel-body">
          <div className="action-list">
            {ACTIONS.map(a => {
              const count = actionCounts[a.id]
              const pct = count / maxAction * 100
              const isActive = actionFilter === a.id
              return (
                <div key={a.id} className={"action-row" + (isActive ? " active-filter" : "")}
                     onClick={() => setActionFilter(actionFilter === a.id ? "ALL" : a.id)}>
                  <div className="action-name">
                    <span className={"action-badge " + a.cls}>
                      <I n={a.icon} s={11}/> {a.label}
                    </span>
                  </div>
                  <div className="action-bar">
                    <div className="action-bar-fill" style={{ width: `${pct}%`, background: colorMap[a.cls] }}/>
                  </div>
                  <div className="action-count" style={{ color: colorMap[a.cls] }}>{count}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><I n="audit" s={16}/> Audit Log Entries</h2>
          <span className="panel-counter">{filtered.length}</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty-state"><p>Memuat audit log...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <I n="audit" s={44}/>
              <p>Tidak ada audit log cocok dengan filter</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table audit-table">
                <thead>
                  <tr>
                    <th style={{ width: 130 }}>Time</th>
                    <th>User</th>
                    <th>Branch</th>
                    <th>Action</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const action = ACTIONS.find(a => a.id === l.action)
                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="audit-time">
                            <strong style={{ color: "var(--text)", fontWeight: 600 }}>{fmtFull(l.created_at)}</strong>
                            <span className="audit-time-date">{fmtDateOnly(l.created_at)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="audit-user">
                            <div className="audit-avatar">{initials(l.user_name)}</div>
                            <span className="audit-user-name">{l.user_name || "—"}</span>
                          </div>
                        </td>
                        <td>
                          {l.branch_code && (
                            <span className="unit-tag" style={{ cursor: "pointer" }}
                                  onClick={(e) => { e.stopPropagation(); setBr(l.branch_code) }}>
                              {l.branch_code}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={"action-badge " + (action?.cls || "")}>
                            <I n={action?.icon || "audit"} s={11}/> {l.action || "—"}
                          </span>
                        </td>
                        <td><div className="audit-detail">{l.detail || ""}</div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length >= limit && limit < 1000 && (
            <div className="load-more">
              <button className="btn btn-sm" onClick={() => setLimit(Math.min(limit + 100, 1000))}>
                Load 100 more · saat ini {limit}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
