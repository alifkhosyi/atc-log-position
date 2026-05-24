// ============================================================
// src/pages/cabang/HoToMo.jsx — Manager Operasi PRKP (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: HoToMo_Redesign.html mockup
//
// Logic preserved exactly from original:
//   - activeTab state (pre_shift / handover / post_shift) tied to MO_TABS
//   - 3-state toggleCheck (null → true → false → null)
//   - History fetch from supabase mo_checklists table on tab change
//   - handleSubmit insert shape unchanged (branch_code, checklist_date,
//     shift, checklist_type, items, incoming_mo, outgoing_mo, notes, created_by)
//   - logAudit('MO_CHECKLIST', ...) preserved
//   - Confirm dialog for incomplete submission preserved
// New affordances from mockup:
//   - .mo-tabs + .mo-tab + .mo-tab-emoji with counter badge
//   - .form-card for form panel with .form-card-head + .form-card-title
//   - .items-table with item-no/item-label/item-toggle-cell
//   - .h-list with .h-card (shift-Morning/Afternoon/Night variants)
//   - .h-card-head with .h-caret expand chevron
//   - .h-summary with .h-pill (ok/notok/na) status badges
//   - .h-card-body with .h-item-list + .h-notes + .h-footer
//   - .save-bar dengan summary count + actions
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { getAccessibleBranches, logAudit, fmtD } from "../../lib/utils.js"
import { MO_TABS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"

// ── 3-state toggle button ──
const StateToggle = ({ value, onChange }) => (
  <div className="check-seg">
    <button type="button"
            className={"check-seg-btn check-ok" + (value === true ? " active" : "")}
            onClick={() => onChange(value === true ? null : true)}
            aria-label="Mark OK">✓</button>
    <button type="button"
            className={"check-seg-btn check-notok" + (value === false ? " active" : "")}
            onClick={() => onChange(value === false ? null : false)}
            aria-label="Mark Not OK">✗</button>
    <button type="button"
            className={"check-seg-btn check-na" + (value === null ? " active" : "")}
            onClick={() => onChange(null)}
            aria-label="Mark N/A">—</button>
  </div>
)

export const CabangHoToMo = () => {
  const ctx = useApp()
  const toast = useToast()
  const confirm = useConfirm()

  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)

  // ── State ──
  const [activeTab, setActiveTab] = useState("pre_shift")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [historyByTab, setHistoryByTab] = useState({}) // { pre_shift: [], handover: [], post_shift: [] }

  const [checkDate, setCheckDate] = useState(new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState("Morning")
  const [notes, setNotes] = useState("")
  const [incomingMo, setIncomingMo] = useState("")
  const [outgoingMo, setOutgoingMo] = useState("")

  const currentTab = MO_TABS.find(t => t.id === activeTab)
  const initChecks = () => currentTab.items.reduce((a, it) => ({ ...a, [it.no]: null }), {})
  const [checks, setChecks] = useState(initChecks())

  // ── Reset form when tab changes ──
  useEffect(() => {
    setChecks(initChecks())
    setShowForm(false)
    setExpandedId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ── Load history per tab ──
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("mo_checklists").select("*")
        .in("branch_code", myBranches)
        .eq("checklist_type", activeTab)
        .order("created_at", { ascending: false }).limit(20)
      if (error) {
        toast.error("Gagal memuat riwayat", error.message)
        return
      }
      if (data) {
        setHistory(data)
        setHistoryByTab(prev => ({ ...prev, [activeTab]: data }))
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ctx.user.branch_code, saving])

  // ── 3-state toggle (preserved cycle) ──
  const setCheckValue = (no, v) => setChecks(p => ({ ...p, [no]: v }))

  // ── Submit (preserved shape) ──
  const handleSubmit = async () => {
    if (!shift) {
      toast.warn("Shift kosong", "Pilih shift terlebih dahulu")
      return
    }
    const hasUnchecked = Object.values(checks).some(v => v === null)
    if (hasUnchecked) {
      const ok = await confirm({
        title: "Masih ada item yang belum dicek",
        detail: "Lanjutkan submit dengan item tidak lengkap?",
        confirmText: "Tetap submit",
      })
      if (!ok) return
    }

    setSaving(true)
    const itemsArr = currentTab.items.map(it => ({
      no: it.no, item: it.item, checked: checks[it.no],
    }))
    const { error } = await supabase.from("mo_checklists").insert({
      branch_code: ctx.user.branch_code,
      checklist_date: checkDate,
      shift,
      checklist_type: activeTab,
      items: itemsArr,
      incoming_mo: incomingMo || ctx.user.display_name,
      outgoing_mo: outgoingMo || "",
      notes,
      created_by: ctx.user.id,
    })
    if (error) {
      toast.error("Gagal menyimpan", error.message)
      setSaving(false)
      return
    }
    logAudit("MO_CHECKLIST",
      "Submit " + activeTab + " checklist — shift " + shift, ctx.user)
    toast.success("Checklist tersimpan",
      `${currentTab.label} · shift ${shift}`)
    setChecks(initChecks())
    setNotes("")
    setIncomingMo("")
    setOutgoingMo("")
    setShift("Morning")
    setShowForm(false)
    setSaving(false)
  }

  // ── Tab counts for badges ──
  const tabCount = (tabId) => (historyByTab[tabId] || (tabId === activeTab ? history : [])).length

  // ── Summary count from checks ──
  const okCount = Object.values(checks).filter(v => v === true).length
  const notOkCount = Object.values(checks).filter(v => v === false).length
  const naCount = Object.values(checks).filter(v => v === null).length

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">HO/TO Manager Operasi</div>
          <div className="topbar-sub">Checklist PRKP — Cabang {ctx.user.branch_code} · {currentTab.label}</div>
        </div>
        {!showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <I n="plus" s={16}/> Checklist Baru
          </button>
        )}
      </div>

      {/* MO TABS */}
      <div className="mo-tabs">
        {MO_TABS.map(t => (
          <button
            key={t.id}
            className={"mo-tab" + (activeTab === t.id ? " active" : "")}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="mo-tab-emoji">{t.icon}</span>
            <span>{t.label}</span>
            <span className="panel-counter" style={{ marginLeft: 4 }}>{tabCount(t.id)}</span>
          </button>
        ))}
      </div>

      {/* FORM */}
      {showForm && (
        <div className="form-card">
          <div className="form-card-head">
            <h2 className="form-card-title">
              <span style={{ fontSize: 18 }}>{currentTab.icon}</span> Form {currentTab.label}
            </h2>
            <button className="btn btn-sm btn-ghost"
                    onClick={() => { setShowForm(false); setChecks(initChecks()); setNotes(""); setIncomingMo(""); setOutgoingMo("") }}>
              <I n="x" s={14}/> Tutup
            </button>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Tanggal</label>
              <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)}/>
            </div>
            <div className="field">
              <label>Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value)}>
                <option value="Morning">Morning</option>
                <option value="Afternoon">Afternoon</option>
                <option value="Night">Night</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>Incoming MO</label>
              <input value={incomingMo} onChange={e => setIncomingMo(e.target.value)}
                     placeholder={ctx.user.display_name || "Nama MO masuk..."}/>
            </div>
            <div className="field">
              <label>Outgoing MO</label>
              <input value={outgoingMo} onChange={e => setOutgoingMo(e.target.value)}
                     placeholder="Nama MO keluar..."/>
            </div>
          </div>

          <table className="items-table">
            <thead>
              <tr>
                <th className="center">No</th>
                <th>Item Checklist</th>
                <th className="center">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentTab.items.map(it => (
                <tr key={it.no}>
                  <td className="item-no">{it.no.toString().padStart(2, "0")}</td>
                  <td className="item-label">
                    {it.item}
                    {it.std && <div className="faint" style={{ fontSize: 11, marginTop: 2 }}>{it.std}</div>}
                  </td>
                  <td className="item-toggle-cell">
                    <StateToggle value={checks[it.no]} onChange={v => setCheckValue(it.no, v)}/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="field" style={{ marginTop: 16 }}>
            <label>Notes (opsional)</label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="Catatan tambahan, NOTAM aktif, kondisi khusus..."/>
          </div>

          <div className="save-bar">
            <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-muted)" }}>
              {okCount} OK · {notOkCount} Not OK · {naCount} N/A
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost"
                      onClick={() => { setShowForm(false); setChecks(initChecks()); setNotes("") }}>
                Batal
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                <I n="save" s={14}/> {saving ? "Menyimpan..." : "Submit Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY PANEL */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><I n="checklist" s={16}/> Riwayat {currentTab.label}</h2>
          <span className="panel-counter">{history.length} checklist</span>
        </div>
        <div className="panel-body">
          {history.length === 0 ? (
            <div className="empty-state">
              <I n="checklist" s={44}/>
              <p>Belum ada checklist untuk fase ini</p>
              {!showForm && (
                <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>
                  <I n="plus" s={14}/> Buat checklist pertama
                </button>
              )}
            </div>
          ) : (
            <div className="h-list">
              {history.map(h => {
                // Build checks map from items array
                const itemsMap = {}
                ;(h.items || []).forEach(it => { itemsMap[it.no] = it.checked })

                const ok = (h.items || []).filter(it => it.checked === true).length
                const notOk = (h.items || []).filter(it => it.checked === false).length
                const na = (h.items || []).filter(it => it.checked === null).length
                const isOpen = expandedId === h.id

                return (
                  <div key={h.id} className={"h-card shift-" + (h.shift || "")}>
                    <div className="h-card-head" onClick={() => setExpandedId(isOpen ? null : h.id)}>
                      <div className="h-card-l">
                        <span className={"h-caret" + (isOpen ? " open" : "")}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </span>
                        <span className="h-card-date">{fmtD(h.checklist_date)}</span>
                        <span className="h-shift-tag">{h.shift}</span>
                        {(h.outgoing_mo || h.incoming_mo) && (
                          <span className="h-mo">
                            {h.outgoing_mo || "—"} → <strong style={{ color: "var(--text)" }}>{h.incoming_mo || "—"}</strong>
                          </span>
                        )}
                      </div>
                      <div className="h-summary">
                        {ok > 0 && <span className="h-pill h-pill-ok">{ok} ✓</span>}
                        {notOk > 0 && <span className="h-pill h-pill-notok">{notOk} ✗</span>}
                        {na > 0 && <span className="h-pill h-pill-na">{na} —</span>}
                      </div>
                    </div>
                    {isOpen && (
                      <div className="h-card-body">
                        <div className="h-item-list">
                          {(h.items || []).map(it => (
                            <div key={it.no} className="h-item-row">
                              <div className="h-item-num">{(it.no || 0).toString().padStart(2, "0")}</div>
                              <div>{it.item}</div>
                              <div className={"h-item-status " + (it.checked === true ? "ok" : it.checked === false ? "notok" : "na")}>
                                {it.checked === true ? "✓ OK" : it.checked === false ? "✗ Not OK" : "— N/A"}
                              </div>
                            </div>
                          ))}
                        </div>
                        {h.notes && <div className="h-notes">📝 {h.notes}</div>}
                        <div className="h-footer">
                          <span>Submitted {new Date(h.created_at).toLocaleString("id-ID")}</span>
                          {h.id && <span className="mono">ID: {String(h.id).slice(0, 16)}</span>}
                        </div>
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
