// ============================================================
// src/pages/cabang/Dashboard.jsx — Cabang dashboard (REDESIGN)
// ──────────────────────────────────────────────────────────
// Visual: Dashboard Redesign.html mockup
// Logic preserved: same myBranches/active/today/todayTC compute
// New actions: Refresh, Off-Mic (non-Controller only), Delete row
// Controller off-mic still routes to Log Position (traffic input there)
// ============================================================
import React, { useState } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import {
  fmtT, durMin, getShift,
  getAccessibleBranches, logAudit,
} from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"

const isControllerCwp = (cwp) => (cwp || "").toLowerCase().includes("controller")

export const CabangDash = () => {
  const ctx = useApp()
  const toast = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState(false)

  // ── Computed (preserved from original) ──
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const active = ctx.logs.filter(l => !l.off_time && myBranches.includes(l.branch_code))
  const today = ctx.logs.filter(l =>
    myBranches.includes(l.branch_code) &&
    new Date(l.on_time).toDateString() === new Date().toDateString()
  )
  const todayTC = today
    .filter(l => l.off_time)
    .reduce((a,l) => a + (l.departure_count||0) + (l.arrival_count||0) + (l.overfly_count||0), 0)
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || { name:"", city:"", units:[] }

  // ── Refresh handler ──
  const onRefresh = async () => {
    if (busy) return
    setBusy(true)
    toast.info("Memuat ulang…", "Sinkronisasi data dari server")
    try {
      await ctx.reload()
      toast.success("Data diperbarui",
        `${active.length} posisi aktif · ${today.length} log hari ini`)
    } catch (e) {
      toast.error("Gagal memuat ulang", e?.message || "Coba lagi")
    } finally {
      setBusy(false)
    }
  }

  // ── Off mic from dashboard ──
  // Controller needs traffic input → redirect to Log Position page
  // Non-Controller (Assistant) → confirm + direct off
  const onOffMic = async (log) => {
    if (busy) return
    if (isControllerCwp(log.cwp)) {
      toast.info("Lapor traffic dulu",
        "Controller harus laporkan DEP/ARR/OVF di halaman Log Position")
      ctx.goPage("log")
      return
    }
    const ok = await confirm({
      title: "Off mic sekarang?",
      detail: "Posisi akan ditutup. Data tidak bisa dibatalkan dari sini.",
      target: `${log.atc_name} · ${log.unit} ${log.sector} · On ${fmtT(log.on_time)}`,
      confirmText: "Off Mic",
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    const { error } = await supabase
      .from("position_logs")
      .update({ off_time: new Date().toISOString() })
      .eq("id", log.id)
    if (error) {
      toast.error("Gagal off mic", error.message)
    } else {
      logAudit("OFF_MIC",
        `${log.atc_name} — ${log.unit} ${log.sector} (dashboard, no traffic)`,
        ctx.user)
      toast.success("Off mic berhasil",
        `${log.atc_name} — durasi ${durMin(log.on_time, new Date().toISOString())} menit`)
      await ctx.reload()
    }
    setBusy(false)
  }

  // ── Delete log row ──
  const onDeleteLog = async (log) => {
    if (busy) return
    const ok = await confirm({
      title: "Hapus log ini?",
      detail: "Data akan hilang permanen dan tidak masuk laporan harian.",
      target: `${log.atc_name} · ${log.unit} · ${fmtT(log.on_time)}–${log.off_time ? fmtT(log.off_time) : "now"}`,
      confirmText: "Hapus log",
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
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
    setBusy(false)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Dashboard</h1>
          <p className="topbar-sub">
            {br.name || ctx.user.branch_code} ({ctx.user.branch_code})
            {br.city ? " — " + br.city : ""}
          </p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-sm" onClick={onRefresh} disabled={busy}>
            <I n="refresh" s={14}/> Refresh
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => ctx.goPage("log")}>
            <I n="mic" s={14}/> Input On Mic
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <Stat icon="mic"   label="On Mic"        value={active.length}
              sub="Saat ini" color="var(--status-on)"/>
        <Stat icon="log"   label="Log Hari Ini"  value={today.length}
              sub={"Shift " + getShift()} color="var(--accent)"/>
        <Stat icon="plane" label="Traffic Total" value={todayTC}
              sub="DEP + ARR + OVF" color="var(--status-warn)"/>
        <Stat icon="tower" label="Unit"          value={br.units?.length ? br.units.join(" · ") : "-"}
              sub={(br.units?.length || 0) + " unit aktif"} color="var(--purple)"/>
      </div>

      {/* POSISI AKTIF */}
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
              <button className="btn btn-sm btn-primary" onClick={() => ctx.goPage("log")}>
                <I n="mic" s={14}/> Input ATC pertama
              </button>
            </div>
          ) : (
            <div className="position-grid">
              {active.map(l => (
                <div key={l.id} className="position-card">
                  <div className="row" style={{ marginBottom:6 }}>
                    <Pulse s={7}/>
                    <span className="position-unit">{l.unit}</span>
                    <span className="position-sector">· {l.sector}</span>
                  </div>
                  <div className="position-cwp">{l.cwp}</div>
                  <div className="position-name">{l.atc_name}</div>
                  <div className="position-card-actions">
                    <span className="position-time mono">
                      {fmtT(l.on_time)} ·{" "}
                      <span style={{ color: "var(--status-on)" }}>
                        {durMin(l.on_time, new Date().toISOString())}m
                      </span>
                    </span>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => onOffMic(l)}
                      disabled={busy}
                      style={{ padding: "4px 10px" }}
                      title={isControllerCwp(l.cwp)
                        ? "Lapor traffic di halaman Log Position"
                        : "Off mic langsung"}
                    >
                      <I n="micOff" s={12}/> Off
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TIMELINE HARI INI */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Timeline Hari Ini</h2>
          <span className="panel-counter">{today.length} log</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {today.length === 0 ? (
            <div className="empty-state"><p>Belum ada log</p></div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Unit</th>
                    <th>Sektor</th>
                    <th>CWP</th>
                    <th>On</th>
                    <th>Off</th>
                    <th>Durasi</th>
                    <th>DEP</th>
                    <th>ARR</th>
                    <th>OVF</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {today.map(l => (
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
                          disabled={busy}
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
