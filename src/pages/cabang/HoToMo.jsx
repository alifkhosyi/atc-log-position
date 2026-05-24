// ============================================================
// src/pages/cabang/HoToMo.jsx — Manager Operasi PRKP (REDESIGN)
// ──────────────────────────────────────────────────────────
// No dedicated mockup file — use Handover-redesign visual pattern
// for consistency (tabs styled with .mo-tab, structured items table,
// expandable history cards).
//
// Logic preserved exactly from original:
//   - activeTab state (pre_shift / handover / post_shift) tied to MO_TABS
//   - 3-state toggleCheck (null → true → false → null)
//   - History fetch from supabase mo_checklists table on tab change
//   - handleSubmit insert shape unchanged (branch_code, checklist_date,
//     shift, checklist_type, items, incoming_mo, outgoing_mo, notes, created_by)
//   - logAudit('MO_CHECKLIST', ...) preserved
//   - Confirm dialog for incomplete submission preserved
// New affordances:
//   - Tabs styled as .mo-tab (rounded button row, accent active)
//   - Items table uses .mo-items-table with grouped header
//   - 3-state check button as .mo-check-btn (color-coded)
//   - History card with .mo-history-card structure
//   - Expand/collapse via tombol (state), bukan <details> native
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { getAccessibleBranches, logAudit } from "../../lib/utils.js"
import { MO_TABS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"

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

  const [checkDate, setCheckDate] = useState(new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState("")
  const [notes, setNotes] = useState("")

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
      if (data) setHistory(data)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ctx.user.branch_code, saving])

  // ── 3-state toggle (preserved cycle: null → true → false → null) ──
  const toggleCheck = (no) => {
    setChecks(p => {
      const cur = p[no]
      const next = cur === null ? true : cur === true ? false : null
      return { ...p, [no]: next }
    })
  }

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
      incoming_mo: ctx.user.display_name,
      outgoing_mo: "",
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
    setShift("")
    setShowForm(false)
    setSaving(false)
  }

  // ── Render check icon for a value (preserved logic) ──
  const renderCheckIcon = (val) => {
    if (val === true)  return "✓"
    if (val === false) return "✗"
    return "—"
  }
  const checkClass = (val) => {
    if (val === true)  return "checked-true"
    if (val === false) return "checked-false"
    return "checked-null"
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <h1 className="topbar-title">HO/TO Manager Operasi</h1>
          <p className="topbar-sub">Checklist PRKP — Cabang {ctx.user.branch_code}</p>
        </div>
      </div>

      {/* MO TABS */}
      <div className="mo-tabs">
        {MO_TABS.map(t => (
          <button
            key={t.id}
            className={"mo-tab" + (activeTab === t.id ? " active" : "")}
            onClick={() => setActiveTab(t.id)}
          >
            <span className="mo-tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* SECTION HEADER */}
      <div className="row-between" style={{ marginBottom: 16 }}>
        <h2 style={{
          margin: 0, fontSize: 15, fontWeight: 600,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <I n="checklist" s={18}/> {currentTab.label}
        </h2>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <I n="plus" s={14}/> Buat Checklist
          </button>
        )}
      </div>

      {/* FORM */}
      {showForm && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <h2 className="panel-title">
              <span className="mo-tab-icon">{currentTab.icon}</span> {currentTab.label}
            </h2>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => { setShowForm(false); setChecks(initChecks()); setNotes(""); setShift("") }}
            >Tutup</button>
          </div>
          <div className="panel-body">
            {/* Meta row */}
            <div className="form-grid" style={{ marginBottom: 20 }}>
              <div className="field">
                <label>Tanggal</label>
                <input type="date" value={checkDate}
                       onChange={e => setCheckDate(e.target.value)}/>
              </div>
              <div className="field">
                <label>Shift</label>
                <select value={shift} onChange={e => setShift(e.target.value)}>
                  <option value="">— Pilih —</option>
                  <option value="Pagi">Pagi</option>
                  <option value="Siang">Siang</option>
                  <option value="Malam">Malam</option>
                </select>
              </div>
              <div className="field">
                <label>Manager Operasi</label>
                <input
                  value={ctx.user.display_name} disabled
                  style={{
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    fontWeight: 600, cursor: "not-allowed",
                  }}
                />
              </div>
            </div>

            {/* Items table */}
            <div className="section-subtitle">Items Pemeriksaan</div>
            <div className="table-wrap">
              <table className="mo-items-table">
                <thead>
                  <tr>
                    <th className="mo-no">NO</th>
                    <th className="mo-item-label">ITEM</th>
                    <th>STANDAR MINIMUM</th>
                    <th className="mo-check-cell">CEK</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTab.items.map(it => (
                    <tr key={it.no}>
                      <td className="mo-no">{it.no}</td>
                      <td className="mo-item-label">{it.item}</td>
                      <td className="mo-item-std">{it.std}</td>
                      <td className="mo-check-cell">
                        <button
                          type="button"
                          className={"mo-check-btn " + checkClass(checks[it.no])}
                          onClick={() => toggleCheck(it.no)}
                          title="Klik untuk ubah status (✓ → ✗ → —)"
                          aria-label={`Item ${it.no}: ${renderCheckIcon(checks[it.no])}`}
                        >
                          {renderCheckIcon(checks[it.no])}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="field" style={{ marginTop: 16, marginBottom: 0 }}>
              <label>Catatan Tambahan</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Catatan opsional..."
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button
                className="btn btn-ghost"
                onClick={() => { setShowForm(false); setChecks(initChecks()); setNotes(""); setShift("") }}
                disabled={saving}
              >Batal</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                <I n="save" s={14}/> {saving ? "Menyimpan…" : "Submit Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HISTORY */}
      <div className="section-subtitle">
        Riwayat {currentTab.label} {history.length > 0 ? `(${history.length})` : ""}
      </div>
      {history.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-state">
              <I n="clock" s={44}/>
              <p>Belum ada riwayat</p>
            </div>
          </div>
        </div>
      ) : history.map(h => {
        const items = h.items || []
        const checked   = items.filter(i => i.checked === true).length
        const unchecked = items.filter(i => i.checked === false).length
        const total = items.length
        const isOpen = expandedId === h.id
        return (
          <div key={h.id} className="mo-history-card">
            <div className="mo-history-head">
              <div className="mo-history-l">
                <span className="mo-history-date">
                  {new Date(h.checklist_date).toLocaleDateString("id-ID", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                <span className="mo-history-shift">{h.shift}</span>
                <div className="mo-history-summary">
                  <span className="mo-summary-ok">✓ {checked}</span>
                  {unchecked > 0 && (
                    <span className="mo-summary-bad">✗ {unchecked}</span>
                  )}
                  <span className="mo-summary-total">/ {total}</span>
                </div>
              </div>
              <span className="cl-time">
                {new Date(h.created_at).toLocaleTimeString("id-ID", {
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
            <div className="mo-history-meta">
              <span>MO: <strong style={{ color: "var(--text)" }}>{h.incoming_mo}</strong></span>
            </div>
            {h.notes && (
              <div className="mo-history-note">📝 {h.notes}</div>
            )}
            <button
              className="mo-history-toggle"
              onClick={() => setExpandedId(isOpen ? null : h.id)}
            >
              <I n={isOpen ? "chevron-up" : "chevron-down"} s={12}/>
              {isOpen ? "Tutup detail" : `Lihat Detail (${total} item)`}
            </button>
            {isOpen && (
              <div className="mo-history-detail">
                {items.map(it => (
                  <div key={it.no} className="mo-detail-item">
                    <span className={
                      "mo-mark " + (it.checked === true ? "ok" : it.checked === false ? "bad" : "na")
                    }>{renderCheckIcon(it.checked)}</span>
                    <span>{it.item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
