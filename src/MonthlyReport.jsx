// ============================================================
// src/MonthlyReport.jsx — Monthly Report (REDESIGN sesi 4)
// Class-based styling, logic 1:1 with pre-redesign version.
// ============================================================
import React, { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function MonthlyReport() {
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().substring(0, 7))
  const [loading, setLoading] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const [branchInfo, setBranchInfo] = useState(null)
  const [dailyReports, setDailyReports] = useState([])
  const [positionLogs, setPositionLogs] = useState([])
  const [checklists, setChecklists] = useState([])
  const [personnel, setPersonnel] = useState([])

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', user.id).single()
      if (acc) {
        setUserInfo(acc)
        const { data: br } = await supabase.from('branches').select('*').eq('code', acc.branch_code).single()
        if (br) setBranchInfo(br)
      }
    }
    loadUser()
  }, [])

  useEffect(() => {
    if (!userInfo) return
    loadMonthData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, userInfo])

  const loadMonthData = async () => {
    setLoading(true)
    const startDate = yearMonth + '-01'
    const endDate = yearMonth + '-31'
    const bc = userInfo.branch_code
    const [drRes, plRes, clRes, pRes] = await Promise.all([
      supabase.from('daily_reports').select('*, traffic_movements(*), hourly_traffic(*), communication_systems(*), incident_reports(*), operational_disruptions(*)').eq('branch_code', bc).gte('report_date', startDate).lte('report_date', endDate).order('report_date'),
      supabase.from('position_logs').select('*').eq('branch_code', bc).gte('on_time', startDate + 'T00:00:00').lte('on_time', endDate + 'T23:59:59').order('on_time'),
      supabase.from('handover_checklists').select('*').eq('branch_id', userInfo.id).gte('checklist_date', startDate).lte('checklist_date', endDate).order('checklist_date'),
      supabase.from('personnel').select('*').eq('branch_code', bc).eq('is_active', true).order('name'),
    ])
    setDailyReports(drRes.data || [])
    setPositionLogs(plRes.data || [])
    setChecklists(clRes.data || [])
    setPersonnel(pRes.data || [])
    setLoading(false)
  }

  const daysInMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate()
  const monthName = new Date(yearMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

  const completedLogs = positionLogs.filter(l => l.off_time)
  const totalDep = completedLogs.reduce((a, l) => a + (l.departure_count || 0), 0)
  const totalArr = completedLogs.reduce((a, l) => a + (l.arrival_count || 0), 0)
  const totalOvf = completedLogs.reduce((a, l) => a + (l.overfly_count || 0), 0)
  const totalTraffic = totalDep + totalArr + totalOvf

  const drTraffic = dailyReports.reduce((acc, dr) => {
    if (dr.traffic_movements) {
      dr.traffic_movements.forEach(tm => {
        const type = (tm.movement_type || '').toLowerCase()
        if (!acc[type]) acc[type] = { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0 }
        acc[type].depDom += tm.depDom || tm.dep_dom || 0
        acc[type].depInt += tm.depInt || tm.dep_int || 0
        acc[type].arrDom += tm.arrDom || tm.arr_dom || 0
        acc[type].arrInt += tm.arrInt || tm.arr_int || 0
        acc[type].ovf += tm.ovf || 0
      })
    }
    return acc
  }, {})

  const dailyTrafficMap = {}
  completedLogs.forEach(l => {
    const dt = new Date(l.on_time).toISOString().slice(0, 10)
    if (!dailyTrafficMap[dt]) dailyTrafficMap[dt] = { dep: 0, arr: 0, ovf: 0 }
    dailyTrafficMap[dt].dep += l.departure_count || 0
    dailyTrafficMap[dt].arr += l.arrival_count || 0
    dailyTrafficMap[dt].ovf += l.overfly_count || 0
  })
  const dailyDates = Array.from({ length: daysInMonth }, (_, i) => yearMonth + '-' + String(i + 1).padStart(2, '0'))
  const chartMax = Math.max(1, ...dailyDates.map(d => {
    const v = dailyTrafficMap[d]
    return v ? v.dep + v.arr + v.ovf : 0
  }))

  const personnelStats = {}
  completedLogs.forEach(l => {
    const nm = l.atc_name
    if (!personnelStats[nm]) personnelStats[nm] = { count: 0, totalMin: 0, dep: 0, arr: 0, ovf: 0, shifts: {} }
    const p = personnelStats[nm]
    p.count++
    const dur = l.off_time ? Math.round((new Date(l.off_time) - new Date(l.on_time)) / 60000) : 0
    p.totalMin += dur
    p.dep += l.departure_count || 0
    p.arr += l.arrival_count || 0
    p.ovf += l.overfly_count || 0
    p.shifts[l.shift] = (p.shifts[l.shift] || 0) + 1
  })
  const personList = Object.entries(personnelStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.totalMin - a.totalMin)

  const clItems = ['traffic_situation', 'conflict_solution', 'weather', 'facilities', 'coordination', 'others']
  const clStats = {}
  clItems.forEach(it => { clStats[it] = { ok: 0, notOk: 0, na: 0 } })
  checklists.forEach(cl => {
    clItems.forEach(it => {
      const st = cl[it + '_status']
      if (st === 'OK') clStats[it].ok++
      else if (st === 'Not OK') clStats[it].notOk++
      else clStats[it].na++
    })
  })
  const totalNotOk = clItems.reduce((a, it) => a + clStats[it].notOk, 0)

  const conditionFields = ['general', 'notam', 'restriction', 'fir', 'weather', 'military']
  const conditionStats = {}
  conditionFields.forEach(f => { conditionStats[f] = { ok: 0, notOk: 0 } })
  dailyReports.forEach(dr => {
    conditionFields.forEach(f => {
      const st = dr['condition_' + f + '_status']
      if (st === 'OK' || st === 'Operational') conditionStats[f].ok++
      else if (st) conditionStats[f].notOk++
    })
  })

  const totalIncidents = dailyReports.reduce((a, dr) => a + (dr.incident_reports?.length || 0), 0)
  const totalDisruptions = dailyReports.reduce((a, dr) => a + (dr.operational_disruptions?.length || 0), 0)
  const totalOnMic = completedLogs.length
  const totalHours = Math.round(completedLogs.reduce((a, l) => a + (l.off_time ? (new Date(l.off_time) - new Date(l.on_time)) / 3600000 : 0), 0) * 10) / 10
  const activePersonnel = Object.keys(personnelStats).length

  if (!userInfo) {
    return (
      <div className="page-content">
        <div className="topbar"><div><h1 className="topbar-title">Monthly Report</h1><p className="topbar-sub">Memuat...</p></div></div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Monthly Report</h1>
          <p className="topbar-sub">{branchInfo?.name} ({userInfo.branch_code}) {branchInfo?.city ? `— ${branchInfo.city}` : ''} · {monthName}</p>
        </div>
        <div className="mr-month-pick">
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}/>
          {loading && <span className="muted text-sm">Memuat...</span>}
        </div>
      </div>

      <div className="mr-stats-grid">
        <div className="mr-stat">
          <div className="mr-stat-num">{totalTraffic}</div>
          <div className="mr-stat-label">Total Traffic</div>
          <div className="mr-stat-sub">{monthName}</div>
        </div>
        <div className="mr-stat color-on">
          <div className="mr-stat-num">{totalDep}</div>
          <div className="mr-stat-label">Departure</div>
        </div>
        <div className="mr-stat color-warn">
          <div className="mr-stat-num">{totalArr}</div>
          <div className="mr-stat-label">Arrival</div>
        </div>
        <div className="mr-stat color-muted">
          <div className="mr-stat-num">{totalOvf}</div>
          <div className="mr-stat-label">Overfly</div>
        </div>
        <div className="mr-stat color-purple">
          <div className="mr-stat-num">{totalOnMic}</div>
          <div className="mr-stat-label">Total On Mic</div>
          <div className="mr-stat-sub">{totalHours} jam</div>
        </div>
        <div className="mr-stat color-alert">
          <div className="mr-stat-num">{activePersonnel}/{personnel.length}</div>
          <div className="mr-stat-label">Personel Aktif</div>
        </div>
        <div className="mr-stat">
          <div className="mr-stat-num">{dailyReports.length}/{daysInMonth}</div>
          <div className="mr-stat-label">Daily Reports</div>
          <div className="mr-stat-sub">Terisi</div>
        </div>
        <div className={"mr-stat " + (totalNotOk > 0 ? "color-alert" : "color-on")}>
          <div className="mr-stat-num">{checklists.length}</div>
          <div className="mr-stat-label">Handover Checklist</div>
          <div className="mr-stat-sub">{totalNotOk > 0 ? totalNotOk + ' Not OK' : 'Semua OK'}</div>
        </div>
      </div>

      <div className="mr-card">
        <div className="mr-card-title">📊 Traffic Harian — {monthName}</div>
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${Math.max(700, daysInMonth * 24)} 200`} width="100%" style={{ display: 'block', minWidth: daysInMonth * 20 }}>
            {[0, .25, .5, .75, 1].map(f => {
              const y = 10 + (1 - f) * 150
              return <line key={f} x1="30" y1={y} x2={daysInMonth * 22 + 30} y2={y} stroke="var(--border)" strokeWidth="0.5"/>
            })}
            {dailyDates.map((d, i) => {
              const v = dailyTrafficMap[d] || { dep: 0, arr: 0, ovf: 0 }
              const total = v.dep + v.arr + v.ovf
              const barH = total > 0 ? (total / chartMax) * 150 : 0
              const x = 30 + i * 22
              const dayNum = parseInt(d.split('-')[2])
              return (
                <g key={d}>
                  {total > 0 && (
                    <>
                      <rect x={x} y={10 + 150 - barH} width={16} height={barH * (v.dep / total)} fill="var(--accent)" rx="1"/>
                      <rect x={x} y={10 + 150 - barH + barH * (v.dep / total)} width={16} height={barH * (v.arr / total)} fill="var(--status-warn)" rx="1"/>
                      <rect x={x} y={10 + 150 - barH + barH * ((v.dep + v.arr) / total)} width={16} height={barH * (v.ovf / total)} fill="var(--text-muted)" rx="1"/>
                      <text x={x + 8} y={10 + 150 - barH - 4} textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--text-muted)">{total}</text>
                    </>
                  )}
                  <text x={x + 8} y={175} textAnchor="middle" fontSize="8" fill="var(--text-muted)">{dayNum}</text>
                </g>
              )
            })}
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
          {[['DEP', 'var(--accent)'], ['ARR', 'var(--status-warn)'], ['OVF', 'var(--text-muted)']].map(([l, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }}/>{l}
            </div>
          ))}
        </div>
      </div>

      <div className="mr-card">
        <div className="mr-card-title">📋 Status Daily Report per Hari</div>
        {dailyReports.length === 0 ? (
          <div className="empty-state"><p>Belum ada daily report untuk bulan ini</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Tanggal</th><th>Status</th><th>Manager</th><th>Kondisi Umum</th><th>Cuaca</th><th>NOTAM</th><th className="center">Insiden</th><th>Catatan</th>
              </tr></thead>
              <tbody>
                {dailyReports.map(dr => (
                  <tr key={dr.id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{new Date(dr.report_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                    <td><span className={"status-badge " + (dr.status === 'submitted' ? 'status-on' : 'status-warn')}>{dr.status === 'submitted' ? 'Submitted' : 'Draft'}</span></td>
                    <td style={{ fontSize: 11 }}>{dr.manager_name || '-'}</td>
                    <td><span className={"status-badge " + (dr.condition_general_status === 'OK' ? 'status-on' : 'status-alert')}>{dr.condition_general_status || '-'}</span></td>
                    <td><span className={"status-badge " + (dr.condition_weather_status === 'OK' ? 'status-on' : 'status-alert')}>{dr.condition_weather_status || '-'}</span></td>
                    <td><span className={"status-badge " + (dr.condition_notam_status === 'OK' ? 'status-on' : 'status-alert')}>{dr.condition_notam_status || '-'}</span></td>
                    <td className="center">{(dr.incident_reports?.length || 0) > 0 ? <span className="status-badge status-alert">{dr.incident_reports.length}</span> : <span className="muted">0</span>}</td>
                    <td className="muted text-sm" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dr.operational_notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {Object.keys(drTraffic).length > 0 && (
        <div className="mr-card">
          <div className="mr-card-title">✈️ Traffic Per Kategori (dari Daily Report)</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Kategori</th><th className="center">DEP Dom</th><th className="center">DEP Int</th><th className="center">ARR Dom</th><th className="center">ARR Int</th><th className="center">OVF</th><th className="center">Total</th>
              </tr></thead>
              <tbody>
                {Object.entries(drTraffic).map(([type, d]) => {
                  const tot = d.depDom + d.depInt + d.arrDom + d.arrInt + d.ovf
                  return (
                    <tr key={type}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{type}</td>
                      <td className="center">{d.depDom || 0}</td><td className="center">{d.depInt || 0}</td>
                      <td className="center">{d.arrDom || 0}</td><td className="center">{d.arrInt || 0}</td>
                      <td className="center">{d.ovf || 0}</td><td className="center" style={{ fontWeight: 700 }}>{tot}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mr-card">
        <div className="mr-card-title">👥 Rekap Personel — {monthName}</div>
        {personList.length === 0 ? (
          <div className="empty-state"><p>Belum ada data on mic bulan ini</p></div>
        ) : (
          <>
            <div style={{ marginBottom: 16 }}>
              {personList.slice(0, 10).map(p => {
                const hrs = Math.round(p.totalMin / 60 * 10) / 10
                const maxMin = personList[0].totalMin || 1
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <div className="mr-bar-track">
                      <div style={{
                        width: (p.totalMin / maxMin * 100) + '%',
                        background: 'linear-gradient(90deg, var(--accent2), var(--accent))',
                        height: '100%', borderRadius: 4,
                        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                        paddingRight: 6, minWidth: 40,
                      }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{hrs}h</span>
                      </div>
                    </div>
                    <span className="muted text-sm" style={{ minWidth: 40, textAlign: 'right' }}>{p.count}x</span>
                  </div>
                )
              })}
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>
                  <th>Nama</th><th className="center">On Mic</th><th className="center">Jam Kerja</th><th className="center">Rata-rata</th>
                  <th className="center">DEP</th><th className="center">ARR</th><th className="center">OVF</th><th className="center">Traffic</th>
                  <th className="center">Pagi</th><th className="center">Siang</th><th className="center">Malam</th>
                </tr></thead>
                <tbody>
                  {personList.map(p => {
                    const hrs = Math.round(p.totalMin / 60 * 10) / 10
                    const avg = p.count ? Math.round(p.totalMin / p.count) : 0
                    const tc = p.dep + p.arr + p.ovf
                    return (
                      <tr key={p.name}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td className="center">{p.count}</td>
                        <td className="center" style={{ fontWeight: 600, color: 'var(--accent)' }}>{hrs}h</td>
                        <td className="center muted">{avg}m</td>
                        <td className="center" style={{ color: 'var(--accent)' }}>{p.dep}</td>
                        <td className="center" style={{ color: 'var(--status-warn)' }}>{p.arr}</td>
                        <td className="center muted">{p.ovf}</td>
                        <td className="center" style={{ fontWeight: 700 }}>{tc}</td>
                        <td className="center text-sm">{p.shifts.Morning || 0}</td>
                        <td className="center text-sm">{p.shifts.Afternoon || 0}</td>
                        <td className="center text-sm">{p.shifts.Night || 0}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ fontWeight: 700, background: 'var(--bg3)' }}>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>TOTAL</td>
                    <td className="center">{totalOnMic}</td>
                    <td className="center" style={{ color: 'var(--accent)' }}>{totalHours}h</td>
                    <td></td>
                    <td className="center" style={{ color: 'var(--accent)' }}>{totalDep}</td>
                    <td className="center" style={{ color: 'var(--status-warn)' }}>{totalArr}</td>
                    <td className="center muted">{totalOvf}</td>
                    <td className="center">{totalTraffic}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="mr-card">
        <div className="mr-card-title">📋 Rekap Handover Checklist — {checklists.length} checklist</div>
        {checklists.length === 0 ? (
          <div className="empty-state"><p>Belum ada handover checklist bulan ini</p></div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>
                <th>Item</th><th className="center">OK</th><th className="center">Not OK</th><th className="center">N/A</th><th>Rasio OK</th>
              </tr></thead>
              <tbody>
                {clItems.map(it => {
                  const d = clStats[it]
                  const total = d.ok + d.notOk + d.na
                  const ratio = total > 0 ? Math.round(d.ok / (d.ok + d.notOk || 1) * 100) : 0
                  const label = it.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  return (
                    <tr key={it}>
                      <td style={{ fontWeight: 600 }}>{label}</td>
                      <td className="center"><span className="status-badge status-on">{d.ok}</span></td>
                      <td className="center">{d.notOk > 0 ? <span className="status-badge status-alert">{d.notOk}</span> : <span className="muted">0</span>}</td>
                      <td className="center muted">{d.na}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: ratio + '%', height: '100%', background: ratio >= 80 ? 'var(--status-on)' : ratio >= 50 ? 'var(--status-warn)' : 'var(--status-alert)', borderRadius: 4 }}/>
                          </div>
                          <span className="muted text-sm" style={{ minWidth: 32, fontWeight: 600 }}>{ratio}%</span>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {dailyReports.length > 0 && (
        <div className="mr-card">
          <div className="mr-card-title">⚙️ Kondisi Operasional (dari Daily Report)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {conditionFields.map(f => {
              const d = conditionStats[f]
              const label = { general: 'Kondisi Umum', notam: 'NOTAM', restriction: 'Restriksi', fir: 'FIR/Sektor', weather: 'Cuaca', military: 'Militer' }[f] || f
              return (
                <div key={f} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span className="status-badge status-on">OK: {d.ok}</span>
                    {d.notOk > 0 && <span className="status-badge status-alert">Issue: {d.notOk}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(totalIncidents > 0 || totalDisruptions > 0) && (
        <div className="mr-card">
          <div className="mr-card-title">⚠️ Insiden & Gangguan</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 13 }}>
              <span className="muted">Total Insiden: </span>
              <strong style={{ color: totalIncidents > 0 ? 'var(--status-alert)' : 'var(--text)' }}>{totalIncidents}</strong>
            </div>
            <div style={{ fontSize: 13 }}>
              <span className="muted">Total Gangguan: </span>
              <strong style={{ color: totalDisruptions > 0 ? 'var(--status-warn)' : 'var(--text)' }}>{totalDisruptions}</strong>
            </div>
          </div>
          {dailyReports.filter(dr => (dr.incident_reports?.length || 0) > 0).map(dr => (
            <div key={dr.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                {new Date(dr.report_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              {dr.incident_reports.map((inc, idx) => (
                <div key={idx} style={{ background: 'var(--status-alert-soft)', borderRadius: 6, padding: '8px 12px', marginBottom: 4, fontSize: 12, color: 'var(--status-alert)', border: '1px solid rgba(239,68,68,.2)' }}>
                  <strong>{inc.incident_type || 'Insiden'}</strong>
                  {inc.affected_system && <span> — {inc.affected_system}</span>}
                  {inc.duration_minutes > 0 && <span> ({inc.duration_minutes} mnt)</span>}
                  {inc.follow_up_action && <div style={{ marginTop: 2, fontSize: 11, opacity: .85 }}>Tindak lanjut: {inc.follow_up_action}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--text-muted)' }}>
        Monthly Report — {branchInfo?.name} ({userInfo.branch_code}) — {monthName}
      </div>
    </div>
  )
}
