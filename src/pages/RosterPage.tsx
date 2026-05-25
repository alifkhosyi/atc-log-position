/**
 * RosterPage.tsx — Menu "Roster" untuk atc-log-position.
 *
 * v5 (Phase 1 audit fix): port dari Tailwind → design tokens existing app
 * (CSS classes .panel/.btn/.stat-card + CSS vars --text/--border/--accent/dst).
 *
 * Native React component yang panggil engine TypeScript langsung
 * (tidak ada API call eksternal). Simpan hasil ke Supabase tabel
 * atc_rosters + atc_roster_cells + atc_leaves.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { useApp } from '../lib/context.jsx';

import {
    type Personnel, type RosterCell, type LeaveRange,
    type FrmsIssue,
    generateRoster,
    swapShift,
    validateFull, splitBySeverity,
    leaveRangeFromDates,
    listAirports, getAirport, getUnit, getBaselineForMonth,
    computeAllowanceTable,
    type PersonnelAllowance,
} from '../lib/roster-engine';

// ============================================================
// COLOR HELPERS — inline hex consistent dengan LogPosition.SHIFT_LABELS
// (Phase 3 akan migrasi ke CSS tokens --shift-I..--shift-V)
// ============================================================

const SHIFT_HEX: Record<string, string> = {
    I:   '#3b82f6',
    II:  '#f59e0b',
    III: '#a855f7',
    IV:  '#ec4899',
    V:   '#14b8a6',
};
const LEAVE_HEX: Record<string, string> = {
    CUTI:   '#f97316',
    SAKIT:  '#ef4444',
    DIKLAT: '#0ea5e9',
    OTHERS: '#737373',
};

function cellBgHex(status: string): string {
    if (SHIFT_HEX[status]) return SHIFT_HEX[status] + '33';   // 20% opacity bg
    if (LEAVE_HEX[status]) return LEAVE_HEX[status] + '40';
    if (status === 'TNI') return 'rgba(245, 158, 11, 0.25)';
    return 'var(--surface-2, #f5f5f5)';
}

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// ============================================================
// TYPES (DB shape)
// ============================================================

interface DBPersonnel {
    id: string;
    initial: string;
    full_name?: string;
    airport_code: string;
    unit: string;
    is_active?: boolean;
    priority_order?: number;
}

interface DBLeave {
    id: string;
    personnel_id: string;
    airport_code: string;
    unit: string;
    start_date: string;
    end_date: string;
    category: 'CUTI' | 'SAKIT' | 'DIKLAT' | 'OTHERS';
    note?: string;
}

interface RosterRow {
    id: string;
    status: 'DRAFT' | 'FINAL';
    mode: string;
    metadata: { pattern_phase_at_eom?: Record<string, string[]>; };
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function RosterPage() {
    const ctx: any = useApp();
    const user = ctx?.user;
    const isAdmin = user?.role === 'admin';
    const userBranchCode = (user?.branch_code || '').toUpperCase();

    const allAirports = useMemo(() => listAirports(), []);

    // Resolve airport_code: ICAO branch → engine name
    const resolvedFromBranch = useMemo(() => {
        if (!userBranchCode) return null;
        const direct = getAirport(userBranchCode);
        if (direct) return direct.airport_code;
        const branchObj = ctx?.branches?.find((b: any) => b.code === userBranchCode);
        if (!branchObj) return null;
        const branchName = (branchObj.name || '').toLowerCase();
        if (!branchName) return null;
        for (const a of allAirports) {
            const engName = a.airport_name.toLowerCase();
            if (engName === branchName) return a.airport_code;
            if (branchName.includes(engName)) return a.airport_code;
            if (engName.includes(branchName)) return a.airport_code;
        }
        return null;
    }, [userBranchCode, ctx?.branches, allAirports]);

    const [airportCode, setAirportCode] = useState(
        isAdmin ? 'AMBON' : (resolvedFromBranch || userBranchCode || 'AMBON')
    );
    const [unit, setUnit] = useState('TWR');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [activeTab, setActiveTab] = useState<'roster' | 'ca'>('roster');

    useEffect(() => {
        if (!isAdmin && resolvedFromBranch && resolvedFromBranch !== airportCode) {
            setAirportCode(resolvedFromBranch);
        }
    }, [isAdmin, resolvedFromBranch]);

    const branchDisplayName = useMemo(() => {
        if (isAdmin) return null;
        const branchObj = ctx?.branches?.find((b: any) => b.code === userBranchCode);
        const engCfg = getAirport(airportCode);
        if (branchObj?.name) return branchObj.name;
        if (engCfg) return engCfg.airport_name;
        return userBranchCode;
    }, [isAdmin, userBranchCode, ctx?.branches, airportCode]);

    // ---- Data state ----
    const [dbPersonnel, setDbPersonnel] = useState<DBPersonnel[]>([]);
    const [dbLeaves, setDbLeaves] = useState<DBLeave[]>([]);
    const [roster, setRoster] = useState<Record<string, RosterCell[]> | null>(null);
    const [rosterId, setRosterId] = useState<string | null>(null);
    const [rosterStatus, setRosterStatus] = useState<'DRAFT' | 'FINAL'>('DRAFT');
    const [mode, setMode] = useState('');
    const [frmsErrors, setFrmsErrors] = useState<FrmsIssue[]>([]);
    const [frmsWarnings, setFrmsWarnings] = useState<FrmsIssue[]>([]);

    // ---- UI state ----
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [swapSelection, setSwapSelection] = useState<{ personnelId: string; day: number } | null>(null);

    const [leaveForm, setLeaveForm] = useState({
        personnelId: '', startDate: '', endDate: '', category: 'CUTI' as DBLeave['category'],
    });

    const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

    const availableUnits = useMemo(() => {
        const ap = getAirport(airportCode);
        return ap ? ap.units.map(u => u.unit) : ['TWR'];
    }, [airportCode]);

    const unitConfig = useMemo(() => {
        const ap = getAirport(airportCode);
        return ap ? getUnit(ap, unit) : undefined;
    }, [airportCode, unit]);

    const selectableAirports = useMemo(() => {
        if (isAdmin) return allAirports;
        return allAirports.filter(a => a.airport_code === (resolvedFromBranch || userBranchCode));
    }, [isAdmin, resolvedFromBranch, userBranchCode, allAirports]);

    // ============================================================
    // LOAD PERSONNEL & LEAVES
    // ============================================================
    useEffect(() => {
        let cancelled = false;

        async function loadPersonnel() {
            const ctxPersonnel: any[] = ctx?.personnel || [];
            const branchFilter = isAdmin ? null : userBranchCode;
            const filtered = ctxPersonnel.filter((p: any) => {
                if (branchFilter && p.branch_code !== branchFilter) return false;
                if (p.unit && p.unit !== unit) return false;
                return p.is_active !== false;
            });

            if (cancelled) return;

            if (filtered.length > 0) {
                setDbPersonnel(filtered.map((p: any, i: number) => ({
                    id: p.id,
                    initial: p.initial || p.name || `P${i + 1}`,
                    full_name: p.name || p.full_name,
                    airport_code: airportCode,
                    unit,
                    is_active: p.is_active !== false,
                    priority_order: p.priority_order ?? i,
                })));
                return;
            }

            const cfg = unitConfig;
            if (cfg?.initials && cfg.initials.length > 0) {
                setDbPersonnel(cfg.initials.map((ini, i) => ({
                    id: ini, initial: ini,
                    full_name: cfg.names?.[i],
                    airport_code: airportCode, unit,
                    is_active: true,
                    priority_order: i,
                })));
            } else {
                setDbPersonnel([]);
                setError(
                    `Tidak ada personel untuk cabang ${airportCode}/${unit}. ` +
                    `Pastikan personel sudah di-input di app, atau cabang ini belum ada di config engine.`
                );
            }
        }

        async function loadLeaves() {
            const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            const { data } = await supabase
                .from('atc_leaves')
                .select('*')
                .eq('airport_code', airportCode)
                .eq('unit', unit)
                .lte('start_date', monthEnd)
                .gte('end_date', monthStart);
            if (cancelled) return;
            if (data) setDbLeaves(data as DBLeave[]);
        }

        loadPersonnel();
        loadLeaves();
        return () => { cancelled = true; };
    }, [airportCode, unit, year, month, unitConfig, ctx?.personnel?.length, isAdmin, userBranchCode]);

    // ============================================================
    // LOAD EXISTING ROSTER
    // ============================================================
    useEffect(() => {
        let cancelled = false;
        async function load() {
            if (dbPersonnel.length === 0) return;
            const { data: rRow } = await supabase
                .from('atc_rosters')
                .select('id, status, mode, metadata')
                .eq('airport_code', airportCode)
                .eq('unit', unit)
                .eq('year', year)
                .eq('month', month)
                .maybeSingle();
            if (cancelled) return;
            if (!rRow) {
                setRoster(null); setRosterId(null);
                setRosterStatus('DRAFT'); setMode('');
                return;
            }
            const r = rRow as RosterRow;
            setRosterId(r.id);
            setRosterStatus(r.status);
            setMode(r.mode || '');

            const { data: cells } = await supabase
                .from('atc_roster_cells')
                .select('personnel_id, day, status, locked')
                .eq('roster_id', r.id)
                .order('day');
            if (cancelled) return;
            if (cells) {
                const grouped: Record<string, RosterCell[]> = {};
                for (const p of dbPersonnel) {
                    grouped[p.id] = Array.from({ length: daysInMonth }, () => ({ status: '-', locked: false }));
                }
                for (const c of cells as any[]) {
                    if (!grouped[c.personnel_id]) {
                        grouped[c.personnel_id] = Array.from({ length: daysInMonth }, () => ({ status: '-', locked: false }));
                    }
                    grouped[c.personnel_id][c.day - 1] = { status: c.status, locked: c.locked };
                }
                setRoster(grouped);
                validateRoster(grouped);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [airportCode, unit, year, month, dbPersonnel, daysInMonth]);

    // ============================================================
    // REALTIME SUBSCRIPTION
    // ============================================================
    useEffect(() => {
        if (!rosterId) return;
        const channel = supabase
            .channel(`roster-${rosterId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'atc_roster_cells', filter: `roster_id=eq.${rosterId}` },
                async () => {
                    const { data: cells } = await supabase
                        .from('atc_roster_cells')
                        .select('personnel_id, day, status, locked')
                        .eq('roster_id', rosterId);
                    if (!cells) return;
                    setRoster(prev => {
                        if (!prev) return prev;
                        const updated = { ...prev };
                        for (const c of cells as any[]) {
                            if (updated[c.personnel_id]) {
                                updated[c.personnel_id] = [...updated[c.personnel_id]];
                                updated[c.personnel_id][c.day - 1] = { status: c.status, locked: c.locked };
                            }
                        }
                        return updated;
                    });
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [rosterId]);

    // ============================================================
    // GENERATE
    // ============================================================
    async function handleGenerate() {
        if (dbPersonnel.length === 0) {
            setError('Belum ada personel untuk cabang/unit ini.');
            return;
        }
        setLoading(true);
        setError('');
        setInfo('');
        try {
            const personnel: Personnel[] = dbPersonnel
                .filter(p => p.is_active !== false)
                .map(p => ({
                    id: p.id, initial: p.initial,
                    leaves: [],
                    priorityOrder: p.priority_order ?? 0,
                }));

            for (const lv of dbLeaves) {
                const p = personnel.find(pp => pp.id === lv.personnel_id);
                if (!p) continue;
                const projected = leaveRangeFromDates(lv.start_date, lv.end_date, year, month, lv.category);
                if (projected) p.leaves.push(projected);
            }

            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? year - 1 : year;
            const { data: prevRow } = await supabase
                .from('atc_rosters')
                .select('metadata')
                .eq('airport_code', airportCode)
                .eq('unit', unit)
                .eq('year', prevYear)
                .eq('month', prevMonth)
                .maybeSingle();
            const prevTail = (prevRow as any)?.metadata?.pattern_phase_at_eom || null;

            const baseline = getBaselineForMonth(airportCode, unit, daysInMonth) || null;

            const result = generateRoster({
                year, month, personnel,
                requiredPerDay: unitConfig?.min_on_duty_baseline ?? 3,
                isTni: unitConfig?.is_tni ?? false,
                baselinePattern: baseline,
                prevMonthTail: prevTail,
            });

            if (!result.success) {
                setError(result.errorMessage || 'Generate gagal');
                return;
            }

            const tailLen = Math.min(7, result.daysInMonth);
            const phase: Record<string, string[]> = {};
            for (const [pid, cells] of Object.entries(result.roster)) {
                phase[pid] = cells.slice(-tailLen).map(c => c.status);
            }

            const { data: rosterRow, error: insertErr } = await supabase
                .from('atc_rosters')
                .upsert({
                    airport_code: airportCode, unit, year, month,
                    days_in_month: result.daysInMonth,
                    status: 'DRAFT',
                    mode: result.mode,
                    required_per_day: result.requiredPerDay,
                    is_tni: result.isTni,
                    metadata: { pattern_phase_at_eom: phase },
                    generated_at: new Date().toISOString(),
                }, { onConflict: 'airport_code,unit,year,month' })
                .select()
                .single();
            if (insertErr) throw insertErr;

            await supabase.from('atc_roster_cells').delete().eq('roster_id', rosterRow!.id);
            const cellsToInsert: any[] = [];
            for (const [pid, cells] of Object.entries(result.roster)) {
                for (let i = 0; i < cells.length; i++) {
                    cellsToInsert.push({
                        roster_id: rosterRow!.id,
                        personnel_id: pid,
                        day: i + 1,
                        status: cells[i].status,
                        locked: cells[i].locked,
                    });
                }
            }
            for (let i = 0; i < cellsToInsert.length; i += 500) {
                await supabase.from('atc_roster_cells').insert(cellsToInsert.slice(i, i + 500));
            }

            setRoster(result.roster);
            setRosterId(rosterRow!.id);
            setRosterStatus('DRAFT');
            setMode(result.mode);
            validateRoster(result.roster);
            setInfo(`Roster ${MONTHS[month - 1]} ${year} berhasil di-generate (mode: ${result.mode}).`);
        } catch (e: any) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }

    function validateRoster(r: Record<string, RosterCell[]>) {
        if (unitConfig?.is_tni) {
            setFrmsErrors([]); setFrmsWarnings([]); return;
        }
        try {
            const personnel: Personnel[] = dbPersonnel.map(p => ({
                id: p.id, initial: p.initial,
                leaves: dbLeaves
                    .filter(l => l.personnel_id === p.id)
                    .map(l => leaveRangeFromDates(l.start_date, l.end_date, year, month, l.category))
                    .filter((l): l is LeaveRange => l !== null),
            }));
            const issues = validateFull({
                roster: r, personnel,
                daysInMonth, serviceClass: 'LOW',
                shiftHours: 10,
                minOnDuty: unitConfig?.min_on_duty_baseline ?? 3,
            });
            const { errors, warnings } = splitBySeverity(issues);
            setFrmsErrors(errors);
            setFrmsWarnings(warnings);
        } catch {
            /* ignore */
        }
    }

    async function handleCellClick(personnelId: string, day: number) {
        if (!roster) return;
        const cell = roster[personnelId]?.[day - 1];
        if (!cell || cell.locked) return;

        if (!swapSelection) {
            setSwapSelection({ personnelId, day });
            return;
        }
        if (swapSelection.day !== day) {
            setError('Swap harus di hari yang sama. Reset selection.');
            setSwapSelection({ personnelId, day });
            return;
        }
        if (swapSelection.personnelId === personnelId) {
            setSwapSelection(null);
            return;
        }

        setError('');
        const personnel: Personnel[] = dbPersonnel.map(p => ({
            id: p.id, initial: p.initial,
            leaves: dbLeaves
                .filter(l => l.personnel_id === p.id)
                .map(l => leaveRangeFromDates(l.start_date, l.end_date, year, month, l.category))
                .filter((l): l is LeaveRange => l !== null),
        }));
        const result = swapShift({
            roster, personnel,
            personnelA: swapSelection.personnelId,
            personnelB: personnelId,
            day,
            requiredPerDay: unitConfig?.min_on_duty_baseline ?? 3,
            daysInMonth, serviceClass: 'LOW',
            shiftHours: 10,
        });
        setSwapSelection(null);
        if (!result.success) {
            setError(result.message);
            return;
        }
        if (rosterId) {
            const a = swapSelection.personnelId;
            const b = personnelId;
            await Promise.all([
                supabase.from('atc_roster_cells').update({ status: roster[a][day - 1].status })
                    .eq('roster_id', rosterId).eq('personnel_id', a).eq('day', day),
                supabase.from('atc_roster_cells').update({ status: roster[b][day - 1].status })
                    .eq('roster_id', rosterId).eq('personnel_id', b).eq('day', day),
            ]);
            if (rosterStatus === 'FINAL') {
                await supabase.from('atc_rosters').update({ status: 'DRAFT' }).eq('id', rosterId);
                setRosterStatus('DRAFT');
                setInfo('Roster di-revert ke DRAFT karena ada perubahan.');
            }
        }
        setRoster({ ...roster });
        validateRoster(roster);
    }

    async function handleMarkFinal() {
        if (!rosterId) return;
        if (frmsErrors.length > 0) {
            setError(`Tidak bisa mark FINAL: ada ${frmsErrors.length} FRMS error.`);
            return;
        }
        await supabase.from('atc_rosters').update({
            status: 'FINAL', marked_final_at: new Date().toISOString(),
        }).eq('id', rosterId);
        setRosterStatus('FINAL');
        setInfo('Roster di-mark FINAL.');
    }

    async function handleRevert() {
        if (!rosterId) return;
        await supabase.from('atc_rosters').update({ status: 'DRAFT' }).eq('id', rosterId);
        setRosterStatus('DRAFT');
        setInfo('Roster di-revert ke DRAFT.');
    }

    async function handleAddLeave() {
        if (!leaveForm.personnelId || !leaveForm.startDate || !leaveForm.endDate) {
            setError('Pilih personel + tanggal mulai + tanggal selesai.');
            return;
        }
        if (leaveForm.endDate < leaveForm.startDate) {
            setError('Tanggal selesai sebelum tanggal mulai.');
            return;
        }
        const { error: err } = await supabase.from('atc_leaves').insert({
            personnel_id: leaveForm.personnelId,
            airport_code: airportCode, unit,
            start_date: leaveForm.startDate,
            end_date: leaveForm.endDate,
            category: leaveForm.category,
        });
        if (err) { setError(err.message); return; }
        setInfo(`Cuti ditambahkan untuk ${leaveForm.personnelId} (${leaveForm.startDate} – ${leaveForm.endDate}).`);
        setLeaveForm({ personnelId: '', startDate: '', endDate: '', category: 'CUTI' });
        const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const { data } = await supabase.from('atc_leaves').select('*')
            .eq('airport_code', airportCode).eq('unit', unit)
            .lte('start_date', monthEnd).gte('end_date', monthStart);
        if (data) setDbLeaves(data as DBLeave[]);
    }

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="page-content">
            {/* TOPBAR */}
            <div className="topbar">
                <div>
                    <h1 className="topbar-title">Roster ATC</h1>
                    <p className="topbar-sub">
                        Generate jadwal bulanan personel ATC
                        {!isAdmin && branchDisplayName && (
                            <> — Cabang <strong style={{ color: 'var(--text)' }}>{branchDisplayName}</strong></>
                        )}
                    </p>
                </div>
                <div className="topbar-actions">
                    <span className="status-pill-info">
                        <strong style={{ color: 'var(--text)', margin: '0 4px' }}>{dbPersonnel.length}</strong> personel
                    </span>
                </div>
            </div>

            {/* TABS */}
            <div className="roster-tabs" style={{
                display: 'flex',
                gap: 4,
                borderBottom: '1px solid var(--border)',
                marginBottom: 16,
            }}>
                {(['roster', 'ca'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setActiveTab(t)}
                        className="btn"
                        style={{
                            border: 'none',
                            borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                            background: 'transparent',
                            color: activeTab === t ? 'var(--accent)' : 'var(--text-muted)',
                            borderRadius: 0,
                            fontWeight: 600,
                            padding: '10px 14px',
                            marginBottom: -1,
                        }}
                    >
                        {t === 'roster' ? 'Roster' : 'Control Allowance'}
                    </button>
                ))}
            </div>

            {/* TOOLBAR */}
            <div className="input-banner">
                <div className="quick-row">
                    {isAdmin ? (
                        <div className="field" style={{ margin: 0 }}>
                            <label>Cabang</label>
                            <select
                                value={airportCode}
                                onChange={e => { setAirportCode(e.target.value); setUnit('TWR'); }}
                            >
                                {selectableAirports.map(a => (
                                    <option key={a.airport_code} value={a.airport_code}>
                                        {a.airport_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="field" style={{ margin: 0 }}>
                            <label>Cabang</label>
                            <div style={{
                                padding: '6px 12px',
                                background: 'var(--accent-soft)',
                                color: 'var(--accent)',
                                borderRadius: 'var(--r, 6px)',
                                fontWeight: 600,
                                fontSize: 'var(--fs-sm, 13px)',
                                border: '1px solid var(--border)',
                            }}>
                                {branchDisplayName || airportCode}
                            </div>
                        </div>
                    )}
                    <div className="field" style={{ margin: 0 }}>
                        <label>Unit</label>
                        <select value={unit} onChange={e => setUnit(e.target.value)}>
                            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                        <label>Bulan</label>
                        <select value={month} onChange={e => setMonth(+e.target.value)}>
                            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                        <label>Tahun</label>
                        <input type="number" value={year} onChange={e => setYear(+e.target.value)}
                               style={{ width: 100 }}/>
                    </div>
                    <button
                        className="btn btn-primary btn-lg"
                        onClick={handleGenerate}
                        disabled={loading || dbPersonnel.length === 0}
                    >
                        {loading ? 'Memproses…' : (roster ? 'Re-generate' : 'Generate')}
                    </button>
                </div>
            </div>

            {/* ALERTS */}
            {info && (
                <div className="panel" style={{ marginTop: 12, background: 'var(--accent-soft)' }}>
                    <div className="panel-body" style={{ padding: '10px 14px', color: 'var(--accent)' }}>
                        {info}
                    </div>
                </div>
            )}
            {error && (
                <div className="panel" style={{ marginTop: 12, background: 'var(--status-off-soft, rgba(239,68,68,0.1))' }}>
                    <div className="panel-body" style={{ padding: '10px 14px', color: 'var(--status-off, #dc2626)', whiteSpace: 'pre-line' }}>
                        {error}
                    </div>
                </div>
            )}

            {/* TAB CONTENT */}
            {activeTab === 'roster' ? (
                <>
                    {/* Status row */}
                    {roster && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '12px 0' }}>
                            <span className={'status-badge ' + (rosterStatus === 'FINAL' ? 'status-on' : 'status-off')}>
                                {rosterStatus === 'FINAL' ? 'FINAL' : 'DRAFT'}
                            </span>
                            <span className="faint text-sm">Mode: {mode || '—'}</span>
                            {rosterStatus === 'DRAFT' ? (
                                <button className="btn btn-sm btn-primary" onClick={handleMarkFinal} disabled={frmsErrors.length > 0}>
                                    Mark FINAL
                                </button>
                            ) : (
                                <button className="btn btn-sm" onClick={handleRevert}>
                                    Revert ke DRAFT
                                </button>
                            )}
                            {swapSelection && (
                                <span className="status-badge" style={{ background: 'var(--status-warn-soft)', color: 'var(--status-warn)' }}>
                                    Klik cell ke-2 di hari yang sama untuk swap, atau klik ulang untuk batal
                                </span>
                            )}
                        </div>
                    )}

                    {/* FRMS panel */}
                    {roster && (frmsErrors.length > 0 || frmsWarnings.length > 0) && (
                        <div className="panel">
                            <details>
                                <summary className="panel-header" style={{ cursor: 'pointer' }}>
                                    <h2 className="panel-title">
                                        FRMS Compliance — {frmsErrors.length} error, {frmsWarnings.length} warning
                                    </h2>
                                </summary>
                                <div className="panel-body" style={{ paddingTop: 0 }}>
                                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--fs-sm, 13px)' }}>
                                        {frmsErrors.map((e, i) =>
                                            <li key={`e-${i}`} style={{ color: 'var(--status-off, #dc2626)', marginBottom: 4 }}>
                                                [{e.rule}] {e.message}
                                            </li>
                                        )}
                                        {frmsWarnings.map((w, i) =>
                                            <li key={`w-${i}`} style={{ color: 'var(--status-warn, #f59e0b)', marginBottom: 4 }}>
                                                [{w.rule}] {w.message}
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            </details>
                        </div>
                    )}

                    {/* Add leave form */}
                    <div className="panel">
                        <details>
                            <summary className="panel-header" style={{ cursor: 'pointer' }}>
                                <h2 className="panel-title">Tambah Cuti / Off-Roster</h2>
                            </summary>
                            <div className="panel-body" style={{ paddingTop: 0 }}>
                                <div className="quick-row">
                                    <div className="field" style={{ margin: 0 }}>
                                        <label>Personel</label>
                                        <select
                                            value={leaveForm.personnelId}
                                            onChange={e => setLeaveForm({ ...leaveForm, personnelId: e.target.value })}
                                        >
                                            <option value="">— Pilih personel —</option>
                                            {dbPersonnel.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.initial}{p.full_name ? ` — ${p.full_name}` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="field" style={{ margin: 0 }}>
                                        <label>Tanggal Mulai</label>
                                        <input type="date"
                                               value={leaveForm.startDate}
                                               onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}/>
                                    </div>
                                    <div className="field" style={{ margin: 0 }}>
                                        <label>Tanggal Selesai</label>
                                        <input type="date"
                                               value={leaveForm.endDate}
                                               onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}/>
                                    </div>
                                    <div className="field" style={{ margin: 0 }}>
                                        <label>Kategori</label>
                                        <select
                                            value={leaveForm.category}
                                            onChange={e => setLeaveForm({ ...leaveForm, category: e.target.value as DBLeave['category'] })}
                                        >
                                            <option value="CUTI">Cuti</option>
                                            <option value="SAKIT">Sakit</option>
                                            <option value="DIKLAT">Diklat</option>
                                            <option value="OTHERS">Lainnya</option>
                                        </select>
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={handleAddLeave}>
                                        Tambah
                                    </button>
                                </div>
                                <p className="faint text-sm" style={{ marginTop: 8 }}>
                                    Cuti boleh lintas bulan — engine otomatis tracking ke bulan berikutnya.
                                </p>
                            </div>
                        </details>
                    </div>

                    {/* Roster table */}
                    {roster ? (
                        <div className="panel">
                            <div className="panel-header">
                                <h2 className="panel-title">Tabel Roster</h2>
                                <span className="panel-counter">
                                    {dbPersonnel.length} personel × {daysInMonth} hari
                                </span>
                            </div>
                            <div className="panel-body" style={{ padding: 0 }}>
                                <div className="table-wrap" style={{ overflowX: 'auto' }}>
                                    <table className="data-table" style={{ fontSize: 11 }}>
                                        <thead>
                                            <tr>
                                                <th style={{
                                                    position: 'sticky', left: 0, zIndex: 2,
                                                    background: 'var(--surface, white)',
                                                    minWidth: 160,
                                                    borderRight: '1px solid var(--border)',
                                                }}>
                                                    Personel
                                                </th>
                                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                                    const dt = new Date(year, month - 1, d);
                                                    const dow = dt.getDay();
                                                    const isWeekend = dow === 0 || dow === 6;
                                                    return (
                                                        <th key={d} style={{
                                                            padding: '6px 4px', minWidth: 30, textAlign: 'center',
                                                            background: isWeekend ? 'var(--surface-2, #f5f5f5)' : undefined,
                                                            borderLeft: '1px solid var(--border)',
                                                        }}>
                                                            <div style={{ fontWeight: 600 }}>{d}</div>
                                                            <div className="faint" style={{ fontSize: 9, fontWeight: 400 }}>
                                                                {['M', 'S', 'S', 'R', 'K', 'J', 'S'][dow]}
                                                            </div>
                                                        </th>
                                                    );
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dbPersonnel.map(p => (
                                                <tr key={p.id}>
                                                    <td style={{
                                                        position: 'sticky', left: 0, zIndex: 1,
                                                        background: 'var(--surface, white)',
                                                        borderRight: '1px solid var(--border)',
                                                        whiteSpace: 'nowrap',
                                                    }}>
                                                        <strong>{p.initial}</strong>
                                                        {p.full_name && p.full_name !== p.initial && (
                                                            <div className="faint" style={{ fontSize: 10, fontWeight: 400 }}>
                                                                {p.full_name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    {(roster[p.id] || Array.from({ length: daysInMonth }, () => ({ status: '-', locked: false }))).map((c, i) => {
                                                        const isSelected = swapSelection?.personnelId === p.id && swapSelection?.day === i + 1;
                                                        const symbol = c.status === '-' ? '' : (c.status.length > 1 ? c.status[0] : c.status);
                                                        return (
                                                            <td
                                                                key={i}
                                                                onClick={() => handleCellClick(p.id, i + 1)}
                                                                title={`Hari ${i + 1}: ${c.status}${c.locked ? ' (locked)' : ''}`}
                                                                style={{
                                                                    padding: '6px 2px', textAlign: 'center',
                                                                    cursor: c.locked ? 'not-allowed' : 'pointer',
                                                                    background: cellBgHex(c.status),
                                                                    opacity: c.locked ? 0.55 : 1,
                                                                    outline: isSelected
                                                                        ? '2px solid var(--accent)'
                                                                        : c.locked
                                                                            ? '1px solid var(--border)'
                                                                            : 'none',
                                                                    outlineOffset: -2,
                                                                    fontWeight: 600,
                                                                    userSelect: 'none',
                                                                    borderLeft: '1px solid var(--border)',
                                                                }}
                                                            >
                                                                {symbol}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                            <p>
                                Belum ada roster untuk {airportCode}/{unit} {MONTHS[month - 1]} {year}.
                            </p>
                            <p className="faint text-sm">Klik <strong>Generate</strong> untuk membuat.</p>
                        </div>
                    )}

                    {/* Legenda */}
                    {roster && (
                        <div style={{
                            display: 'flex', flexWrap: 'wrap', gap: 12,
                            marginTop: 10,
                            fontSize: 'var(--fs-sm, 12px)',
                            color: 'var(--text-muted)',
                        }}>
                            {Object.entries(SHIFT_HEX).map(([k, hex]) => (
                                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: hex + '33', border: `1px solid ${hex}`, borderRadius: 3 }}/>
                                    Shift {k}
                                </span>
                            ))}
                            {Object.entries(LEAVE_HEX).map(([k, hex]) => (
                                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: hex + '40', border: `1px solid ${hex}`, borderRadius: 3 }}/>
                                    {k === 'CUTI' ? 'Cuti' : k === 'SAKIT' ? 'Sakit' : k === 'DIKLAT' ? 'Diklat' : 'Lainnya'}
                                </span>
                            ))}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ width: 14, height: 14, background: 'var(--surface-2, #f5f5f5)', border: '1px solid var(--border)', borderRadius: 3 }}/>
                                Off
                            </span>
                        </div>
                    )}
                </>
            ) : (
                <CAPanel
                    airportCode={airportCode}
                    unit={unit}
                    year={year}
                    month={month}
                    roster={roster}
                    rosterStatus={rosterStatus}
                    dbPersonnel={dbPersonnel}
                    unitConfig={unitConfig}
                />
            )}
        </div>
    );
}


// ============================================================
// CA PANEL — sub-component untuk tab Control Allowance
// ============================================================

interface CAPanelProps {
    airportCode: string;
    unit: string;
    year: number;
    month: number;
    roster: Record<string, RosterCell[]> | null;
    rosterStatus: 'DRAFT' | 'FINAL';
    dbPersonnel: DBPersonnel[];
    unitConfig: ReturnType<typeof getUnit> | undefined;
}

function CAPanel(props: CAPanelProps) {
    const { airportCode, unit, year, month, roster, rosterStatus, dbPersonnel, unitConfig } = props;

    if (!roster) {
        return (
            <div className="empty-state" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p>Belum ada roster.</p>
                <p className="faint text-sm">Buka tab <strong>Roster</strong>, klik Generate dulu.</p>
            </div>
        );
    }

    if (!unitConfig?.rolling) {
        return (
            <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-body" style={{ padding: 14, color: 'var(--status-warn, #f59e0b)' }}>
                    Control Allowance memerlukan konfigurasi rolling.
                    Unit <strong>{airportCode}/{unit}</strong> belum punya rolling table —
                    tunjangan tidak bisa dihitung.
                </div>
            </div>
        );
    }

    const cfg = getAirport(airportCode);
    const airportName = cfg?.airport_name || airportCode;

    const fakeResult = {
        success: true as const,
        year, month,
        daysInMonth: new Date(year, month, 0).getDate(),
        personnel: dbPersonnel.map(p => ({ id: p.id, initial: p.initial, leaves: [] })),
        roster,
        mode: 'external' as const,
        cutoffDay: 0,
        requiredPerDay: unitConfig?.min_on_duty_baseline ?? 3,
        isTni: false,
    };

    const nameLookup: Record<string, string> = {};
    for (const p of dbPersonnel) nameLookup[p.id] = p.full_name || p.initial;
    const nikLookup: Record<string, string> = {};

    const allowance = computeAllowanceTable({
        airportName,
        result: fakeResult,
        unitConfig,
        priorityOrder: dbPersonnel.map(p => p.id),
        nameLookup,
        nikLookup,
        rosterStatus,
    });

    if (allowance.error) {
        return (
            <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-body" style={{ padding: 14, color: 'var(--status-off, #dc2626)' }}>
                    {allowance.error}
                </div>
            </div>
        );
    }

    function downloadCSV() {
        const headers = ['No', 'Inisial', 'Nama', 'Jam Kontrol (jam)', 'Konstanta (Rp/jam)', 'Tunjangan (Rp)'];
        const lines = [
            `Control Allowance - ${airportName} ${unit} - ${month}/${year}`,
            `Status: ${rosterStatus}`,
            `Konstanta: Rp ${allowance.constant_per_hour.toLocaleString('id-ID')}/jam`,
            '',
            headers.join(','),
            ...allowance.rows.map((r: PersonnelAllowance, i: number) =>
                [
                    i + 1, r.initial, `"${r.name}"`,
                    r.kontrol_hours.toFixed(2),
                    r.constant_per_hour.toFixed(0),
                    r.allowance_rp.toFixed(0),
                ].join(',')
            ),
            '',
            `TOTAL,,,${allowance.summary.total_kontrol_hours.toFixed(2)},,${allowance.summary.total_allowance.toFixed(0)}`,
        ];
        const csv = lines.join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CA_${airportName.replace(/\s+/g, '_')}_${unit}_${year}_${String(month).padStart(2, '0')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    return (
        <>
            {/* Metric cards */}
            <div className="stats-grid" style={{ marginTop: 12 }}>
                <div className="stat-card">
                    <div style={{ flex: 1 }}>
                        <div className="stat-l">Bandara / Unit</div>
                        <div className="stat-v" style={{ fontSize: 18 }}>{airportName}</div>
                        <div className="stat-sub">Unit {unit}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ flex: 1 }}>
                        <div className="stat-l">
                            Konstanta {allowance.is_tma && <span className="status-badge status-on" style={{ marginLeft: 4 }}>TMA</span>}
                        </div>
                        <div className="stat-v" style={{ fontSize: 18 }}>
                            Rp {allowance.constant_per_hour.toLocaleString('id-ID')}
                        </div>
                        <div className="stat-sub">per jam</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ flex: 1 }}>
                        <div className="stat-l">Total Jam Kontrol</div>
                        <div className="stat-v" style={{ fontSize: 18 }}>
                            {allowance.summary.total_kontrol_hours.toFixed(2)}
                        </div>
                        <div className="stat-sub">jam</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div style={{ flex: 1 }}>
                        <div className="stat-l">Status Roster</div>
                        <div className="stat-v" style={{
                            fontSize: 18,
                            color: rosterStatus === 'FINAL' ? 'var(--status-on)' : 'var(--status-warn)',
                        }}>
                            {rosterStatus}
                        </div>
                        <div className="stat-sub">
                            {rosterStatus === 'FINAL' ? 'siap submit' : 'preview saja'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Banner DRAFT */}
            {rosterStatus !== 'FINAL' && (
                <div className="panel" style={{ marginTop: 12, background: 'var(--status-warn-soft, rgba(245,158,11,0.1))' }}>
                    <div className="panel-body" style={{ padding: 12, color: 'var(--status-warn, #f59e0b)' }}>
                        <strong>Perhatian:</strong> Roster masih DRAFT.
                        Tunjangan ini boleh dipakai untuk preview, tapi jangan submit ke HR/finance
                        sebelum roster di-mark FINAL di tab Roster.
                    </div>
                </div>
            )}

            {/* Domain rule */}
            <div className="panel" style={{ marginTop: 12, background: 'var(--accent-soft)' }}>
                <div className="panel-body" style={{ padding: 12, color: 'var(--accent)' }}>
                    <strong>Jam Kontrol</strong> = waktu Controller + Assistant per personel
                    (waktu Istirahat tidak dihitung). Tunjangan = Jam Kontrol × Konstanta.
                </div>
            </div>

            {/* Warnings */}
            {allowance.warnings.length > 0 && (
                <div className="panel" style={{ marginTop: 12 }}>
                    <details>
                        <summary className="panel-header" style={{ cursor: 'pointer' }}>
                            <h2 className="panel-title">{allowance.warnings.length} validation warning</h2>
                        </summary>
                        <div className="panel-body" style={{ paddingTop: 0 }}>
                            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 'var(--fs-sm, 13px)', color: 'var(--status-warn, #f59e0b)' }}>
                                {allowance.warnings.map((w, i) => <li key={i}>{w}</li>)}
                            </ul>
                        </div>
                    </details>
                </div>
            )}

            {/* CA Table */}
            <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-header">
                    <h2 className="panel-title">Tabel Tunjangan</h2>
                    <span className="panel-counter">{allowance.summary.n_personnel} personel</span>
                </div>
                <div className="panel-body" style={{ padding: 0 }}>
                    <div className="table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 50 }}>No</th>
                                    <th>Inisial</th>
                                    <th>Nama Lengkap</th>
                                    <th style={{ textAlign: 'right' }}>Jam Kontrol</th>
                                    <th style={{ textAlign: 'right' }}>Konstanta (Rp/jam)</th>
                                    <th style={{ textAlign: 'right' }}>Tunjangan (Rp)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allowance.rows.map((r: PersonnelAllowance, i: number) => (
                                    <tr key={r.personnel_id}>
                                        <td>{i + 1}</td>
                                        <td><strong>{r.initial}</strong></td>
                                        <td>{r.name}</td>
                                        <td className="mono" style={{ textAlign: 'right' }}>
                                            {r.kontrol_hours.toFixed(2)} jam
                                            <div className="faint" style={{ fontSize: 10 }}>
                                                ({r.kontrol_minutes.toLocaleString('id-ID')} mnt)
                                            </div>
                                        </td>
                                        <td className="mono" style={{ textAlign: 'right' }}>
                                            {r.constant_per_hour.toLocaleString('id-ID')}
                                        </td>
                                        <td className="mono" style={{
                                            textAlign: 'right', fontWeight: 700,
                                            color: 'var(--status-on, #16a34a)',
                                        }}>
                                            Rp {Math.round(r.allowance_rp).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                ))}
                                <tr style={{
                                    background: 'var(--status-on-soft, rgba(34,197,94,0.08))',
                                    borderTop: '2px solid var(--status-on, #22c55e)',
                                    fontWeight: 700,
                                }}>
                                    <td colSpan={3} style={{ textAlign: 'right' }}>TOTAL</td>
                                    <td className="mono" style={{ textAlign: 'right' }}>
                                        {allowance.summary.total_kontrol_hours.toFixed(2)} jam
                                    </td>
                                    <td/>
                                    <td className="mono" style={{
                                        textAlign: 'right',
                                        color: 'var(--status-on, #16a34a)',
                                    }}>
                                        Rp {Math.round(allowance.summary.total_allowance).toLocaleString('id-ID')}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className="faint text-sm" style={{ marginTop: 8 }}>
                Rata-rata Rp {Math.round(allowance.summary.avg_allowance).toLocaleString('id-ID')} per personel.
            </div>

            <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={downloadCSV}>
                    Download CSV
                </button>
            </div>
        </>
    );
}
