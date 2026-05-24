// ============================================================
// src/pages/admin/MonRecap.jsx — INMC Monitoring Rekap Traffic (REDESIGN — Mockup-driven)
// ──────────────────────────────────────────────────────────
// Visual: Admin_MonRecap_Redesign.html mockup
//
// Logic preserved:
//   - br state from ctx.globalBranch
//   - period filter (today/week/month) with same date math
//   - filtered logs (off_time != null AND traffic > 0)
//   - byBr aggregation per branch
//   - bySector aggregation per sektor within branch
//   - exportCSV preserved
// New affordances from mockup:
//   - Topbar + INMC sticky toolbar (BranchPicker + filter pill + period chips)
//   - Stats grid (4 cards) with % trend vs previous period
//   - RegionCard component (West/East summary when ALL branches)
//   - Trend chart panel (SVG stacked bars with grid lines)
//   - Per-branch breakdown panel with expandable rows
//   - Expanded row shows per-sektor breakdown with proportional bars
// ============================================================
import React, { useState, useMemo } from "react"
import { useApp } from "../../lib/context.jsx"
import { I } from "../../components/Icons.jsx"
import { BranchPicker } from "../../components/BranchPicker.jsx"
import { useToast } from "../../components/Toast.jsx"

const RegionCard = ({ region, color, regionAgg }) => {
  const r = regionAgg[region]
  const totRegion = Math.max(1, regionAgg.west.tc + regionAgg.east.tc)
  return (
    <div className={"region-card " + region}>
      <div className="region-head">
        <div className={"region-name " + region}>
          <I n="pin" s={16}/> {region === "west" ? "West Region" : "East Region"}
        </div>
        <span className="muted" style={{ fontSize: "var(--fs-xs)", fontFamily: "var(--font-mono)" }}>
          {r.activeBranches}/{r.branches} aktif
        </span>
      </div>
      <div className="region-traffic">{r.tc.toLocaleString()}</div>
      <div className="region-traffic-sub">
        <span style={{ color: "var(--traffic-dep)" }}>{r.dep} D</span> ·
        <span style={{ color: "var(--traffic-arr)" }}> {r.arr} A</span> ·
        <span style={{ color: "var(--traffic-ovf)" }}> {r.ovf} O</span> ·
        <span> {Math.round(r.tc / totRegion * 100)}% dari total</span>
      </div>
      <div className="region-top">
        <div className="region-top-h">Top 3 Cabang</div>
        <div className="region-top-list">
          {r.topBranches.slice(0, 3).map(t => {
            const pct = r.topBranches[0].tc > 0 ? t.tc / r.topBranches[0].tc * 100 : 0
            return (
              <div key={t.code} className="region-top-item">
                <span className="region-top-code">{t.code}</span>
                <div className="region-top-bar">
                  <div className="region-top-bar-fill" style={{ width: `${pct}%`, background: color }}/>
                </div>
                <span className="region-top-val">{t.tc.toLocaleString()}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export const AdminMonRecap = () => {
  const ctx = useApp()
  const toast = useToast()
  const br = ctx.globalBranch || "ALL"
  const setBr = (v) => ctx.setGlobalBranch(v)

  const [period, setPeriod] = useState("today")
  const [expandBr, setExpandBr] = useState(null)
  const now = new Date()

  // Filter logs by period + branch
  const filtered = useMemo(() => ctx.logs.filter(l => {
    if (!l.off_time) return false
    const tc = (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)
    if (tc === 0) return false
    const d = (now - new Date(l.on_time)) / 864e5
    const pOk = period === "today"
      ? new Date(l.on_time).toDateString() === now.toDateString()
      : period === "week" ? d <= 7 : d <= 30
    return pOk && (br === "ALL" || l.branch_code === br)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ctx.logs, br, period])

  // Totals + previous period
  const totals = useMemo(() => filtered.reduce((a, l) => ({
    dep: a.dep + (l.departure_count || 0),
    arr: a.arr + (l.arrival_count || 0),
    ovf: a.ovf + (l.overfly_count || 0),
    tc:  a.tc  + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0),
  }), { dep: 0, arr: 0, ovf: 0, tc: 0 }), [filtered])

  const prevTotal = useMemo(() => {
    const days = period === "today" ? 1 : period === "week" ? 7 : 30
    return ctx.logs.filter(l => {
      if (!l.off_time) return false
      const d = (now - new Date(l.on_time)) / 864e5
      return d > days && d <= days * 2 && (br === "ALL" || l.branch_code === br)
    }).reduce((a, l) => a + (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.logs, br, period])
  const trend = prevTotal > 0 ? Math.round((totals.tc - prevTotal) / prevTotal * 100) : 0

  // By date for chart
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

  // By branch (with sector breakdown for expand)
  const branchData = useMemo(() => {
    const m = {}
    filtered.forEach(l => {
      const bc = l.branch_code
      if (!m[bc]) m[bc] = { dep: 0, arr: 0, ovf: 0, tc: 0, sectors: {} }
      const tc = (l.departure_count || 0) + (l.arrival_count || 0) + (l.overfly_count || 0)
      m[bc].dep += l.departure_count || 0
      m[bc].arr += l.arrival_count || 0
      m[bc].ovf += l.overfly_count || 0
      m[bc].tc += tc
      const sk = (l.unit || "—") + " — " + (l.sector || "—")
      if (!m[bc].sectors[sk]) m[bc].sectors[sk] = { dep: 0, arr: 0, ovf: 0 }
      m[bc].sectors[sk].dep += l.departure_count || 0
      m[bc].sectors[sk].arr += l.arrival_count || 0
      m[bc].sectors[sk].ovf += l.overfly_count || 0
    })
    return m
  }, [filtered])
  const allBr = useMemo(() => ctx.branches.filter(b => b.region), [ctx.branches])
  const brKeys = useMemo(() => {
    // Include all branches with region (show idle too)
    return allBr.map(b => b.code)
      .sort((a, c) => (branchData[c]?.tc || 0) - (branchData[a]?.tc || 0))
  }, [allBr, branchData])
  const brMax = useMemo(() => Math.max(1, ...Object.values(branchData).map(d => d.tc)), [branchData])

  // Region aggregation
  const regionAgg = useMemo(() => {
    const agg = {
      west: { tc: 0, dep: 0, arr: 0, ovf: 0, branches: 0, activeBranches: 0, topBranches: [] },
      east: { tc: 0, dep: 0, arr: 0, ovf: 0, branches: 0, activeBranches: 0, topBranches: [] },
    }
    allBr.forEach(b => {
      if (!agg[b.region]) return
      const d = branchData[b.code] || { tc: 0, dep: 0, arr: 0, ovf: 0 }
      agg[b.region].branches++
      if (d.tc > 0) {
        agg[b.region].activeBranches++
        agg[b.region].tc += d.tc
        agg[b.region].dep += d.dep
        agg[b.region].arr += d.arr
        agg[b.region].ovf += d.ovf
        agg[b.region].topBranches.push({ code: b.code, tc: d.tc })
      }
    })
    agg.west.topBranches.sort((a, b) => b.tc - a.tc)
    agg.east.topBranches.sort((a, b) => b.tc - a.tc)
    return agg
  }, [allBr, branchData])

  // brAct for BranchPicker
  const brAct = useMemo(() => {
    const m = {}
    ctx.logs.filter(l => !l.off_time).forEach(l => { m[l.branch_code] = (m[l.branch_code] || 0) + 1 })
    return m
  }, [ctx.logs])

  const exportCSV = () => {
    const head = ["Cabang", "Region", "DEP", "ARR", "OVF", "Total"]
    const rows = brKeys.map(code => {
      const b = allBr.find(x => x.code === code)
      const d = branchData[code] || { dep: 0, arr: 0, ovf: 0, tc: 0 }
      return [code, b?.region || "", d.dep, d.arr, d.ovf, d.tc]
    })
    const csv = [head.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `monitoring_rekap_traffic_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Export berhasil", `${brKeys.length} cabang diunduh sebagai CSV`)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Monitoring Rekap Traffic</div>
          <div className="topbar-sub">Detail traffic seluruh cabang{br === "ALL" ? "" : ` · ${br}`}</div>
        </div>
        <button className="btn btn-sm" onClick={exportCSV}>
          <I n="download" s={14}/> Export CSV
        </button>
      </div>

      {/* INMC TOOLBAR */}
      <div className="inmc-topbar">
        <div className="inmc-topbar-l">
          <BranchPicker value={br} onChange={setBr} branches={allBr} brAct={brAct}/>
          {br !== "ALL" && (
            <span className="filter-pill">
              <I n="eye" s={11}/> Filter: {br}
              <button className="filter-pill-x" onClick={() => setBr("ALL")} aria-label="Clear filter">×</button>
            </span>
          )}
        </div>
        <div className="inmc-topbar-l">
          <span className="monitor-label"><I n="eye" s={11}/> Monitoring</span>
          <div className="period-chips">
            <button className={"period-chip" + (period === "today" ? " active" : "")} onClick={() => setPeriod("today")}>Hari Ini</button>
            <button className={"period-chip" + (period === "week" ? " active" : "")} onClick={() => setPeriod("week")}>Minggu</button>
            <button className={"period-chip" + (period === "month" ? " active" : "")} onClick={() => setPeriod("month")}>Bulan</button>
          </div>
        </div>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            <I n="plane" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Total Traffic</div>
            <div className="stat-v">{totals.tc.toLocaleString()}</div>
            <div className="stat-sub">
              {trend !== 0 && (
                <>
                  <span style={{ color: trend > 0 ? "var(--status-on)" : "var(--status-alert)", fontWeight: 600 }}>
                    {trend > 0 ? "▲" : "▼"} {Math.abs(trend)}%
                  </span>
                  <span> vs sebelumnya</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--accent-soft)", color: "var(--traffic-dep)" }}>
            <I n="upload" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Departure</div>
            <div className="stat-v" style={{ color: "var(--traffic-dep)" }}>{totals.dep.toLocaleString()}</div>
            <div className="stat-sub">{totals.tc > 0 ? Math.round(totals.dep / totals.tc * 100) : 0}%</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-warn-soft)", color: "var(--traffic-arr)" }}>
            <I n="download" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Arrival</div>
            <div className="stat-v" style={{ color: "var(--traffic-arr)" }}>{totals.arr.toLocaleString()}</div>
            <div className="stat-sub">{totals.tc > 0 ? Math.round(totals.arr / totals.tc * 100) : 0}%</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-ic" style={{ background: "var(--status-off-soft)", color: "var(--traffic-ovf)" }}>
            <I n="radar" s={20}/>
          </div>
          <div style={{ flex: 1 }}>
            <div className="stat-l">Overfly</div>
            <div className="stat-v" style={{ color: "var(--traffic-ovf)" }}>{totals.ovf.toLocaleString()}</div>
            <div className="stat-sub">{totals.tc > 0 ? Math.round(totals.ovf / totals.tc * 100) : 0}%</div>
          </div>
        </div>
      </div>

      {/* REGION COMPARISON (only when ALL) */}
      {br === "ALL" && (
        <div className="region-row">
          <RegionCard region="west" color="#3b82f6" regionAgg={regionAgg}/>
          <RegionCard region="east" color="#dc2626" regionAgg={regionAgg}/>
        </div>
      )}

      {/* TREND CHART */}
      {dates.length > 1 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <I n="chart" s={16}/> Trend Traffic Harian — {period === "week" ? "Minggu Ini" : period === "month" ? "Bulan Ini" : "Hari Ini"}
            </h2>
            <span className="panel-counter">{dates.length} hari</span>
          </div>
          <div className="panel-body">
            <div className="traffic-chart-wrap">
              <svg viewBox={`0 0 ${dates.length * 26 + 60} 200`} width="100%" style={{ display: "block", minWidth: dates.length * 26 }}>
                {[0, .25, .5, .75, 1].map(f => {
                  const y = 10 + (1 - f) * 150
                  return (
                    <g key={f}>
                      <line x1="40" y1={y} x2={dates.length * 26 + 40} y2={y} stroke="var(--border-subtle)" strokeWidth="1"/>
                      <text x="36" y={y + 3} textAnchor="end" fontSize="9" fill="var(--text-faint)" fontFamily="var(--font-mono)">{Math.round(chartMax * f)}</text>
                    </g>
                  )
                })}
                {dates.map((d, i) => {
                  const total = byDate[d].dep + byDate[d].arr + byDate[d].ovf
                  if (total === 0) return null
                  const barH = (total / chartMax) * 150
                  const x = 50 + i * 26
                  const depH = (byDate[d].dep / total) * barH
                  const arrH = (byDate[d].arr / total) * barH
                  const ovfH = (byDate[d].ovf / total) * barH
                  return (
                    <g key={i}>
                      <rect x={x} y={160 - barH} width={18} height={depH} fill="var(--traffic-dep)" rx="1"/>
                      <rect x={x} y={160 - barH + depH} width={18} height={arrH} fill="var(--traffic-arr)"/>
                      <rect x={x} y={160 - barH + depH + arrH} width={18} height={ovfH} fill="var(--traffic-ovf)"/>
                      <text x={x + 9} y={160 - barH - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="var(--text-faint)" fontFamily="var(--font-mono)">{total}</text>
                      {(i % 4 === 0 || i === dates.length - 1) && (
                        <text x={x + 9} y={178} textAnchor="middle" fontSize="9" fill="var(--text-faint)" fontFamily="var(--font-mono)">{d.slice(5)}</text>
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

      {/* PER-BRANCH BREAKDOWN */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><I n="chart" s={16}/> Rekap Per Cabang</h2>
          <span className="panel-counter">{brKeys.length} cabang</span>
        </div>
        <div className="panel-body" style={{ padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "30px 60px 1fr 1fr 80px 80px 80px 80px 30px", gap: 8, padding: "8px 16px", fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 1, fontFamily: "var(--font-mono)" }}>
            <div/>
            <div>Code</div>
            <div>Cabang</div>
            <div>Distribusi</div>
            <div style={{ textAlign: "center" }}>DEP</div>
            <div style={{ textAlign: "center" }}>ARR</div>
            <div style={{ textAlign: "center" }}>OVF</div>
            <div style={{ textAlign: "center" }}>Total</div>
            <div/>
          </div>
          {brKeys.map(code => {
            const b = allBr.find(x => x.code === code)
            if (!b) return null
            const d = branchData[code] || { dep: 0, arr: 0, ovf: 0, tc: 0, sectors: {} }
            const isExp = expandBr === code
            return (
              <div key={code} className={"br-row" + (d.tc === 0 ? " idle" : "") + (isExp ? " expanded" : "")}>
                <div className="br-head" onClick={() => setExpandBr(isExp ? null : code)}>
                  <div><span className={"br-region-dot " + b.region}/></div>
                  <span className="br-code">{code}</span>
                  <div>
                    <div>{b.name}</div>
                    <div className="br-city">{b.city}</div>
                  </div>
                  <div className="br-bar-stack">
                    {d.tc > 0 && (
                      <>
                        <div className="br-bar-seg" style={{ width: `${d.dep / brMax * 100}%`, background: "var(--traffic-dep)" }}/>
                        <div className="br-bar-seg" style={{ width: `${d.arr / brMax * 100}%`, background: "var(--traffic-arr)" }}/>
                        <div className="br-bar-seg" style={{ width: `${d.ovf / brMax * 100}%`, background: "var(--traffic-ovf)" }}/>
                      </>
                    )}
                  </div>
                  <div className="br-traffic-val dep">{d.dep || <span className="faint">—</span>}</div>
                  <div className="br-traffic-val arr">{d.arr || <span className="faint">—</span>}</div>
                  <div className="br-traffic-val ovf">{d.ovf || <span className="faint">—</span>}</div>
                  <div className="br-traffic-val total">{d.tc || <span className="faint">—</span>}</div>
                  <div><span className={"br-caret" + (isExp ? " open" : "")}><I n="chev" s={14}/></span></div>
                </div>
                {isExp && d.tc > 0 && (
                  <div className="br-body">
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "grid", gridTemplateColumns: "1fr 60px 60px 60px 60px", gap: 8, padding: "0 8px" }}>
                      <div>Sektor</div>
                      <div style={{ textAlign: "center" }}>DEP</div>
                      <div style={{ textAlign: "center" }}>ARR</div>
                      <div style={{ textAlign: "center" }}>OVF</div>
                      <div style={{ textAlign: "center" }}>Total</div>
                    </div>
                    {Object.entries(d.sectors).map(([sk, sv]) => {
                      const stot = sv.dep + sv.arr + sv.ovf
                      const smax = Math.max(...Object.values(d.sectors).map(s => s.dep + s.arr + s.ovf))
                      return (
                        <div key={sk} className="br-sector-row">
                          <div>
                            <div className="br-sector-name">{sk}</div>
                            <div className="br-sector-bar" style={{ marginTop: 4 }}>
                              <div className="br-sector-stack" style={{ width: `${stot / smax * 100}%` }}>
                                <div className="br-bar-seg" style={{ width: `${sv.dep / stot * 100}%`, background: "var(--traffic-dep)" }}/>
                                <div className="br-bar-seg" style={{ width: `${sv.arr / stot * 100}%`, background: "var(--traffic-arr)" }}/>
                                <div className="br-bar-seg" style={{ width: `${sv.ovf / stot * 100}%`, background: "var(--traffic-ovf)" }}/>
                              </div>
                            </div>
                          </div>
                          <div className="br-traffic-val dep">{sv.dep || <span className="faint">—</span>}</div>
                          <div className="br-traffic-val arr">{sv.arr || <span className="faint">—</span>}</div>
                          <div className="br-traffic-val ovf">{sv.ovf || <span className="faint">—</span>}</div>
                          <div className="br-traffic-val total">{stot}</div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
