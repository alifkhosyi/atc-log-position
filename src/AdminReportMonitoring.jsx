import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

// ─── Constants ────────────────────────────────────────────────
const OPERATIONAL_ASPECTS = [
  { key: 'general',     label: 'Kondisi Umum', icon: '🌐' },
  { key: 'notam',       label: 'NOTAM',        icon: '📋' },
  { key: 'restriction', label: 'Restriksi',    icon: '🚫' },
  { key: 'fir',         label: 'FIR/Sektor',   icon: '📡' },
  { key: 'weather',     label: 'Cuaca',        icon: '⛈️' },
  { key: 'military',    label: 'Militer',      icon: '✈️' },
];
const COMM_SYSTEMS = [
  { key: 'vhfPrimary',  label: 'VHF Primary' },
  { key: 'vhfStandby',  label: 'VHF Standby' },
  { key: 'hf',          label: 'HF Comm' },
  { key: 'aftn',        label: 'AFTN/AMHS' },
  { key: 'vccs',        label: 'VCCS' },
  { key: 'vsat',        label: 'VSAT' },
  { key: 'interphone',  label: 'Interphone' },
  { key: 'recorder',    label: 'Recorder' },
];
const TRAFFIC_TYPES = [
  { key: 'scheduled', label: 'Scheduled' }, { key: 'unscheduled', label: 'Unscheduled' },
  { key: 'vip', label: 'VIP' }, { key: 'cargo', label: 'Cargo' },
  { key: 'military', label: 'Military' }, { key: 'helicopter', label: 'Helicopter' },
  { key: 'training', label: 'Training' },
];
const TRAFFIC_GROUPS = [
  { label: 'DEPARTURE', color: '#10b981', cols: [{ key: 'depDom', label: 'DOM' }, { key: 'depInt', label: 'INT' }] },
  { label: 'ARRIVAL',   color: '#38bdf8', cols: [{ key: 'arrDom', label: 'DOM' }, { key: 'arrInt', label: 'INT' }] },
  { label: 'OTHERS',    color: '#94a3b8', cols: [
    { key: 'ovf', label: 'OVF' }, { key: 'adv', label: 'ADV' }, { key: 'ext', label: 'EXT' },
    { key: 'dla', label: 'DLA' }, { key: 'cnl', label: 'CNL' }, { key: 'ef', label: 'EF' },
    { key: 'cf', label: 'CF' }, { key: 'rtb', label: 'RTB' }, { key: 'rta', label: 'RTA' },
    { key: 'dvt', label: 'DVT' }, { key: 'ga', label: 'GA' },
  ]},
];
const ALL_COLS = TRAFFIC_GROUPS.flatMap(g => g.cols);
const SECTIONS_DETAIL = [
  { id: 'A', label: 'Identifikasi', icon: '📄' },
  { id: 'B', label: 'Kondisi Ops',  icon: '🌐' },
  { id: 'C', label: 'Traffic',      icon: '✈️' },
  { id: 'D', label: 'Komunikasi',   icon: '📡' },
  { id: 'E', label: 'Insiden',      icon: '⚠️' },
  { id: 'F', label: 'Catatan',      icon: '📝' },
];

// ─── Helpers ──────────────────────────────────────────────────
const fmtD = d => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDT = d => d ? new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

// ─── Sub-components ───────────────────────────────────────────
const Dot = ({ color, glow }) => (
  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0,
    boxShadow: glow ? `0 0 6px ${color}` : 'none' }} />
);

const StatusBadge = ({ status }) => {
  const map = {
    submitted:  { bg: 'rgba(16,185,129,0.15)',  color: '#10b981', label: 'Submitted' },
    draft:      { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', label: 'Draft' },
    belum:      { bg: 'rgba(100,116,139,0.15)', color: '#64748b', label: 'Belum Lapor' },
  };
  const s = map[status] || map.belum;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
      borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
      <Dot color={s.color} glow={status === 'submitted'} />{s.label}
    </span>
  );
};

const MiniStat = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.3px' }}>{label}</div>
  </div>
);

const Panel = ({ title, badge, glow, children, action, noPad }) => (
  <div style={{
    background: 'var(--card)', border: `1px solid ${glow ? glow + '44' : 'var(--border)'}`,
    borderRadius: 12, marginBottom: 16, overflow: 'hidden',
    boxShadow: glow ? `0 0 20px ${glow}18` : 'none',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '11px 16px', borderBottom: '1px solid var(--border)',
      background: glow ? glow + '08' : 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge && <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8',
          padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{badge}</span>}
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--fg)',
          textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</h3>
      </div>
      {action}
    </div>
    <div style={noPad ? {} : { padding: '16px' }}>{children}</div>
  </div>
);

const th = (extra) => ({
  padding: '6px 8px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '.4px', border: '1px solid var(--border)', textAlign: 'center',
  whiteSpace: 'nowrap', ...extra,
});
const td = (extra) => ({
  border: '1px solid var(--border)', padding: '4px 6px', textAlign: 'center',
  fontSize: 12, ...extra,
});

// ─── Detail View ──────────────────────────────────────────────
function ReportDetail({ report, onBack }) {
  const [activeTab, setActiveTab] = useState('A');

  if (!report) return null;

  const tm = report.traffic_movements || [];
  const rowTotal = (fk) => ALL_COLS.reduce((s, c) => {
    const row = tm.find(r => r.flight_type === fk);
    return s + (parseInt(row?.[c.key]) || 0);
  }, 0);
  const colTotal = (ck) => tm.reduce((s, r) => s + (parseInt(r[ck]) || 0), 0);
  const grandTotal = () => TRAFFIC_TYPES.reduce((s, t) => s + rowTotal(t.key), 0);

  const incidents = report.incident_reports || [];
  const commSystems = report.communication_systems || [];
  const commIssues = commSystems.filter(s => s.status !== 'Operational');
  const bProblems = OPERATIONAL_ASPECTS.filter(a => {
    const val = report[`condition_${a.key}_status`];
    return val && val !== 'Normal';
  });

  const sIdx = SECTIONS_DETAIL.findIndex(s => s.id === activeTab);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Back + Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--fg)',
          fontWeight: 600, fontSize: 12, cursor: 'pointer',
        }}>← Kembali</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--fg)' }}>
              {report.branch_code} — Daily Report
            </h2>
            <StatusBadge status={report.status || 'belum'} />
          </div>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
            {report.unit_name} · {fmtD(report.report_date)} · No. {report.report_number || '—'} · Manager: {report.manager_name || '—'}
          </p>
        </div>
      </div>

      {/* Quick Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Traffic', val: grandTotal(), color: '#38bdf8' },
          { label: 'OTP Airline',   val: report.otp_airline_percentage != null ? report.otp_airline_percentage + '%' : '—', color: '#38bdf8' },
          { label: 'DEP Punct.',    val: report.dep_punctuality_percentage != null ? report.dep_punctuality_percentage + '%' : '—', color: '#10b981' },
          { label: 'ARR Punct.',    val: report.arr_punctuality_percentage != null ? report.arr_punctuality_percentage + '%' : '—', color: '#f59e0b' },
          { label: 'Insiden',       val: incidents.filter(i => i.incident_type).length, color: incidents.filter(i => i.incident_type).length > 0 ? '#ef4444' : '#64748b' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ background: 'var(--card)', border: `1px solid ${color}33`,
            borderRadius: 10, padding: '12px', textAlign: 'center', boxShadow: `0 0 12px ${color}10` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color }}>{val ?? '—'}</div>
          </div>
        ))}
      </div>

      {/* Tab Navigator */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12,
        padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
        {SECTIONS_DETAIL.map((sec, i) => {
          const active = activeTab === sec.id;
          const done = i < sIdx;
          return (
            <React.Fragment key={sec.id}>
              <button type="button" onClick={() => setActiveTab(sec.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(56,189,248,0.12)' : 'transparent', transition: 'all .2s', flexShrink: 0,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800,
                  background: active ? '#38bdf8' : done ? 'rgba(16,185,129,0.2)' : 'var(--bg)',
                  color: active ? '#0f172a' : done ? '#10b981' : 'var(--fg-muted)',
                  border: `2px solid ${active ? '#38bdf8' : done ? '#10b981' : 'var(--border)'}`,
                  boxShadow: active ? '0 0 10px #38bdf866' : 'none',
                }}>{done ? '✓' : sec.id}</div>
                <span style={{ fontSize: 9, fontWeight: 600, color: active ? '#38bdf8' : done ? '#10b981' : 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                  {sec.icon} {sec.label}
                </span>
              </button>
              {i < SECTIONS_DETAIL.length - 1 && (
                <div style={{ flex: 1, height: 2, minWidth: 8, background: i < sIdx ? 'rgba(16,185,129,0.4)' : 'var(--border)' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── A: Identifikasi ── */}
      {activeTab === 'A' && (
        <Panel badge="A" title="Identifikasi Laporan" glow="#38bdf8">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
            {[
              ['Tanggal Laporan', fmtD(report.report_date)],
              ['Nomor Laporan',   report.report_number || '—'],
              ['Periode UTC',     `${report.period_start || '0000'} – ${report.period_end || '2359'}`],
              ['Unit',           report.unit_name || '—'],
              ['Manager Operasi', report.manager_name || '—'],
              ['Lokasi',          report.location || '—'],
            ].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>{k}</div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{v}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* ── B: Kondisi Operasional ── */}
      {activeTab === 'B' && (
        <Panel badge="B" title="Kondisi Operasional Umum"
          glow={bProblems.length > 0 ? '#f59e0b' : '#10b981'}
          action={bProblems.length > 0
            ? <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>⚠ {bProblems.length} perlu perhatian</span>
            : <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>✓ Semua Normal</span>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {OPERATIONAL_ASPECTS.map(a => {
              const status = report[`condition_${a.key}_status`] || 'Normal';
              const notes  = report[`condition_${a.key}_notes`]  || '';
              const waktu  = report[`condition_${a.key}_waktu`]  || '';
              const color  = status === 'Normal' ? '#10b981' : status === 'Perhatian' ? '#f59e0b' : '#ef4444';
              const problem = status !== 'Normal';
              return (
                <div key={a.key} style={{
                  display: 'grid', gridTemplateColumns: '200px 120px 80px 1fr', gap: 10, alignItems: 'center',
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${problem ? color + '44' : 'var(--border)'}`,
                  background: problem ? color + '06' : 'rgba(255,255,255,0.01)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{a.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                    borderRadius: 20, background: color + '20', color, fontSize: 11, fontWeight: 700 }}>
                    <Dot color={color} glow={problem} />{status}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{waktu || '—'}</span>
                  <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{notes || '—'}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ── C: Traffic ── */}
      {activeTab === 'C' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total Traffic', val: grandTotal(), color: '#38bdf8' },
              { label: 'Departure', val: ['depDom','depInt'].reduce((s,k) => s + colTotal(k), 0), color: '#10b981' },
              { label: 'Arrival',   val: ['arrDom','arrInt'].reduce((s,k) => s + colTotal(k), 0), color: '#38bdf8' },
              { label: 'Overfly',   val: colTotal('ovf'), color: '#f59e0b' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'var(--card)', border: `1px solid ${color}33`, borderRadius: 10, padding: '14px', textAlign: 'center', boxShadow: `0 0 12px ${color}10` }}>
                <div style={{ fontSize: 10, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
              </div>
            ))}
          </div>

          <Panel badge="C" title="Movement Traffic Harian" glow="#10b981">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 750 }}>
                <thead>
                  <tr>
                    <th style={th({ textAlign: 'left', minWidth: 130, background: 'var(--bg)' })} rowSpan={2}>Jenis Penerbangan</th>
                    {TRAFFIC_GROUPS.map(g => (
                      <th key={g.label} colSpan={g.cols.length} style={th({ background: g.color + '22', color: g.color })}>{g.label}</th>
                    ))}
                    <th style={th({ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', minWidth: 48 })}>TOTAL</th>
                  </tr>
                  <tr>
                    {TRAFFIC_GROUPS.map(g => g.cols.map(c => (
                      <th key={c.key} style={th({ background: g.color + '11', color: g.color, minWidth: 38 })}>{c.label}</th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {TRAFFIC_TYPES.map((t, ri) => {
                    const row = tm.find(r => r.flight_type === t.key) || {};
                    return (
                      <tr key={t.key} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                        <td style={{ ...td({ textAlign: 'left', padding: '7px 10px' }), fontWeight: 600, color: 'var(--fg)' }}>{t.label}</td>
                        {ALL_COLS.map(c => (
                          <td key={c.key} style={td({ color: (parseInt(row[c.key]) || 0) > 0 ? 'var(--fg)' : 'var(--fg-muted)' })}>
                            {row[c.key] || '—'}
                          </td>
                        ))}
                        <td style={td({ fontWeight: 800, color: '#38bdf8', background: 'rgba(56,189,248,0.06)' })}>{rowTotal(t.key) || '—'}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'rgba(56,189,248,0.05)' }}>
                    <td style={{ ...td({ textAlign: 'left', padding: '7px 10px' }), fontWeight: 800, color: '#38bdf8' }}>TOTAL</td>
                    {ALL_COLS.map(c => (<td key={c.key} style={td({ fontWeight: 700, color: '#38bdf8' })}>{colTotal(c.key) || '—'}</td>))}
                    <td style={td({ fontWeight: 900, fontSize: 13, color: '#f59e0b', background: 'rgba(245,158,11,0.1)' })}>{grandTotal() || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          {/* C.3 OTP */}
          <Panel badge="C.3" title="Kinerja Ketepatan Waktu">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {[['OTP Airline', report.otp_airline_percentage, '#38bdf8'], ['DEP Punctuality', report.dep_punctuality_percentage, '#10b981'], ['ARR Punctuality', report.arr_punctuality_percentage, '#f59e0b']].map(([label, val, color]) => (
                <div key={label} style={{ background: color + '0d', border: `1px solid ${color}33`, borderRadius: 12, padding: '18px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color }}>{val != null ? val + '%' : '—'}</div>
                </div>
              ))}
            </div>
          </Panel>

          {/* C.2 Disruptions */}
          {(report.operational_disruptions || []).length > 0 && (
            <Panel badge="C.2" title="Gangguan Operasional">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(report.operational_disruptions || []).map((d, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 70px 1fr 1fr', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{d.kategori}</span>
                    <span style={{ fontWeight: 800, fontSize: 16, color: d.total > 0 ? '#ef4444' : 'var(--fg-muted)', textAlign: 'center' }}>{d.total ?? '—'}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{d.tindak_lanjut || '—'}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{d.keterangan || '—'}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}

      {/* ── D: Komunikasi ── */}
      {activeTab === 'D' && (
        <Panel badge="D" title="Laporan Komunikasi Penerbangan"
          glow={commIssues.length > 0 ? '#f59e0b' : '#10b981'}
          action={commIssues.length > 0
            ? <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>⚠ {commIssues.length} tidak normal</span>
            : <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>✓ Semua Operational</span>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COMM_SYSTEMS.map(s => {
              const sys = commSystems.find(x => x.system_key === s.key || x.system_name?.includes(s.label.split(' ')[0]));
              const status = sys?.status || 'Operational';
              const color  = status === 'Operational' ? '#10b981' : status === 'Degraded' ? '#f59e0b' : '#ef4444';
              const notOp  = status !== 'Operational';
              return (
                <div key={s.key} style={{
                  display: 'grid', gridTemplateColumns: '220px 140px 1fr', gap: 12, alignItems: 'center',
                  padding: '10px 14px', borderRadius: 10,
                  border: `1px solid ${notOp ? color + '44' : 'var(--border)'}`,
                  background: notOp ? color + '06' : 'rgba(255,255,255,0.01)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Dot color={color} glow={true} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</span>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
                    borderRadius: 20, background: color + '20', color, fontSize: 11, fontWeight: 700 }}>{status}</span>
                  <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{sys?.notes || '—'}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ── E: Insiden ── */}
      {activeTab === 'E' && (
        <Panel badge="E" title="Gangguan, Insiden & Tindak Lanjut"
          glow={incidents.filter(i => i.incident_type).length > 0 ? '#ef4444' : undefined}>
          {incidents.filter(i => i.incident_type || i.incident_time).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--fg-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ margin: 0, fontSize: 13 }}>Tidak ada gangguan atau insiden</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {incidents.filter(i => i.incident_type || i.incident_time).map((inc, i) => (
                <div key={i} style={{ padding: '14px', borderRadius: 10, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>⚠ Insiden {i + 1}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>{inc.incident_type}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[['Waktu UTC', inc.incident_time || '—'], ['Sistem Terdampak', inc.affected_system || '—'], ['Durasi', inc.duration_minutes ? inc.duration_minutes + ' menit' : '—']].map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 10px', border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>{k}</div>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {inc.follow_up_action && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'var(--bg)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 3 }}>Tindak Lanjut</div>
                      <div style={{ fontSize: 12 }}>{inc.follow_up_action}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── F: Catatan ── */}
      {activeTab === 'F' && (
        <>
          <Panel badge="F" title="Catatan Operasional" glow="#8b5cf6">
            {report.operational_notes ? (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: 'var(--fg)', padding: '4px 0' }}>{report.operational_notes}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-muted)', fontStyle: 'italic' }}>Tidak ada catatan operasional.</p>
            )}
          </Panel>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>✍️ Dibuat Oleh</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[['Nama', report.manager_name || '—'], ['Jabatan', 'Manager Operasi'], ['Tanggal', fmtD(report.report_date)], ['Unit', report.unit_name || '—']].map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center', padding: '10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 5 }}>{k}</div>
                  <div style={{ fontWeight: 700, fontSize: 12, borderTop: '2px solid var(--fg)', paddingTop: 5 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Tab nav buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <button onClick={() => sIdx > 0 && setActiveTab(SECTIONS_DETAIL[sIdx - 1].id)} disabled={sIdx === 0} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--fg-muted)', fontWeight: 600, fontSize: 12, cursor: sIdx === 0 ? 'not-allowed' : 'pointer', opacity: sIdx === 0 ? 0.4 : 1,
        }}>← Sebelumnya</button>
        <button onClick={() => sIdx < SECTIONS_DETAIL.length - 1 && setActiveTab(SECTIONS_DETAIL[sIdx + 1].id)} disabled={sIdx === SECTIONS_DETAIL.length - 1} style={{
          padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--fg-muted)', fontWeight: 600, fontSize: 12, cursor: sIdx === SECTIONS_DETAIL.length - 1 ? 'not-allowed' : 'pointer', opacity: sIdx === SECTIONS_DETAIL.length - 1 ? 0.4 : 1,
        }}>Berikutnya →</button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function AdminReportMonitoring() {
  const [branches, setBranches]         = useState([]);
  const [reports, setReports]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [filterDate, setFilterDate]     = useState(new Date().toISOString().split('T')[0]);
  const [filterBranch, setFilterBranch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('branches').select('code,name,city').order('code');
      setBranches(data || []);
    })();
  }, []);

  useEffect(() => {
    loadReports();
  }, [filterDate, filterBranch]);

  const loadReports = async () => {
    setLoading(true);
    try {
      let q = supabase.from('daily_reports')
        .select('*,traffic_movements(*),hourly_traffic(*),operational_disruptions(*),communication_systems(*),incident_reports(*)')
        .eq('report_date', filterDate);
      if (filterBranch) q = q.eq('branch_code', filterBranch);
      const { data } = await q.order('created_at', { ascending: false });
      setReports(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  if (selectedReport) {
    return <ReportDetail report={selectedReport} onBack={() => setSelectedReport(null)} />;
  }

  // Map reports by branch_code
  const reportMap = {};
  reports.forEach(r => { reportMap[r.branch_code] = r; });

  const filteredBranches = filterBranch ? branches.filter(b => b.code === filterBranch) : branches;

  const submitted  = reports.filter(r => r.status === 'submitted').length;
  const draft      = reports.filter(r => r.status === 'draft').length;
  const totalExpected = filteredBranches.length;
  const belumLapor = totalExpected - reports.length;

  return (
    <div style={{ paddingBottom: 40 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>📊</span>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--fg)' }}>Monitoring Daily Reports</h2>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-muted)' }}>Pantau laporan harian dari semua cabang</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Cabang</div>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{
              padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--fg)', fontSize: 12, minWidth: 160,
            }}>
              <option value="">Semua Cabang</option>
              {branches.map(b => <option key={b.code} value={b.code}>{b.code} — {b.city}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Tanggal</div>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{
              padding: '7px 10px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--bg)', color: 'var(--fg)', fontSize: 12,
            }} />
          </div>
          <button onClick={loadReports} style={{
            padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer', marginTop: 18,
          }}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Cabang',   val: totalExpected, color: '#38bdf8', icon: '🏢' },
          { label: 'Submitted',      val: submitted,      color: '#10b981', icon: '✅' },
          { label: 'Draft',          val: draft,          color: '#f59e0b', icon: '📝' },
          { label: 'Belum Lapor',    val: Math.max(0, belumLapor), color: '#ef4444', icon: '⏳' },
        ].map(({ label, val, color, icon }) => (
          <div key={label} style={{ background: 'var(--card)', border: `1px solid ${color}33`,
            borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: `0 0 16px ${color}12` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '18',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{icon}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>{val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Branch Cards ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--fg-muted)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <p>Memuat laporan...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {filteredBranches.map(branch => {
            const report = reportMap[branch.code];
            const status = report?.status || 'belum';
            const borderColor = status === 'submitted' ? '#10b981' : status === 'draft' ? '#f59e0b' : '#334155';
            const glowColor   = status === 'submitted' ? '#10b981' : status === 'draft' ? '#f59e0b' : null;

            // Compute quick stats from report
            const tm = report?.traffic_movements || [];
            const totalTraffic = tm.reduce((s, r) => s + ALL_COLS.reduce((ss, c) => ss + (parseInt(r[c.key]) || 0), 0), 0);
            const commIss = (report?.communication_systems || []).filter(s => s.status !== 'Operational').length;
            const incCount = (report?.incident_reports || []).filter(i => i.incident_type).length;
            const bIss = report ? OPERATIONAL_ASPECTS.filter(a => {
              const val = report[`condition_${a.key}_status`];
              return val && val !== 'Normal';
            }).length : 0;

            return (
              <div key={branch.code}
                onClick={() => report && setSelectedReport(report)}
                style={{
                  background: 'var(--card)',
                  border: `1.5px solid ${borderColor}${status === 'belum' ? '' : '66'}`,
                  borderRadius: 14, padding: '18px',
                  cursor: report ? 'pointer' : 'default',
                  boxShadow: glowColor ? `0 0 18px ${glowColor}18, 0 0 4px ${glowColor}10` : 'none',
                  transition: 'all .2s', opacity: status === 'belum' ? 0.65 : 1,
                }}
                onMouseEnter={e => { if (report) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--fg)' }}>{branch.code}</span>
                      <StatusBadge status={status} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>{branch.name} · {branch.city}</div>
                  </div>
                  {report && <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{fmtDT(report.created_at)}</span>}
                </div>

                {report ? (
                  <>
                    {/* OTP Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                      {[
                        ['OTP', report.otp_airline_percentage, '#38bdf8'],
                        ['DEP', report.dep_punctuality_percentage, '#10b981'],
                        ['ARR', report.arr_punctuality_percentage, '#f59e0b'],
                      ].map(([k, v, color]) => (
                        <div key={k} style={{ background: color + '0d', border: `1px solid ${color}22`,
                          borderRadius: 8, padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color, letterSpacing: '.3px' }}>{k}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color }}>{v != null ? v + '%' : '—'}</div>
                        </div>
                      ))}
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12, padding: '10px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <MiniStat label="Traffic" value={totalTraffic} color="#38bdf8" />
                      <MiniStat label="Ops Issue" value={bIss} color={bIss > 0 ? '#f59e0b' : '#64748b'} />
                      <MiniStat label="Comm Issue" value={commIss} color={commIss > 0 ? '#f59e0b' : '#64748b'} />
                      <MiniStat label="Insiden" value={incCount} color={incCount > 0 ? '#ef4444' : '#64748b'} />
                    </div>

                    {/* Alert strip */}
                    {(bIss > 0 || commIss > 0 || incCount > 0) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                        {bIss > 0 && <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>⚠ {bIss} ops</span>}
                        {commIss > 0 && <span style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>📡 {commIss} comm</span>}
                        {incCount > 0 && <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>🚨 {incCount} insiden</span>}
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                        No. {report.report_number || '—'} · {report.manager_name || '—'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#38bdf8' }}>Lihat Detail →</span>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--fg-muted)' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
                    <p style={{ margin: 0, fontSize: 12 }}>Belum ada laporan</p>
                    <p style={{ margin: '3px 0 0', fontSize: 11 }}>untuk tanggal ini</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
