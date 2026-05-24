// ============================================================
// src/pages/cabang/HoToMo.jsx — Manager Operasi PRKP checklists
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { getAccessibleBranches, logAudit } from "../../lib/utils.js"
import { MO_TABS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"

export const CabangHoToMo = () => {
  const ctx = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const [activeTab, setActiveTab] = useState("pre_shift")
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [checkDate, setCheckDate] = useState(new Date().toISOString().slice(0, 10))
  const [shift, setShift] = useState("")
  const [notes, setNotes] = useState("")

  const currentTab = MO_TABS.find(t => t.id === activeTab)
  const initChecks = () => currentTab.items.reduce((a, it) => ({ ...a, [it.no]: null }), {})
  const [checks, setChecks] = useState(initChecks())

  useEffect(() => { setChecks(initChecks()); setShowForm(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("mo_checklists").select("*")
        .in("branch_code", myBranches).eq("checklist_type", activeTab)
        .order("created_at", { ascending: false }).limit(20)
      if (data) setHistory(data)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, ctx.user.branch_code, saving])

  const toggleCheck = (no) => {
    setChecks(p => {
      const cur = p[no]
      // cycle: null → true(✓) → false(✗) → null
      const next = cur === null ? true : cur === true ? false : null
      return { ...p, [no]: next }
    })
  }

  const handleSubmit = async () => {
    if (!shift) { toast.warn("Shift kosong", "Pilih shift terlebih dahulu"); return }
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
    const itemsArr = currentTab.items.map(it => ({ no: it.no, item: it.item, checked: checks[it.no] }))
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
      setSaving(false); return
    }
    logAudit("MO_CHECKLIST", "Submit " + activeTab + " checklist — shift " + shift, ctx.user)
    toast.success("Checklist tersimpan", `${currentTab.label} · shift ${shift}`)
    setChecks(initChecks()); setNotes(""); setShift(""); setShowForm(false); setSaving(false)
  }

  const checkIcon = (val) => {
    if (val === true)  return <span style={{ color:"var(--status-on)",    fontSize:18, fontWeight:900 }}>✓</span>
    if (val === false) return <span style={{ color:"var(--status-alert)", fontSize:18, fontWeight:900 }}>✗</span>
    return <span style={{ color:"var(--fg-muted)", fontSize:14 }}>—</span>
  }

  return (
    <div className="page-content">
      <Header title="HO/TO Manager Operasi" sub={"Checklist PRKP — " + ctx.user.branch_code}/>

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

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--fg)", display:"flex", alignItems:"center", gap:8 }}>
          <I n="checklist" s={18}/> {currentTab.label}
        </h2>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
            <I n="plus" s={14}/> Buat Checklist
          </button>
        )}
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom:24 }}>
          <div className="panel-header">
            <h2 className="panel-title">{currentTab.icon} {currentTab.label}</h2>
          </div>
          <div className="panel-body">
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16, marginBottom:20 }}>
              <div className="field"><label>Tanggal</label>
                <input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)}/>
              </div>
              <div className="field"><label>Shift</label>
                <select value={shift} onChange={e => setShift(e.target.value)}>
                  <option value="">Pilih...</option>
                  <option value="Pagi">Pagi</option>
                  <option value="Siang">Siang</option>
                  <option value="Malam">Malam</option>
                </select>
              </div>
              <div className="field"><label>Manager Operasi</label>
                <input value={ctx.user.display_name} disabled
                       style={{ background:"var(--accent-soft)", color:"var(--accent)",
                                fontWeight:600, cursor:"not-allowed" }}/>
              </div>
            </div>

            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr style={{ background:"var(--accent-soft)" }}>
                    <th style={{ padding:"10px 8px", fontSize:11, fontWeight:700, color:"var(--fg-muted)",
                                 textAlign:"center", width:40, borderBottom:"2px solid var(--border)" }}>NO</th>
                    <th style={{ padding:"10px 12px", fontSize:11, fontWeight:700, color:"var(--fg-muted)",
                                 textAlign:"left", width:180, borderBottom:"2px solid var(--border)" }}>ITEM</th>
                    <th style={{ padding:"10px 12px", fontSize:11, fontWeight:700, color:"var(--fg-muted)",
                                 textAlign:"left", borderBottom:"2px solid var(--border)" }}>STANDAR MINIMUM</th>
                    <th style={{ padding:"10px 8px", fontSize:11, fontWeight:700, color:"var(--fg-muted)",
                                 textAlign:"center", width:60, borderBottom:"2px solid var(--border)" }}>CEK</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTab.items.map(it => (
                    <tr key={it.no} style={{ borderBottom:"1px solid var(--border)" }}>
                      <td style={{ padding:"12px 8px", textAlign:"center", fontSize:13, fontWeight:700, color:"var(--fg-muted)" }}>{it.no}</td>
                      <td style={{ padding:"12px", fontSize:13, fontWeight:600, color:"var(--fg)" }}>{it.item}</td>
                      <td style={{ padding:"12px", fontSize:12, color:"var(--fg-muted)", lineHeight:1.5 }}>{it.std}</td>
                      <td style={{ padding:"12px 8px", textAlign:"center" }}>
                        <button type="button" onClick={() => toggleCheck(it.no)} style={{
                          width:36, height:36, borderRadius:8,
                          border: "1.5px solid " + (
                            checks[it.no] === true  ? "var(--status-on)" :
                            checks[it.no] === false ? "var(--status-alert)" :
                            "var(--border)"),
                          background:
                            checks[it.no] === true  ? "var(--status-on-soft)" :
                            checks[it.no] === false ? "var(--status-alert-soft)" :
                            "transparent",
                          cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                          transition:"all .15s",
                        }}>{checkIcon(checks[it.no])}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop:16 }}>
              <div className="field"><label>Catatan Tambahan</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                          placeholder="Catatan opsional..." rows={3}/>
              </div>
            </div>

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16,
                          paddingTop:16, borderTop:"1px solid var(--border)" }}>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setChecks(initChecks()); setNotes("") }}>Batal</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? "Menyimpan..." : "Submit Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="clock" s={16}/> Riwayat {currentTab.label}</h2></div>
        <div className="panel-body">
          {history.length === 0 ? (
            <p style={{ color:"var(--fg-muted)", fontSize:13, textAlign:"center", padding:20 }}>Belum ada riwayat</p>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {history.map(h => {
                const items = h.items || []
                const checked = items.filter(i => i.checked === true).length
                const unchecked = items.filter(i => i.checked === false).length
                const total = items.length
                return (
                  <div key={h.id} style={{ padding:16, borderRadius:10, border:"1px solid var(--border)", background:"var(--surface-2)" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                        <span style={{ fontSize:13, fontWeight:700, color:"var(--fg)" }}>
                          {new Date(h.checklist_date).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" })}
                        </span>
                        <span style={{ padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:700,
                                       background:"var(--accent-soft)", color:"var(--accent)" }}>{h.shift}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"var(--status-on)", fontWeight:700 }}>✓ {checked}</span>
                        {unchecked > 0 && <span style={{ fontSize:11, color:"var(--status-alert)", fontWeight:700 }}>✗ {unchecked}</span>}
                        <span style={{ fontSize:11, color:"var(--fg-muted)" }}>/ {total}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:"var(--fg-muted)" }}>
                      <span>MO: <strong style={{ color:"var(--fg)" }}>{h.incoming_mo}</strong></span>
                      <span style={{ marginLeft:12, fontSize:11, color:"var(--fg-muted)" }}>
                        {new Date(h.created_at).toLocaleTimeString("id-ID", { hour:"2-digit", minute:"2-digit" })}
                      </span>
                    </div>
                    {h.notes && (
                      <div style={{ marginTop:8, fontSize:12, color:"var(--fg-muted)", fontStyle:"italic" }}>📝 {h.notes}</div>
                    )}
                    <details style={{ marginTop:10 }}>
                      <summary style={{ fontSize:11, color:"var(--accent)", cursor:"pointer", fontWeight:600 }}>
                        Lihat Detail ({total} item)
                      </summary>
                      <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:4 }}>
                        {items.map(it => (
                          <div key={it.no} style={{ display:"flex", gap:8, alignItems:"center", padding:"4px 0", fontSize:12 }}>
                            {it.checked === true  ? <span style={{ color:"var(--status-on)",    fontWeight:900 }}>✓</span>
                             : it.checked === false ? <span style={{ color:"var(--status-alert)", fontWeight:900 }}>✗</span>
                             : <span style={{ color:"var(--fg-muted)" }}>—</span>}
                            <span style={{ color:"var(--fg)" }}>{it.item}</span>
                          </div>
                        ))}
                      </div>
                    </details>
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
