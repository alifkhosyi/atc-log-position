// ============================================================
// src/pages/cabang/LogPosition.jsx — Cabang log position (REDESIGN)
// ──────────────────────────────────────────────────────────
// Visual: Log Position Redesign.html mockup
// Logic preserved:
//   - Same onMic / offMic supabase mutations (position_logs)
//   - Same Controller vs non-Controller branch in off-mic flow
//   - Same combobox search semantics (startsWith → contains)
//   - Same myBranches / mySectors / myPersonnel computation
// New affordances:
//   - Always-visible quick-input banner (no toggle)
//   - Bigger active position cards with inline traffic form
//   - Search box + unit chip filter for today's log table
//   - Per-row delete with ConfirmDialog
// ============================================================
import React, { useState, useEffect, useRef } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import {
  fmtT, durMin, getShift,
  getAccessibleBranches, logAudit,
} from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"

const isControllerCwp = (cwp) => (cwp || "").toLowerCase().includes("controller")

// ── Combobox (search-as-you-type personnel picker) ─────────
const Combobox = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])
  const q = (value || "").toLowerCase()
  const filtered = q.trim() === ""
    ? options
    : [
        ...options.filter(p => p.name.toLowerCase().startsWith(q)),
        ...options.filter(p =>
          !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q)
        ),
      ]
  return (
    <div className="combobox" ref={ref}>
      <input
        type="text" value={value || ""} placeholder={placeholder} autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div className="combobox-list">
          {filtered.length === 0
            ? <div className="combobox-empty">Tidak ditemukan</div>
            : filtered.slice(0, 8).map(p => (
                <div key={p.id} className="combobox-item"
                     onClick={() => { onChange(p.name); setOpen(false) }}>
                  {p.name}
                </div>
              ))}
        </div>
      )}
    </div>
  )
}

// ── Active position card with inline off-mic flow ─────────
const ActivePositionCard = ({ log, onOffMic, saving }) => {
  const [mode, setMode] = useState("idle") // idle | confirming
  const [dep, setDep] = useState("")
  const [arr, setArr] = useState("")
  const [ovf, setOvf] = useState("")
  const isCtr = isControllerCwp(log.cwp)
  const total = (parseInt(dep) || 0) + (parseInt(arr) || 0) + (parseInt(ovf) || 0)
  const dur = durMin(log.on_time, new Date().toISOString())

  const submit = () => {
    onOffMic(log, isCtr ? {
      dep: parseInt(dep) || 0,
      arr: parseInt(arr) || 0,
      ovf: parseInt(ovf) || 0,
    } : null)
    // Don't reset mode here — parent reload will unmount this card
  }

  return (
    <div className="ap-card">
      <div className="ap-head">
        <Pulse s={8}/>
        <span className="ap-unit">{log.unit}</span>
        <span className="ap-sector">{log.sector}</span>
      </div>
      <div>
        <div className="ap-name">{log.atc_name}</div>
        <div className="ap-cwp">{log.cwp}</div>
      </div>
      <div className="ap-meta">
        <div>
          <span className="ap-meta-l">On Mic</span>
          <span className="ap-meta-v">{fmtT(log.on_time)}</span>
        </div>
        <div>
          <span className="ap-meta-l">Durasi</span>
          <span className="ap-meta-v ap-meta-dur">{dur}m</span>
        </div>
      </div>

      {mode === "idle" ? (
        <div className="ap-actions">
          <button
            className="btn btn-sm btn-danger"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setMode("confirming")}
            disabled={saving}
          >
            <I n="micOff" s={14}/> Off Mic
          </button>
        </div>
      ) : (
        <div className="traffic-form">
          {isCtr ? (
            <>
              <div className="traffic-grid">
                <div className="traffic-field traffic-dep">
                  <label>DEP</label>
                  <input type="number" min="0" value={dep}
                         onChange={e => setDep(e.target.value)} placeholder="0"/>
                </div>
                <div className="traffic-field traffic-arr">
                  <label>ARR</label>
                  <input type="number" min="0" value={arr}
                         onChange={e => setArr(e.target.value)} placeholder="0"/>
                </div>
                <div className="traffic-field traffic-ovf">
                  <label>OVF</label>
                  <input type="number" min="0" value={ovf}
                         onChange={e => setOvf(e.target.value)} placeholder="0"/>
                </div>
              </div>
              {total > 0 && (
                <div className="traffic-total">
                  Total traffic: <strong>{total}</strong>
                </div>
              )}
            </>
          ) : (
            <div className="muted text-sm" style={{ marginBottom: 12, textAlign: "center" }}>
              CWP <strong style={{ color: "var(--text)" }}>{log.cwp}</strong> — tidak perlu laporan traffic
            </div>
          )}
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-sm btn-ghost"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={() => { setMode("idle"); setDep(""); setArr(""); setOvf("") }}
                    disabled={saving}>
              Batal
            </button>
            <button className="btn btn-sm btn-danger"
                    style={{ flex: 1, justifyContent: "center" }}
                    onClick={submit} disabled={saving}>
              <I n="micOff" s={14}/> {saving ? "Menyimpan…" : "Konfirmasi Off Mic"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────
export const CabangLog = () => {
  const ctx = useApp()
  const toast = useToast()
  const confirm = useConfirm()

  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || { units: ["TWR"] }
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const mySectors = ctx.sectors.filter(s => myBranches.includes(s.branch_code))
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))

  // On-mic form
  const [nm, setNm]         = useState("")
  const [unit, setUnit]     = useState(br.units?.[0] || "TWR")
  const [si, setSi]         = useState(0)
  const [ci, setCi]         = useState(0)
  const [saving, setSaving] = useState(false)

  const unitSectors = mySectors.filter(s => s.unit === unit)
  const cwps = unitSectors[si] ? unitSectors[si].cwps : ["Controller", "Assistant"]

  // Today logs + filters
  const active = ctx.logs.filter(l => !l.off_time && myBranches.includes(l.branch_code))
  const today = ctx.logs.filter(l =>
    myBranches.includes(l.branch_code) &&
    new Date(l.on_time).toDateString() === new Date().toDateString()
  )
  const [search, setSearch] = useState("")
  const [unitFilter, setUnitFilter] = useState("all")
  const filteredLogs = today.filter(l => {
    if (unitFilter !== "all" && l.unit !== unitFilter) return false
    if (search.trim() && !l.atc_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // ── On Mic ──
  const onMic = async () => {
    if (!nm.trim() || saving) return
    if (active.some(l => l.atc_name === nm.trim())) {
      toast.error("ATC sudah on mic", `${nm.trim()} masih aktif di posisi lain`)
      return
    }
    setSaving(true)
    const { error } = await supabase.from("position_logs").insert({
      branch_code: ctx.user.branch_code,
      atc_name: nm.trim(),
      unit,
      sector: unitSectors[si]?.name || "Sector 1",
      cwp: cwps[ci] || "Controller",
      shift: getShift(),
      on_time: new Date().toISOString(),
      logged_by: ctx.user.id,
    })
    if (error) {
      toast.error("Gagal input on mic", error.message)
    } else {
      logAudit("ON_MIC",
        `${nm.trim()} — ${unit} ${unitSectors[si]?.name || ""} (${cwps[ci] || ""})`,
        ctx.user)
      toast.success("On mic berhasil",
        `${nm.trim()} — ${unit} ${unitSectors[si]?.name || ""}`)
      await ctx.reload()
      setNm("")
    }
    setSaving(false)
  }

  // ── Off Mic (called from ActivePositionCard) ──
  const onOffMic = async (log, traffic) => {
    if (saving) return
    setSaving(true)
    const updateData = { off_time: new Date().toISOString() }
    if (traffic) {
      updateData.departure_count = traffic.dep
      updateData.arrival_count   = traffic.arr
      updateData.overfly_count   = traffic.ovf
      updateData.traffic_count   = traffic.dep + traffic.arr + traffic.ovf
    }
    const { error } = await supabase
      .from("position_logs").update(updateData).eq("id", log.id)
    if (error) {
      toast.error("Gagal off mic", error.message)
    } else {
      logAudit("OFF_MIC",
        `${log.atc_name} — ${log.unit} ${log.sector}` +
          (traffic
            ? ` DEP:${traffic.dep} ARR:${traffic.arr} OVF:${traffic.ovf}`
            : ""),
        ctx.user)
      toast.success("Off mic berhasil",
        traffic
          ? `${log.atc_name} — Total traffic: ${updateData.traffic_count}`
          : `${log.atc_name} — Durasi ${durMin(log.on_time, new Date().toISOString())} menit`)
      await ctx.reload()
    }
    setSaving(false)
  }

  // ── Delete log ──
  const onDeleteLog = async (log) => {
    if (saving) return
    const ok = await confirm({
      title: "Hapus log ini?",
      detail: "Data akan hilang permanen dan tidak masuk laporan harian.",
      target: `${log.atc_name} · ${log.unit} · ${fmtT(log.on_time)}–${log.off_time ? fmtT(log.off_time) : "ongoing"}`,
      destructive: true, confirmText: "Hapus log",
    })
    if (!ok) return
    setSaving(true)
    const { error } = await supabase.from("position_logs").delete().eq("id", log.id)
    if (error) {
      toast.error("Gagal menghapus", error.message)
    } else {
      logAudit("DELETE_LOG",
        `${log.atc_name} — ${log.unit} ${log.sector} (${fmtT(log.on_time)})`,
        ctx.user)
      toast.success("Log dihapus")
      await ctx.reload()
    }
    setSaving(false)
  }

  const completedTodayCount = today.filter(l => l.off_time).length

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Log Position</h1>
          <p className="topbar-sub">Input posisi ATC — Cabang {ctx.user.branch_code}</p>
        </div>
        <div className="topbar-actions">
          <span className="status-pill-info">
            <Pulse s={8}/>
            <strong style={{ color: "var(--text)", margin: "0 4px" }}>{active.length}</strong> on mic ·
            <strong style={{ color: "var(--text)", margin: "0 4px" }}>{completedTodayCount}</strong> selesai
          </span>
        </div>
      </div>

      {/* INPUT BANNER — always visible */}
      <div className="input-banner">
        <div className="input-banner-header">
          <h2><I n="mic" s={18}/> Input ATC On Mic</h2>
          <span className="muted text-sm">
            Shift <strong style={{ color: "var(--text)" }}>{getShift()}</strong>
          </span>
        </div>
        <div className="quick-row">
          <div className="field" style={{ margin: 0 }}>
            <label>Nama ATC</label>
            <Combobox
              value={nm}
              onChange={setNm}
              options={myPersonnel}
              placeholder="Ketik nama..."
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Unit</label>
            <select value={unit} onChange={e => { setUnit(e.target.value); setSi(0); setCi(0) }}>
              {(br.units || ["TWR"]).map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>Sektor</label>
            <select value={si} onChange={e => { setSi(+e.target.value); setCi(0) }}>
              {unitSectors.length === 0
                ? <option>—</option>
                : unitSectors.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label>CWP</label>
            <select value={ci} onChange={e => setCi(+e.target.value)}>
              {cwps.map((c, i) => <option key={i} value={i}>{c}</option>)}
            </select>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onMic} disabled={!nm.trim() || saving}>
            <I n="mic" s={16}/> {saving ? "Menyimpan…" : "On Mic"}
          </button>
        </div>
      </div>

      {/* ACTIVE POSITIONS */}
      <div className={"panel" + (active.length > 0 ? " panel-glow" : "")}>
        <div className="panel-header">
          <h2 className="panel-title"><Pulse s={10}/> Posisi Aktif</h2>
          <span className="panel-badge">● LIVE · {active.length}</span>
        </div>
        <div className="panel-body">
          {active.length === 0 ? (
            <div className="empty-state">
              <I n="micOff" s={44}/>
              <p>Belum ada ATC on mic</p>
              <p className="faint text-sm">Gunakan form di atas untuk input</p>
            </div>
          ) : (
            <div className="ap-grid">
              {active.map(l => (
                <ActivePositionCard
                  key={l.id} log={l}
                  onOffMic={onOffMic} saving={saving}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TODAY LOG */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Log Hari Ini</h2>
          <span className="panel-counter">{today.length} log</span>
        </div>
        <div className="panel-body" style={{ paddingTop: 12 }}>
          {/* Filter row */}
          <div className="log-filters">
            <div style={{ position: "relative", flex: "0 1 240px" }}>
              <span style={{
                position: "absolute", left: 10, top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-faint)", pointerEvents: "none",
                display: "inline-flex",
              }}>
                <I n="search" s={14}/>
              </span>
              <input
                className="filter-input"
                style={{ paddingLeft: 30 }}
                placeholder="Cari nama..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span className="faint text-sm" style={{ marginLeft: 8 }}>Filter unit:</span>
            <button
              className={"chip" + (unitFilter === "all" ? " active" : "")}
              onClick={() => setUnitFilter("all")}
            >Semua</button>
            {(br.units || []).map(u => (
              <button
                key={u}
                className={"chip" + (unitFilter === u ? " active" : "")}
                onClick={() => setUnitFilter(u)}
              >{u}</button>
            ))}
            <span className="faint text-sm" style={{ marginLeft: "auto" }}>
              {filteredLogs.length} dari {today.length} log
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="empty-state">
              <p>{today.length === 0 ? "Belum ada log" : "Tidak ada log yang cocok dengan filter"}</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th>
                    <th>On</th><th>Off</th><th>Durasi</th>
                    <th>DEP</th><th>ARR</th><th>OVF</th>
                    <th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map(l => (
                    <tr key={l.id}>
                      <td><strong>{l.atc_name}</strong></td>
                      <td><span className="unit-tag">{l.unit}</span></td>
                      <td>{l.sector}</td>
                      <td className="muted">{l.cwp}</td>
                      <td className="mono">{fmtT(l.on_time)}</td>
                      <td className="mono">
                        {l.off_time ? fmtT(l.off_time) : <span className="faint">—</span>}
                      </td>
                      <td className="mono">
                        {l.off_time
                          ? durMin(l.on_time, l.off_time) + "m"
                          : <span style={{ color: "var(--status-on)" }}>
                              {durMin(l.on_time, new Date().toISOString())}m
                            </span>}
                      </td>
                      <td className="td-dep">{l.departure_count ?? <span className="faint">—</span>}</td>
                      <td className="td-arr">{l.arrival_count   ?? <span className="faint">—</span>}</td>
                      <td className="td-ovf">{l.overfly_count   ?? <span className="faint">—</span>}</td>
                      <td>
                        {l.off_time
                          ? <span className="status-badge status-off">Off</span>
                          : <span className="status-badge status-on"><Pulse s={6}/> On</span>}
                      </td>
                      <td>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => onDeleteLog(l)}
                          disabled={saving}
                          title="Hapus log"
                          aria-label="Hapus log"
                        >
                          <I n="trash" s={14}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
