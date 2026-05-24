// ============================================================
// src/pages/admin/MonHandover.jsx — INMC Monitoring Handover (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: Admin_MonHandover_Redesign.html mockup
//
// Logic preserved:
//   - br state from ctx.globalBranch
//   - filterDate filter for checklist_date
//   - ctx.handoverChecklists (with branch_id schema bug — see project notes)
//   - CHECKLIST_ITEMS constants from lib/constants.js (6 items)
//   - getAcctName for branch resolution from branch_id (UUID)
// New affordances from mockup:
//   - Topbar + INMC sticky toolbar with BranchPicker + filter pill + date input + Reset
//   - Stats grid (4 cards): Total Checklist / Cabang Aktif / Total Not OK / Cabang Bermasalah
//   - Distribusi Status per Item panel:
//     - .compl-list of compliance rows
//     - Each item: name + counts + horizontal stacked bar + compliance %
//     - Color-coded compliance (≥90 green, ≥70 amber, else red)
//   - Worst Cabang panel (Top 5 with Not OK count)
//   - Checklist cards with:
//     - .cl-card with .has-notok / .all-na variants
//     - .cl-card-head with .cl-caret + branch + date + shift + outgoing → incoming
//     - .cl-summary with .cl-pill (ok/notok/na)
//     - .cl-body with .cl-items-table + per-item status pill + notes
//     - .cl-footer
// ============================================================
import React, { useState, useMemo } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtD, fmtDT } from "../../lib/utils.js"
import { CHECKLIST_ITEMS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { BranchPicker } from "../../components/BranchPicker.jsx"
import { useToast } from "../../components/Toast.jsx"

export const AdminMonHandover = () => {
  const ctx = useApp()
  const toast = useToast()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)
  const [filterDate, setFilterDate] = useState("")
  const [expandedId, setExpandedId] = useState(null)

  // Resolve branch from branch_id (legacy UUID field in handover_checklists table).
  // This carries a known schema bug (see project docs) — branch_id is stored as UUID
  // but our BranchPicker uses .code. We resolve via ctx.branches.find by id.
  const getBranchCode = (branchId) => {
    const found = ctx.branches.find(b => b.id === branchId)
    return found?.code || branchId
  }
  const getBranchName = (branchId) => {
    const found = ctx.branches.find(b => b.id === branchId)
    return found?.name || found?.city || ""
  }

  // Filter checklists
  const filtered = useMemo(() => {
    let list = ctx.handoverChecklists
    if (br !== "ALL") {
      list = list.filter(c => getBranchCode(c.branch_id) === br)
    }
    if (filterDate) list = list.filter(c => c.checklist_date === filterDate)
    return [...list].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.handoverChecklists, br, filterDate, ctx.branches])

  // Stats
  const totalChecklists = filtered.length
  const activeBranches = new Set(filtered.map(c => getBranchCode(c.branch_id))).size
  const totalNotOk = filtered.reduce((a, c) => a + CHECKLIST_ITEMS.filter(it => c[it.key + "_status"] === "Not OK").length, 0)
  const branchesWithIssues = new Set(
    filtered
      .filter(c => CHECKLIST_ITEMS.some(it => c[it.key + "_status"] === "Not OK"))
      .map(c => getBranchCode(c.branch_id))
  ).size

  // Per-item compliance stats
  const itemStats = useMemo(() => {
    const m = {}
    CHECKLIST_ITEMS.forEach(it => { m[it.key] = { ok: 0, notOk: 0, na: 0 } })
    filtered.forEach(cl => {
      CHECKLIST_ITEMS.forEach(it => {
        const st = cl[it.key + "_status"]
        if (st === "OK") m[it.key].ok++
        else if (st === "Not OK") m[it.key].notOk++
        else m[it.key].na++
      })
    })
    return m
  }, [filtered])

  // Worst branches
  const worstBranches = useMemo(() => {
    const m = {}
    filtered.forEach(cl => {
      const code = getBranchCode(cl.branch_id)
      const notOk = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "Not OK").length
      if (notOk > 0) m[code] = (m[code] || 0) + notOk
    })
    return Object.entries(m)
      .map(([code, count]) => ({ code, count, name: getBranchName(ctx.branches.find(b => b.code === code)?.id) || ctx.branches.find(b => b.code === code)?.name }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, ctx.branches])

  // brAct for BranchPicker
  const brAct = useMemo(() => {
    const m = {}
    ctx.logs.filter(l => !l.off_time).forEach(l => { m[l.branch_code] = (m[l.branch_code] || 0) + 1 })
    return m
  }, [ctx.logs])
  const allBr = useMemo(() => ctx.branches.filter(b => b.region), [ctx.branches])

  const exportCSV = () => {
    const head = ["Branch", "Date", "Shift", "Outgoing", "Incoming",
      ...CHECKLIST_ITEMS.flatMap(it => [it.label + " Status", it.label + " Notes"])]
    const rows = filtered.map(c => [
      getBranchCode(c.branch_id), c.checklist_date, c.shift || "",
      c.outgoing_atc || c.outgoing_personnel || "",
      c.incoming_atc || c.incoming_personnel || "",
      ...CHECKLIST_ITEMS.flatMap(it => [c[it.key + "_status"] || "", c[it.key + "_notes"] || ""]),
    ])
    const csv = [head.join(","), ...rows.map(r => r.map(v => `"${(v + "").replace(/"/g, '""')}"`).join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `monitoring_handover_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Export berhasil", `${filtered.length} checklist diunduh`)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Monitoring Handover/Takeover</div>
          <div className="topbar-sub">Audit kualitas handover seluruh cabang{br === "ALL" ? "" : ` · ${br}`}</div>
        </div>
        <button className="btn btn-sm" onClick={exportCSV}>
          <I n="download" s={14}/> Export CSV
        </button>
      </div>

      {/* INMC TOOLBAR */}
      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={br} onChange={setBr} branches={allBr} brAct={brAct}/>
          {br !== "ALL" && (
            <span className="filter-pill">
              <I n="eye" s={11}/> {br}
              <button className="filter-pill-x" onClick={() => setBr("ALL")} aria-label="Clear filter">×</button>
            </span>
          )}
        </div>
        <div className="inmc-topbar-l">
          <span className="monitor-label"><I n="eye" s={11}/> Monitoring</span>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
                 style={{ padding: "6px 10px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--r)", color: "var(--text)", fontSize: "var(--fs-sm)" }}/>
          {filterDate && <button className="btn btn-sm btn-ghost" onClick={() => setFilterDate("")}>Reset</button>}
        </div>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="checklist" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Total Checklist</div>
            <div className="stat-v">{totalChecklists}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-on-soft)", color: "var(--status-on)" }}>
            <I n="branches" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Cabang Aktif</div>
            <div className="stat-v" style={{ color: "var(--status-on)" }}>{activeBranches}</div>
            <div className="stat-sub">submit checklist</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-alert-soft)", color: "var(--status-alert)" }}>
            <I n="alert" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Total Not OK</div>
            <div className="stat-v" style={{ color: "var(--status-alert)" }}>{totalNotOk}</div>
            <div className="stat-sub">items perlu perhatian</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-warn-soft)", color: "var(--status-warn)" }}>
            <I n="shield" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Cabang Bermasalah</div>
            <div className="stat-v" style={{ color: "var(--status-warn)" }}>{branchesWithIssues}</div>
            <div className="stat-sub">≥ 1 Not OK</div>
          </div>
        </div>
      </div>

      {/* COMPLIANCE PER ITEM */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><I n="chart" s={16}/> Distribusi Status per Item</h2>
        </div>
        <div className="panel-body">
          <div className="compl-list">
            {CHECKLIST_ITEMS.map(it => {
              const s = itemStats[it.key]
              const tot = s.ok + s.notOk + s.na
              const okPct = tot > 0 ? s.ok / tot * 100 : 0
              const notOkPct = tot > 0 ? s.notOk / tot * 100 : 0
              const naPct = tot > 0 ? s.na / tot * 100 : 0
              const compliancePct = tot - s.na > 0 ? Math.round(s.ok / (tot - s.na) * 100) : 100
              const cls = compliancePct >= 90 ? "" : compliancePct >= 70 ? "warn" : "danger"
              return (
                <div key={it.key} className="compl-row">
                  <div>
                    <div className="compl-name">{it.label}</div>
                    <div className="compl-counts">OK {s.ok} · Not OK {s.notOk} · N/A {s.na}</div>
                  </div>
                  <div className="compl-bar">
                    <div className="compl-bar-seg ok" style={{ width: `${okPct}%` }} title={`${s.ok} OK`}/>
                    <div className="compl-bar-seg notok" style={{ width: `${notOkPct}%` }} title={`${s.notOk} Not OK`}/>
                    <div className="compl-bar-seg na" style={{ width: `${naPct}%` }} title={`${s.na} N/A`}/>
                  </div>
                  <div className={"compl-pct " + cls}>{compliancePct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* WORST CABANG */}
      {worstBranches.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><I n="alert" s={16}/> Top 5 Cabang dengan Not OK Items</h2>
          </div>
          <div className="panel-body">
            <div className="worst-list">
              {worstBranches.map((b, i) => (
                <div key={b.code} className="worst-row">
                  <div className="worst-num">{i + 1}</div>
                  <span className="worst-code">{b.code}</span>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>{b.name}</span>
                  <div className="worst-count">{b.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CHECKLIST LIST */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Checklist {filterDate ? fmtD(filterDate) : "Terbaru"}</h2>
          <span className="panel-counter">{filtered.length}</span>
        </div>
        <div className="panel-body" style={{ padding: 12 }}>
          {filtered.length === 0 ? (
            <div className="empty-state"><I n="checklist" s={44}/><p>Belum ada handover untuk filter ini</p></div>
          ) : (
            <>
              {filtered.slice(0, 50).map(cl => {
                const notOk = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "Not OK").length
                const ok = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "OK").length
                const na = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "N/A").length
                const isExp = expandedId === cl.id
                const cardCls = notOk > 0 ? "has-notok" : na === CHECKLIST_ITEMS.length ? "all-na" : ""
                const branchCode = getBranchCode(cl.branch_id)
                return (
                  <div key={cl.id} className={"cl-card " + cardCls}>
                    <div className="cl-card-head" onClick={() => setExpandedId(isExp ? null : cl.id)}>
                      <div className="cl-card-l">
                        <span className={"cl-caret" + (isExp ? " open" : "")}><I n="chev" s={14}/></span>
                        <span className="unit-tag" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>{branchCode}</span>
                        <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmtD(cl.checklist_date)}</span>
                        {cl.shift && (
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", background: "var(--surface-3)", padding: "2px 8px", borderRadius: "var(--r-sm)", color: "var(--text-muted)" }}>{cl.shift}</span>
                        )}
                        {(cl.outgoing_atc || cl.outgoing_personnel || cl.incoming_atc || cl.incoming_personnel) && (
                          <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                            {cl.outgoing_atc || cl.outgoing_personnel || "—"} →{" "}
                            <strong style={{ color: "var(--text)" }}>{cl.incoming_atc || cl.incoming_personnel || "—"}</strong>
                          </span>
                        )}
                      </div>
                      <div className="cl-summary">
                        {ok > 0 && <span className="cl-pill ok">{ok} OK</span>}
                        {notOk > 0 && <span className="cl-pill notok">{notOk} Not OK</span>}
                        {na > 0 && <span className="cl-pill na">{na} N/A</span>}
                      </div>
                    </div>
                    {isExp && (
                      <div className="cl-body">
                        <table className="cl-items-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 1 }}>Item</th>
                              <th style={{ textAlign: "center", padding: "6px 10px", fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 1, width: 90 }}>Status</th>
                              <th style={{ textAlign: "left", padding: "6px 10px", fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 1 }}>Catatan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {CHECKLIST_ITEMS.map(it => {
                              const st = cl[it.key + "_status"]
                              const cls = st === "OK" ? "cl-status-ok" : st === "Not OK" ? "cl-status-notok" : "cl-status-na"
                              return (
                                <tr key={it.key}>
                                  <td style={{ fontWeight: 600, color: "var(--text)" }}>{it.label}</td>
                                  <td style={{ textAlign: "center" }}>
                                    <span className={"cl-status-pill " + cls}>{st || "N/A"}</span>
                                  </td>
                                  <td style={{ color: "var(--text-muted)", fontStyle: "italic" }}>{cl[it.key + "_notes"] || "—"}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                        <div className="cl-footer">
                          <span>
                            Submitted by <strong style={{ color: "var(--text)" }}>{cl.outgoing_atc || cl.outgoing_personnel || cl.manager_on_duty || "—"}</strong>
                            {cl.created_at ? ` · ${fmtDT(cl.created_at)}` : ""}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {filtered.length > 50 && (
                <div style={{ padding: 12, textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
                  Menampilkan 50 terbaru dari {filtered.length}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
