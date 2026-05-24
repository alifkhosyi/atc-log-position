// ============================================================
// src/pages/cabang/RekapTraffic.jsx — Traffic recap (REDESIGN)
// ──────────────────────────────────────────────────────────
// No dedicated mockup file — apply same pattern as Rekap Personnel
// (period chips + filter row + stats + chart panels + detail table).
//
// Logic preserved exactly from original:
//   - myLogs filter (off_time AND has traffic > 0)
//   - period filter (today/week/month)
//   - filterName + filterSector text matches
//   - totals reduce shape
//   - byDate breakdown for trend chart
//   - bySector aggregation for per-sector bar chart
//   - SVG trend line rendering
//   - exportCSV (same column shape)
// New affordances:
//   - Period chips replace .filter-bar
//   - Stack chart per-sektor (DEP/ARR/OVF stacked horizontally)
//   - Stack legend in chart header
//   - Toast on CSV export
// ============================================================
import React, { useState } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, getAccessibleBranches } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Stat } from "../../components/Stat.jsx"
import { useToast } from "../../components/Toast.jsx"

export const CabangRekap = () => {
  const ctx = useApp()
  const toast = useToast()

  // ── Same filter as original ──
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myLogs = ctx.logs.filter(l =>
    myBranches.includes(l.branch_code) && l.off_time &&
    ((l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)) > 0
  )

  // ── State ──
  const [period, setPeriod] = useState("month")
  const [filterName, setFilterName] = useState("")
  const [filterSector, setFilterSector] = useState("")

  // ── Filtered + sorted (same as original) ──
  const filtered = myLogs.filter(l => {
    const d = (new Date() - new Date(l.on_time)) / 864e5
    const pOk = period === "today"
      ? new Date(l.on_time).toDateString() === new Date().toDateString()
      : period === "week" ? d <= 7 : d <= 30
    const nmOk  = !filterName   || (l.atc_name || "").toLowerCase().includes(filterName.toLowerCase())
    const secOk = !filterSector || (l.sector   || "").toLowerCase().includes(filterSector.toLowerCase())
    return pOk && nmOk && secOk
  }).sort((a, b) => new Date(b.on_time) - new Date(a.on_time))

  // ── Totals + aggregations (preserved) ──
  const totals = filtered.reduce((a, l) => ({
    dep: a.dep + (l.departure_count || 0),
    arr: a.arr + (l.arrival_count || 0),
    ovf: a.ovf + (l.overfly_count || 0),
    tc:  a.tc  + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0),
  }), { dep: 0, arr: 0, ovf: 0, tc: 0 })

  const byDate = {}
  filtered.forEach(l => {
    const dt = new Date(l.on_time).toISOString().slice(0, 10)
    if (!byDate[dt]) byDate[dt] = { dep: 0, arr: 0, ovf: 0 }
    byDate[dt].dep += l.departure_count || 0
    byDate[dt].arr += l.arrival_count   || 0
    byDate[dt].ovf += l.overfly_count   || 0
  })
  const dates = Object.keys(byDate).sort()
  const chartMax = Math.max(1, ...dates.map(d => byDate[d].dep + byDate[d].arr + byDate[d].ovf))

  const bySector = {}
  filtered.forEach(l => {
    const sk = l.unit + " — " + l.sector
    if (!bySector[sk]) bySector[sk] = { dep: 0, arr: 0, ovf: 0 }
    bySector[sk].dep += l.departure_count || 0
    bySector[sk].arr += l.arrival_count   || 0
    bySector[sk].ovf += l.overfly_count   || 0
  })
  const sectorKeys = Object.keys(bySector).sort((a, b) =>
    (bySector[b].dep + bySector[b].arr + bySector[b].ovf) -
    (bySector[a].dep + bySector[a].arr + bySector[a].ovf)
  )
  const sectorMax = Math.max(1, ...sectorKeys.map(k =>
    bySector[k].dep + bySector[k].arr + bySector[k].ovf
  ))

  const periodLabel = period === "today"
    ? "Hari ini"
    : period === "week" ? "7 hari terakhir" : "30 hari terakhir"

  // ── Export CSV (preserved + Toast) ──
  const exportCSV = () => {
    const head = ["Tanggal","On","Off","Controller","Unit","Sektor","Shift","DEP","ARR","OVF","Total"]
    const rows = filtered.map(l => {
      const dt = new Date(l.on_time).toISOString().slice(0, 10)
      return [dt, fmtT(l.on_time), fmtT(l.off_time),
        l.atc_name || "", l.unit || "", l.sector || "", l.shift || "",
        l.departure_count || 0, l.arrival_count || 0, l.overfly_count || 0,
        (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)]
    })
    const csv = [head.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `rekap_traffic_${ctx.user.branch_code}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Export berhasil", `${filtered.length} laporan diunduh sebagai CSV`)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Rekap Traffic</h1>
          <p className="topbar-sub">
            Data traffic per sektor — Cabang {ctx.user.branch_code} · {periodLabel}
          </p>
        </div>
        <button className="btn btn-sm" onClick={exportCSV} disabled={filtered.length === 0}>
          <I n="download" s={14}/> Export CSV
        </button>
      </div>

      {/* PERIOD + FILTERS */}
      <div className="row" style={{ marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div className="period-chips">
          <button
            className={"period-chip" + (period === "today" ? " active" : "")}
            onClick={() => setPeriod("today")}
          >Hari Ini</button>
          <button
            className={"period-chip" + (period === "week" ? " active" : "")}
            onClick={() => setPeriod("week")}
          >7 Hari</button>
          <button
            className={"period-chip" + (period === "month" ? " active" : "")}
            onClick={() => setPeriod("month")}
          >30 Hari</button>
        </div>
        <input
          className="filter-input"
          placeholder="Filter controller..."
          value={filterName}
          onChange={e => setFilterName(e.target.value)}
        />
        <input
          className="filter-input"
          style={{ width: 140, minWidth: 100 }}
          placeholder="Filter sektor..."
          value={filterSector}
          onChange={e => setFilterSector(e.target.value)}
        />
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <Stat
          icon="plane" label="Total Traffic" value={totals.tc}
          sub={`${filtered.length} laporan`}
          color="var(--status-on)"
        />
        <Stat icon="upload"   label="Departure" value={totals.dep} color="var(--traffic-dep)"/>
        <Stat icon="download" label="Arrival"   value={totals.arr} color="var(--traffic-arr)"/>
        <Stat icon="radar"    label="Overfly"   value={totals.ovf} color="var(--text-faint)"/>
      </div>

      {/* PER-SECTOR STACKED BAR */}
      {sectorKeys.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <I n="chart" s={16}/> Traffic per Sektor
            </h2>
            <div className="stack-legend">
              <span className="stack-legend-item">
                <span className="stack-legend-swatch" style={{ background: "var(--traffic-dep)" }}/>
                DEP
              </span>
              <span className="stack-legend-item">
                <span className="stack-legend-swatch" style={{ background: "var(--traffic-arr)" }}/>
                ARR
              </span>
              <span className="stack-legend-item">
                <span className="stack-legend-swatch" style={{ background: "var(--text-faint)" }}/>
                OVF
              </span>
            </div>
          </div>
          <div className="panel-body">
            <div className="stack-chart">
              {sectorKeys.map(sk => {
                const s = bySector[sk]
                const t = s.dep + s.arr + s.ovf
                const fullPct = (t / sectorMax) * 100
                // Each segment's width *within the bar* is proportional to t,
                // and the whole bar's width is proportional to fullPct of track.
                const depPct = t > 0 ? (s.dep / t * fullPct) : 0
                const arrPct = t > 0 ? (s.arr / t * fullPct) : 0
                const ovfPct = t > 0 ? (s.ovf / t * fullPct) : 0
                return (
                  <div key={sk} className="stack-row">
                    <span className="stack-label">{sk}</span>
                    <div className="stack-track">
                      {depPct > 0 && (
                        <div className="stack-seg stack-seg-dep"
                             style={{ width: depPct + "%" }}
                             title={`DEP: ${s.dep}`}>
                          {s.dep > 0 && depPct > 6 ? s.dep : ""}
                        </div>
                      )}
                      {arrPct > 0 && (
                        <div className="stack-seg stack-seg-arr"
                             style={{ width: arrPct + "%" }}
                             title={`ARR: ${s.arr}`}>
                          {s.arr > 0 && arrPct > 6 ? s.arr : ""}
                        </div>
                      )}
                      {ovfPct > 0 && (
                        <div className="stack-seg stack-seg-ovf"
                             style={{ width: ovfPct + "%" }}
                             title={`OVF: ${s.ovf}`}>
                          {s.ovf > 0 && ovfPct > 6 ? s.ovf : ""}
                        </div>
                      )}
                    </div>
                    <span className="stack-total">{t}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* DAILY TREND SVG (preserved logic from original) */}
      {dates.length > 1 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <I n="chart" s={16}/> Trend Harian
            </h2>
          </div>
          <div className="panel-body">
            <svg viewBox="0 0 680 200" width="100%" style={{ display: "block" }}>
              {[0, .25, .5, .75, 1].map(f => {
                const y = 16 + (1 - f) * 150
                return (
                  <line key={f} x1="46" y1={y} x2="664" y2={y}
                        stroke="var(--border)" strokeWidth=".5"/>
                )
              })}
              {(() => {
                const pts = dates.map((d, i) => ({
                  x: 46 + (dates.length === 1 ? 309 : (i / (dates.length - 1)) * 618),
                  y: 16 + (1 - (byDate[d].dep + byDate[d].arr + byDate[d].ovf) / chartMax) * 150,
                  v: byDate[d].dep + byDate[d].arr + byDate[d].ovf,
                  d,
                }))
                const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
                return (
                  <>
                    <path
                      d={`${pathD} L${pts[pts.length - 1].x},166 L${pts[0].x},166 Z`}
                      fill="var(--traffic-dep)" opacity=".1"
                    />
                    <path
                      d={pathD} fill="none"
                      stroke="var(--traffic-dep)" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                    />
                    {pts.map((p, i) => (
                      <g key={i}>
                        <circle cx={p.x} cy={p.y} r="4"
                                fill="var(--bg2)"
                                stroke="var(--traffic-dep)" strokeWidth="2"/>
                        <text x={p.x} y={p.y - 10} textAnchor="middle"
                              fontSize="10" fontWeight="600"
                              fill="var(--traffic-dep)">{p.v}</text>
                        <text x={p.x} y={185} textAnchor="middle"
                              fontSize="9" fill="var(--text-muted)">
                          {p.d.slice(5)}
                        </text>
                      </g>
                    ))}
                  </>
                )
              })()}
            </svg>
          </div>
        </div>
      )}

      {/* DETAIL TABLE */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Data Detail</h2>
          <span className="panel-counter">{filtered.length} log</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <p>Tidak ada data untuk filter ini</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>On–Off</th>
                    <th>Controller</th>
                    <th>Unit</th>
                    <th>Sektor</th>
                    <th>Shift</th>
                    <th className="center">DEP</th>
                    <th className="center">ARR</th>
                    <th className="center">OVF</th>
                    <th className="center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => {
                    const tc = (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)
                    return (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtD(l.on_time)}</td>
                        <td className="muted mono" style={{ whiteSpace: "nowrap" }}>
                          {fmtT(l.on_time)}–{fmtT(l.off_time)}
                        </td>
                        <td><strong>{l.atc_name || "-"}</strong></td>
                        <td><span className="unit-tag">{l.unit}</span></td>
                        <td>{l.sector || "-"}</td>
                        <td className="muted">{l.shift || "-"}</td>
                        <td className="td-dep">{l.departure_count || 0}</td>
                        <td className="td-arr">{l.arrival_count || 0}</td>
                        <td className="td-ovf">{l.overfly_count || 0}</td>
                        <td className="center mono"><strong>{tc}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: "var(--bg3)" }}>
                    <td colSpan={6} style={{ textAlign: "right", color: "var(--text-muted)" }}>TOTAL</td>
                    <td className="td-dep">{totals.dep}</td>
                    <td className="td-arr">{totals.arr}</td>
                    <td className="td-ovf">{totals.ovf}</td>
                    <td className="center mono"><strong>{totals.tc}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
