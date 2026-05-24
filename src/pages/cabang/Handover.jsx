// ============================================================
// src/pages/cabang/Handover.jsx — Checklist + Notes (REDESIGN)
// ──────────────────────────────────────────────────────────
// Visual: Handover Redesign.html mockup
// Logic preserved:
//   - Same submitCL Supabase insert shape (handover_checklists)
//     including the existing `branch_id: ctx.user.id` value (pre-existing,
//     not touched here — visual redesign only)
//   - Same delCL flow + logAudit
//   - Same addNote Supabase insert (handover_notes)
//   - Same myChecklists / myBranches filtering
// New UX:
//   - Tabs (Checklist | Notes) — collapses two separate scrolls
//   - Segmented control (OK / Not OK / N/A) replaces dropdown
//   - Personnel picker = chip pool with search; auto-disables names
//     already used in the other list (incoming vs outgoing)
//   - History card summary pills (N OK · M Not OK · K N/A)
//   - Border-left accent on cards with Not OK
//   - Priority radios styled (Normal neutral / Medium warn / Urgent alert)
//   - Inline warning banner when Urgent selected
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import {
  fmtD, fmtDT, getShift,
  getAccessibleBranches, logAudit, SHIFTS,
} from "../../lib/utils.js"
import { CHECKLIST_ITEMS, STATUS_OPTS } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"

// ── Status pill (read-only, used in summary + expanded view) ──
const StatusPill = ({ value }) => {
  if (value === "OK")     return <span className="status-pill status-pill-ok">OK</span>
  if (value === "Not OK") return <span className="status-pill status-pill-notok">Not OK</span>
  return <span className="status-pill status-pill-na">N/A</span>
}

// ── Segmented control (3-state status picker, replaces dropdown) ──
const StatusSegment = ({ value, onChange }) => (
  <div className="seg" role="radiogroup">
    {STATUS_OPTS.map(s => {
      const active = s === value
      const cls = active
        ? "active-" + (s === "OK" ? "ok" : s === "Not OK" ? "notok" : "na")
        : ""
      return (
        <button key={s} type="button" className={"seg-btn " + cls} onClick={() => onChange(s)}>
          {s}
        </button>
      )
    })}
  </div>
)

// ── Personnel chip pool picker (incoming / outgoing) ─────
// `selected`: names already chosen in this column (string[])
// `excludeList`: names chosen in the OTHER column (auto-disabled here)
const PersonnelPicker = ({ title, icon = "users", selected, onChange, excludeList = [], options }) => {
  const [search, setSearch] = useState("")
  const q = search.toLowerCase()
  const filtered = options.filter(p => p.name.toLowerCase().includes(q))
  const toggle = (name) => {
    if (selected.includes(name)) onChange(selected.filter(n => n !== name))
    else if (!excludeList.includes(name)) onChange([...selected, name])
  }
  return (
    <div className="pp-section">
      <div className="pp-header">
        <div className="pp-title"><I n={icon} s={14}/> {title}</div>
        <span className="pp-count">{selected.length}</span>
      </div>
      <div className="pp-selected">
        {selected.length === 0
          ? <span className="pp-selected-empty">Belum ada personnel dipilih</span>
          : selected.map(name => (
              <span key={name} className="pp-chip-selected">
                {name}
                <button className="pp-chip-x" onClick={() => toggle(name)} title="Hapus">×</button>
              </span>
            ))}
      </div>
      <input className="pp-search" placeholder="Cari nama..."
             value={search} onChange={e => setSearch(e.target.value)}/>
      <div className="pp-pool">
        {filtered.length === 0
          ? <span className="pp-pool-empty">Tidak ada yang cocok</span>
          : filtered.map(p => {
              if (selected.includes(p.name)) return null
              const excluded = excludeList.includes(p.name)
              return (
                <button key={p.id} type="button"
                        className={"pp-pool-chip" + (excluded ? " taken" : "")}
                        disabled={excluded} onClick={() => toggle(p.name)}
                        title={excluded ? "Sudah dipilih di kolom lain" : "Klik untuk tambah"}>
                  + {p.name}
                </button>
              )
            })}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export const CabangHandover = () => {
  const ctx = useApp()
  const toast = useToast()
  const confirm = useConfirm()

  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))

  const [tab, setTab] = useState("checklist")
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

  // ── Checklist state ──
  const [showForm, setShowForm] = useState(false)
  const [savingCL, setSavingCL] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  const initForm = () => ({
    checklist_date: new Date().toISOString().split("T")[0],
    checklist_time: new Date().toTimeString().slice(0, 5),
    manager_on_duty: "", shift: "",
    traffic_situation_status: "OK", traffic_situation_notes: "",
    conflict_solution_status: "OK", conflict_solution_notes: "",
    weather_status: "OK", weather_notes: "",
    facilities_status: "OK", facilities_notes: "",
    coordination_status: "OK", coordination_notes: "",
    others_status: "N/A", others_notes: "",
    incoming: [], outgoing: [],
  })
  const [f, setF] = useState(initForm())
  const set = (k, v) => setF(p => ({ ...p, [k]: v }))

  const myChecklists = ctx.handoverChecklists.filter(c => {
    const b = ctx.branches.find(br => br.id === c.branch_id)
    return b && myBranches.includes(b.code)
  })

  const submitCL = async () => {
    if (!f.manager_on_duty.trim()) {
      toast.warn("Manager on Duty kosong", "Pilih MOD sebelum simpan")
      return
    }
    if (!f.shift) {
      toast.warn("Shift belum dipilih", "Pilih shift sebelum simpan")
      return
    }
    if (f.incoming.length === 0 || f.outgoing.length === 0) {
      toast.warn("Personnel belum lengkap",
        "Minimal 1 Incoming dan 1 Outgoing personnel")
      return
    }
    setSavingCL(true)
    // Preserve existing DB shape: incoming/outgoing as comma-joined strings
    const submitData = {
      ...f,
      incoming_personnel: f.incoming.join(", "),
      outgoing_personnel: f.outgoing.join(", "),
    }
    delete submitData.incoming
    delete submitData.outgoing
    const { error } = await supabase.from("handover_checklists").insert({
      ...submitData,
      branch_id: ctx.user.id,    // ← preserved from original (pre-existing behavior)
      created_by: ctx.user.id,
    })
    if (error) {
      toast.error("Gagal simpan checklist", error.message)
    } else {
      logAudit("CHECKLIST_CREATE",
        "Shift " + f.shift + " MOD:" + f.manager_on_duty, ctx.user)
      const notOkCount = CHECKLIST_ITEMS.filter(it => f[it.key + "_status"] === "Not OK").length
      if (notOkCount > 0) {
        toast.warn(`Checklist tersimpan — ${notOkCount} item Not OK`,
          "Pastikan tindak lanjut sudah dikoordinasikan")
      } else {
        toast.success("Checklist tersimpan", `Shift ${f.shift} · ${f.manager_on_duty}`)
      }
      setF(initForm()); setShowForm(false)
      await ctx.reload()
    }
    setSavingCL(false)
  }

  const delCL = async (cl) => {
    const ok = await confirm({
      title: "Hapus checklist ini?",
      detail: "Data tidak bisa dipulihkan setelah dihapus. Pastikan sudah di-export jika dibutuhkan untuk audit.",
      target: `${fmtD(cl.checklist_date)} · Shift ${cl.shift} · ${cl.manager_on_duty}`,
      destructive: true, confirmText: "Hapus checklist",
    })
    if (!ok) return
    logAudit("CHECKLIST_DELETE", "ID:" + String(cl.id).slice(0, 8), ctx.user)
    const { error } = await supabase.from("handover_checklists").delete().eq("id", cl.id)
    if (error) {
      toast.error("Gagal menghapus", error.message)
    } else {
      await ctx.reload()
      toast.success("Checklist dihapus")
    }
  }

  // ── Notes state ──
  const [txt, setTxt] = useState("")
  const [pri, setPri] = useState("normal")
  const [savingN, setSavingN] = useState(false)

  const myNotes = ctx.handovers.filter(n => myBranches.includes(n.branch_code))
  const notOkChecklistCount = myChecklists.filter(c =>
    CHECKLIST_ITEMS.some(it => c[it.key + "_status"] === "Not OK")
  ).length

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
      logAudit("NOTE_CREATE",
        "Prioritas:" + pri + " — " + txt.slice(0, 50), ctx.user)
      toast.success("Catatan tersimpan",
        pri === "high"
          ? "Prioritas URGENT — shift berikutnya akan langsung melihat ini"
          : null)
      await ctx.reload()
      setTxt(""); setPri("normal")
    }
    setSavingN(false)
  }

  const delNote = async (note) => {
    const ok = await confirm({
      title: "Hapus catatan?",
      destructive: true, confirmText: "Hapus",
      target: note.content.length > 80 ? note.content.slice(0, 80) + "..." : note.content,
    })
    if (!ok) return
    logAudit("NOTE_DELETE", "ID:" + String(note.id).slice(0, 8), ctx.user)
    const { error } = await supabase.from("handover_notes").delete().eq("id", note.id)
    if (error) {
      toast.error("Gagal menghapus", error.message)
    } else {
      await ctx.reload()
      toast.success("Catatan dihapus")
    }
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Handover / Takeover</h1>
          <p className="topbar-sub">
            Checklist serah terima &amp; catatan antar shift — Cabang {ctx.user.branch_code}
          </p>
        </div>
      </div>

      {/* TABS */}
      <div className="tabs">
        <button
          className={"tab" + (tab === "checklist" ? " active" : "")}
          onClick={() => setTab("checklist")}
        >
          <I n="checklist" s={16}/> Checklist
          <span className="tab-count">{myChecklists.length}</span>
        </button>
        <button
          className={"tab" + (tab === "notes" ? " active" : "")}
          onClick={() => setTab("notes")}
        >
          <I n="note" s={16}/> Notes
          <span className="tab-count">{myNotes.length}</span>
        </button>
      </div>

      {tab === "checklist" && (
        <>
          {/* Action bar */}
          <div className="row-between" style={{ marginBottom: 20 }}>
            <div className="muted text-sm">
              {myChecklists.length} checklist tersimpan
              {notOkChecklistCount > 0 && (
                <> · <span style={{ color: "var(--status-alert)" }}>{notOkChecklistCount} dengan Not OK</span></>
              )}
            </div>
            {!showForm && (
              <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                <I n="plus" s={16}/> Buat Checklist Baru
              </button>
            )}
          </div>

          {/* Form */}
          {showForm && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title"><I n="checklist" s={16}/> Form Checklist Baru</h2>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => { setShowForm(false); setF(initForm()) }}
                >Tutup</button>
              </div>
              <div className="panel-body">
                {/* Meta */}
                <div className="form-grid" style={{ marginBottom: 20 }}>
                  <div className="field">
                    <label>Tanggal</label>
                    <input type="date" value={f.checklist_date}
                           onChange={e => set("checklist_date", e.target.value)}/>
                  </div>
                  <div className="field">
                    <label>Jam</label>
                    <input type="time" value={f.checklist_time}
                           onChange={e => set("checklist_time", e.target.value)}/>
                  </div>
                  <div className="field">
                    <label>Shift</label>
                    <select value={f.shift} onChange={e => set("shift", e.target.value)}>
                      <option value="">— Pilih —</option>
                      <option value="Pagi">Pagi</option>
                      <option value="Siang">Siang</option>
                      <option value="Malam">Malam</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Manager on Duty</label>
                    <select value={f.manager_on_duty}
                            onChange={e => set("manager_on_duty", e.target.value)}>
                      <option value="">— Pilih MOD —</option>
                      {moAccounts.map(m => (
                        <option key={m.id} value={m.display_name}>{m.display_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Checklist items */}
                <div className="section-subtitle">Items Pemeriksaan</div>
                <div className="cl-form-rows">
                  <div className="cl-form-row head">
                    <div>#</div><div>Item</div><div>Status</div><div>Catatan</div>
                  </div>
                  {CHECKLIST_ITEMS.map((it, idx) => {
                    const status = f[it.key + "_status"]
                    const notes  = f[it.key + "_notes"]
                    return (
                      <div key={it.key} className="cl-form-row">
                        <div className="cl-num">{(idx + 1).toString().padStart(2, "0")}</div>
                        <div className="cl-label">{it.label}</div>
                        <div>
                          <StatusSegment
                            value={status}
                            onChange={s => set(it.key + "_status", s)}
                          />
                        </div>
                        <div>
                          <input
                            className="cl-note-input"
                            value={notes}
                            onChange={e => set(it.key + "_notes", e.target.value)}
                            placeholder={status === "Not OK"
                              ? "Wajib isi: jelaskan kondisi & tindak lanjut"
                              : "Opsional..."}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Personnel pickers */}
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: 16, marginTop: 20,
                }}>
                  <PersonnelPicker
                    title="Incoming Personnel" icon="users"
                    selected={f.incoming}
                    onChange={inc => setF(p => ({ ...p, incoming: inc }))}
                    excludeList={f.outgoing}
                    options={myPersonnel}
                  />
                  <PersonnelPicker
                    title="Outgoing Personnel" icon="users"
                    selected={f.outgoing}
                    onChange={out => setF(p => ({ ...p, outgoing: out }))}
                    excludeList={f.incoming}
                    options={myPersonnel}
                  />
                </div>

                <div className="form-actions">
                  <button className="btn btn-ghost"
                          onClick={() => { setShowForm(false); setF(initForm()) }}>
                    Batal
                  </button>
                  <button className="btn btn-primary" onClick={submitCL} disabled={savingCL}>
                    <I n="checklist" s={16}/> {savingCL ? "Menyimpan…" : "Simpan Checklist"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          <div className="section-subtitle">Riwayat</div>
          {myChecklists.length === 0 ? (
            <div className="panel">
              <div className="panel-body">
                <div className="empty-state">
                  <I n="checklist" s={44}/>
                  <p>Belum ada checklist</p>
                </div>
              </div>
            </div>
          ) : myChecklists.map(cl => {
            const isOpen = expandedId === cl.id
            const okCount    = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "OK").length
            const notOkItems = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "Not OK")
            const naCount    = CHECKLIST_ITEMS.filter(it => cl[it.key + "_status"] === "N/A").length
            const incList = (cl.incoming_personnel || "").split(",").map(s => s.trim()).filter(Boolean)
            const outList = (cl.outgoing_personnel || "").split(",").map(s => s.trim()).filter(Boolean)
            return (
              <div key={cl.id} className={"cl-card" + (notOkItems.length ? " has-notok" : "")}>
                <div className="cl-card-head" onClick={() => setExpandedId(isOpen ? null : cl.id)}>
                  <div className="cl-card-l">
                    <span className={"cl-caret" + (isOpen ? " open" : "")}>
                      <I n="chev" s={14}/>
                    </span>
                    <span className="cl-date">{fmtD(cl.checklist_date)}</span>
                    {cl.shift && <span className="cl-shift-tag">{cl.shift}</span>}
                    <span className="cl-mod">MOD: {cl.manager_on_duty}</span>
                    <div className="cl-summary">
                      <span className="status-pill status-pill-ok">{okCount} OK</span>
                      {notOkItems.length > 0 && (
                        <span className="status-pill status-pill-notok">{notOkItems.length} Not OK</span>
                      )}
                      {naCount > 0 && (
                        <span className="status-pill status-pill-na">{naCount} N/A</span>
                      )}
                    </div>
                  </div>
                  <div className="cl-card-r">
                    {cl.checklist_time && <span className="cl-time">{cl.checklist_time}</span>}
                    <button
                      className="btn-icon btn-icon-danger"
                      onClick={e => { e.stopPropagation(); delCL(cl) }}
                      title="Hapus checklist"
                      aria-label="Hapus checklist"
                    >
                      <I n="trash" s={14}/>
                    </button>
                  </div>
                </div>
                {isOpen && (
                  <div className="cl-card-body">
                    <div className="cl-items-list">
                      {CHECKLIST_ITEMS.map(it => {
                        const st = cl[it.key + "_status"]
                        const nt = cl[it.key + "_notes"]
                        return (
                          <div key={it.key} className="cl-item-row">
                            <div>{it.label}</div>
                            <div><StatusPill value={st}/></div>
                            <div className={"cl-item-note" + (!nt ? " empty" : "")}>
                              {nt || "Tidak ada catatan"}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="cl-detail-grid">
                      <div className="cl-detail-section">
                        <h4>Incoming ({incList.length})</h4>
                        <div className="cl-personnel-list">
                          {incList.length === 0
                            ? <div className="faint text-sm">—</div>
                            : incList.map(p => (
                                <div key={p} className="cl-personnel-item">{p}</div>
                              ))}
                        </div>
                      </div>
                      <div className="cl-detail-section">
                        <h4>Outgoing ({outList.length})</h4>
                        <div className="cl-personnel-list">
                          {outList.length === 0
                            ? <div className="faint text-sm">—</div>
                            : outList.map(p => (
                                <div key={p} className="cl-personnel-item">{p}</div>
                              ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {tab === "notes" && (
        <>
          {/* Compose */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title"><I n="note" s={16}/> Catatan Baru</h2>
              <span className="muted text-sm">
                Shift <strong style={{ color: "var(--text)" }}>{getShift()}</strong>
                {" → "}
                {SHIFTS[(SHIFTS.indexOf(getShift()) + 1) % 3]}
              </span>
            </div>
            <div className="panel-body">
              <div className="field">
                <label>Prioritas</label>
                <div className="prio-radios">
                  <button type="button"
                          className={"prio-radio" + (pri === "normal" ? " active-normal" : "")}
                          onClick={() => setPri("normal")}>Normal</button>
                  <button type="button"
                          className={"prio-radio" + (pri === "medium" ? " active-medium" : "")}
                          onClick={() => setPri("medium")}>Medium</button>
                  <button type="button"
                          className={"prio-radio" + (pri === "high" ? " active-high" : "")}
                          onClick={() => setPri("high")}>Urgent</button>
                </div>
                {pri === "high" && (
                  <div className="urgent-warning">
                    <I n="alert-triangle" s={14}/>
                    Catatan urgent akan ditandai khusus untuk shift berikutnya
                  </div>
                )}
              </div>
              <div className="field">
                <label>Isi Catatan</label>
                <textarea
                  rows={4} value={txt}
                  onChange={e => setTxt(e.target.value)}
                  placeholder="Tulis kondisi yang perlu diketahui shift berikutnya — incident, anomali fasilitas, koordinasi tertunda, dll..."
                />
              </div>
              <div className="form-actions">
                <button className="btn btn-ghost"
                        onClick={() => { setTxt(""); setPri("normal") }}>
                  Reset
                </button>
                <button className="btn btn-primary"
                        onClick={addNote} disabled={!txt.trim() || savingN}>
                  <I n="note" s={16}/> {savingN ? "Menyimpan…" : "Simpan Catatan"}
                </button>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="section-subtitle">Riwayat Catatan</div>
          {myNotes.length === 0 ? (
            <div className="panel">
              <div className="panel-body">
                <div className="empty-state">
                  <I n="note" s={44}/>
                  <p>Belum ada catatan</p>
                </div>
              </div>
            </div>
          ) : myNotes.map(n => (
            <div key={n.id} className={"note-card p-" + (n.priority || "normal")}>
              <div className="note-head">
                <div className="note-head-l">
                  <span className={"priority-badge priority-" + (n.priority || "normal")}>
                    {n.priority === "high" ? "URGENT" : (n.priority || "normal").toUpperCase()}
                  </span>
                  <span className="note-shift">
                    {n.from_shift} → {n.to_shift}
                  </span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="note-time">{fmtDT(n.created_at)}</span>
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => delNote(n)}
                    title="Hapus catatan"
                    aria-label="Hapus catatan"
                  >
                    <I n="trash" s={14}/>
                  </button>
                </div>
              </div>
              <div className="note-body">{n.content}</div>
              <div className="note-author">— {n.author_name}</div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
