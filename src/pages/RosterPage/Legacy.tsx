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
import { supabase } from '../../supabase';
import { useApp } from '../../lib/context.jsx';
// Phase 3 fix N-03: CSS tokens untuk shift & leave colors
import '../../styles/roster-tokens.css';

// Split-engine refactor: shared types from shared/, airport data from
// airport-data/, roster logic from roster-engine/.
// CA + rolling sudah pindah ke folder masing-masing (lihat
// SPLIT_ENGINE_HANDOFF.md). TunjanganPage handle CA.
import type { Personnel, RosterCell, LeaveRange, DBLeave } from '../../lib/shared';
import { leaveRangeFromDates } from '../../lib/shared';
import {
    generateRoster,
    swapShift,
    validateFull, splitBySeverity,
    type FrmsIssue,
} from '../../lib/roster-engine';
import {
    listAirports, getAirport, getUnit, getBaselineForMonth,
} from '../../lib/airport-data';

// ============================================================
// COLOR HELPERS — pakai CSS tokens dari roster-tokens.css (N-03)
// ============================================================

const SHIFT_TOKEN: Record<string, { stroke: string; soft: string }> = {
    I:   { stroke: 'var(--shift-I)',   soft: 'var(--shift-I-soft)' },
    II:  { stroke: 'var(--shift-II)',  soft: 'var(--shift-II-soft)' },
    III: { stroke: 'var(--shift-III)', soft: 'var(--shift-III-soft)' },
    IV:  { stroke: 'var(--shift-IV)',  soft: 'var(--shift-IV-soft)' },
    V:   { stroke: 'var(--shift-V)',   soft: 'var(--shift-V-soft)' },
};
const LEAVE_TOKEN: Record<string, { stroke: string; soft: string }> = {
    CUTI:   { stroke: 'var(--leave-cuti)',   soft: 'var(--leave-cuti-soft)' },
    SAKIT:  { stroke: 'var(--leave-sakit)',  soft: 'var(--leave-sakit-soft)' },
    DIKLAT: { stroke: 'var(--leave-diklat)', soft: 'var(--leave-diklat-soft)' },
    OTHERS: { stroke: 'var(--leave-others)', soft: 'var(--leave-others-soft)' },
};

function cellBg(status: string): string {
    if (SHIFT_TOKEN[status]) return SHIFT_TOKEN[status].soft;
    if (LEAVE_TOKEN[status]) return LEAVE_TOKEN[status].soft;
    if (status === 'TNI') return 'var(--tni-soft)';
    return 'var(--surface-2, #f5f5f5)';
}

// Helper: detect UUID-like string supaya tidak tampil sebagai initial
function isUuidLike(s: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

// Helper: derive short display initial dari nama lengkap
function deriveDisplayInitial(name: string | undefined, fallback: string = 'P'): string {
    if (!name || typeof name !== 'string') return fallback;
    const words = name.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return fallback;
    if (words.length === 1) return words[0].slice(0, 4).toUpperCase();
    return words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
}

const MONTHS = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Map internal engine mode → user-friendly status text.
 * Engine internal names (baseline/baseline-multishift/template/greedy)
 * TIDAK boleh muncul di UI — itu detail engineer.
 */
function friendlyModeMessage(mode: string): string {
    if (mode === 'baseline' || mode === 'baseline-multishift') {
        return 'Roster dibuat berdasarkan template standar cabang.';
    }
    if (mode === 'template') {
        return 'Roster dibuat dari pola default.';
    }
    if (mode === 'greedy') {
        // Greedy SEHARUSNYA jarang terjadi setelah baseline enforcement.
        return 'Roster disesuaikan otomatis (template tidak tersedia).';
    }
    if (mode === 'tni') {
        return 'Cabang TNI — semua hari diisi default.';
    }
    return 'berhasil di-generate.';
}

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

// DBLeave dipindah ke src/lib/shared/db-types.ts (split-engine cleanup #3).
// Import via shared di atas. Definisi disini sudah dihapus untuk dedupe.

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
    // Step 10 cleanup: activeTab state dihapus — CA pindah ke TunjanganPage.

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

    // leaveForm state DIHAPUS — form sudah pindah ke Tab Off-Roster.
    // dbLeaves (di atas) tetap di-load untuk engine generator.

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
                setDbPersonnel(filtered.map((p: any, i: number) => {
                    const name = p.name || p.full_name || '';
                    // Initial display: kalau p.initial valid (bukan UUID), pakai itu.
                    // Otherwise derive dari nama (AGUS LESTARIONO → "AL")
                    const rawInit = p.initial && !isUuidLike(p.initial) ? p.initial : null;
                    const initial = rawInit || deriveDisplayInitial(name, `P${i + 1}`);
                    return {
                        id: p.id,
                        initial,
                        full_name: name,
                        airport_code: airportCode,
                        unit,
                        is_active: p.is_active !== false,
                        priority_order: p.priority_order ?? i,
                    };
                }));
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
            setInfo(`Roster ${MONTHS[month - 1]} ${year}: ${friendlyModeMessage(result.mode)}`);
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

    // handleAddLeave() DIHAPUS — operasi CRUD Off-Roster sudah pindah ke
    // src/pages/RosterPage/OffRosterTab.tsx (Tab 2 di shell).

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <div className="page-content">
            {/* TOPBAR di-HAPUS (cleanup #2) — judul "Roster ATC" sudah ada
                di sidebar item + tab indicator. Personnel count + branch
                info di-pindah ke toolbar/status row di bawah supaya tidak
                duplikat 3× di layar.

                Note (cleanup #2 step 10): inner Roster/CA tabs removed — CA
                pindah ke page Tunjangan ATC standalone, halaman ini sekarang
                jadi "Tab 1: Jadwal Bulanan" di shell RosterPage/index.tsx. */}

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

            {/* Step 10 cleanup: tab CA dihapus, tinggal Roster (Jadwal Bulanan). */}
            <>
                    {/* Status strip — cleanup #1: konsisten dengan TunjanganPage
                        + RollingPage. Pill kiri (status pill style), info tengah
                        (mode + personnel + branch), tombol Mark FINAL / Revert
                        di kanan. */}
                    {roster && (
                        <div className="rs-strip">
                            <div className="rs-strip-left">
                                <span className={'rs-pill ' + (rosterStatus === 'FINAL' ? 'final' : 'draft')}>
                                    Roster · {rosterStatus === 'FINAL' ? 'FINAL' : 'DRAFT'}
                                </span>
                                <span className="rs-meta">
                                    <b>{dbPersonnel.length}</b> personel × <b>{daysInMonth}</b> hari
                                    {!isAdmin && branchDisplayName && (
                                        <> · cabang <b>{branchDisplayName}</b></>
                                    )}
                                    {/* Engine internal mode name (baseline / greedy / template)
                                        sengaja TIDAK ditampilkan — user tidak perlu tahu
                                        algoritma backend. Lihat friendlyModeMessage() di atas
                                        untuk feedback yang user-friendly via toast. */}
                                </span>
                            </div>
                            <div className="rs-strip-right">
                                {rosterStatus === 'DRAFT' ? (
                                    <button
                                        className="btn btn-sm btn-primary"
                                        onClick={handleMarkFinal}
                                        disabled={frmsErrors.length > 0}
                                        title={frmsErrors.length > 0
                                            ? `Fix ${frmsErrors.length} FRMS error dulu sebelum FINAL`
                                            : 'Mark roster ini sebagai FINAL'}
                                    >
                                        ✓ Mark FINAL
                                    </button>
                                ) : (
                                    <button className="btn btn-sm" onClick={handleRevert}>
                                        ↩ Revert ke DRAFT
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {swapSelection && (
                        <div className="rs-swap-notice">
                            Klik cell ke-2 di hari yang sama untuk swap, atau klik ulang untuk batal.
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

                    {/* Form "Tambah Cuti / Off-Roster" sengaja DIHAPUS dari sini.
                        Sudah pindah ke Tab 2 (Off-Roster) — flow penuh dengan
                        stats strip, filter, edit, delete. Data dbLeaves di sini
                        tetap di-load dari Supabase untuk engine generator yang
                        butuh tahu siapa cuti hari apa. */}

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
                                                        // Display rules:
                                                        //   '-'                  → ''
                                                        //   SHIFT_TOKEN (I..V)   → full token (max 3 char fits 30px col)
                                                        //   LEAVE_TOKEN / TNI    → first char only (CUTI→C, SAKIT→S, DIKLAT→D, OTHERS→O, TNI→T)
                                                        // Sebelumnya semua status >1 char di-truncate ke char[0],
                                                        // bikin "II"/"III"/"IV" semua tampil "I" → pattern shift
                                                        // tidak terbaca, user cuma bisa bedakan via warna cellBg.
                                                        const symbol =
                                                            c.status === '-' ? '' :
                                                            SHIFT_TOKEN[c.status] ? c.status :
                                                            c.status[0];
                                                        return (
                                                            <td
                                                                key={i}
                                                                onClick={() => handleCellClick(p.id, i + 1)}
                                                                title={`Hari ${i + 1}: ${c.status}${c.locked ? ' (locked)' : ''}`}
                                                                style={{
                                                                    padding: '6px 2px', textAlign: 'center',
                                                                    cursor: c.locked ? 'not-allowed' : 'pointer',
                                                                    background: cellBg(c.status),
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
                            {Object.entries(SHIFT_TOKEN).map(([k, t]) => (
                                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: t.soft, border: `1px solid ${t.stroke}`, borderRadius: 3 }}/>
                                    Shift {k}
                                </span>
                            ))}
                            {Object.entries(LEAVE_TOKEN).map(([k, t]) => (
                                <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 14, height: 14, background: t.soft, border: `1px solid ${t.stroke}`, borderRadius: 3 }}/>
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
        </div>
    );
}

// Step 10 cleanup: CAPanel function (~270 lines) sudah dihapus.
// Logic-nya pindah ke src/pages/TunjanganPage.tsx sebagai standalone
// page, dengan tambahan kolom Jam Advance + Jam Extend.
