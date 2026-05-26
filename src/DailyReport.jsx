// ============================================================
// src/DailyReport.jsx — Daily Report MO → INMC (REDESIGN sesi 4)
// Class-based styling, logic 1:1 with pre-redesign version.
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';
import SectionG from './components/DailyReport/SectionG.jsx';
import { useApp } from './lib/context.jsx';
import { useToast } from './components/Toast.jsx';

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
  { label: 'DEPARTURE', className: 'group-dep', cols: [
    { key: 'depDom', label: 'DOM' },
    { key: 'depInt', label: 'INT' },
  ]},
  { label: 'ARRIVAL',   className: 'group-arr', cols: [
    { key: 'arrDom', label: 'DOM' },
    { key: 'arrInt', label: 'INT' },
  ]},
  { label: 'OTHERS',    className: 'group-other', cols: [
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
  { id: 'D', label: 'Peralatan',     icon: '📡' },
  { id: 'E', label: 'Insiden',       icon: '⚠️' },
  { id: 'F', label: 'Catatan',       icon: '📝' },
  { id: 'G', label: 'Personnel',     icon: '👥' },
];

const emptyTrafficRow = () => ALL_COLS.reduce((a, c) => ({ ...a, [c.key]: '' }), {});
const emptyIncident   = () => ({ waktu: '', jenis: '', sistem: '', durasi: '', tindakLanjut: '', keterangan: '' });
const initMovements   = () => TRAFFIC_TYPES.reduce((a, t) => ({ ...a, [t.key]: emptyTrafficRow() }), {});
const initSecB        = () => OPERATIONAL_ASPECTS.reduce((a, x) => ({ ...a, [x.key]: { status: 'Normal', notes: '', waktu: '' } }), {});
const initSecD        = () => COMM_SYSTEMS.reduce((a, s) => ({ ...a, [s.key]: { status: 'Normal', notes: '' } }), {});

// ─── Sub-components ───────────────────────────────────────────
const StatusBadge = ({ status }) => {
  if (!status) return null;
  const cls =
    status === 'submitted' ? 'submitted' :
    status === 'draft'     ? 'draft' :
    status === 'Normal' || status === 'Operational' ? 'submitted' :
    'draft';
  return <span className={`dr-status ${cls}`}>● {status}</span>;
};

const StatusSegment = ({ value, onChange, options }) => (
  <div className="ops-seg">
    {options.map(([val, label, color]) => {
      const active = value === val;
      return (
        <button
          key={val} type="button"
          className={`ops-seg-btn ${active ? `active-${color}` : ''}`}
          onClick={() => onChange(val)}
        >{label}</button>
      );
    })}
  </div>
);

// ─── Main Component ───────────────────────────────────────────
export default function DailyReport() {
  const appCtx = useApp();
  const toast  = useToast();

  // If the user landed here via the deprecated `/log-position` redirect,
  // show a one-time toast pointing them at Section G.
  useEffect(() => {
    if (appCtx?.logRedirectFlag) {
      toast?.info(
        'Halaman Log Position sudah dipindah',
        'Sekarang ada di Daily Report → tab G · Personnel.',
        6000,
      );
      appCtx.clearLogRedirectFlag?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the redirect requested Section G, jump straight to it.
  const initialSection = appCtx?.logRedirectFlag ? 'G' : 'A';

  const [reportDate, setReportDate]         = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [saveMsg, setSaveMsg]               = useState(null);
  const [activeSection, setActiveSection]   = useState(initialSection);
  const [userInfo, setUserInfo]             = useState(null);
  const [branchInfo, setBranchInfo]         = useState(null);
  const [existingId, setExistingId]         = useState(null);
  const [existingStatus, setExistingStatus] = useState(null);

  const [secA, setSecA]             = useState({ reportNumber: '', unitName: '', managerName: '', location: '' });
  const [secB, setSecB]             = useState(initSecB());
  const [movements, setMovements]   = useState(initMovements());
  const [hourly, setHourly]         = useState(Array(24).fill(''));
  const [otp, setOtp]               = useState({ airline: '', dep: '', arr: '' });
  const [secD, setSecD]             = useState(initSecD());
  const [commSystems, setCommSystems] = useState(() => {
    try { const saved = localStorage.getItem('commSystems_custom'); if (saved) return JSON.parse(saved); }
    catch { /* noop */ }
    return [...COMM_SYSTEMS];
  });
  const [incidents, setIncidents]   = useState([emptyIncident()]);
  const [notes, setNotes]           = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: acc } = await supabase.from('accounts').select('*').eq('id', user.id).single();
      if (!acc) return;
      setUserInfo(acc);
      const { data: br } = await supabase.from('branches').select('*').eq('code', acc.branch_code).single();
      if (br) {
        setBranchInfo(br);
        setSecA(p => ({ ...p, unitName: br.name || '', location: br.city || '', managerName: acc.display_name || '' }));
      }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportDate, userInfo]);

  const resetForm = () => {
    setSecA(p => ({ ...p, reportNumber: '' }));
    setSecB(initSecB()); setMovements(initMovements()); setHourly(Array(24).fill(''));
    setOtp({ airline: '', dep: '', arr: '' }); setSecD(initSecD());
    setIncidents([emptyIncident()]); setNotes('');
  };

  const populateForm = (data) => {
    setSecA(p => ({ ...p, reportNumber: data.report_number || '', unitName: data.unit_name || p.unitName, managerName: data.manager_name || p.managerName, location: data.location || p.location }));
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
    if (data.communication_systems?.length) {
      const d = initSecD();
      data.communication_systems.forEach(s => { if (d[s.system_key]) d[s.system_key] = { status: s.status, notes: s.notes || '' }; });
      setSecD(d);
    }
    if (data.incident_reports?.length) {
      setIncidents(data.incident_reports.map(r => ({ waktu: r.incident_time || '', jenis: r.incident_type || '', sistem: r.affected_system || '', durasi: r.duration_minutes || '', tindakLanjut: r.follow_up_action || '', keterangan: r.keterangan || '' })));
    }
  };

  const rowTotal  = (tk) => ALL_COLS.reduce((s, c) => s + (parseInt(movements[tk][c.key]) || 0), 0);
  const colTotal  = (ck) => TRAFFIC_TYPES.reduce((s, t) => s + (parseInt(movements[t.key][ck]) || 0), 0);
  const grandTotal = ()  => TRAFFIC_TYPES.reduce((s, t) => s + rowTotal(t.key), 0);

  const handleSave = async (status = 'draft') => {
    if (!userInfo) return;
    setSaving(true); setSaveMsg(null);
    try {
      const autoReportNumber = secA.reportNumber || `RPT/${userInfo.branch_code}/${reportDate.replace(/-/g, '')}`;
      const payload = {
        branch_code: userInfo.branch_code, report_date: reportDate, status,
        report_number: autoReportNumber,
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
        const { data: ins } = await supabase
          .from('daily_reports').insert(payload).select('id').single();
        if (ins?.id) {
          reportId = ins.id;
        } else {
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

      await supabase.from('communication_systems').delete().eq('daily_report_id', reportId);
      await supabase.from('communication_systems').insert(commSystems.map(s => ({ daily_report_id: reportId, system_key: s.key, system_name: s.label, status: secD[s.key]?.status || 'Normal', notes: secD[s.key]?.notes || '' })));

      await supabase.from('incident_reports').delete().eq('daily_report_id', reportId);
      const iRows = incidents.filter(i => i.jenis || i.waktu).map(i => ({ daily_report_id: reportId, incident_time: i.waktu || null, incident_type: i.jenis, affected_system: i.sistem, duration_minutes: parseInt(i.durasi) || null, follow_up_action: i.tindakLanjut, notes: i.keterangan }));
      if (iRows.length) await supabase.from('incident_reports').insert(iRows);

      setExistingStatus(status);
      setSaveMsg({ ok: true, text: status === 'submitted' ? '✅ Laporan berhasil dikirim ke INMC!' : '💾 Draft tersimpan.' });
      // Audit log
      if (status === 'submitted') {
        try {
          supabase.from('audit_logs').insert({
            user_id: userInfo?.id || null,
            user_name: userInfo?.display_name || userInfo?.username || '-',
            branch_code: userInfo?.branch_code || '-',
            action: 'DAILY_REPORT_SUBMIT',
            detail: 'Submit Daily Report — ' + reportDate + ' — ' + (secA.unitName || userInfo?.branch_code),
          }).then(({ error }) => { if (error) console.warn('[AUDIT]', error.message); });
        } catch { /* noop */ }
      }
    } catch (e) { setSaveMsg({ ok: false, text: '❌ Gagal: ' + e.message }); }
    setSaving(false);
    setTimeout(() => setSaveMsg(null), 5000);
  };

  const updateMovement = (tk, ck, v) => setMovements(p => ({ ...p, [tk]: { ...p[tk], [ck]: v } }));
  const updateSecB     = (k, f, v)  => setSecB(p => ({ ...p, [k]: { ...p[k], [f]: v } }));
  const updateSecD     = (k, f, v)  => setSecD(p => ({ ...p, [k]: { ...p[k], [f]: v } }));
  const updateInc      = (i, f, v)  => setIncidents(p => p.map((x, idx) => idx === i ? { ...x, [f]: v } : x));

  // Persist commSystems changes to localStorage
  useEffect(() => {
    try { localStorage.setItem('commSystems_custom', JSON.stringify(commSystems)); }
    catch { /* noop */ }
  }, [commSystems]);

  const removeCommSystem = (key) => {
    setCommSystems(p => p.filter(s => s.key !== key));
    setSecD(p => { const n = { ...p }; delete n[key]; return n; });
  };
  const addCommSystem = () => {
    const id = 'custom_' + Date.now();
    setCommSystems(p => [...p, { key: id, label: '' }]);
    setSecD(p => ({ ...p, [id]: { status: 'Normal', notes: '' } }));
  };
  const renameCommSystem = (key, newLabel) => {
    setCommSystems(p => p.map(s => s.key === key ? { ...s, label: newLabel } : s));
  };

  const sIdx      = SECTIONS.findIndex(s => s.id === activeSection);
  const goNext    = () => sIdx < SECTIONS.length - 1 && setActiveSection(SECTIONS[sIdx + 1].id);
  const goPrev    = () => sIdx > 0 && setActiveSection(SECTIONS[sIdx - 1].id);
  const bProblems = OPERATIONAL_ASPECTS.filter(a => secB[a.key].status !== 'Normal').length;
  const dProblems = commSystems.filter(s => secD[s.key] && secD[s.key].status !== 'Normal').length;

  // Pending count for Section G tab badge (this date only,
  // derived from context.logs which is already loaded).
  const pendingDate = useMemo(() => {
    if (!userInfo?.branch_code || !appCtx?.logs) return 0;
    return appCtx.logs.filter(l =>
      l.branch_code === userInfo.branch_code
      && l.off_time
      && new Date(l.on_time).toISOString().slice(0, 10) === reportDate
      && (l.departure_count === null
        || l.arrival_count === null
        || l.overfly_count === null)
    ).length;
  }, [appCtx?.logs, userInfo?.branch_code, reportDate]);

  // Section completion for tab indicators
  const sectionFilled = {
    A: !!(secA.unitName && secA.managerName),
    B: true, // always considered filled (defaults to Normal)
    C: grandTotal() > 0,
    D: commSystems.length > 0,
    E: incidents.some(i => i.jenis || i.waktu),
    F: !!notes.trim(),
    G: pendingDate === 0,
  };

  return (
    <div style={{ paddingBottom: 24 }}>

      {/* ─── Topbar ─── */}
      <div className="topbar">
        <div>
          <div className="topbar-title">Daily Report</div>
          <div className="topbar-sub">
            {branchInfo?.name || '—'} ({branchInfo?.code || userInfo?.branch_code || '—'}) — Laporan Harian MO ke INMC
          </div>
        </div>
      </div>

      {/* ─── Date / Status header ─── */}
      <div className="dr-header">
        <div className="dr-header-l">
          <div>
            <div className="dr-header-eyebrow">Tanggal Laporan</div>
            <div className="dr-header-date">
              {new Date(reportDate).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
          <div className="dr-date-pick">
            <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
          </div>
        </div>
        <div className="row">
          {existingStatus && <StatusBadge status={existingStatus} />}
          {loading && <span className="faint" style={{ fontSize: 12 }}>memuat…</span>}
        </div>
      </div>

      {/* ─── Save Message Banner ─── */}
      {saveMsg && (
        <div className={`dr-save-msg ${saveMsg.ok ? 'ok' : 'err'}`}>{saveMsg.text}</div>
      )}

      {/* ─── Section navigation (sticky) ─── */}
      <div className="sec-nav">
        <div className="sec-nav-row">
          {SECTIONS.map(sec => {
            const active = activeSection === sec.id;
            const done   = sectionFilled[sec.id] && !active;
            const showPendingBadge = sec.id === 'G' && pendingDate > 0;
            return (
              <button
                key={sec.id} type="button"
                className={`sec-tab ${active ? 'active' : ''}`}
                onClick={() => setActiveSection(sec.id)}
              >
                <span className={`sec-tab-id ${done ? 'sec-tab-done' : ''}`}>{sec.id}</span>
                <span>{sec.icon} {sec.label}</span>
                {showPendingBadge && (
                  <span className="sec-tab-pending" title={`${pendingDate} session belum diisi`}>{pendingDate}</span>
                )}
                {done && !showPendingBadge && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--status-on)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ A — IDENTIFIKASI ══ */}
      {activeSection === 'A' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title"><span className="panel-badge">A</span> Identifikasi Laporan</h3>
          </div>
          <div className="panel-body">
            <div className="form-grid">
              <div className="field">
                <label>Tanggal Laporan</label>
                <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Nomor Laporan (Auto)</label>
                <input
                  value={secA.reportNumber || `RPT/${userInfo?.branch_code || '____'}/${reportDate.replace(/-/g, '')}`}
                  disabled
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700, cursor: 'not-allowed' }}
                />
              </div>
              <div className="field">
                <label>Unit</label>
                <input value={secA.unitName} disabled style={{ cursor: 'not-allowed', opacity: 0.75 }} />
              </div>
              <div className="field">
                <label>Lokasi</label>
                <input value={secA.location} disabled style={{ cursor: 'not-allowed', opacity: 0.75 }} />
              </div>
              <div className="field">
                <label>Manager Operasi</label>
                <input value={secA.managerName} disabled style={{ cursor: 'not-allowed', opacity: 0.75 }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ B — KONDISI OPERASIONAL ══ */}
      {activeSection === 'B' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title"><span className="panel-badge">B</span> Kondisi Operasional Umum</h3>
            {bProblems > 0
              ? <span className="status-badge" style={{ background: 'var(--status-alert-soft)', color: 'var(--status-alert)' }}>⚠ {bProblems} perlu perhatian</span>
              : <span className="status-badge status-on">✓ Semua Normal</span>}
          </div>
          <div className="panel-body">
            <div className="ops-grid">
              {OPERATIONAL_ASPECTS.map(a => {
                const b = secB[a.key];
                const problem = b.status !== 'Normal';
                return (
                  <div key={a.key} className={`ops-row ${problem ? 'has-problem' : ''}`}>
                    <div className="ops-row-head">
                      <div className="ops-row-label">
                        <span className="ops-row-icon">{a.icon}</span>
                        {a.label}
                      </div>
                      <StatusSegment
                        value={b.status}
                        onChange={v => updateSecB(a.key, 'status', v)}
                        options={[['Normal', 'Normal', 'normal'], ['Perhatian', 'Perhatian', 'warn'], ['Gangguan', 'Gangguan', 'alert']]}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="ops-row-waktu"
                        placeholder="UTC"
                        value={b.waktu}
                        onChange={e => updateSecB(a.key, 'waktu', e.target.value)}
                      />
                      <input
                        className="ops-row-note"
                        placeholder={problem ? 'Wajib isi: jelaskan kondisi' : 'Catatan opsional…'}
                        value={b.notes}
                        onChange={e => updateSecB(a.key, 'notes', e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ C — TRAFFIC ══ */}
      {activeSection === 'C' && (
        <>
          {/* Stats summary */}
          <div className="traffic-stats">
            <div className="traffic-stat color-accent">
              <div className="traffic-stat-label">Total Traffic</div>
              <div className="traffic-stat-val">{grandTotal() || 0}</div>
            </div>
            <div className="traffic-stat color-on">
              <div className="traffic-stat-label">Departure</div>
              <div className="traffic-stat-val">{TRAFFIC_TYPES.reduce((s,t) => s+(parseInt(movements[t.key].depDom)||0)+(parseInt(movements[t.key].depInt)||0), 0)}</div>
            </div>
            <div className="traffic-stat color-warn">
              <div className="traffic-stat-label">Arrival</div>
              <div className="traffic-stat-val">{TRAFFIC_TYPES.reduce((s,t) => s+(parseInt(movements[t.key].arrDom)||0)+(parseInt(movements[t.key].arrInt)||0), 0)}</div>
            </div>
            <div className="traffic-stat color-muted">
              <div className="traffic-stat-label">Overfly</div>
              <div className="traffic-stat-val">{colTotal('ovf')}</div>
            </div>
          </div>

          {/* Traffic matrix */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><span className="panel-badge">C</span> Movement Traffic Harian</h3>
              <span className="panel-counter">Total: <strong style={{ color: 'var(--text)', marginLeft: 6 }}>{grandTotal() || 0}</strong></span>
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <div className="tm-wrap">
                <table className="tm-table">
                  <thead>
                    <tr>
                      <th rowSpan={2} style={{ textAlign: 'left', paddingLeft: 12, minWidth: 140 }}>Jenis Penerbangan</th>
                      {TRAFFIC_GROUPS.map(g => (
                        <th key={g.label} colSpan={g.cols.length} className={g.className}>{g.label}</th>
                      ))}
                      <th rowSpan={2}>TOTAL</th>
                    </tr>
                    <tr>
                      {TRAFFIC_GROUPS.flatMap(g => g.cols.map(c => (
                        <th key={g.label + c.key} className={g.className} style={{ minWidth: 44 }}>{c.label}</th>
                      )))}
                    </tr>
                  </thead>
                  <tbody>
                    {TRAFFIC_TYPES.map(t => (
                      <tr key={t.key}>
                        <td className="tm-type-label">{t.label}</td>
                        {ALL_COLS.map(c => (
                          <td key={c.key} className="tm-input-cell">
                            <input
                              type="number" min="0"
                              value={movements[t.key][c.key]}
                              onChange={e => updateMovement(t.key, c.key, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="tm-row-total">{rowTotal(t.key) || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="tm-type-label">TOTAL</td>
                      {ALL_COLS.map(c => (<td key={c.key}>{colTotal(c.key) || '—'}</td>))}
                      <td className="tm-grand">{grandTotal() || '—'}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Hourly */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><span className="panel-badge">C.1</span> Total Traffic Per Jam (UTC)</h3>
              <span className="panel-counter">{hourly.reduce((s, v) => s + (parseInt(v) || 0), 0)} movements</span>
            </div>
            <div className="panel-body">
              <div className="hourly-wrap">
                <div className="hourly-chart">
                  {hourly.map((v, i) => {
                    const num = parseInt(v) || 0;
                    const max = Math.max(1, ...hourly.map(x => parseInt(x) || 0));
                    return (
                      <div key={i} className="hourly-bar"
                           data-tip={`${HOURS[i]} — ${num}`}
                           style={{ height: `${(num / max) * 100}%`, minHeight: num > 0 ? 4 : 2 }} />
                    );
                  })}
                </div>
                <div className="hourly-labels">
                  {[0, 4, 8, 12, 16, 20].map(h => <span key={h}>{String(h).padStart(2, '0')}:00</span>)}
                  <span>23:00</span>
                </div>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
                {hourly.map((v, i) => (
                  <input
                    key={i} type="number" min="0" value={v}
                    onChange={e => setHourly(p => p.map((x, idx) => idx === i ? e.target.value : x))}
                    placeholder={HOURS[i]}
                    style={{
                      padding: '4px', borderRadius: 4, border: '1px solid var(--border)',
                      background: 'var(--bg)', color: 'var(--text)',
                      fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'center', boxSizing: 'border-box',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* OTP */}
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><span className="panel-badge">C.2</span> Kinerja Ketepatan Waktu Operasional</h3>
            </div>
            <div className="panel-body">
              <div className="otp-grid">
                {[
                  ['airline', 'OTP Airline', 'accent'],
                  ['dep', 'DEP Punctuality', 'on'],
                  ['arr', 'ARR Punctuality', 'warn'],
                ].map(([k, label, color]) => (
                  <div key={k} className={`otp-card color-${color}`}>
                    <div className="otp-card-label">{label}</div>
                    <div className="otp-card-inp-wrap">
                      <input
                        type="number" min="0" max="100" placeholder="—"
                        value={otp[k]}
                        onChange={e => setOtp(p => ({ ...p, [k]: e.target.value }))}
                        className="otp-card-inp"
                      />
                      <span className="otp-card-percent">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══ D — PERALATAN ══ */}
      {activeSection === 'D' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title"><span className="panel-badge">D</span> Laporan Peralatan</h3>
            {dProblems > 0
              ? <span className="status-badge" style={{ background: 'var(--status-alert-soft)', color: 'var(--status-alert)' }}>⚠ {dProblems} tidak normal</span>
              : <span className="status-badge status-on">✓ Semua Normal</span>}
          </div>
          <div className="panel-body">
            <div className="ops-grid">
              {commSystems.map(s => {
                const d = secD[s.key] || { status: 'Normal', notes: '' };
                const notOp = d.status !== 'Normal';
                const isCustom = s.key.startsWith('custom_');
                return (
                  <div key={s.key} className={`ops-row ${notOp ? 'has-problem' : ''}`}>
                    <div className="ops-row-head">
                      <div className="ops-row-label" style={{ flex: 1, minWidth: 0 }}>
                        {isCustom ? (
                          <input
                            className="eq-label-input"
                            placeholder="Nama peralatan…"
                            value={s.label}
                            onChange={e => renameCommSystem(s.key, e.target.value)}
                          />
                        ) : (
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.label}</span>
                        )}
                      </div>
                      <StatusSegment
                        value={d.status}
                        onChange={v => updateSecD(s.key, 'status', v)}
                        options={[['Normal', 'Normal', 'normal'], ['Unserviceable', 'U/S', 'alert']]}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="ops-row-note"
                        placeholder={notOp ? 'Jelaskan kondisi & tindak lanjut' : 'Catatan opsional…'}
                        value={d.notes}
                        onChange={e => updateSecD(s.key, 'notes', e.target.value)}
                      />
                      <button
                        type="button"
                        className="eq-delete"
                        title="Hapus peralatan"
                        onClick={() => removeCommSystem(s.key)}
                      >×</button>
                    </div>
                  </div>
                );
              })}
            </div>
            <button type="button" className="add-row-btn" onClick={addCommSystem}>+ Tambah Peralatan</button>
          </div>
        </div>
      )}

      {/* ══ E — INSIDEN ══ */}
      {activeSection === 'E' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title"><span className="panel-badge">E</span> Gangguan, Insiden & Tindak Lanjut</h3>
            <button
              type="button" className="btn btn-sm btn-primary"
              onClick={() => setIncidents(p => [...p, emptyIncident()])}
            >+ Tambah Baris</button>
          </div>
          <div className="panel-body">
            {incidents.map((inc, i) => (
              <div key={i} className={`inc-card ${inc.jenis ? 'has-content' : ''}`}>
                <div className="inc-card-head">
                  <span className="inc-num">{i + 1}</span>
                  {inc.jenis && <span className="inc-jenis-label">{inc.jenis}</span>}
                </div>
                <div className="inc-grid-1">
                  <div className="field" style={{ margin: 0 }}>
                    <label>Waktu UTC</label>
                    <input placeholder="0000" value={inc.waktu} onChange={e => updateInc(i, 'waktu', e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Jenis Gangguan / Insiden</label>
                    <input placeholder="…" value={inc.jenis} onChange={e => updateInc(i, 'jenis', e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Sistem Terdampak</label>
                    <input placeholder="…" value={inc.sistem} onChange={e => updateInc(i, 'sistem', e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Durasi (mnt)</label>
                    <input type="number" min="0" value={inc.durasi} onChange={e => updateInc(i, 'durasi', e.target.value)} />
                  </div>
                </div>
                <div className="inc-grid-2">
                  <div className="field" style={{ margin: 0 }}>
                    <label>Tindak Lanjut</label>
                    <input placeholder="…" value={inc.tindakLanjut} onChange={e => updateInc(i, 'tindakLanjut', e.target.value)} />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label>Keterangan</label>
                    <input placeholder="…" value={inc.keterangan} onChange={e => updateInc(i, 'keterangan', e.target.value)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ F — CATATAN ══ */}
      {activeSection === 'F' && (
        <>
          <div className="panel">
            <div className="panel-header">
              <h3 className="panel-title"><span className="panel-badge">F</span> Catatan Operasional & Hal Penting Lainnya</h3>
            </div>
            <div className="panel-body">
              <textarea
                className="notes-textarea"
                rows={8}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Tuliskan catatan operasional, koordinasi khusus, atau hal penting lain yang perlu dilaporkan kepada INMC…"
              />
            </div>
          </div>
          <div className="signoff-card">
            <div className="signoff-title">✍️ Dibuat Oleh</div>
            <div className="signoff-grid">
              {[
                ['Nama', secA.managerName || '—'],
                ['Jabatan', 'Manager Operasi'],
                ['Tanggal', reportDate],
                ['Unit', secA.unitName || '—'],
              ].map(([k, v]) => (
                <div key={k} className="signoff-cell">
                  <div className="signoff-cell-label">{k}</div>
                  <div className="signoff-cell-val">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ══ G — PELAPORAN PERSONNEL ══ */}
      {activeSection === 'G' && (
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title"><span className="panel-badge">G</span> Pelaporan Personnel</h3>
            <span className="panel-counter">
              {pendingDate > 0
                ? <>⚠ {pendingDate} session belum diisi</>
                : <>✓ Tanggal ini lengkap</>}
            </span>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <SectionG />
          </div>
        </div>
      )}

      {/* ─── Sticky Save Bar ─── */}
      <div className="r-save-bar">
        <div className="r-save-nav">
          <button
            type="button" className="btn"
            onClick={goPrev} disabled={sIdx === 0}
            style={sIdx === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          >← Sebelumnya</button>
          <button
            type="button" className="btn"
            onClick={goNext} disabled={sIdx === SECTIONS.length - 1}
            style={sIdx === SECTIONS.length - 1 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          >Berikutnya →</button>
        </div>
        <span className="r-save-step">
          Step {sIdx + 1} / {SECTIONS.length} — {SECTIONS[sIdx].icon} {SECTIONS[sIdx].label}
        </span>
        <div className="row">
          <button
            type="button" className="btn"
            onClick={() => handleSave('draft')} disabled={saving}
          >💾 {saving ? 'Menyimpan…' : 'Save Draft'}</button>
          <button
            type="button" className="btn-submit-report"
            onClick={() => handleSave('submitted')} disabled={saving}
          >📤 {saving ? 'Mengirim…' : 'Submit Laporan'}</button>
        </div>
      </div>
    </div>
  );
}
