// ============================================================
// src/pages/admin/MonHoToMo.jsx — INMC Monitoring HO/TO MO (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: Admin_MonHoToMo_Redesign.html mockup
//
// Logic preserved:
//   - br state from ctx.globalBranch
//   - filterDate, activeTab, data, loading, expandedId state
//   - supabase.from('mo_checklists').select with eq filters
//   - MO_TABS constant from lib/constants.js
//   - Data shape: { items: [{no, item, checked}] } (array, not object map)
// New affordances from mockup:
//   - Topbar + INMC sticky toolbar (BranchPicker + filter pill + date + Reset)
//   - .mo-tabs with counter badges (filtered count per tab)
//   - Tab description italic muted text
//   - Stats grid (4 cards): Total / Cabang Aktif / Not OK Items / Completion Rate
//   - Compliance per Item panel (only for active tab items)
//   - Worst Items panel (top 3 with most Not OK in current tab)
//   - Checklist cards (.cl-card.has-notok/.all-na) with expandable items
//   - .cl-item rows with .cl-item-st status badge (ok/notok/na)
//   - .cl-notes section for notes
// ============================================================
import React, { useState, useEffect, useMemo } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { fmtD, fmtDT } from "../../lib/utils.js"
import { MO_TABS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { BranchPicker } from "../../components/BranchPicker.jsx"
import { useToast } from "../../components/Toast.jsx"

export const AdminMonHoToMo = () => {
  const ctx = useApp()
  const toast = useToast()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)
  const [filterDate, setFilterDate] = useState("")
  const [activeTab, setActiveTab] = useState("pre_shift")
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [allData, setAllData] = useState({ pre_shift: [], handover: [], post_shift: [] })
  const [expandedId, setExpandedId] = useState(null)

  const currentTab = MO_TABS.find(t => t.id === activeTab)

  // Load data when activeTab/br/filterDate changes (preserved logic)
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let q = supabase.from("mo_checklists").select("*")
        .eq("checklist_type", activeTab)
        .order("created_at", { ascending: false })
        .limit(200)
      if (br !== "ALL") q = q.eq("branch_code", br)
      if (filterDate) q = q.eq("checklist_date", filterDate)
      const { data: d } = await q
      if (d) {
        setData(d)
        setAllData(prev => ({ ...prev, [activeTab]: d }))
      }
      setLoading(false)
    }
    load()
  }, [activeTab, br, filterDate])

  // Item-wise compliance stats for current tab
  const itemStats = useMemo(() => {
    const m = {}
    currentTab.items.forEach(it => { m[it.no] = { ok: 0, notOk: 0, na: 0 } })
    data.forEach(cl => {
      (cl.items || []).forEach(itVal => {
        const id = itVal.no
        if (!m[id]) m[id] = { ok: 0, notOk: 0, na: 0 }
        if (itVal.checked === true) m[id].ok++
        else if (itVal.checked === false) m[id].notOk++
        else m[id].na++
      })
    })
    return m
  }, [data, currentTab])

  // Worst items (top 3 by Not OK)
  const worstItems = useMemo(() => {
    return currentTab.items
      .map(it => ({ no: it.no, label: it.item, notOk: itemStats[it.no]?.notOk || 0 }))
      .filter(it => it.notOk > 0)
      .sort((a, b) => b.notOk - a.notOk)
      .slice(0, 3)
  }, [itemStats, currentTab])

  // Aggregate stats
  const totalChecklists = data.length
  const activeBranches = new Set(data.map(d => d.branch_code)).size
  const totalNotOk = data.reduce((a, c) => a + (c.items || []).filter(i => i.checked === false).length, 0)
  const totalChecked = data.reduce((a, c) => a + (c.items || []).filter(i => i.checked === true || i.checked === false).length, 0)
  const totalItems = data.reduce((a, c) => a + (c.items || []).length, 0)
  const completionRate = totalItems > 0 ? Math.round(totalChecked / totalItems * 100) : 0

  // brAct + branches
  const brAct = useMemo(() => {
    const m = {}
    ctx.logs.filter(l => !l.off_time).forEach(l => { m[l.branch_code] = (m[l.branch_code] || 0) + 1 })
    return m
  }, [ctx.logs])
  const allBr = useMemo(() => ctx.branches.filter(b => b.region), [ctx.branches])

  const tabCount = (tabId) => (allData[tabId] || (tabId === activeTab ? data : [])).length

  const exportCSV = () => {
    const head = ["Branch", "Date", "Shift", "Type", "Incoming MO", "Outgoing MO", "OK", "Not OK", "N/A", "Notes"]
    const rows = data.map(cl => {
      const ok = (cl.items || []).filter(i => i.checked === true).length
      const notOk = (cl.items || []).filter(i => i.checked === false).length
      const na = (cl.items || []).filter(i => i.checked === null || i.checked === undefined).length
      return [
        cl.branch_code, cl.checklist_date, cl.shift || "", cl.checklist_type,
        cl.incoming_mo || "", cl.outgoing_mo || "", ok, notOk, na, (cl.notes || "").replace(/"/g, '""'),
      ]
    })
    const csv = [head.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `monitoring_ho_to_mo_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Export berhasil", `${data.length} checklist diunduh`)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Monitoring HO/TO MO</div>
          <div className="topbar-sub">Audit checklist Manager Operasi PRKP{br === "ALL" ? "" : ` · ${br}`}</div>
        </div>
        <button className="btn btn-sm" onClick={exportCSV} disabled={data.length === 0}>
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

      {/* TABS */}
      <div className="mo-tabs">
        {MO_TABS.map(t => (
          <button key={t.id}
                  className={"mo-tab" + (activeTab === t.id ? " active" : "")}
                  onClick={() => { setActiveTab(t.id); setExpandedId(null) }}>
            <span className="mo-tab-emoji">{t.icon}</span>
            <span>{t.label}</span>
            <span className="panel-counter" style={{ marginLeft: 4 }}>{tabCount(t.id)}</span>
          </button>
        ))}
      </div>
      <p style={{ fontSize: "var(--fs-sm)", fontStyle: "italic", color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
        {currentTab.label} · {currentTab.items.length} items per checklist
      </p>

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
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-alert-soft)", color: "var(--status-alert)" }}>
            <I n="alert" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Not OK Items</div>
            <div className="stat-v" style={{ color: "var(--status-alert)" }}>{totalNotOk}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-warn-soft)", color: "var(--status-warn)" }}>
            <I n="check" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Completion Rate</div>
            <div className="stat-v" style={{ color: "var(--status-warn)" }}>{completionRate}%</div>
            <div className="stat-sub">checked vs total</div>
          </div>
        </div>
      </div>

      {/* COMPLIANCE PER ITEM */}
      {totalChecklists > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><I n="chart" s={16}/> Compliance per Item — {currentTab.label}</h2>
          </div>
          <div className="panel-body">
            <div className="compl-list">
              {currentTab.items.map(it => {
                const s = itemStats[it.no] || { ok: 0, notOk: 0, na: 0 }
                const tot = s.ok + s.notOk + s.na
                const okPct = tot > 0 ? s.ok / tot * 100 : 0
                const notOkPct = tot > 0 ? s.notOk / tot * 100 : 0
                const naPct = tot > 0 ? s.na / tot * 100 : 0
                const compliancePct = tot - s.na > 0 ? Math.round(s.ok / (tot - s.na) * 100) : 100
                const color = compliancePct >= 90 ? "var(--status-on)" : compliancePct >= 70 ? "var(--status-warn)" : "var(--status-alert)"
                return (
                  <div key={it.no} className="compl-row">
                    <div>
                      <div className="compl-name">{it.no}. {it.item}</div>
                      <div className="compl-counts">✓ {s.ok} · ✗ {s.notOk} · — {s.na}</div>
                    </div>
                    <div className="compl-bar">
                      <div className="compl-bar-seg ok" style={{ width: `${okPct}%` }}/>
                      <div className="compl-bar-seg notok" style={{ width: `${notOkPct}%` }}/>
                      <div className="compl-bar-seg na" style={{ width: `${naPct}%` }}/>
                    </div>
                    <div className="compl-pct" style={{ color }}>{compliancePct}%</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* WORST ITEMS */}
      {worstItems.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><I n="alert" s={16}/> Top 3 Items dengan Most Not OK</h2>
          </div>
          <div className="panel-body">
            <div className="worst-list">
              {worstItems.map((it, i) => (
                <div key={it.no} className="worst-row">
                  <div className="worst-num">{i + 1}</div>
                  <span style={{ fontSize: "var(--fs-sm)", color: "var(--text)", fontWeight: 600 }}>{it.label}</span>
                  <div className="worst-count">{it.notOk}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CHECKLIST LIST */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">{currentTab.label} Checklists</h2>
          <span className="panel-counter">{data.length}</span>
        </div>
        <div className="panel-body" style={{ padding: 12 }}>
          {loading ? (
            <div className="empty-state"><p>Memuat...</p></div>
          ) : data.length === 0 ? (
            <div className="empty-state">
              <I n="checklist" s={44}/>
              <p>Belum ada checklist {currentTab.label} untuk filter ini</p>
            </div>
          ) : (
            data.slice(0, 40).map(cl => {
              const items = cl.items || []
              const ok = items.filter(i => i.checked === true).length
              const notOk = items.filter(i => i.checked === false).length
              const na = items.filter(i => i.checked === null || i.checked === undefined).length
              const isExp = expandedId === cl.id
              const cardCls = notOk > 0 ? "has-notok" : na === currentTab.items.length ? "all-na" : ""
              // Build map from items array for quick lookup by item.no
              const itemMap = {}
              items.forEach(i => { itemMap[i.no] = i.checked })
              return (
                <div key={cl.id} className={"cl-card " + cardCls}>
                  <div className="cl-card-head" onClick={() => setExpandedId(isExp ? null : cl.id)}>
                    <div className="cl-card-l">
                      <span className={"cl-caret" + (isExp ? " open" : "")}><I n="chev" s={14}/></span>
                      <span className="unit-tag" style={{ background: "var(--purple-soft)", color: "var(--purple)" }}>{cl.branch_code}</span>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{fmtD(cl.checklist_date)}</span>
                      {cl.shift && (
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", background: "var(--surface-3)", padding: "2px 8px", borderRadius: "var(--r-sm)", color: "var(--text-muted)" }}>{cl.shift}</span>
                      )}
                      {(cl.outgoing_mo || cl.incoming_mo) && (
                        <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                          {cl.outgoing_mo || "—"} → <strong style={{ color: "var(--text)" }}>{cl.incoming_mo || "—"}</strong>
                        </span>
                      )}
                    </div>
                    <div className="cl-summary">
                      {ok > 0 && <span className="cl-pill ok">✓ {ok}</span>}
                      {notOk > 0 && <span className="cl-pill notok">✗ {notOk}</span>}
                      {na > 0 && <span className="cl-pill na">— {na}</span>}
                    </div>
                  </div>
                  {isExp && (
                    <div className="cl-body">
                      {currentTab.items.map(it => {
                        const v = itemMap[it.no]
                        return (
                          <div key={it.no} className="cl-item">
                            <div className="cl-item-no">{it.no.toString().padStart(2, "0")}</div>
                            <div>{it.item}</div>
                            <div className={"cl-item-st " + (v === true ? "ok" : v === false ? "notok" : "na")}>
                              {v === true ? "✓" : v === false ? "✗" : "—"}
                            </div>
                          </div>
                        )
                      })}
                      {cl.notes && <div className="cl-notes">📝 {cl.notes}</div>}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)", fontSize: 11, color: "var(--text-faint)" }}>
                        <span>Submitted by <strong style={{ color: "var(--text)" }}>{cl.outgoing_mo || "—"}</strong> · {cl.created_at ? fmtDT(cl.created_at) : "—"}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
          {data.length > 40 && (
            <div style={{ padding: 12, textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
              Menampilkan 40 terbaru dari {data.length}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
