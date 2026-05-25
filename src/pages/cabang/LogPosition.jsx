// ============================================================
// src/pages/cabang/LogPosition.jsx — Cabang log position (REDESIGN + ROSTER LINK)
// ──────────────────────────────────────────────────────────
// v2 (hybrid): roster jadi suggested today, manual override tetap ada.
//   - Section baru "Sesuai Roster Hari Ini" di atas
//   - Quick On Mic per personel (no typing)
//   - Cuti / sakit auto-detected dari roster
//   - Form manual existing tetap untuk emergency override
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
// Phase 3 fix N-06 + C-03: shared accessible Combobox
import { Combobox } from "../../components/Combobox.jsx"
// Phase 3 fix N-03: CSS tokens
import "../../styles/roster-tokens.css"

const isControllerCwp = (cwp) => (cwp || "").toLowerCase().includes("controller")

// Map status token → label & color (pakai CSS tokens, bukan hex inline)
// Phase 3 fix N-03
const SHIFT_LABELS = {
  I:    { label: "Shift I",   color: "var(--shift-I)" },
  II:   { label: "Shift II",  color: "var(--shift-II)" },
  III:  { label: "Shift III", color: "var(--shift-III)" },
  IV:   { label: "Shift IV",  color: "var(--shift-IV)" },
  V:    { label: "Shift V",   color: "var(--shift-V)" },
}
const LEAVE_LABELS = {
  CUTI:   { label: "Cuti",   color: "var(--leave-cuti)" },
  SAKIT:  { label: "Sakit",  color: "var(--leave-sakit)" },
  DIKLAT: { label: "Diklat", color: "var(--leave-diklat)" },
  OTHERS: { label: "Off",    color: "var(--leave-others)" },
}

// Phase 3 fix N-04: helper untuk match personnel cell-by-cell dengan UUID FK warning
// Saat ini kita fallback by name/initial supaya backward-compat. Setelah migrate
// data biar consistent UUID, hapus fallback ini.
function matchPersonnelByCellId(personnelList, personnelIdFromCell) {
  if (!personnelIdFromCell) return null
  // Primary: UUID match
  let p = personnelList.find(pp => pp.id === personnelIdFromCell)
  if (p) return p
  // Fallback 1: by name (LEGACY — issues console.warn)
  p = personnelList.find(pp => pp.name === personnelIdFromCell)
  if (p) {
    if (typeof console !== "undefined") {
      console.warn(
        `[roster] Personnel "${p.name}" matched by NAME, not UUID id (cell.personnel_id="${personnelIdFromCell}"). ` +
        `Migration aid only — update atc_roster_cells.personnel_id to UUID FK.`
      )
    }
    return p
  }
  // Fallback 2: by initial (LEGACY — issues console.warn)
  p = personnelList.find(pp =>
    (pp.initial || "").toLowerCase() === personnelIdFromCell.toLowerCase()
  )
  if (p) {
    if (typeof console !== "undefined") {
      console.warn(
        `[roster] Personnel "${p.initial}" matched by INITIAL, not UUID id (cell.personnel_id="${personnelIdFromCell}"). ` +
        `Migration aid only — update atc_roster_cells.personnel_id to UUID FK.`
      )
    }
    return p
  }
  return null
}

// ── Active position card with inline off-mic flow ─────────
const ActivePositionCard = ({ log, onOffMic, saving }) => {
  const [mode, setMode] = useState("idle")
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


// ============================================================
// ROSTER CARD — quick on-mic dari roster hari ini (with sector picker)
// ============================================================
// N-05 fix: replace auto-pick first sector dengan inline picker form
// (pattern sama dengan ActivePositionCard idle → confirming)
const RosterPersonCard = ({ entry, isOnMic, onQuickOnMic, saving, sectorOptions, cwpOptionsBySector }) => {
  // Cuti / sakit / off → display only, no button
  const isLeave = !!LEAVE_LABELS[entry.shift_status]
  const isWorking = !!SHIFT_LABELS[entry.shift_status]
  const meta = SHIFT_LABELS[entry.shift_status] || LEAVE_LABELS[entry.shift_status]

  // Inline picker state
  const [mode, setMode] = useState("idle")  // idle | picking
  const [si, setSi] = useState(0)            // sector index
  const [ci, setCi] = useState(0)            // CWP index
  const cwpOpts = cwpOptionsBySector?.[si] || ["Controller", "Assistant"]

  const submitPick = () => {
    const sectorName = sectorOptions?.[si]?.name || "Sector 1"
    const cwpName = cwpOpts[ci] || "Controller"
    onQuickOnMic(entry, sectorName, cwpName)
    // parent ctx.reload akan unmount card
  }

  return (
    <div className="roster-card" style={{
      border: "1px solid var(--border, #e5e7eb)",
      borderRadius: 8,
      padding: 10,
      display: "flex", flexDirection: "column", gap: 6,
      background: isOnMic ? "var(--status-on-soft, rgba(34,197,94,0.06))" : "var(--surface, white)",
      minWidth: 220,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isOnMic ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
            color: "var(--status-on, #22c55e)",
          }}>
            <Pulse on/> On Mic
          </span>
        ) : isLeave ? (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, color: "var(--text-faint, #9ca3af)",
          }}>
            <I n="micOff" s={12}/> Off-roster
          </span>
        ) : (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            fontSize: 11, color: "var(--accent, #3b82f6)",
          }}>
            <I n="checklist" s={12}/> Belum on mic
          </span>
        )}
        <span style={{
          marginLeft: "auto",
          fontSize: 10, fontWeight: 700,
          background: meta?.color || "#9ca3af", color: "white",
          padding: "2px 6px", borderRadius: 4,
        }}>
          {meta?.label || entry.shift_status}
        </span>
      </div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>
        {entry.name || entry.initial}
      </div>
      {entry.initial && entry.initial !== entry.name && (
        <div style={{ fontSize: 11, color: "var(--text-faint, #9ca3af)" }}>
          {entry.initial} · {entry.unit}
        </div>
      )}

      {/* IDLE: tombol On Mic muncul */}
      {isWorking && !isOnMic && mode === "idle" && (
        <button
          className="btn btn-sm btn-primary"
          style={{ marginTop: 4, justifyContent: "center" }}
          onClick={() => setMode("picking")}
          disabled={saving}
        >
          <I n="mic" s={12}/> On Mic
        </button>
      )}

      {/* PICKING: pilih sector + CWP, lalu konfirmasi */}
      {isWorking && !isOnMic && mode === "picking" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
          {sectorOptions && sectorOptions.length > 1 && (
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: 10 }}>Sektor</label>
              <select value={si}
                      onChange={e => { setSi(+e.target.value); setCi(0) }}
                      style={{ fontSize: 12, padding: "4px 6px" }}>
                {sectorOptions.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
              </select>
            </div>
          )}
          {cwpOpts.length > 1 && (
            <div className="field" style={{ margin: 0 }}>
              <label style={{ fontSize: 10 }}>CWP</label>
              <select value={ci}
                      onChange={e => setCi(+e.target.value)}
                      style={{ fontSize: 12, padding: "4px 6px" }}>
                {cwpOpts.map((c, i) => <option key={i} value={i}>{c}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="btn btn-sm btn-ghost"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => setMode("idle")}
              disabled={saving}
            >
              Batal
            </button>
            <button
              className="btn btn-sm btn-primary"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={submitPick}
              disabled={saving}
            >
              <I n="mic" s={12}/> {saving ? "..." : "Konfirmasi"}
            </button>
          </div>
        </div>
      )}

      {isLeave && (
        <div style={{ fontSize: 11, color: "var(--text-faint, #9ca3af)" }}>
          Tidak dijadwal hari ini
        </div>
      )}
    </div>
  )
}


// ============================================================
// MAIN PAGE
// ============================================================
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

  // ============================================================
  // ROSTER TODAY — load dari Supabase atc_rosters + atc_roster_cells
  // ============================================================
  const [rosterToday, setRosterToday] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterNotFound, setRosterNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadRosterToday() {
      if (!ctx.user?.branch_code) return
      setRosterLoading(true)
      setRosterNotFound(false)

      const today = new Date()
      const year = today.getFullYear()
      const month = today.getMonth() + 1
      const day = today.getDate()

      // Cek semua unit di cabang ini (TWR, APP, dst)
      const units = br.units || ["TWR"]
      const collected = []

      for (const u of units) {
        const { data: rRow } = await supabase
          .from('atc_rosters')
          .select('id')
          .eq('airport_code', ctx.user.branch_code)
          .eq('unit', u)
          .eq('year', year)
          .eq('month', month)
          .maybeSingle()

        if (!rRow) continue

        const { data: cells } = await supabase
          .from('atc_roster_cells')
          .select('personnel_id, status')
          .eq('roster_id', rRow.id)
          .eq('day', day)

        if (!cells) continue
        for (const c of cells) {
          // Phase 3 N-04: match by UUID; fallback by name/initial dengan console.warn
          const p = matchPersonnelByCellId(myPersonnel, c.personnel_id)
          collected.push({
            personnel_id: c.personnel_id,
            shift_status: c.status,
            unit: u,
            name: p?.name || c.personnel_id,
            initial: p?.initial || c.personnel_id,
            matched_personnel: p,
          })
        }
      }

      if (cancelled) return
      if (collected.length === 0) {
        setRosterToday([])
        setRosterNotFound(true)
      } else {
        // Sort: working personnel dulu, lalu yang off
        collected.sort((a, b) => {
          const aw = SHIFT_LABELS[a.shift_status] ? 0 : 1
          const bw = SHIFT_LABELS[b.shift_status] ? 0 : 1
          if (aw !== bw) return aw - bw
          return (a.name || "").localeCompare(b.name || "")
        })
        setRosterToday(collected)
      }
      setRosterLoading(false)
    }
    loadRosterToday()
    return () => { cancelled = true }
  }, [ctx.user?.branch_code, myPersonnel.length])

  // Check apakah personel sudah on-mic (di active logs)
  const isPersonOnMic = (entry) => {
    const candidates = [entry.name, entry.initial].filter(Boolean).map(s => s.toLowerCase())
    return active.some(l => candidates.includes((l.atc_name || "").toLowerCase()))
  }

  // ── Quick On Mic dari roster card (sector & CWP dipilih di card) ──
  // N-05 fix: sector & cwpName sekarang dipilih eksplisit di RosterPersonCard,
  // bukan auto-pick "first" (yang silently misroute di station multi-sector)
  const onQuickOnMic = async (entry, sectorName, cwpName) => {
    if (!entry.name || saving) return
    if (active.some(l => l.atc_name === entry.name)) {
      toast.error("ATC sudah on mic", `${entry.name} masih aktif`)
      return
    }
    setSaving(true)

    const { error } = await supabase.from("position_logs").insert({
      branch_code: ctx.user.branch_code,
      atc_name: entry.name,
      unit: entry.unit,
      sector: sectorName || "Sector 1",
      cwp: cwpName || "Controller",
      shift: getShift(),
      on_time: new Date().toISOString(),
      logged_by: ctx.user.id,
    })
    if (error) {
      toast.error("Gagal on mic", error.message)
    } else {
      logAudit("ON_MIC_FROM_ROSTER",
        `${entry.name} — ${entry.unit} ${sectorName} (${cwpName})`,
        ctx.user)
      toast.success("On mic berhasil (dari roster)",
        `${entry.name} — ${entry.unit} ${sectorName}`)
      await ctx.reload()
    }
    setSaving(false)
  }

  // ── On Mic manual ──
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

  // ── Off Mic ──
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
  const workingCount = rosterToday.filter(e => SHIFT_LABELS[e.shift_status]).length

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

      {/* ROSTER HARI INI (BARU) */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <I n="checklist" s={16}/> Sesuai Roster Hari Ini
          </h2>
          <span className="panel-counter">
            {rosterLoading ? "Loading…" : `${workingCount} jadwal shift`}
          </span>
        </div>
        <div className="panel-body" style={{ paddingTop: 12 }}>
          {rosterNotFound ? (
            <div className="empty-state">
              <p>Belum ada roster untuk bulan ini.</p>
              <p className="faint text-sm">
                Buka menu <strong>Roster ATC</strong> untuk generate dulu.
              </p>
            </div>
          ) : rosterToday.length === 0 && !rosterLoading ? (
            <div className="empty-state">
              <p className="faint text-sm">Roster tidak punya data untuk hari ini.</p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 10,
            }}>
              {rosterToday.map((entry, i) => {
                // Sector & CWP options untuk unit personel ini
                const entryUnitSectors = mySectors.filter(s => s.unit === entry.unit)
                const cwpOptionsBySector = entryUnitSectors.map(s =>
                  s.cwps && s.cwps.length > 0 ? s.cwps : ["Controller", "Assistant"]
                )
                return (
                  <RosterPersonCard
                    key={`${entry.personnel_id}-${entry.unit}-${i}`}
                    entry={entry}
                    isOnMic={isPersonOnMic(entry)}
                    onQuickOnMic={onQuickOnMic}
                    saving={saving}
                    sectorOptions={entryUnitSectors}
                    cwpOptionsBySector={cwpOptionsBySector}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* INPUT BANNER — manual override / emergency */}
      <details className="input-banner" style={{ padding: 0 }}>
        <summary style={{
          padding: "12px 16px", cursor: "pointer",
          listStyle: "none", fontWeight: 600,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span><I n="mic" s={16}/> Input Manual / Override</span>
          <span className="muted text-sm">Shift {getShift()}</span>
        </summary>
        <div style={{ padding: "0 16px 16px" }}>
          <p className="muted text-sm" style={{ marginBottom: 8 }}>
            Pakai form ini untuk personel di luar roster (mis. lembur, ganti shift mendadak).
          </p>
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
      </details>

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
              <p className="faint text-sm">Klik <strong>On Mic</strong> di card roster di atas</p>
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
