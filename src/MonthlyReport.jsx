import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

export default function MonthlyReport() {
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().substring(0, 7));
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [branchInfo, setBranchInfo] = useState(null);

  // Data aggregated
  const [dailyReports, setDailyReports] = useState([]);
  const [positionLogs, setPositionLogs] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [personnel, setPersonnel] = useState([]);

  // Load user info
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', user.id).single();
      if (acc) {
        setUserInfo(acc);
        const { data: br } = await supabase.from('branches').select('*').eq('code', acc.branch_code).single();
        if (br) setBranchInfo(br);
      }
    };
    loadUser();
  }, []);

  // Load data when month changes
  useEffect(() => {
    if (!userInfo) return;
    loadMonthData();
  }, [yearMonth, userInfo]);

  const loadMonthData = async () => {
    setLoading(true);
    const startDate = yearMonth + '-01';
    const endDate = yearMonth + '-31';
    const bc = userInfo.branch_code;

    const [drRes, plRes, clRes, pRes] = await Promise.all([
      supabase.from('daily_reports').select('*, traffic_movements(*), hourly_traffic(*), communication_systems(*), incident_reports(*), operational_disruptions(*)').eq('branch_code', bc).gte('report_date', startDate).lte('report_date', endDate).order('report_date'),
      supabase.from('position_logs').select('*').eq('branch_code', bc).gte('on_time', startDate + 'T00:00:00').lte('on_time', endDate + 'T23:59:59').order('on_time'),
      supabase.from('handover_checklists').select('*').eq('branch_id', userInfo.id).gte('checklist_date', startDate).lte('checklist_date', endDate).order('checklist_date'),
      supabase.from('personnel').select('*').eq('branch_code', bc).eq('is_active', true).order('name'),
    ]);

    setDailyReports(drRes.data || []);
    setPositionLogs(plRes.data || []);
    setChecklists(clRes.data || []);
    setPersonnel(pRes.data || []);
    setLoading(false);
  };

  // ── Computed Stats ──
  const daysInMonth = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate();
  const monthName = new Date(yearMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Traffic from position_logs (off mic reports)
  const completedLogs = positionLogs.filter(l => l.off_time);
  const totalDep = completedLogs.reduce((a, l) => a + (l.departure_count || 0), 0);
  const totalArr = completedLogs.reduce((a, l) => a + (l.arrival_count || 0), 0);
  const totalOvf = completedLogs.reduce((a, l) => a + (l.overfly_count || 0), 0);
  const totalTraffic = totalDep + totalArr + totalOvf;

  // Traffic from daily_reports (Section C)
  const drTraffic = dailyReports.reduce((acc, dr) => {
    if (dr.traffic_movements) {
      dr.traffic_movements.forEach(tm => {
        const type = (tm.movement_type || '').toLowerCase();
        if (!acc[type]) acc[type] = { depDom: 0, depInt: 0, arrDom: 0, arrInt: 0, ovf: 0 };
        acc[type].depDom += tm.depDom || tm.dep_dom || 0;
        acc[type].depInt += tm.depInt || tm.dep_int || 0;
        acc[type].arrDom += tm.arrDom || tm.arr_dom || 0;
        acc[type].arrInt += tm.arrInt || tm.arr_int || 0;
        acc[type].ovf += tm.ovf || 0;
      });
    }
    return acc;
  }, {});

  // Daily traffic breakdown for chart
  const dailyTrafficMap = {};
  completedLogs.forEach(l => {
    const dt = new Date(l.on_time).toISOString().slice(0, 10);
    if (!dailyTrafficMap[dt]) dailyTrafficMap[dt] = { dep: 0, arr: 0, ovf: 0 };
    dailyTrafficMap[dt].dep += l.departure_count || 0;
    dailyTrafficMap[dt].arr += l.arrival_count || 0;
    dailyTrafficMap[dt].ovf += l.overfly_count || 0;
  });
  const dailyDates = Array.from({ length: daysInMonth }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return yearMonth + '-' + d;
  });
  const chartMax = Math.max(1, ...dailyDates.map(d => {
    const v = dailyTrafficMap[d];
    return v ? v.dep + v.arr + v.ovf : 0;
  }));

  // Personnel stats
  const personnelStats = {};
  completedLogs.forEach(l => {
    const nm = l.atc_name;
    if (!personnelStats[nm]) personnelStats[nm] = { count: 0, totalMin: 0, dep: 0, arr: 0, ovf: 0, shifts: {} };
    const p = personnelStats[nm];
    p.count++;
    const dur = l.off_time ? Math.round((new Date(l.off_time) - new Date(l.on_time)) / 60000) : 0;
    p.totalMin += dur;
    p.dep += l.departure_count || 0;
    p.arr += l.arrival_count || 0;
    p.ovf += l.overfly_count || 0;
    p.shifts[l.shift] = (p.shifts[l.shift] || 0) + 1;
  });
  const personList = Object.entries(personnelStats).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.totalMin - a.totalMin);

  // Handover checklist stats
  const clItems = ['traffic_situation', 'conflict_solution', 'weather', 'facilities', 'coordination', 'others'];
  const clStats = {};
  clItems.forEach(it => { clStats[it] = { ok: 0, notOk: 0, na: 0 }; });
  checklists.forEach(cl => {
    clItems.forEach(it => {
      const st = cl[it + '_status'];
      if (st === 'OK') clStats[it].ok++;
      else if (st === 'Not OK') clStats[it].notOk++;
      else clStats[it].na++;
    });
  });
  const totalNotOk = clItems.reduce((a, it) => a + clStats[it].notOk, 0);

  // Condition stats from daily_reports
  const conditionFields = ['general', 'notam', 'restriction', 'fir', 'weather', 'military'];
  const conditionStats = {};
  conditionFields.forEach(f => { conditionStats[f] = { ok: 0, notOk: 0 }; });
  dailyReports.forEach(dr => {
    conditionFields.forEach(f => {
      const st = dr['condition_' + f + '_status'];
      if (st === 'OK' || st === 'Operational') conditionStats[f].ok++;
      else if (st) conditionStats[f].notOk++;
    });
  });

  // Incident count
  const totalIncidents = dailyReports.reduce((a, dr) => a + (dr.incident_reports?.length || 0), 0);
  const totalDisruptions = dailyReports.reduce((a, dr) => a + (dr.operational_disruptions?.length || 0), 0);

  // On mic stats
  const totalOnMic = completedLogs.length;
  const totalHours = Math.round(completedLogs.reduce((a, l) => a + (l.off_time ? (new Date(l.off_time) - new Date(l.on_time)) / 3600000 : 0), 0) * 10) / 10;
  const activePersonnel = Object.keys(personnelStats).length;

  // ── Styles (matching app dark theme) ──
  const s = {
    card: { background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px', marginBottom: 16 },
    cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 },
    stat: (color) => ({ background: 'var(--card)', borderRadius: 10, border: '1px solid var(--border)', padding: '16px', textAlign: 'center', borderTop: `3px solid ${color}` }),
    statNum: (color) => ({ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }),
    statLabel: { fontSize: 11, color: 'var(--fg-muted)', marginTop: 6, fontWeight: 600 },
    statSub: { fontSize: 10, color: 'var(--fg-muted)', marginTop: 2 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
    th: { padding: '8px 10px', background: 'var(--bg)', fontWeight: 700, color: 'var(--fg-muted)', textAlign: 'left', borderBottom: '2px solid var(--border)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' },
    td: { padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--fg)' },
    pill: (bg, fg) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: bg, color: fg }),
    sectionTitle: { fontSize: 18, fontWeight: 700, color: 'var(--fg)', marginTop: 24, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 },
    barTrack: { flex: 1, height: 18, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden', display: 'flex' },
    empty: { textAlign: 'center', padding: '30px 0', color: 'var(--fg-muted)', fontSize: 13 },
  };

  if (!userInfo) return <div style={s.empty}>Memuat...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--fg)' }}>Monthly Report</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>{branchInfo?.name} ({userInfo.branch_code}) — {branchInfo?.city}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)', fontSize: 14 }}
          />
          {loading && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Memuat...</span>}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* OVERVIEW STATS                          */}
      {/* ═══════════════════════════════════════ */}
      <div style={s.statGrid}>
        <div style={s.stat('#0EA5E9')}>
          <div style={s.statNum('#0EA5E9')}>{totalTraffic}</div>
          <div style={s.statLabel}>Total Traffic</div>
          <div style={s.statSub}>{monthName}</div>
        </div>
        <div style={s.stat('#10B981')}>
          <div style={s.statNum('#10B981')}>{totalDep}</div>
          <div style={s.statLabel}>Departure</div>
        </div>
        <div style={s.stat('#F59E0B')}>
          <div style={s.statNum('#F59E0B')}>{totalArr}</div>
          <div style={s.statLabel}>Arrival</div>
        </div>
        <div style={s.stat('#64748B')}>
          <div style={s.statNum('#64748B')}>{totalOvf}</div>
          <div style={s.statLabel}>Overfly</div>
        </div>
        <div style={s.stat('#8B5CF6')}>
          <div style={s.statNum('#8B5CF6')}>{totalOnMic}</div>
          <div style={s.statLabel}>Total On Mic</div>
          <div style={s.statSub}>{totalHours} jam</div>
        </div>
        <div style={s.stat('#EC4899')}>
          <div style={s.statNum('#EC4899')}>{activePersonnel}/{personnel.length}</div>
          <div style={s.statLabel}>Personel Aktif</div>
        </div>
        <div style={s.stat('#0EA5E9')}>
          <div style={s.statNum('#0EA5E9')}>{dailyReports.length}/{daysInMonth}</div>
          <div style={s.statLabel}>Daily Reports</div>
          <div style={s.statSub}>Terisi</div>
        </div>
        <div style={s.stat(totalNotOk > 0 ? '#EF4444' : '#10B981')}>
          <div style={s.statNum(totalNotOk > 0 ? '#EF4444' : '#10B981')}>{checklists.length}</div>
          <div style={s.statLabel}>Handover Checklist</div>
          <div style={s.statSub}>{totalNotOk > 0 ? totalNotOk + ' Not OK' : 'Semua OK'}</div>
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 1. DAILY TRAFFIC CHART (BAR)            */}
      {/* ═══════════════════════════════════════ */}
      <div style={s.card}>
        <div style={s.cardTitle}>📊 Traffic Harian — {monthName}</div>
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${Math.max(700, daysInMonth * 24)} 200`} width="100%" style={{ display: 'block', minWidth: daysInMonth * 20 }}>
            {[0, .25, .5, .75, 1].map(f => {
              const y = 10 + (1 - f) * 150;
              return <line key={f} x1="30" y1={y} x2={daysInMonth * 22 + 30} y2={y} stroke="var(--border)" strokeWidth="0.5" />;
            })}
            {dailyDates.map((d, i) => {
              const v = dailyTrafficMap[d] || { dep: 0, arr: 0, ovf: 0 };
              const total = v.dep + v.arr + v.ovf;
              const barH = total > 0 ? (total / chartMax) * 150 : 0;
              const x = 30 + i * 22;
              const dayNum = parseInt(d.split('-')[2]);
              return (
                <g key={d}>
                  {total > 0 && <>
                    <rect x={x} y={10 + 150 - barH} width={16} height={barH * (v.dep / total)} fill="#0EA5E9" rx="1" />
                    <rect x={x} y={10 + 150 - barH + barH * (v.dep / total)} width={16} height={barH * (v.arr / total)} fill="#F59E0B" rx="1" />
                    <rect x={x} y={10 + 150 - barH + barH * ((v.dep + v.arr) / total)} width={16} height={barH * (v.ovf / total)} fill="#94A3B8" rx="1" />
                    <text x={x + 8} y={10 + 150 - barH - 4} textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--fg-muted)">{total}</text>
                  </>}
                  <text x={x + 8} y={175} textAnchor="middle" fontSize="8" fill="var(--fg-muted)">{dayNum}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11 }}>
          {[['DEP', '#0EA5E9'], ['ARR', '#F59E0B'], ['OVF', '#94A3B8']].map(([l, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fg-muted)' }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />{l}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 2. DAILY REPORTS STATUS TABLE            */}
      {/* ═══════════════════════════════════════ */}
      <div style={s.card}>
        <div style={s.cardTitle}>📋 Status Daily Report per Hari</div>
        {dailyReports.length === 0 ? (
          <div style={s.empty}>Belum ada daily report untuk bulan ini</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Tanggal</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Manager</th>
                  <th style={s.th}>Kondisi Umum</th>
                  <th style={s.th}>Cuaca</th>
                  <th style={s.th}>NOTAM</th>
                  <th style={s.th}>Insiden</th>
                  <th style={s.th}>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {dailyReports.map(dr => (
                  <tr key={dr.id}>
                    <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{new Date(dr.report_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}</td>
                    <td style={s.td}>
                      <span style={s.pill(dr.status === 'submitted' ? '#dcfce7' : '#fef3c7', dr.status === 'submitted' ? '#166534' : '#92400e')}>
                        {dr.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ ...s.td, fontSize: 11 }}>{dr.manager_name || '-'}</td>
                    <td style={s.td}>
                      <span style={s.pill(dr.condition_general_status === 'OK' ? '#dcfce7' : '#fef2f2', dr.condition_general_status === 'OK' ? '#166534' : '#991b1b')}>
                        {dr.condition_general_status || '-'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={s.pill(dr.condition_weather_status === 'OK' ? '#dcfce7' : '#fef2f2', dr.condition_weather_status === 'OK' ? '#166534' : '#991b1b')}>
                        {dr.condition_weather_status || '-'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={s.pill(dr.condition_notam_status === 'OK' ? '#dcfce7' : '#fef2f2', dr.condition_notam_status === 'OK' ? '#166534' : '#991b1b')}>
                        {dr.condition_notam_status || '-'}
                      </span>
                    </td>
                    <td style={{ ...s.td, textAlign: 'center' }}>
                      {(dr.incident_reports?.length || 0) > 0
                        ? <span style={s.pill('#fef2f2', '#991b1b')}>{dr.incident_reports.length}</span>
                        : <span style={{ color: 'var(--fg-muted)', fontSize: 11 }}>0</span>}
                    </td>
                    <td style={{ ...s.td, fontSize: 11, color: 'var(--fg-muted)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dr.operational_notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 3. TRAFFIC PER CATEGORY (from daily_reports) */}
      {/* ═══════════════════════════════════════ */}
      {Object.keys(drTraffic).length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>✈️ Traffic Per Kategori (dari Daily Report)</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Kategori</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>DEP Dom</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>DEP Int</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>ARR Dom</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>ARR Int</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>OVF</th>
                  <th style={{ ...s.th, textAlign: 'center', fontWeight: 800 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(drTraffic).map(([type, d]) => {
                  const tot = d.depDom + d.depInt + d.arrDom + d.arrInt + d.ovf;
                  return (
                    <tr key={type}>
                      <td style={{ ...s.td, fontWeight: 600, textTransform: 'capitalize' }}>{type}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{d.depDom || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{d.depInt || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{d.arrDom || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{d.arrInt || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{d.ovf || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 800 }}>{tot}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* 4. REKAP PERSONEL                       */}
      {/* ═══════════════════════════════════════ */}
      <div style={s.card}>
        <div style={s.cardTitle}>👥 Rekap Personel — {monthName}</div>
        {personList.length === 0 ? (
          <div style={s.empty}>Belum ada data on mic bulan ini</div>
        ) : (<>
          {/* Top 10 bar */}
          <div style={{ marginBottom: 16 }}>
            {personList.slice(0, 10).map(p => {
              const hrs = Math.round(p.totalMin / 60 * 10) / 10;
              const maxMin = personList[0].totalMin || 1;
              return (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg)', minWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <div style={s.barTrack}>
                    <div style={{ width: (p.totalMin / maxMin * 100) + '%', background: 'linear-gradient(90deg, #0EA5E9, #38BDF8)', height: '100%', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, minWidth: 40 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#fff' }}>{hrs}h</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--fg-muted)', minWidth: 40, textAlign: 'right' }}>{p.count}x</span>
                </div>
              );
            })}
          </div>

          {/* Full table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Nama</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>On Mic</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Jam Kerja</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Rata-rata</th>
                  <th style={{ ...s.th, textAlign: 'center', color: '#0EA5E9' }}>DEP</th>
                  <th style={{ ...s.th, textAlign: 'center', color: '#F59E0B' }}>ARR</th>
                  <th style={{ ...s.th, textAlign: 'center', color: '#64748B' }}>OVF</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Traffic</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Pagi</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Siang</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Malam</th>
                </tr>
              </thead>
              <tbody>
                {personList.map(p => {
                  const hrs = Math.round(p.totalMin / 60 * 10) / 10;
                  const avg = p.count ? Math.round(p.totalMin / p.count) : 0;
                  const tc = p.dep + p.arr + p.ovf;
                  return (
                    <tr key={p.name}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{p.name}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{p.count}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 600, color: '#0EA5E9' }}>{hrs}h</td>
                      <td style={{ ...s.td, textAlign: 'center', color: 'var(--fg-muted)' }}>{avg}m</td>
                      <td style={{ ...s.td, textAlign: 'center', color: '#0EA5E9' }}>{p.dep}</td>
                      <td style={{ ...s.td, textAlign: 'center', color: '#F59E0B' }}>{p.arr}</td>
                      <td style={{ ...s.td, textAlign: 'center', color: '#64748B' }}>{p.ovf}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontWeight: 700 }}>{tc}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontSize: 11 }}>{p.shifts.Morning || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontSize: 11 }}>{p.shifts.Afternoon || 0}</td>
                      <td style={{ ...s.td, textAlign: 'center', fontSize: 11 }}>{p.shifts.Night || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700 }}>
                  <td style={{ ...s.td, textAlign: 'right', color: 'var(--fg-muted)' }}>TOTAL</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{totalOnMic}</td>
                  <td style={{ ...s.td, textAlign: 'center', color: '#0EA5E9' }}>{totalHours}h</td>
                  <td style={s.td}></td>
                  <td style={{ ...s.td, textAlign: 'center', color: '#0EA5E9' }}>{totalDep}</td>
                  <td style={{ ...s.td, textAlign: 'center', color: '#F59E0B' }}>{totalArr}</td>
                  <td style={{ ...s.td, textAlign: 'center', color: '#64748B' }}>{totalOvf}</td>
                  <td style={{ ...s.td, textAlign: 'center' }}>{totalTraffic}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>)}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 5. HANDOVER CHECKLIST SUMMARY           */}
      {/* ═══════════════════════════════════════ */}
      <div style={s.card}>
        <div style={s.cardTitle}>📋 Rekap Handover Checklist — {checklists.length} checklist</div>
        {checklists.length === 0 ? (
          <div style={s.empty}>Belum ada handover checklist bulan ini</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Item</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>OK</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>Not OK</th>
                  <th style={{ ...s.th, textAlign: 'center' }}>N/A</th>
                  <th style={s.th}>Rasio OK</th>
                </tr>
              </thead>
              <tbody>
                {clItems.map(it => {
                  const d = clStats[it];
                  const total = d.ok + d.notOk + d.na;
                  const ratio = total > 0 ? Math.round(d.ok / (d.ok + d.notOk || 1) * 100) : 0;
                  const label = it.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <tr key={it}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{label}</td>
                      <td style={{ ...s.td, textAlign: 'center' }}><span style={s.pill('#dcfce7', '#166534')}>{d.ok}</span></td>
                      <td style={{ ...s.td, textAlign: 'center' }}>{d.notOk > 0 ? <span style={s.pill('#fef2f2', '#991b1b')}>{d.notOk}</span> : <span style={{ color: 'var(--fg-muted)' }}>0</span>}</td>
                      <td style={{ ...s.td, textAlign: 'center', color: 'var(--fg-muted)' }}>{d.na}</td>
                      <td style={s.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: ratio + '%', height: '100%', background: ratio >= 80 ? '#10B981' : ratio >= 50 ? '#F59E0B' : '#EF4444', borderRadius: 4 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', minWidth: 32 }}>{ratio}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* 6. KONDISI OPERASIONAL SUMMARY          */}
      {/* ═══════════════════════════════════════ */}
      {dailyReports.length > 0 && (
        <div style={s.card}>
          <div style={s.cardTitle}>⚙️ Kondisi Operasional (dari Daily Report)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {conditionFields.map(f => {
              const d = conditionStats[f];
              const label = { general: 'Kondisi Umum', notam: 'NOTAM', restriction: 'Restriksi', fir: 'FIR/Sektor', weather: 'Cuaca', military: 'Militer' }[f] || f;
              return (
                <div key={f} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                    <span style={s.pill('#dcfce7', '#166534')}>OK: {d.ok}</span>
                    {d.notOk > 0 && <span style={s.pill('#fef2f2', '#991b1b')}>Issue: {d.notOk}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* 7. INSIDEN & GANGGUAN SUMMARY           */}
      {/* ═══════════════════════════════════════ */}
      {(totalIncidents > 0 || totalDisruptions > 0) && (
        <div style={s.card}>
          <div style={s.cardTitle}>⚠️ Insiden & Gangguan</div>
          <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--fg-muted)' }}>Total Insiden: </span>
              <strong style={{ color: totalIncidents > 0 ? '#EF4444' : 'var(--fg)' }}>{totalIncidents}</strong>
            </div>
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--fg-muted)' }}>Total Gangguan: </span>
              <strong style={{ color: totalDisruptions > 0 ? '#F59E0B' : 'var(--fg)' }}>{totalDisruptions}</strong>
            </div>
          </div>
          {dailyReports.filter(dr => (dr.incident_reports?.length || 0) > 0).map(dr => (
            <div key={dr.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>
                {new Date(dr.report_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              {dr.incident_reports.map((inc, idx) => (
                <div key={idx} style={{ background: '#fef2f2', borderRadius: 6, padding: '8px 12px', marginBottom: 4, fontSize: 12, color: '#991b1b', border: '1px solid #fecaca' }}>
                  <strong>{inc.incident_type || 'Insiden'}</strong>
                  {inc.affected_system && <span> — {inc.affected_system}</span>}
                  {inc.duration_minutes > 0 && <span> ({inc.duration_minutes} mnt)</span>}
                  {inc.follow_up_action && <div style={{ marginTop: 2, fontSize: 11, color: '#7f1d1d' }}>Tindak lanjut: {inc.follow_up_action}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 11, color: 'var(--fg-muted)' }}>
        Monthly Report — {branchInfo?.name} ({userInfo.branch_code}) — {monthName}
      </div>
    </div>
  );
}
 
