// ============================================================
// src/pages/cabang/LogPosition.jsx — Cabang log position (input + active + table)
// ============================================================
import React, { useState, useEffect, useRef } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { fmtT, durMin, getShift, getAccessibleBranches, logAudit } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { Header } from "../../components/Header.jsx"
import { useToast } from "../../components/Toast.jsx"

export const CabangLog = () => {
  const ctx = useApp()
  const toast = useToast()
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || { units: ["TWR"] }
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const mySectors = ctx.sectors.filter(s => myBranches.includes(s.branch_code))
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))

  const [nmSearch, setNmSearch] = useState("")
  const [nmOpen, setNmOpen] = useState(false)
  const nmRef = useRef(null)
  const filteredPersonnel = [
    ...myPersonnel.filter(p => p.name.toLowerCase().startsWith(nmSearch.toLowerCase())),
    ...myPersonnel.filter(p => !p.name.toLowerCase().startsWith(nmSearch.toLowerCase())
                            && p.name.toLowerCase().includes(nmSearch.toLowerCase())),
  ]

  useEffect(() => {
    const handleClick = (e) => { if (nmRef.current && !nmRef.current.contains(e.target)) setNmOpen(false) }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const selectPerson = (name) => { setNm(name); setNmSearch(name); setNmOpen(false) }

  const [unit, setUnit] = useState(br.units[0] || "TWR")
  const [nm, setNm]     = useState("")
  const [show, setShow] = useState(false)
  const [offId, setOffId] = useState(null)
  const [dep, setDep] = useState("")
  const [arr, setArr] = useState("")
  const [ovf, setOvf] = useState("")
  const [saving, setSaving] = useState(false)
  const [shift, setShift] = useState("")

  const unitSectors = mySectors.filter(s => s.unit === unit)
  const [si, setSi] = useState(0)
  const cwps = unitSectors[si] ? unitSectors[si].cwps : ["Controller", "Assistant"]
  const [ci, setCi] = useState(0)

  const active = ctx.logs.filter(l => !l.off_time && myBranches.includes(l.branch_code))
  const today  = ctx.logs.filter(l => myBranches.includes(l.branch_code)
                                  && new Date(l.on_time).toDateString() === new Date().toDateString())

  const onMic = async () => {
    if (!nm.trim() || saving) return
    if (!shift.trim()) {
      toast.warn("Shift belum diisi", "Ketik nama shift sebelum on mic.")
      return
    }
    setSaving(true)
    const { error } = await supabase.from("position_logs").insert({
      branch_code: ctx.user.branch_code,
      atc_name: nm.trim(),
      unit,
      sector: unitSectors[si]?.name || "Sector 1",
      cwp: cwps[ci] || "Controller",
      shift: shift.trim(),
      on_time: new Date().toISOString(),
      logged_by: ctx.user.id,
    })
    if (error) {
      toast.error("Gagal input on mic", error.message)
    } else {
      logAudit("ON_MIC", nm.trim() + " — " + unit + " " + unitSectors[si]?.name + " (" + cwps[ci] + ")", ctx.user)
      toast.success("On mic berhasil", nm.trim() + " — " + unit + " " + (unitSectors[si]?.name || ""))
      await ctx.reload()
      setNm(""); setNmSearch(""); setShow(false)
    }
    setSaving(false)
  }

  const offMic = async (id, isController) => {
    setSaving(true)
    const updateData = { off_time: new Date().toISOString() }
    if (isController) {
      const d = parseInt(dep) || 0, a = parseInt(arr) || 0, o = parseInt(ovf) || 0
      updateData.departure_count = d
      updateData.arrival_count = a
      updateData.overfly_count = o
      updateData.traffic_count = d + a + o
    }
    const { error } = await supabase.from("position_logs").update(updateData).eq("id", id)
    if (error) {
      toast.error("Gagal off mic", error.message)
    } else {
      const lg = ctx.logs.find(x => x.id === id)
      logAudit("OFF_MIC",
        (lg?.atc_name || "?") + " — " + (lg?.unit || "") + " " + (lg?.sector || "") +
        (isController ? " DEP:" + updateData.departure_count + " ARR:" + updateData.arrival_count + " OVF:" + updateData.overfly_count : ""),
        ctx.user)
      toast.success("Off mic berhasil", (lg?.atc_name || "?") +
        (isController ? ` — Total traffic: ${updateData.traffic_count}` : ""))
      await ctx.reload()
      setOffId(null); setDep(""); setArr(""); setOvf("")
    }
    setSaving(false)
  }

  const isControllerCwp = (cwp) => (cwp || "").toLowerCase().includes("controller")

  return (
    <div className="page-content">
      <Header title="Log Position" sub={"Input posisi ATC — " + ctx.user.branch_code}/>

      {active.length > 0 && (
        <div className="panel panel-glow">
          <div className="panel-header">
            <h2 className="panel-title"><Pulse s={10}/> ATC On Mic ({active.length})</h2>
          </div>
          <div className="panel-body">
            {active.map(l => {
              const isCtr = isControllerCwp(l.cwp)
              return (
                <div key={l.id} className="active-position">
                  <div className="active-position-info">
                    {[["Nama",l.atc_name],["Unit",l.unit],["Sektor",l.sector],["CWP",l.cwp],
                      ["On",fmtT(l.on_time)],["Durasi", durMin(l.on_time, new Date().toISOString()) + "m"]
                    ].map(([k,v]) => (
                      <div key={k} className="active-pos-row">
                        <span className="active-pos-label">{k}</span>
                        <span className="active-pos-value">{v}</span>
                      </div>
                    ))}
                  </div>
                  {offId === l.id ? (
                    <div className="off-mic-form">
                      {isCtr ? (
                        <>
                          <div style={{ width:"100%", marginBottom:8 }}>
                            <div style={{ fontSize:11, fontWeight:600, color:"var(--fg-muted)", marginBottom:6 }}>
                              Laporan Traffic — {l.sector}
                            </div>
                            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
                              <div className="field" style={{ marginBottom:0 }}>
                                <label style={{ fontSize:11, color:"var(--traffic-dep)" }}>DEP</label>
                                <input type="number" value={dep} onChange={e => setDep(e.target.value)}
                                       placeholder="0" min="0" style={{ textAlign:"center" }}/>
                              </div>
                              <div className="field" style={{ marginBottom:0 }}>
                                <label style={{ fontSize:11, color:"var(--traffic-arr)" }}>ARR</label>
                                <input type="number" value={arr} onChange={e => setArr(e.target.value)}
                                       placeholder="0" min="0" style={{ textAlign:"center" }}/>
                              </div>
                              <div className="field" style={{ marginBottom:0 }}>
                                <label style={{ fontSize:11, color:"var(--traffic-ovf)" }}>OVF</label>
                                <input type="number" value={ovf} onChange={e => setOvf(e.target.value)}
                                       placeholder="0" min="0" style={{ textAlign:"center" }}/>
                              </div>
                            </div>
                            {(dep || arr || ovf) && (
                              <div style={{ fontSize:12, fontWeight:700, color:"var(--fg)", marginTop:6, textAlign:"center" }}>
                                Total: {(parseInt(dep)||0) + (parseInt(arr)||0) + (parseInt(ovf)||0)}
                              </div>
                            )}
                          </div>
                          <div className="off-mic-actions">
                            <button className="btn btn-danger btn-sm" onClick={() => offMic(l.id, true)} disabled={saving}>
                              <I n="micOff" s={14}/> Off + Lapor
                            </button>
                            <button className="btn btn-ghost btn-sm"
                                    onClick={() => { setOffId(null); setDep(""); setArr(""); setOvf("") }}>Batal</button>
                          </div>
                        </>
                      ) : (
                        <div className="off-mic-actions">
                          <button className="btn btn-danger btn-sm" onClick={() => offMic(l.id, false)} disabled={saving}>
                            <I n="micOff" s={14}/> Off Mic
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => setOffId(null)}>Batal</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button className="btn btn-danger btn-sm" onClick={() => setOffId(l.id)}>
                      <I n="micOff" s={14}/> Off Mic
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <button className="btn btn-primary btn-lg" onClick={() => setShow(!show)} style={{ marginBottom:20 }}>
        <I n={show ? "x" : "mic"} s={18}/> {show ? "Tutup Form" : "Input ATC On Mic"}
      </button>

      {show && (
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title">Form On Mic</h2></div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="field">
                <label>Nama ATC</label>
                <div ref={nmRef} style={{ position:"relative" }}>
                  <input type="text" placeholder="Ketik nama..." value={nmSearch}
                         onChange={e => { setNmSearch(e.target.value); setNm(""); setNmOpen(true) }}
                         onFocus={() => setNmOpen(true)} style={{ width:"100%" }} autoComplete="off"/>
                  {nmOpen && (
                    <div style={{
                      position:"absolute", top:"100%", left:0, right:0,
                      maxHeight:220, overflowY:"auto",
                      background:"var(--panel-bg)", border:"1px solid var(--border)",
                      borderRadius:8, marginTop:4, zIndex:999,
                      boxShadow:"var(--shadow-lg)",
                    }}>
                      {filteredPersonnel.length === 0
                        ? <div style={{ padding:"12px 16px", color:"var(--fg-muted)", fontSize:13 }}>Tidak ditemukan</div>
                        : filteredPersonnel.map(p => (
                            <div key={p.id} onClick={() => selectPerson(p.name)}
                                 style={{
                                   padding:"10px 16px", cursor:"pointer", fontSize:13,
                                   color:"var(--fg)", borderBottom:"1px solid var(--border-subtle)",
                                   transition:"background .15s",
                                 }}
                                 onMouseEnter={e => e.target.style.background = "var(--accent-soft)"}
                                 onMouseLeave={e => e.target.style.background = "transparent"}>
                              {p.name}
                            </div>
                          ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="field"><label>Unit</label>
                <select value={unit} onChange={e => { setUnit(e.target.value); setSi(0); setCi(0) }}>
                  {br.units.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="field"><label>Sektor</label>
                <select value={si} onChange={e => { setSi(+e.target.value); setCi(0) }}>
                  {unitSectors.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                </select>
              </div>
              <div className="field"><label>CWP</label>
                <select value={ci} onChange={e => setCi(+e.target.value)}>
                  {cwps.map((c, i) => <option key={i} value={i}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Shift</label>
                <input type="text" value={shift} onChange={e => setShift(e.target.value)} placeholder="Ketik shift..." autoComplete="off"/>
              </div>
            </div>
            <button className="btn btn-primary" onClick={onMic} style={{ marginTop:16 }} disabled={!nm.trim() || !shift.trim() || saving}>
              <I n="mic" s={16}/> {saving ? "Menyimpan..." : "On Mic Sekarang"}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Log Hari Ini</h2>
          <span className="panel-counter">{today.length}</span>
        </div>
        <div className="panel-body">
          {today.length === 0
            ? <div className="empty-state"><p>Belum ada log</p></div>
            : <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>Shift</th>
                      <th>On</th><th>Off</th><th>Durasi</th><th>DEP</th><th>ARR</th><th>OVF</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {today.map(l => (
                      <tr key={l.id}>
                        <td><strong>{l.atc_name}</strong></td>
                        <td><span className="unit-tag">{l.unit}</span></td>
                        <td>{l.sector}</td>
                        <td>{l.cwp}</td>
                        <td>{l.shift}</td>
                        <td>{fmtT(l.on_time)}</td>
                        <td>{l.off_time ? fmtT(l.off_time) : "-"}</td>
                        <td>{l.off_time ? durMin(l.on_time, l.off_time) + "m" : "..."}</td>
                        <td style={{ textAlign:"center", color:"var(--traffic-dep)" }}>{l.departure_count || "-"}</td>
                        <td style={{ textAlign:"center", color:"var(--traffic-arr)" }}>{l.arrival_count || "-"}</td>
                        <td style={{ textAlign:"center", color:"var(--traffic-ovf)" }}>{l.overfly_count || "-"}</td>
                        <td>
                          {l.off_time
                            ? <span className="status-badge status-off">Off</span>
                            : <span className="status-badge status-on"><Pulse s={6}/> On</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>}
        </div>
      </div>
    </div>
  )
}
