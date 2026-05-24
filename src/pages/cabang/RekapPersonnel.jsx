// ============================================================
// src/pages/cabang/RekapPersonnel.jsx — Personnel rekap (REDESIGN)
// ──────────────────────────────────────────────────────────
// Visual: Rekap Personnel Redesign.html mockup
// Logic preserved exactly from original:
//   - myBranches/myPersonnel/myLogs computation
//   - period filter (today/week/month)
//   - byPerson aggregation (count, totalMin, dep/arr/ovf, shifts, sectors)
//   - sort: hours/count/traffic (+ new: name)
//   - exportCSV (same column shape)
// New affordances:
//   - Period chips (segmented control style)
//   - Top-10 ranking with gradient bars + rank-1 gold + rank-3 cyan
//   - Detail table with inline shift distribution bar
//   - Expandable row with stats grid + log history table
//   - Toast on CSV export success
// ============================================================
import React, { useState } from "react"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, durMin, getAccessibleBranches } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Stat } from "../../components/Stat.jsx"
import { useToast } from "../../components/Toast.jsx"

export const CabangRekapPersonnel = () => {
  const ctx = useApp()
  const toast = useToast()

  // ── Same data filter as original ──
  const myBranches  = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))
  const myLogs      = ctx.logs.filter(l => myBranches.includes(l.branch_code) && l.off_time)

  // ── State ──
  const [period, setPeriod] = useState("month")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("hours")
  const [expanded, setExpanded] = useState(null)

  // ── Period filter ──
  const filtered = myLogs.filter(l => {
    const d = (new Date() - new Date(l.on_time)) / 864e5
    return period === "today"
      ? new Date(l.on_time).toDateString() === new Date().toDateString()
      : period === "week" ? d <= 7 : d <= 30
  })

  // ── Build per-person aggregation (preserved from original) ──
  const byPerson = {}
  filtered.forEach(l => {
    const nm = l.atc_name
    if (!byPerson[nm]) byPerson[nm] = {
      name: nm, count: 0, totalMin: 0, dep: 0, arr: 0, ovf: 0,
      shifts: { Morning: 0, Afternoon: 0, Night: 0 },
      sectors: new Set(), logs: [],
    }
    const p = byPerson[nm]
    p.count++
    p.totalMin += durMin(l.on_time, l.off_time)
    p.dep += l.departure_count || 0
    p.arr += l.arrival_count   || 0
    p.ovf += l.overfly_count   || 0
    if (l.shift)  p.shifts[l.shift] = (p.shifts[l.shift] || 0) + 1
    if (l.sector) p.sectors.add(l.sector)
    p.logs.push(l)
  })
  // Include personnel with 0 activity (preserved)
  myPersonnel.forEach(p => {
    if (!byPerson[p.name]) byPerson[p.name] = {
      name: p.name, count: 0, totalMin: 0, dep: 0, arr: 0, ovf: 0,
      shifts: { Morning: 0, Afternoon: 0, Night: 0 },
      sectors: new Set(), logs: [],
    }
  })

  // ── Filter + sort (preserved + new "name" sort) ──
  let personList = Object.values(byPerson)
  if (search) personList = personList.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )
  personList = [...personList].sort((a, b) => {
    if (sortBy === "hours")   return b.totalMin - a.totalMin
    if (sortBy === "count")   return b.count - a.count
    if (sortBy === "traffic") return (b.dep + b.arr + b.ovf) - (a.dep + a.arr + a.ovf)
    if (sortBy === "name")    return a.name.localeCompare(b.name)
    return 0
  })

  // ── Stats ──
  const active           = Object.values(byPerson).filter(p => p.count > 0)
  const totalPersonnel   = myPersonnel.length
  const totalHours       = Math.round(Object.values(byPerson).reduce((a, p) => a + p.totalMin, 0) / 60 * 10) / 10
  const totalOnMic       = filtered.length
  const totalTraffic     = Object.values(byPerson).reduce((a, p) => a + p.dep + p.arr + p.ovf, 0)
  const topMin           = active.length ? Math.max(...active.map(p => p.totalMin)) : 1
  const avgHrsPerActive  = active.length ? (totalHours / active.length).toFixed(1) : "0"
  const avgOnMicPerActive = active.length ? Math.round(totalOnMic / active.length) : 0

  const periodLabel = period === "today"
    ? "Hari ini"
    : period === "week" ? "7 hari terakhir" : "30 hari terakhir"

  // ── Export CSV (preserved logic + Toast feedback) ──
  const exportCSV = () => {
    const head = ["Nama","On Mic","Total Jam","Rata-rata (mnt)","DEP","ARR","OVF","Total Traffic","Shift Pagi","Shift Siang","Shift Malam","Sektor"]
    const rows = personList.map(p => [
      p.name, p.count, (p.totalMin / 60).toFixed(1),
      p.count ? Math.round(p.totalMin / p.count) : 0,
      p.dep, p.arr, p.ovf, p.dep + p.arr + p.ovf,
      p.shifts.Morning || 0, p.shifts.Afternoon || 0, p.shifts.Night || 0,
      [...p.sectors].join("; "),
    ])
    const csv = [head.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `rekap_personel_${ctx.user.branch_code}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success("Export berhasil", `${personList.length} personnel diunduh sebagai CSV`)
  }

  return (
    <div className="page-content">
      {/* TOPBAR */}
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Rekap Personnel</h1>
          <p className="topbar-sub">
            Statistik kerja ATC — Cabang {ctx.user.branch_code} · {periodLabel}
          </p>
        </div>
        <button className="btn btn-sm" onClick={exportCSV} disabled={personList.length === 0}>
          <I n="download" s={14}/> Export CSV
        </button>
      </div>

      {/* PERIOD + FILTERS ROW */}
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
            placeholder="Cari nama personnel..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{
            width: "auto", padding: "7px 12px", fontSize: 12,
            borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--bg2)", color: "var(--text)",
            fontFamily: "var(--font)", cursor: "pointer", outline: "none",
          }}
        >
          <option value="hours">Urutkan: Jam kerja</option>
          <option value="count">Urutkan: Frekuensi on mic</option>
          <option value="traffic">Urutkan: Total traffic</option>
          <option value="name">Urutkan: Nama (A–Z)</option>
        </select>
      </div>

      {/* STATS */}
      <div className="stats-grid">
        <Stat
          icon="users" label="Total Personnel" value={totalPersonnel}
          sub={`${active.length} aktif · ${totalPersonnel - active.length} idle`}
          color="var(--purple)"
        />
        <Stat
          icon="clock" label="Total Jam Kerja" value={`${totalHours}h`}
          sub={`${avgHrsPerActive}h rata-rata`}
          color="var(--accent)"
        />
        <Stat
          icon="mic" label="Total On Mic" value={totalOnMic}
          sub={`${avgOnMicPerActive}× per orang`}
          color="var(--status-on)"
        />
        <Stat
          icon="plane" label="Total Traffic" value={totalTraffic}
          sub="Departures + Arrivals + Overfly"
          color="var(--status-warn)"
        />
      </div>

      {/* TOP-10 RANKING */}
      {active.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <I n="chart" s={16}/> Top Personnel (berdasarkan jam kerja)
            </h2>
            <span className="panel-counter">Top {Math.min(10, active.length)}</span>
          </div>
          <div className="panel-body">
            <div className="ranking">
              {active.slice().sort((a, b) => b.totalMin - a.totalMin).slice(0, 10).map((p, i) => {
                const hrs = Math.round(p.totalMin / 60 * 10) / 10
                const traffic = p.dep + p.arr + p.ovf
                const pct = (p.totalMin / topMin) * 100
                const cls = "rank-row" + (i < 3 ? " top-3" : "") + (i === 0 ? " top-1" : "")
                return (
                  <div key={p.name} className={cls}>
                    <div className="rank-num">{(i + 1).toString().padStart(2, "0")}</div>
                    <div>
                      <div className="rank-name">{p.name}</div>
                      <div className="rank-bar-wrap">
                        <div className="rank-bar" style={{ width: pct + "%" }}>{hrs}h</div>
                      </div>
                    </div>
                    <div className="rank-metric">
                      <span className="l">On Mic</span>{p.count}×
                    </div>
                    <div className="rank-metric">
                      <span className="l">Traffic</span>{traffic}
                    </div>
                    <div className="rank-metric">
                      <span className="l">Sektor</span>{p.sectors.size}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* DETAIL TABLE */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Detail Personnel ({personList.length})</h2>
          <span className="muted text-sm">Klik baris untuk detail</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {personList.length === 0 ? (
            <div className="empty-state">
              <I n="users" s={44}/>
              <p>Tidak ada personnel yang cocok</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table person-table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th className="center">Status</th>
                    <th className="center">On Mic</th>
                    <th className="center">Jam</th>
                    <th className="center">Rata² (mnt)</th>
                    <th className="center">DEP</th>
                    <th className="center">ARR</th>
                    <th className="center">OVF</th>
                    <th className="center">Total</th>
                    <th>Distribusi Shift</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {personList.map(p => {
                    const isOpen = expanded === p.name
                    const hrs = Math.round(p.totalMin / 60 * 10) / 10
                    const avg = p.count ? Math.round(p.totalMin / p.count) : 0
                    const tot = p.dep + p.arr + p.ovf
                    const shiftTotal =
                      (p.shifts.Morning + p.shifts.Afternoon + p.shifts.Night) || 1
                    return (
                      <React.Fragment key={p.name}>
                        <tr
                          onClick={() => setExpanded(isOpen ? null : p.name)}
                          style={{ cursor: "pointer" }}
                        >
                          <td>
                            <span className={"activity-dot" + (p.count === 0 ? " inactive" : "")}/>
                            <strong>{p.name}</strong>
                          </td>
                          <td className="center">
                            {p.count > 0
                              ? <span className="status-badge status-on">Aktif</span>
                              : <span className="status-badge status-off">Idle</span>}
                          </td>
                          <td className="center mono">{p.count}</td>
                          <td className="center mono">{hrs}h</td>
                          <td className="center mono">{avg}m</td>
                          <td className="center td-dep">
                            {p.dep || <span className="faint">—</span>}
                          </td>
                          <td className="center td-arr">
                            {p.arr || <span className="faint">—</span>}
                          </td>
                          <td className="center td-ovf">
                            {p.ovf || <span className="faint">—</span>}
                          </td>
                          <td className="center mono"><strong>{tot}</strong></td>
                          <td>
                            <div className="shift-bar">
                              <div className="shift-seg" style={{
                                width: (p.shifts.Morning / shiftTotal * 100) + "%",
                                background: "var(--status-warn)",
                              }}/>
                              <div className="shift-seg" style={{
                                width: (p.shifts.Afternoon / shiftTotal * 100) + "%",
                                background: "var(--accent)",
                              }}/>
                              <div className="shift-seg" style={{
                                width: (p.shifts.Night / shiftTotal * 100) + "%",
                                background: "var(--purple)",
                              }}/>
                            </div>
                            <div className="shift-bar-legend">
                              <span>P:{p.shifts.Morning || 0}</span>
                              <span>S:{p.shifts.Afternoon || 0}</span>
                              <span>M:{p.shifts.Night || 0}</span>
                            </div>
                          </td>
                          <td><I n="caret" s={14}/></td>
                        </tr>
                        {isOpen && (
                          <tr>
                            <td colSpan={11} style={{ padding: 0 }}>
                              <div className="person-detail">
                                <div className="person-detail-grid">
                                  <div className="pd-stat">
                                    <div className="pd-stat-l">Sesi On Mic</div>
                                    <div className="pd-stat-v">{p.count}</div>
                                    <div className="pd-stat-sub">
                                      total dalam {periodLabel.toLowerCase()}
                                    </div>
                                  </div>
                                  <div className="pd-stat">
                                    <div className="pd-stat-l">Jam Kerja</div>
                                    <div className="pd-stat-v">{hrs}h</div>
                                    <div className="pd-stat-sub">rata² {avg} mnt per sesi</div>
                                  </div>
                                  <div className="pd-stat">
                                    <div className="pd-stat-l">Traffic Handled</div>
                                    <div className="pd-stat-v">{tot}</div>
                                    <div className="pd-stat-sub">
                                      {p.dep} DEP · {p.arr} ARR · {p.ovf} OVF
                                    </div>
                                  </div>
                                  <div className="pd-stat">
                                    <div className="pd-stat-l">Distribusi Shift</div>
                                    <div className="pd-stat-v" style={{ fontSize: 14 }}>
                                      {p.shifts.Morning} / {p.shifts.Afternoon} / {p.shifts.Night}
                                    </div>
                                    <div className="pd-stat-sub">Pagi / Siang / Malam</div>
                                  </div>
                                  <div className="pd-stat">
                                    <div className="pd-stat-l">Sektor yang Dipegang</div>
                                    <div className="pd-sector-list">
                                      {p.sectors.size === 0
                                        ? <span className="faint text-sm">—</span>
                                        : [...p.sectors].map(s => (
                                            <span key={s} className="pd-sector">{s}</span>
                                          ))}
                                    </div>
                                  </div>
                                </div>
                                {p.logs.length > 0 && (
                                  <div style={{
                                    marginTop: 16, paddingTop: 12,
                                    borderTop: "1px solid var(--border-subtle)",
                                  }}>
                                    <div className="pd-stat-l" style={{ marginBottom: 8 }}>
                                      Riwayat Log ({Math.min(20, p.logs.length)} dari {p.logs.length})
                                    </div>
                                    <div className="table-wrap">
                                      <table className="pd-logs-table">
                                        <thead>
                                          <tr>
                                            <th>Tanggal</th>
                                            <th>On–Off</th>
                                            <th>Unit</th>
                                            <th>Sektor</th>
                                            <th>CWP</th>
                                            <th>Durasi</th>
                                            <th className="center" style={{ color: "var(--traffic-dep)" }}>D</th>
                                            <th className="center" style={{ color: "var(--traffic-arr)" }}>A</th>
                                            <th className="center" style={{ color: "var(--traffic-ovf)" }}>O</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {p.logs
                                            .slice()
                                            .sort((a, b) => new Date(b.on_time) - new Date(a.on_time))
                                            .slice(0, 20)
                                            .map(l => (
                                              <tr key={l.id}>
                                                <td style={{ whiteSpace: "nowrap" }}>{fmtD(l.on_time)}</td>
                                                <td className="muted mono" style={{ whiteSpace: "nowrap" }}>
                                                  {fmtT(l.on_time)}–{fmtT(l.off_time)}
                                                </td>
                                                <td><span className="unit-tag">{l.unit}</span></td>
                                                <td>{l.sector}</td>
                                                <td className="muted">{l.cwp}</td>
                                                <td className="mono">{durMin(l.on_time, l.off_time)}m</td>
                                                <td className="td-dep">{l.departure_count || 0}</td>
                                                <td className="td-arr">{l.arrival_count   || 0}</td>
                                                <td className="td-ovf">{l.overfly_count   || 0}</td>
                                              </tr>
                                            ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
