import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';

// ─── Constants ────────────────────────────────────────────────
const TRAFFIC_TYPES = [
  { key: 'scheduled',   label: 'Scheduled' },
  { key: 'unscheduled', label: 'Unscheduled' },
  { key: 'vip',         label: 'VIP' },
  { key: 'cargo',       label: 'Cargo' },
  { key: 'military',    label: 'Military / State' },
  { key: 'helicopter',  label: 'Helicopter' },
  { key: 'training',    label: 'Training / Circuit' },
];

const TRAFFIC_GROUPS = [
  { label: 'DEPARTURE', color: '#10b981', cols: [
    { key: 'depDom', label: 'DOM' },
    { key: 'depInt', label: 'INT' },
  ]},
  { label: 'ARRIVAL', color: '#38bdf8', cols: [
    { key: 'arrDom', label: 'DOM' },
    { key: 'arrInt', label: 'INT' },
  ]},
  { label: 'OTHERS', color: '#94a3b8', cols: [
    { key: 'ovf', label: 'OVF' },
    { key: 'adv', label: 'ADV' },
    { key: 'ext', label: 'EXT' },
    { key: 'dla', label: 'DLA' },
    { key: 'cnl', label: 'CNL' },
    { key: 'ef',  label: 'EF'  },
    { key: 'cf',  label: 'CF'  },
    { key: 'rtb', label: 'RTB' },
    { key: 'rta', label: 'RTA' },
    { key: 'dvt', label: 'DVT' },
    { key: 'ga',  label: 'GA'  },
  ]},
];

const ALL_COLS = TRAFFIC_GROUPS.flatMap(g => g.cols);

const COMM_SYSTEMS = [
  { key: 'vhfPrimary',  label: 'VHF Ground-to-Air (Primary)' },
  { key: 'vhfStandby',  label: 'VHF Ground-to-Air (Standby)' },
  { key: 'hf',          label: 'HF Communication' },
  { key: 'aftn',        label: 'AFTN / AMHS' },
  { key: 'vccs',        label: 'VCCS (Voice Comm. System)' },
  { key: 'vsat',        label: 'VSAT / Data Link' },
  { key: 'interphone',  label: 'Interphone / Hotline' },
  { key: 'recorder',    label: 'Recorder System' },
];

const OPERATIONAL_ASPECTS = [
  { key: 'general',     label: 'Kondisi Umum Ruang Udara', icon: '🌐' },
  { key: 'notam',       label: 'NOTAM Aktif',              icon: '📋' },
  { key: 'restriction', label: 'Restriksi Airspace',       icon: '🚫' },
  { key: 'fir',         label: 'Status FIR / Sektor',      icon: '📡' },
  { key: 'weather',     label: 'Kondisi Cuaca (SIGMET)',   icon: '⛈️' },
  { key: 'military',    label: 'Koordinasi Militer',       icon: '✈️' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0') + '00');

const SECTIONS = [
  { id: 'A', label: 'Identifikasi',  icon: '📄' },
  { id: 'B', label: 'Kondisi Ops',   icon: '🌐' },
  { id: 'C', label: 'Traffic',       icon: '✈️' },
  { id: 'D', label: 'Komunikasi',    icon: '📡' },
  { id: 'E', label: 'Insiden',       icon: '⚠️' },
  { id: 'F', label: 'Catatan',       icon: '📝' },
];

const emptyTrafficRow = () => ALL_COLS.reduce((a, c) => ({ ...a, [c.key]: '' }), {});
const emptyIncident   = () => ({ waktu: '', jenis: '', sistem: '', durasi: '', tindakLanjut: '', keterangan: '' });
const initMovements   = () => TRAFFIC_TYPES.reduce((a, t) => ({ ...a, [t.key]: emptyTrafficRow() }), {});
const initSecB        = () => OPERATIONAL_ASPECTS.reduce((a, x) => ({ ...a, [x.key]: { status: 'Normal', notes: '', waktu: '' } }), {});
const initSecD        = () => COMM_SYSTEMS.reduce((a, s) => ({ ...a, [s.key]: { status: 'Operational', notes: '' } }), {});

// ─── Sub-components ───────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Normal: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    Perhatian: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    Gangguan: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    Operational: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    Degraded: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    Unserviceable: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444' },
    draft: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    submitted: { bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  };
  const s = map[status] || { bg: 'rgba(100,116,139,0.15)', color: '#64748b' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
      borderRadius: 20, background: s.bg, color: s.color, fontSize: 11, fontWeight: 700 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
      {status}
    </span>
  );
};

const StatusToggle = ({ value, onChange, options }) => (
  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    {options.map(([val, label, color]) => {
      const active = value === val;
      return (
        <button key={val} type="button" onClick={() => onChange(val)} style={{
          padding: '5px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          border: `1.5px solid ${active ? color : 'var(--border)'}`,
          background: active ? color + '22' : 'transparent',
          color: active ? color : 'var(--fg-muted)', transition: 'all .15s',
        }}>{label}</button>
      );
    })}
  </div>
);

const Panel = ({ title, badge, glow, children, action }) => (
  <div style={{
    background: 'var(--card)', border: `1px solid ${glow ? glow + '44' : 'var(--border)'}`,
    borderRadius: 12, marginBottom: 20, overflow: 'hidden',
    boxShadow: glow ? `0 0 20px ${glow}18, 0 0 6px ${glow}10` : 'none',
  }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 18px', borderBottom: '1px solid var(--border)',
      background: glow ? glow + '08' : 'rgba(255,255,255,0.02)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {badge && <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8',
          padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{badge}</span>}
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fg)',
          textTransform: 'uppercase', letterSpacing: '.5px' }}>{title}</h3>
      </div>
      {action}
    </div>
    <div style={{ padding: '18px' }}>{children}</div>
  </div>
);

const Field = ({ label, children, flex }) => (
  <div style={{ flex, marginBottom: 0 }}>
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)',
      textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>{label}</label>
    {children}
  </div>
);

const Inp = ({ style, ...props }) => (
  <input {...props} style={{
    width: '100%', padding: '8px 11px', borderRadius: 7,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box',
    outline: 'none', transition: 'border-color .15s', ...style,
  }}
    onFocus={e => e.target.style.borderColor = '#38bdf8'}
    onBlur={e => e.target.style.borderColor = 'var(--border)'}
  />
);

const SmInp = ({ style, ...props }) => (
  <input {...props} style={{
    width: '100%', padding: '4px 5px', borderRadius: 5,
    border: '1px solid var(--border)', background: 'var(--bg)',
    color: 'var(--fg)', fontSize: 11, textAlign: 'center',
    boxSizing: 'border-box', outline: 'none', ...style,
  }}
    onFocus={e => e.target.style.borderColor = '#38bdf8'}
    onBlur={e => e.target.style.borderColor = 'var(--border)'}
  />
);

const th = (extra) => ({
  padding: '7px 8px', fontWeight: 700, fontSize: 10, textTransform: 'uppercase',
  letterSpacing: '.4px', border: '1px solid var(--border)', textAlign: 'center',
  whiteSpace: 'nowrap', ...extra,
});
const td = (extra) => ({
  border: '1px solid var(--border)', padding: '3px 4px', textAlign: 'center', ...extra,
});

// ─── Main Component ───────────────────────────────────────────
export default function DailyReport() {
  const [reportDate, setReportDate]         = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState(null);
  const [activeSection, setActiveSection]   = useState('A');
  const [userInfo, setUserInfo]             = useState(null);
  const [branchInfo, setBranchInfo]         = useState(null);
  const [existingId, setExistingId]         = useState(null);
  const [existingStatus, setExistingStatus] = useState(null);

  const [secA, setSecA]             = useState({ reportNumber: '', periodStart: '0000', periodEnd: '2359', unitName: '', managerName: '', location: '' });
  const [secB, setSecB]             = useState(initSecB());
  const [movements, setMovements]   = useState(initMovements());
  const [hourly, setHourly]         = useState(Array(24).fill(''));
  const [disruptions, setDisruptions] = useState([
    { kategori: 'BOS', total: '', tindak: '', keterangan: '' },
    { kategori: 'BOC', total: '', tindak: '', keterangan: '' },
    { kategori: 'INCONVENIENCE', total: '', tindak: '', keterangan: '' },
  ]);
  const [otp, setOtp]               = useState({ airline: '', dep: '', arr: '' });
  const [secD, setSecD]             = useState(initSecD());
  const [incidents, setIncidents]   = useState(Array(5).fill(null).map(emptyIncident));
  const [notes, setNotes]           = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', user.id).single();
      if (!acc) return;
      setUserInfo(acc);
      const { data: br } = await supabase.from('branches').select('*').eq('code', acc.branch_code).single();
      if (br) { setBranchInfo(br); setSecA(p => ({ ...p, unitName: br.name || '', location: br.city || '' })); }
    })();
  }, []);

  useEffect(() => {
    if (!userInfo) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('daily_reports')
        .select('*,traffic_movements(*),hourly_traffic(*),operational_disruptions(*),communication_systems(*),incident_reports(*)')
        .eq('branch_code', userInfo.branch_code).eq('report_date', reportDate).maybeSingle();
      if (data) { setExistingId(data.id); setExistingStatus(data.status); populateForm(data); }
      else { setExistingId(null); setExistingStatus(null); resetForm(); }
      setLoading(false);
    })();
  }, [reportDate, userInfo]);

  const resetForm = () => {
    setSecA(p => ({ ...p, reportNumber: '', periodStart: '0000', periodEnd: '2359', managerName: '' }));
    setSecB(initSecB()); setMovements(initMovements()); setHourly(Array(24).fill(''));
    setDisruptions([{ kategori: 'BOS', total: '', tindak: '', keterangan: '' }, { kategori: 'BOC', total: '', tindak: '', keterangan: '' }, { kategori: 'INCONVENIENCE', total: '', tindak: '', keterangan: '' }]);
    setOtp({ airline: '', dep: '', arr: '' }); setSecD(initSecD());
    setIncidents(Array(5).fill(null).map(emptyIncident)); setNotes('');
  };

  const populateForm = (data) => {
    setSecA({ reportNumber: data.report_number || '', periodStart: data.period_start || '0000', periodEnd: data.period_end || '2359', unitName: data.unit_name || '', managerName: data.manager_name || '', location: data.location || '' });
    setSecB({
      general:     { status: data.condition_general_status || 'Normal',     notes: data.condition_general_notes || '',     waktu: data.condition_general_waktu || '' },
      notam:       { status: data.condition_notam_status || 'Normal',       notes: data.condition_notam_notes || '',       waktu: data.condition_notam_waktu || '' },
      restriction: { status: data.condition_restriction_status || 'Normal', notes: data.condition_restriction_notes || '', waktu: data.condition_restriction_waktu || '' },
      fir:         { status: data.condition_fir_status || 'Normal',         notes: data.condition_fir_notes || '',         waktu: data.condition_fir_waktu || '' },
      weather:     { status: data.condition_weather_status || 'Normal',     notes: data.condition_weather_notes || '',     waktu: data.condition_weather_waktu || '' },
      military:    { status: data.condition_military_status || 'Normal',    notes: data.condition_military_notes || '',    waktu: data.condition_military_waktu || '' },
    });
    setOtp({ airline: data.otp_airline_percentage ?? '', dep: data.dep_punctuality_percentage ?? '', arr: data.arr_punctuality_percentage ?? '' });
    setNotes(data.operational_notes || '');
    if (data.traffic_movements?.length) {
      const m = initMovements();
      data.traffic_movements.forEach(r => { if (m[r.movement_type]) ALL_COLS.forEach(c => { m[r.movement_type][c.key] = r[c.key] ?? ''; }); });
      setMovements(m);
    }
    if (data.hourly_traffic?.length) {
      const h = Array(24).fill('');
      data.hourly_traffic.forEach(r => { if (r.hour_utc >= 0 && r.hour_utc < 24) h[r.hour_utc] = r.total_traffic ?? ''; });
      setHourly(h);
    }
    if (data.operational_disruptions?.length)
      setDisruptions(data.operational_disruptions.map(d => ({ kategori: d.kategori, total: d.total ?? '', tindak: d.tindak_lanjut || '', keterangan: d.keterangan || '' })));
    if (data.communication_systems?.length) {
      const d = initSecD();
      data.communication_systems.forEach(s => { if (d[s.system_key]) d[s.system_key] = { status: s.status, notes: s.notes || '' }; });
      setSecD(d);
    }
    if (data.incident_reports?.length) {
      const inc = Array(5).fill(null).map(emptyIncident);
      data.incident_reports.forEach((r, i) => { if (i < 5) inc[i] = { waktu: r.incident_time || '', jenis: r.incident_type || '', sistem: r.affected_system || '', durasi: r.duration_minutes || '', tindakLanjut: r.follow_up_action || '', keterangan: r.keterangan || '' }; });
      setIncidents(inc);
    }
  };

  const rowTotal  = (tk) => ALL_COLS.reduce((s, c) => s + (parseInt(movements[tk][c.key]) || 0), 0);
  const colTotal  = (ck) => TRAFFIC_TYPES.reduce((s, t) => s + (parseInt(movements[t.key][ck]) || 0), 0);
  const grandTotal = ()  => TRAFFIC_TYPES.reduce((s, t) => s + rowTotal(t.key), 0);

  const handleSave = async (status = 'draft') => {
    if (!userInfo) return;
    setSaving(true); setSaveMsg(null);
    try {
      const payload = {
        branch_code: userInfo.branch_code, report_date: reportDate, status,
        report_number: secA.reportNumber, period_start: secA.periodStart, period_end: secA.periodEnd,
        unit_name: secA.unitName, manager_name: secA.managerName, location: secA.location, created_by: userInfo.id,
        condition_general_status: secB.general.status,         condition_general_notes: secB.general.notes,
        condition_notam_status: secB.notam.status,             condition_notam_notes: secB.notam.notes,
        condition_restriction_status: secB.restriction.status, condition_restriction_notes: secB.restriction.notes,
        condition_fir_status: secB.fir.status,                 condition_fir_notes: secB.fir.notes,
        condition_weather_status: secB.weather.status,         condition_weather_notes: secB.weather.notes,
        condition_military_status: secB.military.status,       condition_military_notes: secB.military.notes,
        otp_airline_percentage: otp.airline === '' ? null : parseFloat(otp.airline),
        dep_punctuality_percentage: otp.dep === '' ? null : parseFloat(otp.dep),
        arr_punctuality_percentage: otp.arr === '' ? null : parseFloat(otp.arr),
        operational_notes: notes,
      };
      let reportId = existingId;
      if (existingId) {
        await supabase.from('daily_reports').update(payload).eq('id', existingId);
      } else {
        // Try insert with select — may fail if RLS blocks returning data
        const { data: ins, error: insErr } = await supabase
          .from('daily_reports').insert(payload).select('id').single();
        if (ins?.id) {
          reportId = ins.id;
        } else {
          // Fallback: insert succeeded but RLS blocked select — fetch separately
          const { data: fetched } = await supabase
            .from('daily_reports')
            .select('id')
            .eq('branch_code', userInfo.branch_code)
            .eq('report_date', reportDate)
            .single();
          reportId = fetched?.id;
        }
        if (reportId) setExistingId(reportId);
      }
      if (!reportId) throw new Error('Gagal mendapatkan ID laporan. Cek koneksi Supabase dan RLS policy.');

      await supabase.from('traffic_movements').delete().eq('daily_report_id', reportId);
      await supabase.from('traffic_movements').insert(TRAFFIC_TYPES.map(t => ({ daily_report_id: reportId, movement_type: t.key, ...ALL_COLS.reduce((a, c) => ({ ...a, [c.key]: parseInt(movements[t.key][c.key]) || 0 }), {}) })));

      const hRows = hourly.map((v, i) => ({ daily_report_id: reportId, hour_utc: i, total_traffic: parseInt(v) || 0 })).filter(r => r.total_traffic > 0);
      await supabase.from('hourly_traffic').delete().eq('daily_report_id', reportId);
      if (hRows.length) await supabase.from('hourly_traffic').insert(hRows);

      await supabase.from('operational_disruptions').delete().eq('daily_report_id', reportId);
      const dRows = disruptions.filter(d => d.total !== '').map(d => ({ daily_report_id: reportId, disruption_type: d.kategori, duration_minutes: parseInt(d.total) || 0, description: d.tindak, impact: d.keterangan }));
      if (dRows.length) await supabase.from('operational_disruptions').insert(dRows);

      await supabase.from('communication_systems').delete().eq('daily_report_id', reportId);
      await supabase.from('communication_systems').insert(COMM_SYSTEMS.map(s => ({ daily_report_id: reportId, system_name: s.label, status: secD[s.key].status, notes: secD[s.key].notes })));

      await supabase.from('incident_reports').delete().eq('daily_report_id', reportId);
      const iRows = incidents.filter(i => i.jenis || i.waktu).map(i => ({ daily_report_id: reportId, incident_time: i.waktu || null, incident_type: i.jenis, affected_system: i.sistem, duration_minutes: parseInt(i.durasi) || null, follow_up_action: i.tindakLanjut, notes: i.keterangan }));
      if (iRows.length) await supabase.from('incident_reports').insert(iRows);

      setExistingStatus(status);
      setSaveMsg({ ok: true, text: status === 'submitted' ? '✅ Laporan berhasil dikirim ke INMC!' : '💾 Draft tersimpan.' });
    } catch (e) { setSaveMsg({ ok: false, text: '❌ Gagal: ' + e.message }); }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 5000);
  };

  const updateMovement = (tk, ck, v) => setMovements(p => ({ ...p, [tk]: { ...p[tk], [ck]: v } }));
  const updateSecB     = (k, f, v)  => setSecB(p => ({ ...p, [k]: { ...p[k], [f]: v } }));
  const updateSecD     = (k, f, v)  => setSecD(p => ({ ...p, [k]: { ...p[k], [f]: v } }));
  const updateInc      = (i, f, v)  => setIncidents(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x));

  const sIdx     = SECTIONS.findIndex(s => s.id === activeSection);
  const goNext   = () => sIdx < SECTIONS.length - 1 && setActiveSection(SECTIONS[sIdx + 1].id);
  const goPrev   = () => sIdx > 0 && setActiveSection(SECTIONS[sIdx - 1].id);
  const bProblems = OPERATIONAL_ASPECTS.filter(a => secB[a.key].status !== 'Normal').length;
  const dProblems = COMM_SYSTEMS.filter(s => secD[s.key].status !== 'Operational').length;

  return (
    <div style={{ paddingBottom: 100 }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--fg)' }}>Daily Report</h2>
            {existingStatus && <StatusBadge status={existingStatus} />}
            {loading && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>memuat...</span>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--fg-muted)' }}>
            {branchInfo?.name} ({branchInfo?.code}) — Laporan Harian MO ke INMC
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600 }}>TANGGAL</label>
          <Inp type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} style={{ width: 'auto' }} />
        </div>
      </div>

      {/* ── Save Message ── */}
      {saveMsg && (
        <div style={{
          padding: '12px 18px', borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600,
          background: saveMsg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          color: saveMsg.ok ? '#10b981' : '#ef4444',
          border: `1px solid ${saveMsg.ok ? '#10b98133' : '#ef444433'}`,
        }}>{saveMsg.text}</div>
      )}

      {/* ── Step Navigator ── */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto' }}>
        {SECTIONS.map((sec, i) => {
          const active = activeSection === sec.id;
          const done   = i < sIdx;
          return (
            <React.Fragment key={sec.id}>
              <button type="button" onClick={() => setActiveSection(sec.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(56,189,248,0.12)' : 'transparent', transition: 'all .2s', flexShrink: 0,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800,
                  background: active ? '#38bdf8' : done ? 'rgba(16,185,129,0.2)' : 'var(--bg)',
                  color: active ? '#0f172a' : done ? '#10b981' : 'var(--fg-muted)',
                  border: `2px solid ${active ? '#38bdf8' : done ? '#10b981' : 'var(--border)'}`,
                  boxShadow: active ? '0 0 12px #38bdf866' : 'none', transition: 'all .2s',
                }}>{done ? '✓' : sec.id}</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? '#38bdf8' : done ? '#10b981' : 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                  {sec.icon} {sec.label}
                </span>
              </button>
              {i < SECTIONS.length - 1 && (
                <div style={{ flex: 1, height: 2, minWidth: 12, background: i < sIdx ? 'rgba(16,185,129,0.4)' : 'var(--border)', transition: 'background .3s' }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ══ A — IDENTIFIKASI ══ */}
      {activeSection === 'A' && (
        <Panel badge="A" title="Identifikasi Laporan" glow="#38bdf8">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label="Tanggal Laporan">
              <Inp type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            </Field>
            <Field label="Nomor Laporan">
              <Inp placeholder="Contoh: RPT/WIII/20260408" value={secA.reportNumber}
                onChange={e => setSecA(p => ({ ...p, reportNumber: e.target.value }))} />
            </Field>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>Periode UTC</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Field label="Dari" flex={1}>
                <Inp placeholder="0000" maxLength={4} value={secA.periodStart} onChange={e => setSecA(p => ({ ...p, periodStart: e.target.value }))} />
              </Field>
              <span style={{ color: 'var(--fg-muted)', fontWeight: 700, marginTop: 16 }}>—</span>
              <Field label="Sampai" flex={1}>
                <Inp placeholder="2359" maxLength={4} value={secA.periodEnd} onChange={e => setSecA(p => ({ ...p, periodEnd: e.target.value }))} />
              </Field>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <Field label="Unit"><Inp value={secA.unitName} onChange={e => setSecA(p => ({ ...p, unitName: e.target.value }))} /></Field>
            <Field label="Lokasi"><Inp value={secA.location} onChange={e => setSecA(p => ({ ...p, location: e.target.value }))} /></Field>
          </div>
          <Field label="Manager Operasi">
            <Inp value={secA.managerName} onChange={e => setSecA(p => ({ ...p, managerName: e.target.value }))} style={{ maxWidth: 400 }} />
          </Field>
        </Panel>
      )}

      {/* ══ B — KONDISI OPERASIONAL ══ */}
      {activeSection === 'B' && (
        <Panel badge="B" title="Kondisi Operasional Umum"
          glow={bProblems > 0 ? '#f59e0b' : '#10b981'}
          action={bProblems > 0
            ? <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>⚠ {bProblems} perlu perhatian</span>
            : <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>✓ Semua Normal</span>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {OPERATIONAL_ASPECTS.map(a => {
              const b = secB[a.key];
              const problem = b.status !== 'Normal';
              return (
                <div key={a.key} style={{
                  display: 'grid', gridTemplateColumns: '220px 1fr 100px 180px', gap: 12, alignItems: 'center',
                  padding: '12px 14px', borderRadius: 10,
                  border: `1px solid ${problem ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                  background: problem ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.01)', transition: 'all .2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{a.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{a.label}</span>
                  </div>
                  <StatusToggle value={b.status} onChange={v => updateSecB(a.key, 'status', v)}
                    options={[['Normal', 'Normal', '#10b981'], ['Perhatian', 'Perhatian', '#f59e0b'], ['Gangguan', 'Gangguan', '#ef4444']]} />
                  <SmInp placeholder="Waktu UTC" value={b.waktu} onChange={e => updateSecB(a.key, 'waktu', e.target.value)} />
                  <SmInp placeholder="Keterangan..." value={b.notes} style={{ textAlign: 'left' }} onChange={e => updateSecB(a.key, 'notes', e.target.value)} />
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ══ C — TRAFFIC ══ */}
      {activeSection === 'C' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Traffic', val: grandTotal(), color: '#38bdf8' },
              { label: 'Departure', val: TRAFFIC_TYPES.reduce((s,t) => s+(parseInt(movements[t.key].depDom)||0)+(parseInt(movements[t.key].depInt)||0), 0), color: '#10b981' },
              { label: 'Arrival',   val: TRAFFIC_TYPES.reduce((s,t) => s+(parseInt(movements[t.key].arrDom)||0)+(parseInt(movements[t.key].arrInt)||0), 0), color: '#38bdf8' },
              { label: 'Overfly',   val: colTotal('ovf'), color: '#f59e0b' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ background: 'var(--card)', border: `1px solid ${color}33`, borderRadius: 10, padding: '14px 16px', textAlign: 'center', boxShadow: `0 0 14px ${color}12` }}>
                <div style={{ fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color }}>{val || 0}</div>
              </div>
            ))}
          </div>

          <Panel badge="C" title="Movement Traffic Harian" glow="#10b981">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 800 }}>
                <thead>
                  <tr>
                    <th style={th({ textAlign: 'left', minWidth: 140, background: 'var(--bg)', rowSpan: 2 })} rowSpan={2}>Jenis Penerbangan</th>
                    {TRAFFIC_GROUPS.map(g => (
                      <th key={g.label} colSpan={g.cols.length} style={th({ background: g.color + '22', color: g.color })}>{g.label}</th>
                    ))}
                    <th style={th({ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', minWidth: 52 })}>TOTAL</th>
                  </tr>
                  <tr>
                    {TRAFFIC_GROUPS.map(g => g.cols.map(c => (
                      <th key={c.key} style={th({ background: g.color + '11', color: g.color, minWidth: 40 })}>{c.label}</th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {TRAFFIC_TYPES.map((t, ri) => (
                    <tr key={t.key} style={{ background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ ...td({ textAlign: 'left', padding: '8px 10px' }), fontWeight: 600, fontSize: 12, color: 'var(--fg)' }}>{t.label}</td>
                      {ALL_COLS.map(c => (
                        <td key={c.key} style={td({})}>
                          <SmInp type="number" min="0" value={movements[t.key][c.key]} style={{ width: 38 }}
                            onChange={e => updateMovement(t.key, c.key, e.target.value)} />
                        </td>
                      ))}
                      <td style={td({ fontWeight: 800, fontSize: 12, color: '#38bdf8', background: 'rgba(56,189,248,0.06)' })}>{rowTotal(t.key) || '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(56,189,248,0.05)' }}>
                    <td style={{ ...td({ textAlign: 'left', padding: '8px 10px' }), fontWeight: 800, color: '#38bdf8', fontSize: 12 }}>TOTAL</td>
                    {ALL_COLS.map(c => (<td key={c.key} style={td({ fontWeight: 700, color: '#38bdf8' })}>{colTotal(c.key) || '—'}</td>))}
                    <td style={td({ fontWeight: 900, fontSize: 14, color: '#f59e0b', background: 'rgba(245,158,11,0.1)' })}>{grandTotal() || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel badge="C.1" title="Total Traffic Per Jam (UTC) — Opsional">
            <div style={{ overflowX: 'auto' }}>
              {[0, 1].map(hi => (
                <table key={hi} style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%', marginBottom: hi === 0 ? 6 : 0 }}>
                  <thead><tr>{HOURS.slice(hi * 12, hi * 12 + 12).map(h => <th key={h} style={th({ background: 'rgba(56,189,248,0.08)', color: '#38bdf8', minWidth: 52 })}>{h}</th>)}</tr></thead>
                  <tbody><tr>{hourly.slice(hi * 12, hi * 12 + 12).map((v, i) => (
                    <td key={i} style={td({})}>
                      <SmInp type="number" min="0" value={v} style={{ width: 44 }}
                        onChange={e => setHourly(p => p.map((x, idx) => idx === i + hi * 12 ? e.target.value : x))} />
                    </td>
                  ))}</tr></tbody>
                </table>
              ))}
            </div>
          </Panel>

          <Panel badge="C.2" title="Gangguan Operasional Penerbangan">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {disruptions.map((d, i) => (
                <div key={d.kategori} style={{ display: 'grid', gridTemplateColumns: '130px 90px 1fr 1fr', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.01)' }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--fg)' }}>{d.kategori}</span>
                  <SmInp type="number" min="0" placeholder="Total" value={d.total} onChange={e => setDisruptions(p => p.map((x, idx) => idx === i ? { ...x, total: e.target.value } : x))} />
                  <SmInp placeholder="Tindak Lanjut..." value={d.tindak} style={{ textAlign: 'left' }} onChange={e => setDisruptions(p => p.map((x, idx) => idx === i ? { ...x, tindak: e.target.value } : x))} />
                  <SmInp placeholder="Keterangan..." value={d.keterangan} style={{ textAlign: 'left' }} onChange={e => setDisruptions(p => p.map((x, idx) => idx === i ? { ...x, keterangan: e.target.value } : x))} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel badge="C.3" title="Kinerja Ketepatan Waktu Operasional">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {[['airline', 'OTP Airline', '#38bdf8'], ['dep', 'DEP Punctuality', '#10b981'], ['arr', 'ARR Punctuality', '#f59e0b']].map(([k, label, color]) => (
                <div key={k} style={{ background: color + '0d', border: `1px solid ${color}33`, borderRadius: 12, padding: '20px 16px', textAlign: 'center', boxShadow: `0 0 16px ${color}10` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 12 }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <input type="number" min="0" max="100" placeholder="—" value={otp[k]} onChange={e => setOtp(p => ({ ...p, [k]: e.target.value }))}
                      style={{ width: 80, padding: '4px 0', background: 'transparent', border: 'none', borderBottom: `2px solid ${color}66`, color, fontSize: 28, fontWeight: 900, textAlign: 'center', outline: 'none' }} />
                    <span style={{ fontSize: 22, fontWeight: 700, color }}>%</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {/* ══ D — KOMUNIKASI ══ */}
      {activeSection === 'D' && (
        <Panel badge="D" title="Laporan Komunikasi Penerbangan"
          glow={dProblems > 0 ? '#f59e0b' : '#10b981'}
          action={dProblems > 0
            ? <span style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>⚠ {dProblems} tidak normal</span>
            : <span style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>✓ Semua Operational</span>
          }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {COMM_SYSTEMS.map(s => {
              const d = secD[s.key];
              const notOp = d.status !== 'Operational';
              const dotColor = d.status === 'Operational' ? '#10b981' : d.status === 'Degraded' ? '#f59e0b' : '#ef4444';
              return (
                <div key={s.key} style={{
                  display: 'grid', gridTemplateColumns: '230px 1fr 200px', gap: 12, alignItems: 'center',
                  padding: '12px 14px', borderRadius: 10,
                  border: `1px solid ${notOp ? 'rgba(245,158,11,0.35)' : 'var(--border)'}`,
                  background: notOp ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.01)', transition: 'all .2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, boxShadow: `0 0 6px ${dotColor}`, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{s.label}</span>
                  </div>
                  <StatusToggle value={d.status} onChange={v => updateSecD(s.key, 'status', v)}
                    options={[['Operational', 'Operational', '#10b981'], ['Degraded', 'Degraded', '#f59e0b'], ['Unserviceable', 'U/S', '#ef4444']]} />
                  <SmInp placeholder="Keterangan..." value={d.notes} style={{ textAlign: 'left' }} onChange={e => updateSecD(s.key, 'notes', e.target.value)} />
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* ══ E — INSIDEN ══ */}
      {activeSection === 'E' && (
        <Panel badge="E" title="Gangguan, Insiden & Tindak Lanjut"
          glow={incidents.some(i => i.jenis) ? '#ef4444' : undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {incidents.map((inc, i) => (
              <div key={i} style={{
                padding: '14px', borderRadius: 10,
                border: `1px solid ${inc.jenis ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
                background: inc.jenis ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.01)', transition: 'all .2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>{i + 1}</span>
                  {inc.jenis && <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>{inc.jenis}</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 1fr 70px', gap: 8, marginBottom: 8 }}>
                  <Field label="Waktu UTC"><SmInp placeholder="0000" value={inc.waktu} onChange={e => updateInc(i, 'waktu', e.target.value)} /></Field>
                  <Field label="Jenis Gangguan / Insiden"><SmInp placeholder="..." value={inc.jenis} style={{ textAlign: 'left' }} onChange={e => updateInc(i, 'jenis', e.target.value)} /></Field>
                  <Field label="Sistem Terdampak"><SmInp placeholder="..." value={inc.sistem} style={{ textAlign: 'left' }} onChange={e => updateInc(i, 'sistem', e.target.value)} /></Field>
                  <Field label="Durasi (mnt)"><SmInp type="number" min="0" value={inc.durasi} onChange={e => updateInc(i, 'durasi', e.target.value)} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="Tindak Lanjut"><SmInp placeholder="..." value={inc.tindakLanjut} style={{ textAlign: 'left' }} onChange={e => updateInc(i, 'tindakLanjut', e.target.value)} /></Field>
                  <Field label="Keterangan"><SmInp placeholder="..." value={inc.keterangan} style={{ textAlign: 'left' }} onChange={e => updateInc(i, 'keterangan', e.target.value)} /></Field>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setIncidents(p => [...p, emptyIncident()])} style={{
            marginTop: 12, padding: '7px 16px', borderRadius: 8, border: '1px dashed var(--border)',
            background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer', width: '100%',
          }}>+ Tambah Baris Insiden</button>
        </Panel>
      )}

      {/* ══ F — CATATAN ══ */}
      {activeSection === 'F' && (
        <>
          <Panel badge="F" title="Catatan Operasional & Hal Penting Lainnya" glow="#8b5cf6">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={8}
              placeholder="Tuliskan catatan operasional, koordinasi khusus, atau hal penting lain yang perlu dilaporkan kepada INMC..."
              style={{ width: '100%', padding: '12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, minHeight: 160, outline: 'none' }}
              onFocus={e => e.target.style.borderColor = '#38bdf8'} onBlur={e => e.target.style.borderColor = 'var(--border)'} />
          </Panel>
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '20px', marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 14 }}>✍️ Dibuat Oleh</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16 }}>
              {[['Nama', secA.managerName || '—'], ['Jabatan', 'Manager Operasi'], ['Tanggal', reportDate], ['Unit', secA.unitName || '—']].map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center', padding: '12px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 6 }}>{k}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, borderTop: '2px solid var(--fg)', paddingTop: 6 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Action Bar ── */}
      <div style={{
        position: 'sticky', bottom: 0, background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '12px 18px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', boxShadow: '0 -8px 32px rgba(0,0,0,0.35)',
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={goPrev} disabled={sIdx === 0} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
            color: sIdx === 0 ? 'var(--fg-muted)' : 'var(--fg)', fontWeight: 600, fontSize: 12,
            cursor: sIdx === 0 ? 'not-allowed' : 'pointer', opacity: sIdx === 0 ? 0.4 : 1,
          }}>← Sebelumnya</button>
          <button type="button" onClick={goNext} disabled={sIdx === SECTIONS.length - 1} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent',
            color: sIdx === SECTIONS.length - 1 ? 'var(--fg-muted)' : 'var(--fg)', fontWeight: 600, fontSize: 12,
            cursor: sIdx === SECTIONS.length - 1 ? 'not-allowed' : 'pointer', opacity: sIdx === SECTIONS.length - 1 ? 0.4 : 1,
          }}>Berikutnya →</button>
        </div>
        <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 600 }}>
          Step {sIdx + 1} / {SECTIONS.length} — {SECTIONS[sIdx].icon} {SECTIONS[sIdx].label}
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={() => handleSave('draft')} disabled={saving} style={{
            padding: '9px 22px', borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.04)',
            color: 'var(--fg)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>💾 {saving ? 'Menyimpan...' : 'Simpan Draft'}</button>
          <button type="button" onClick={() => handleSave('submitted')} disabled={saving} style={{
            padding: '9px 26px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 0 16px rgba(37,99,235,0.4)',
          }}>📤 {saving ? 'Mengirim...' : 'Submit Laporan'}</button>
        </div>
      </div>
    </div>
  );
}
