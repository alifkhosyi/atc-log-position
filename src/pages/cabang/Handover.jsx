// ============================================================
// src/pages/cabang/Handover.jsx — Checklist + Notes
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { fmtD, fmtDT, getShift, getAccessibleBranches, logAudit, SHIFTS } from "../../lib/utils.js"
import { CHECKLIST_ITEMS, STATUS_OPTS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { Header } from "../../components/Header.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"

// Status colors — tokens, not light-theme hex literals
const STATUS_CLR = {
  "OK":     { bg: "var(--status-on-soft)",    fg: "var(--status-on)",    bd: "var(--status-on)" },
  "Not OK": { bg: "var(--status-alert-soft)", fg: "var(--status-alert)", bd: "var(--status-alert)" },
  "N/A":    { bg: "var(--status-off-soft)",   fg: "var(--text-muted)",   bd: "var(--border)" },
}

// MATSC (WAAA) & JATSC (WIII): bandara tersibuk, sub-cabang sudah punya MO sendiri
// → di form handover hanya lihat cabang sendiri, tidak rekursif ke bawahan.
const HQ_BRANCHES = ["WAAA", "WIII"]

export const CabangHandover = () => {
  const ctx = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const myBranches = HQ_BRANCHES.includes(ctx.user.branch_code)
    ? [ctx.user.branch_code]
    : getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))
  const [moAccounts, setMoAccounts] = useState([])

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("accounts")
        .select("id,username,display_name,branch_code")
        .in("branch_code", myBranches).like("username", "mo_%").order("username")
      if (data) setMoAccounts(data)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.user.branch_code])

  const [showForm, setShowForm] = useState(false)
  const [savingCL, setSavingCL] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const initForm = () => ({
    checklist_date: new Date().toISOString().split("T")[0],
    checklist_time: new Date().toTimeString().slice(0,5),
    manager_on_duty: "", shift: "",
    traffic_situation_status:"OK", traffic_situation_notes:"",
    conflict_solution_status:"OK", conflict_solution_notes:"",
    weather_status:"OK", weather_notes:"",
    facilities_status:"OK", facilities_notes:"",
    coordination_status:"OK", coordination_notes:"",
    others_status:"N/A", others_notes:"",
    incoming_list:[""], outgoing_list:[""],
  })
  const [f, setF] = useState(initForm())
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const allSelected = [...f.incoming_list, ...f.outgoing_list].filter(n => n.trim())
  const setListItem = (listKey, idx, val) => {
    setF(p => { const arr = [...p[listKey]]; arr[idx] = val; return { ...p, [listKey]: arr } })
  }
  const addListItem = (listKey) => {
    setF(p => p[listKey].length < 30 ? { ...p, [listKey]: [...p[listKey], ""] } : p)
  }
  const removeListItem = (listKey, idx) => {
    setF(p => { const arr = p[listKey].filter((_, i) => i !== idx); return { ...p, [listKey]: arr.length === 0 ? [""] : arr } })
  }
  const availablePersonnel = (listKey, idx) => {
    const currentVal = f[listKey][idx]
    return myPersonnel.filter(p => !allSelected.includes(p.name) || p.name === currentVal)
  }

  const myChecklists = ctx.handoverChecklists.filter(c => {
    const b = ctx.branches.find(br => br.id === c.branch_id)
    return b && myBranches.includes(b.code)
  })

  const submitCL = async () => {
    const incList = f.incoming_list.filter(n => n.trim())
    const outList = f.outgoing_list.filter(n => n.trim())
    if (!f.manager_on_duty.trim() || incList.length === 0 || outList.length === 0) {
      toast.warn("Data belum lengkap", "Mohon isi Manager on Duty, minimal 1 Incoming & 1 Outgoing Personnel")
      return
    }
    setSavingCL(true)
    const submitData = { ...f, incoming_personnel: incList.join(", "), outgoing_personnel: outList.join(", ") }
    delete submitData.incoming_list
    delete submitData.outgoing_list
    const { error } = await supabase.from("handover_checklists").insert({ ...submitData, branch_id: ctx.user.id, created_by: ctx.user.id })
    if (error) {
      toast.error("Gagal simpan checklist", error.message)
    } else {
      logAudit("CHECKLIST_CREATE", "Shift " + f.shift + " MOD:" + f.manager_on_duty, ctx.user)
      toast.success("Checklist tersimpan", "Shift " + f.shift + " · " + f.manager_on_duty)
      setF(initForm()); setShowForm(false); await ctx.reload()
    }
    setSavingCL(false)
  }

  const delCL = async (id) => {
    const ok = await confirm({
      title: "Hapus checklist ini?",
      detail: "Aksi ini tidak bisa dibatalkan.",
      destructive: true, confirmText: "Hapus",
    })
    if (!ok) return
    logAudit("CHECKLIST_DELETE", "ID:" + id.slice(0,8), ctx.user)
    await supabase.from("handover_checklists").delete().eq("id", id)
    await ctx.reload()
    toast.success("Checklist dihapus")
  }

  // ── Notes ──
  const [txt, setTxt] = useState("")
  const [pri, setPri] = useState("normal")
  const [savingN, setSavingN] = useState(false)
  const addNote = async () => {
    if (!txt.trim() || savingN) return
    setSavingN(true)
    const si = SHIFTS.indexOf(getShift())
    const { error } = await supabase.from("handover_notes").insert({
      branch_code: ctx.user.branch_code,
      from_shift: getShift(),
      to_shift: SHIFTS[(si + 1) % 3],
      author_name: ctx.user.display_name,
      priority: pri,
      content: txt,
      written_by: ctx.user.id,
    })
    if (error) {
      toast.error("Gagal simpan catatan", error.message)
    } else {
      logAudit("NOTE_CREATE", "Prioritas:" + pri + " — " + txt.slice(0,50), ctx.user)
      toast.success("Catatan tersimpan", pri === "high" ? "Prioritas URGENT" : null)
      await ctx.reload(); setTxt(""); setPri("normal")
    }
    setSavingN(false)
  }

  return (
    <div className="page-content">
      <Header title="Handover/Takeover" sub={"Checklist & catatan serah terima — " + ctx.user.branch_code}/>

      {/* Section 1: Checklist */}
      <div style={{ marginBottom:8 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--fg)", display:"flex", alignItems:"center", gap:8 }}>
            <I n="checklist" s={18}/> Handover/Takeover Checklist
          </h2>
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <I n="plus" s={14}/> Buat Checklist
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title"><I n="checklist" s={16}/> Form Checklist Baru</h2>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="field"><label>Date</label><input type="date" value={f.checklist_date} onChange={e => set("checklist_date", e.target.value)}/></div>
              <div className="field"><label>Time</label><input type="time" value={f.checklist_time} onChange={e => set("checklist_time", e.target.value)}/></div>
              <div className="field"><label>Manager on Duty</label>
                <select value={f.manager_on_duty} onChange={e => set("manager_on_duty", e.target.value)}>
                  <option value="">— Pilih MOD —</option>
                  {moAccounts.map(m => <option key={m.id} value={m.display_name}>{m.display_name}</option>)}
                </select>
              </div>
              <div className="field"><label>Shift</label>
                <select value={f.shift} onChange={e => set("shift", e.target.value)}>
                  <option value="">Pilih...</option>
                  <option value="Pagi">Pagi</option>
                  <option value="Siang">Siang</option>
                  <option value="Malam">Malam</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX:"auto", margin:"20px 0" }}>
              <table className="data-table" style={{ minWidth:560 }}>
                <thead><tr><th style={{ width:36 }}>No</th><th style={{ width:160 }}>Item</th><th style={{ width:220 }}>Status</th><th>Catatan</th></tr></thead>
                <tbody>
                  {CHECKLIST_ITEMS.map((it, idx) => (
                    <tr key={it.key}>
                      <td style={{ textAlign:"center", color:"var(--fg-muted)" }}>{idx + 1}</td>
                      <td><strong>{it.label}</strong></td>
                      <td>
                        <div style={{ display:"flex", gap:4 }}>
                          {STATUS_OPTS.map(st => {
                            const active = f[it.key + "_status"] === st
                            const c = STATUS_CLR[st]
                            return (
                              <button key={st} type="button" onClick={() => set(it.key + "_status", st)} style={{
                                padding:"5px 12px", borderRadius:6,
                                border: `1.5px solid ${active ? c.bd : "var(--border)"}`,
                                background: active ? c.bg : "transparent",
                                color: active ? c.fg : "var(--fg-muted)",
                                fontSize:12, fontWeight:600, cursor:"pointer", transition:"all .15s",
                              }}>{st}</button>
                            )
                          })}
                        </div>
                      </td>
                      <td>
                        <input value={f[it.key + "_notes"]} onChange={e => set(it.key + "_notes", e.target.value)}
                               placeholder="Opsional..." style={{
                                 width:"100%", padding:"6px 10px", borderRadius:6,
                                 border:"1px solid var(--border)", background:"var(--card)",
                                 color:"var(--fg)", fontSize:12,
                               }}/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, padding:"20px 0", borderTop:"2px solid var(--border)" }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--fg-muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>
                  Incoming Personnel ({f.incoming_list.filter(n => n.trim()).length})
                </div>
                {f.incoming_list.map((name, idx) => (
                  <div key={idx} style={{ display:"flex", gap:4, marginBottom:6, alignItems:"center" }}>
                    <select value={name} onChange={e => setListItem("incoming_list", idx, e.target.value)} style={{
                      flex:1, padding:"8px 10px", borderRadius:6,
                      border:"1px solid var(--border)", background:"var(--card)",
                      color:"var(--fg)", fontSize:13,
                    }}>
                      <option value="">— Pilih —</option>
                      {availablePersonnel("incoming_list", idx).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    {f.incoming_list.length > 1 && (
                      <button type="button" onClick={() => removeListItem("incoming_list", idx)} style={{
                        width:28, height:28, borderRadius:6,
                        border:"1px solid var(--border)", background:"transparent",
                        color:"var(--status-alert)", cursor:"pointer", fontSize:14,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>×</button>
                    )}
                  </div>
                ))}
                {f.incoming_list.length < 30 && (
                  <button type="button" onClick={() => addListItem("incoming_list")} className="btn btn-ghost btn-sm" style={{ fontSize:11, marginTop:2 }}>+ Add More</button>
                )}
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:"var(--fg-muted)", textTransform:"uppercase", letterSpacing:".5px", marginBottom:8 }}>
                  Outgoing Personnel ({f.outgoing_list.filter(n => n.trim()).length})
                </div>
                {f.outgoing_list.map((name, idx) => (
                  <div key={idx} style={{ display:"flex", gap:4, marginBottom:6, alignItems:"center" }}>
                    <select value={name} onChange={e => setListItem("outgoing_list", idx, e.target.value)} style={{
                      flex:1, padding:"8px 10px", borderRadius:6,
                      border:"1px solid var(--border)", background:"var(--card)",
                      color:"var(--fg)", fontSize:13,
                    }}>
                      <option value="">— Pilih —</option>
                      {availablePersonnel("outgoing_list", idx).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                    </select>
                    {f.outgoing_list.length > 1 && (
                      <button type="button" onClick={() => removeListItem("outgoing_list", idx)} style={{
                        width:28, height:28, borderRadius:6,
                        border:"1px solid var(--border)", background:"transparent",
                        color:"var(--status-alert)", cursor:"pointer", fontSize:14,
                        display:"flex", alignItems:"center", justifyContent:"center",
                      }}>×</button>
                    )}
                  </div>
                ))}
                {f.outgoing_list.length < 30 && (
                  <button type="button" onClick={() => addListItem("outgoing_list")} className="btn btn-ghost btn-sm" style={{ fontSize:11, marginTop:2 }}>+ Add More</button>
                )}
              </div>
            </div>

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:12 }}>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setF(initForm()) }}>Batal</button>
              <button className="btn btn-primary" onClick={submitCL} disabled={savingCL}>
                <I n="checklist" s={16}/> {savingCL ? "Menyimpan..." : "Simpan Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Riwayat Checklist</h2>
          <span className="panel-counter">{myChecklists.length}</span>
        </div>
        <div className="panel-body">
          {myChecklists.length === 0 ? (
            <div className="empty-state"><I n="checklist" s={44}/><p>Belum ada checklist</p></div>
          ) : myChecklists.map(cl => (
            <div key={cl.id} className="handover-card handover-normal" style={{ cursor:"pointer" }}
                 onClick={() => setExpandedId(expandedId === cl.id ? null : cl.id)}>
              <div className="handover-header">
                <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                  <span style={{ fontSize:14 }}>{expandedId === cl.id ? "▾" : "▸"}</span>
                  <strong>{fmtD(cl.checklist_date)}</strong>
                  {cl.shift && <span className="priority-tag priority-normal">{cl.shift}</span>}
                  <span style={{ color:"var(--fg-muted)", fontSize:12 }}>MOD: {cl.manager_on_duty}</span>
                  {CHECKLIST_ITEMS.some(it => cl[it.key + "_status"] === "Not OK") && (
                    <span className="priority-tag priority-high">⚠ Not OK</span>
                  )}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span className="handover-time">{cl.checklist_time || ""}</span>
                  <button className="btn btn-ghost btn-sm"
                          onClick={e => { e.stopPropagation(); delCL(cl.id) }}
                          style={{ color:"var(--status-alert)", fontSize:11, padding:"2px 8px" }}>Hapus</button>
                </div>
              </div>
              {expandedId === cl.id && (
                <div style={{ padding:"12px 0 4px", borderTop:"1px solid var(--border)" }}>
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
                                fontSize:11, fontWeight:600,
                                background: c.bg, color: c.fg,
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
          ))}
        </div>
      </div>

      {/* Section 2: Notes */}
      <div style={{ marginTop:32, marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:16, fontWeight:700, color:"var(--fg)", display:"flex", alignItems:"center", gap:8 }}>
          <I n="note" s={18}/> Handover Notes
        </h2>
      </div>

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Buat Catatan</h2></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field"><label>Prioritas</label>
              <select value={pri} onChange={e => setPri(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="high">Urgent</option>
              </select>
            </div>
            <div className="field"><label>Shift</label>
              <input value={"Shift " + getShift() + " → " + SHIFTS[(SHIFTS.indexOf(getShift()) + 1) % 3]} disabled/>
            </div>
          </div>
          <div className="field"><label>Catatan</label>
            <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={4} placeholder="Catatan untuk shift berikutnya..."/>
          </div>
          <button className="btn btn-primary" onClick={addNote} disabled={!txt.trim() || savingN}>
            <I n="note" s={16}/> {savingN ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Riwayat Notes</h2>
          <span className="panel-counter">{ctx.handovers.filter(n => myBranches.includes(n.branch_code)).length}</span>
        </div>
        <div className="panel-body">
          {ctx.handovers.filter(n => myBranches.includes(n.branch_code)).length === 0 ? (
            <div className="empty-state"><p>Belum ada catatan</p></div>
          ) : ctx.handovers.filter(n => myBranches.includes(n.branch_code)).map(n => (
            <div key={n.id} className={"handover-card handover-" + n.priority}>
              <div className="handover-header">
                <div>
                  <span className={"priority-tag priority-" + n.priority}>{n.priority.toUpperCase()}</span>
                  <span className="handover-shift">Shift {n.from_shift} → {n.to_shift}</span>
                </div>
                <span className="handover-time">{fmtDT(n.created_at)}</span>
              </div>
              <div className="handover-body">{n.content}</div>
              <div className="handover-author">— {n.author_name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
