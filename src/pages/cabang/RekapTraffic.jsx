// ============================================================
// src/pages/cabang/RekapTraffic.jsx — Traffic recap (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: Rekap_Traffic_Redesign.html mockup
//
// Logic preserved exactly from original:
//   - getAccessibleBranches hierarchy filter (MO supports sub-branches)
//   - myLogs filter (off_time AND has traffic > 0)
//   - period filter (today/week/month)
//   - filterName + filterSector text matches
//   - totals reduce shape
//   - byDate breakdown for trend chart
//   - bySector aggregation for per-sector bar chart
//   - exportCSV (same column shape)
// New affordances from mockup:
//   - .filter-row wrapper with .input-wrap + .input-wrap-ic for search icon
//   - .date-range-info bar
//   - Stat cards with % trend vs previous period
//   - Top Sektor list dengan rank + stacked bar + per-metric breakdown
//   - Detail Log table dengan format mockup (date+time dual line, unit-tag)
//   - Reset filter button
// ============================================================
import React, { useState, useMemo } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, getAccessibleBranches, durMin } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
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

  const now = new Date()

  // ── Filtered + sorted (same as original) ──
  const filtered = useMemo(() => myLogs.filter(l => {
    const d = (now - new Date(l.on_time)) / 864e5
    const pOk = period === "today"
      ? new Date(l.on_time).toDateString() === now.toDateString()
      : period === "week" ? d <= 7 : d <= 30
    const nmOk  = !filterName   || (l.atc_name || "").toLowerCase().includes(filterName.toLowerCase())
    const secOk = !filterSector || ((l.unit || "") + " " + (l.sector || "")).toLowerCase().includes(filterSector.toLowerCase())
    return pOk && nmOk && secOk
  }).sort((a, b) => new Date(b.on_time) - new Date(a.on_time)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myLogs, period, filterName, filterSector])

  // ── Totals + aggregations (preserved) ──
  const totals = useMemo(() => filtered.reduce((a, l) => ({
    dep: a.dep + (l.departure_count || 0),
    arr: a.arr + (l.arrival_count || 0),
    ovf: a.ovf + (l.overfly_count || 0),
    tc:  a.tc  + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0),
  }), { dep: 0, arr: 0, ovf: 0, tc: 0 }), [filtered])

  // ── Previous period comparison ──
  const prevPeriodTotal = useMemo(() => {
    const days = period === "today" ? 1 : period === "week" ? 7 : 30
    return myLogs.filter(l => {
      const d = (now - new Date(l.on_time)) / 864e5
      return d > days && d <= days * 2
    }).reduce((a, l) => a + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLogs, period])
  const trafficTrend = prevPeriodTotal > 0 ? Math.round((totals.tc - prevPeriodTotal) / prevPeriodTotal * 100) : 0

  // ── By date (for trend chart) ──
  const byDate = useMemo(() => {
    const m = {}
    filtered.forEach(l => {
      const dt = new Date(l.on_time).toISOString().slice(0, 10)
      if (!m[dt]) m[dt] = { dep: 0, arr: 0, ovf: 0 }
      m[dt].dep += l.departure_count || 0
      m[dt].arr += l.arrival_count || 0
      m[dt].ovf += l.overfly_count || 0
    })
    return m
  }, [filtered])
  const dates = Object.keys(byDate).sort()
  const chartMax = Math.max(1, ...dates.map(d => byDate[d].dep + byDate[d].arr + byDate[d].ovf))

  // ── By sector (for top-sector list) ──
  const bySector = useMemo(() => {
    const m = {}
    filtered.forEach(l => {
      const k = (l.unit || "—") + " — " + (l.sector || "—")
      if (!m[k]) m[k] = { dep: 0, arr: 0, ovf: 0 }
      m[k].dep += l.departure_count || 0
      m[k].arr += l.arrival_count || 0
      m[k].ovf += l.overfly_count || 0
    })
    return m
  }, [filtered])
  const sectorKeys = Object.keys(bySector).sort((a, b) =>
    (bySector[b].dep + bySector[b].arr + bySector[b].ovf) -
    (bySector[a].dep + bySector[a].arr + bySector[a].ovf)
  )
  const sectorMax = Math.max(1, ...sectorKeys.map(k => bySector[k].dep + bySector[k].arr + bySector[k].ovf))

  // ── Date range label ──
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d }
  const dateRange = period === "today"
    ? now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : period === "week"
      ? `${daysAgo(6).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} — ${now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
      : `${daysAgo(29).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} — ${now.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`

  const resetFilters = () => { setFilterName(""); setFilterSector(""); setPeriod("month") }

  // ── Export CSV (same shape as original) ──
  const exportCSV = () => {
    const head = ["Tanggal", "On Time", "Off Time", "Nama ATC", "Unit", "Sektor", "Shift", "DEP", "ARR", "OVF", "Total"]
    const rows = filtered.map(l => {
      const dt = new Date(l.on_time)
      return [dt.toISOString().slice(0, 10), fmtT(l.on_time), fmtT(l.off_time),
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
    toast.success("Export berhasil", `${filtered.length} log diunduh sebagai CSV`)
  }

  const branchObj = ctx.branches.find(b => b.code === ctx.user.branch_code)
  const branchName = branchObj ? `${branchObj.name} (${branchObj.code})` : ctx.user.branch_code

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Rekap Traffic</div>
          <div className="topbar-sub">Detail traffic cabang {branchName}</div>
        </div>
        <button className="btn btn-sm" onClick={exportCSV} disabled={filtered.length === 0}>
          <I n="download" s={14}/> Export CSV
        </button>
      </div>

      {/* FILTER ROW */}
      <div className="filter-row">
        <div className="period-chips">
          <button className={"period-chip" + (period === "today" ? " active" : "")} onClick={() => setPeriod("today")}>Hari Ini</button>
          <button className={"period-chip" + (period === "week" ? " active" : "")} onClick={() => setPeriod("week")}>Minggu Ini</button>
          <button className={"period-chip" + (period === "month" ? " active" : "")} onClick={() => setPeriod("month")}>Bulan Ini</button>
        </div>
        <div className="input-wrap">
          <span className="input-wrap-ic"><I n="search" s={14}/></span>
          <input className="filter-input" placeholder="Cari nama ATC..."
                 value={filterName} onChange={e => setFilterName(e.target.value)}/>
        </div>
        <div className="input-wrap">
          <span className="input-wrap-ic"><I n="search" s={14}/></span>
          <input className="filter-input" placeholder="Cari unit/sektor..."
                 value={filterSector} onChange={e => setFilterSector(e.target.value)}/>
        </div>
        {(filterName || filterSector || period !== "month") && (
          <button className="btn btn-sm btn-ghost" onClick={resetFilters}>Reset</button>
        )}
      </div>

      {/* DATE RANGE INFO */}
      <div className="date-range-info">
        Periode: <strong>{dateRange}</strong> · {filtered.length} log
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="plane" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Total Traffic</div>
            <div className="stat-v">{totals.tc.toLocaleString()}</div>
            <div className="stat-sub">
              {trafficTrend !== 0 && (
                <>
                  <span style={{ color: trafficTrend > 0 ? "var(--status-on)" : "var(--status-alert)", fontWeight: 600 }}>
                    {trafficTrend > 0 ? "▲" : "▼"} {Math.abs(trafficTrend)}%
                  </span>
                  <span> vs periode sebelumnya</span>
                </>
              )}
              {trafficTrend === 0 && <span>{filtered.length} log</span>}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--traffic-dep)" }}>
            <I n="upload" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Departure</div>
            <div className="stat-v" style={{ color: "var(--traffic-dep)" }}>{totals.dep.toLocaleString()}</div>
            <div className="stat-sub">{totals.tc > 0 ? Math.round(totals.dep / totals.tc * 100) : 0}% dari total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-warn-soft)", color: "var(--traffic-arr)" }}>
            <I n="download" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Arrival</div>
            <div className="stat-v" style={{ color: "var(--traffic-arr)" }}>{totals.arr.toLocaleString()}</div>
            <div className="stat-sub">{totals.tc > 0 ? Math.round(totals.arr / totals.tc * 100) : 0}% dari total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-off-soft)", color: "var(--traffic-ovf)" }}>
            <I n="radar" s={20}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="stat-l">Overfly</div>
            <div className="stat-v" style={{ color: "var(--traffic-ovf)" }}>{totals.ovf.toLocaleString()}</div>
            <div className="stat-sub">{totals.tc > 0 ? Math.round(totals.ovf / totals.tc * 100) : 0}% dari total</div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="panel">
          <div className="panel-body">
            <div className="empty-state">
              <I n="plane" s={44}/>
              <p>Belum ada traffic untuk periode ini</p>
              <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={resetFilters}>Reset Filter</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* TREND CHART */}
          {dates.length > 1 && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title"><I n="chart" s={16}/> Trend Traffic Harian</h2>
                <span className="panel-counter">{dates.length} hari</span>
              </div>
              <div className="panel-body">
                <div className="trend-chart-wrap">
                  <svg viewBox={`0 0 ${dates.length * 28 + 60} 200`} width="100%" style={{ display: "block", minWidth: dates.length * 28 }}>
                    {[0, .25, .5, .75, 1].map(f => {
                      const y = 10 + (1 - f) * 150
                      const v = Math.round(chartMax * f)
                      return (
                        <g key={f}>
                          <line x1="40" y1={y} x2={dates.length * 28 + 40} y2={y} stroke="var(--border-subtle)" strokeWidth="1"/>
                          <text x="36" y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-faint)" fontFamily="var(--font-mono)">{v}</text>
                        </g>
                      )
                    })}
                    {dates.map((d, i) => {
                      const total = byDate[d].dep + byDate[d].arr + byDate[d].ovf
                      if (total === 0) return null
                      const barH = (total / chartMax) * 150
                      const x = 50 + i * 28
                      const depH = (byDate[d].dep / total) * barH
                      const arrH = (byDate[d].arr / total) * barH
                      const ovfH = (byDate[d].ovf / total) * barH
                      const isToday = d === now.toISOString().slice(0, 10)
                      return (
                        <g key={i}>
                          <rect x={x} y={160 - barH} width={20} height={depH} fill="var(--traffic-dep)" rx="1"/>
                          <rect x={x} y={160 - barH + depH} width={20} height={arrH} fill="var(--traffic-arr)"/>
                          <rect x={x} y={160 - barH + depH + arrH} width={20} height={ovfH} fill="var(--traffic-ovf)"/>
                          {isToday && <rect x={x - 1} y={160 - barH - 1} width={22} height={barH + 2} fill="none" stroke="var(--accent)" strokeWidth="1.5" rx="2"/>}
                          <text x={x + 10} y={160 - barH - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={isToday ? "var(--accent)" : "var(--text-faint)"} fontFamily="var(--font-mono)">{total}</text>
                          {(i % 3 === 0 || i === dates.length - 1) && (
                            <text x={x + 10} y={178} textAnchor="middle" fontSize="9" fill="var(--text-faint)" fontFamily="var(--font-mono)">{d.slice(5)}</text>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                  <div className="chart-legend">
                    <div className="chart-legend-item"><div className="chart-legend-swatch" style={{ background: "var(--traffic-dep)" }}/> DEP</div>
                    <div className="chart-legend-item"><div className="chart-legend-swatch" style={{ background: "var(--traffic-arr)" }}/> ARR</div>
                    <div className="chart-legend-item"><div className="chart-legend-swatch" style={{ background: "var(--traffic-ovf)" }}/> OVF</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TOP SEKTOR */}
          {sectorKeys.length > 0 && (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title"><I n="chart" s={16}/> Top Sektor</h2>
                <span className="panel-counter">{sectorKeys.length} sektor</span>
              </div>
              <div className="panel-body">
                <div className="sector-list">
                  {sectorKeys.slice(0, 10).map((sk, i) => {
                    const d = bySector[sk]
                    const t = d.dep + d.arr + d.ovf
                    const pct = (t / sectorMax) * 100
                    return (
                      <div key={sk} className={"sector-row " + (i === 0 ? "top-1" : i < 3 ? "top-3" : "")}>
                        <div className="sector-rank">{(i + 1).toString().padStart(2, "0")}</div>
                        <div>
                          <div className="sector-name">{sk}</div>
                          <div className="sector-bar-wrap" style={{ marginTop: 4 }}>
                            <div className="sector-bar-stack" style={{ width: `${pct}%` }}>
                              <div className="sector-bar-seg" style={{ width: `${d.dep / t * 100}%`, background: "var(--traffic-dep)" }}/>
                              <div className="sector-bar-seg" style={{ width: `${d.arr / t * 100}%`, background: "var(--traffic-arr)" }}/>
                              <div className="sector-bar-seg" style={{ width: `${d.ovf / t * 100}%`, background: "var(--traffic-ovf)" }}/>
                            </div>
                          </div>
                        </div>
                        <div className="sector-metric"><span className="l">DEP</span><span style={{ color: "var(--traffic-dep)" }}>{d.dep}</span></div>
                        <div className="sector-metric"><span className="l">ARR</span><span style={{ color: "var(--traffic-arr)" }}>{d.arr}</span></div>
                        <div className="sector-metric"><span className="l">OVF</span><span style={{ color: "var(--traffic-ovf)" }}>{d.ovf}</span></div>
                        <div className="sector-metric"><span className="l">Total</span><span style={{ color: "var(--text)", fontWeight: 800 }}>{t}</span></div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* DETAIL LOG TABLE */}
          <div className="panel">
            <div className="panel-header">
              <h2 className="panel-title">Detail Log</h2>
              <span className="panel-counter">{filtered.length}</span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Nama ATC</th>
                      <th>Unit</th>
                      <th>Sektor</th>
                      <th>Shift</th>
                      <th>Durasi</th>
                      <th className="traffic-cell">DEP</th>
                      <th className="traffic-cell">ARR</th>
                      <th className="traffic-cell">OVF</th>
                      <th className="traffic-cell">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 100).map(l => {
                      const tc = (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)
                      return (
                        <tr key={l.id}>
                          <td style={{ whiteSpace: "nowrap" }}>
                            <strong>{fmtD(l.on_time)}</strong>
                            <div className="mono faint" style={{ fontSize: 11 }}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</div>
                          </td>
                          <td><strong>{l.atc_name}</strong></td>
                          <td><span className="unit-tag">{l.unit}</span></td>
                          <td>{l.sector}</td>
                          <td className="mono">{l.shift}</td>
                          <td className="mono">{durMin(l.on_time, l.off_time)}m</td>
                          <td className="traffic-cell dep-cell">{l.departure_count || <span className="faint">—</span>}</td>
                          <td className="traffic-cell arr-cell">{l.arrival_count || <span className="faint">—</span>}</td>
                          <td className="traffic-cell ovf-cell">{l.overfly_count || <span className="faint">—</span>}</td>
                          <td className="traffic-cell total-cell">{tc}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={6} style={{ textAlign: "right", color: "var(--text-muted)" }}>TOTAL</td>
                      <td className="traffic-cell dep-cell">{totals.dep}</td>
                      <td className="traffic-cell arr-cell">{totals.arr}</td>
                      <td className="traffic-cell ovf-cell">{totals.ovf}</td>
                      <td className="traffic-cell total-cell" style={{ color: "var(--accent)", fontSize: "var(--fs-md)" }}>{totals.tc}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {filtered.length > 100 && (
                <div style={{ padding: 12, textAlign: "center", fontSize: "var(--fs-sm)", color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
                  Menampilkan 100 terbaru dari {filtered.length} log · Export CSV untuk data lengkap
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
