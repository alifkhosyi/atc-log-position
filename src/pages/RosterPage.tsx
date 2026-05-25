/**
 * RosterPage.tsx — Menu "Roster" untuk atc-log-position.
 *
 * Native React component yang panggil engine TypeScript langsung
 * (tidak ada API call eksternal). Simpan hasil ke Supabase tabel
 * rosters + roster_cells + leaves.
 *
 * ----- Setup yang harus kamu lakukan sebelum komponen ini jalan -----
 *
 * 1. Apply SQL: `db/setup_roster_tables.sql` di Supabase Editor
 * 2. Pastikan path import supabase client di bawah ini benar:
 *      import { supabase } from '@/lib/supabase'
 *    Kalau di repo kamu beda, ganti ke path yang sesuai.
 * 3. Tambah route di router-mu:
 *      <Route path="/roster" element={<RosterPage />} />
 * 4. Tambah menu item ke navigation (sidebar/topbar).
 *
 * ----- Adjust kalau perlu -----
 *
 * Tabel personnel di Supabase log-position kamu — kolom apa namanya?
 * Aku asumsi: { id, initial, full_name, airport_code, unit, is_active }.
 * Cari komentar `// TODO: adjust query personnel` di bawah & sesuaikan.
 */

import { useEffect, useMemo, useState } from 'react';
// Supabase client di repo log-position: src/supabase.js
import { supabase } from '../supabase';
// User context (role + branch_code)
import { useApp } from '../lib/context.jsx';

// Roster engine: src/lib/roster-engine/
import {
    type Personnel, type RosterCell, type LeaveRange,
    type FrmsIssue,
    generateRoster,
    swapShift,
    validateFull, splitBySeverity,
    leaveRangeFromDates,
    listAirports, getAirport, getUnit, getBaselineForMonth,
    computeAllowanceTable, summarizeAllowance,
    type PersonnelAllowance, type AllowanceSummary,
} from '../lib/roster-engine';

// ============================================================
// HELPERS / CONSTANTS
// ============================================================

const SHIFT_COLOR: Record<string, string> = {
    I: 'bg-blue-200',
    II: 'bg-yellow-200',
    III: 'bg-purple-200',
    IV: 'bg-pink-200',
    V: 'bg-teal-200',
};

const LEAVE_COLOR: Record<string, string> = {
    CUTI: 'bg-orange-300',
    SAKIT: 'bg-red-300',
    DIKLAT: 'bg-sky-300',
    OTHERS: 'bg-gray-300',
};

const OFF_COLOR = 'bg-gray-100';

function cellColor(status: string): string {
    if (SHIFT_COLOR[status]) return SHIFT_COLOR[status];
    if (LEAVE_COLOR[status]) return LEAVE_COLOR[status];
    if (status === 'TNI') return 'bg-amber-200';
    return OFF_COLOR;
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
// COMPONENT
// ============================================================

export default function RosterPage() {
    // ---- User context (untuk lock airport per role) ----
    const ctx = useApp();
    const user = ctx?.user;
    const isAdmin = user?.role === 'admin';
    // Branch code MO cabang — format diasumsikan UPPER, match airport_code engine
    const userBranchCode = (user?.branch_code || '').toUpperCase();

    // ---- Setup state ----
    const allAirports = useMemo(() => listAirports(), []);
    // Default airport: kalau MO cabang, lock ke branch_code. Kalau admin, default AMBON.
    const [airportCode, setAirportCode] = useState(
        isAdmin ? 'AMBON' : (userBranchCode || 'AMBON')
    );
    const [unit, setUnit] = useState('TWR');
    const [year, setYear] = useState(new Date().getFullYear());
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    // ---- Tab navigation: 'roster' atau 'ca' (Control Allowance) ----
    const [activeTab, setActiveTab] = useState<'roster' | 'ca'>('roster');

    // ---- Lock airport ke branch_code kalau bukan admin ----
    useEffect(() => {
        if (!isAdmin && userBranchCode && userBranchCode !== airportCode) {
            setAirportCode(userBranchCode);
        }
    }, [isAdmin, userBranchCode]);

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

    // ---- Add leave form ----
    const [leaveForm, setLeaveForm] = useState({
        personnelId: '', startDate: '', endDate: '', category: 'CUTI' as DBLeave['category'],
    });

    const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);

    // Available units for current airport
    const availableUnits = useMemo(() => {
        const ap = getAirport(airportCode);
        return ap ? ap.units.map(u => u.unit) : ['TWR'];
    }, [airportCode]);

    const unitConfig = useMemo(() => {
        const ap = getAirport(airportCode);
        return ap ? getUnit(ap, unit) : undefined;
    }, [airportCode, unit]);

    // ============================================================
    // 1. LOAD PERSONNEL & LEAVES dari Supabase
    // ============================================================
    useEffect(() => {
        let cancelled = false;

        async function loadPersonnel() {
            // TODO: adjust query personnel — sesuaikan nama tabel & kolom dengan
            // struktur Supabase log-position kamu.
            const { data, error: err } = await supabase
                .from('personnel')
                .select('id, initial, full_name, airport_code, unit, is_active, priority_order')
                .eq('airport_code', airportCode)
                .eq('unit', unit)
                .order('priority_order', { ascending: true, nullsFirst: false });

            if (cancelled) return;
            if (err) {
                // Fallback: kalau tabel personnel belum ada, pakai initials dari config
                // (engine punya 73 airports + initials)
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
                    setError(`Tabel personnel tidak terbaca: ${err.message}`);
                }
                return;
            }
            if (data && data.length > 0) {
                setDbPersonnel(data as DBPersonnel[]);
            } else if (unitConfig?.initials && unitConfig.initials.length > 0) {
                // Tabel kosong → fallback ke config
                setDbPersonnel(unitConfig.initials.map((ini, i) => ({
                    id: ini, initial: ini,
                    full_name: unitConfig.names?.[i],
                    airport_code: airportCode, unit,
                    is_active: true,
                    priority_order: i,
                })));
            } else {
                setDbPersonnel([]);
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
    }, [airportCode, unit, year, month, unitConfig]);

    // ============================================================
    // 2. LOAD existing roster (kalau ada)
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
                    grouped[p.id] = Array.from({ length: daysInMonth }, () => ({
                        status: '-', locked: false,
                    }));
                }
                for (const c of cells as any[]) {
                    if (!grouped[c.personnel_id]) {
                        grouped[c.personnel_id] = Array.from({ length: daysInMonth }, () => ({
                            status: '-', locked: false,
                        }));
                    }
                    grouped[c.personnel_id][c.day - 1] = {
                        status: c.status, locked: c.locked,
                    };
                }
                setRoster(grouped);
                validateRoster(grouped);
            }
        }
        load();
        return () => { cancelled = true; };
    }, [airportCode, unit, year, month, dbPersonnel, daysInMonth]);

    // ============================================================
    // 3. REALTIME — auto-refresh kalau ada user lain swap
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
                                updated[c.personnel_id][c.day - 1] = {
                                    status: c.status, locked: c.locked,
                                };
                            }
                        }
                        return updated;
                    });
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [rosterId]);

    // ============================================================
    // 4. GENERATE ROSTER
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
            // Build Personnel objects untuk engine
            const personnel: Personnel[] = dbPersonnel
                .filter(p => p.is_active !== false)
                .map(p => ({
                    id: p.id, initial: p.initial,
                    leaves: [],
                    priorityOrder: p.priority_order ?? 0,
                }));

            // Attach leaves (sudah loaded dari DB)
            for (const lv of dbLeaves) {
                const p = personnel.find(pp => pp.id === lv.personnel_id);
                if (!p) continue;
                const projected = leaveRangeFromDates(
                    lv.start_date, lv.end_date, year, month, lv.category,
                );
                if (projected) p.leaves.push(projected);
            }

            // Load prev_month_tail dari bulan N-1
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

            // Baseline pattern dari config
            const baseline = getBaselineForMonth(airportCode, unit, daysInMonth) || null;

            // Generate
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

            // Compute pattern_phase_at_eom
            const tailLen = Math.min(7, result.daysInMonth);
            const phase: Record<string, string[]> = {};
            for (const [pid, cells] of Object.entries(result.roster)) {
                phase[pid] = cells.slice(-tailLen).map(c => c.status);
            }

            // Upsert roster row
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

            // Delete old cells + insert new
            await supabase.from('atc_roster_cells').delete().eq('roster_id', rosterRow!.id);
            const cellsToInsert = [];
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
            // Batch insert
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

    // ============================================================
    // 5. VALIDATE FRMS
    // ============================================================
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
            // ignore
        }
    }

    // ============================================================
    // 6. SWAP CELL (click 2 cells)
    // ============================================================
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
            setSwapSelection(null);  // unselect
            return;
        }

        // Do swap
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
        // Update DB
        if (rosterId) {
            const a = swapSelection.personnelId;
            const b = personnelId;
            await Promise.all([
                supabase.from('atc_roster_cells').update({ status: roster[a][day - 1].status })
                    .eq('roster_id', rosterId).eq('personnel_id', a).eq('day', day),
                supabase.from('atc_roster_cells').update({ status: roster[b][day - 1].status })
                    .eq('roster_id', rosterId).eq('personnel_id', b).eq('day', day),
            ]);
            // Edit FINAL → revert ke DRAFT
            if (rosterStatus === 'FINAL') {
                await supabase.from('atc_rosters').update({ status: 'DRAFT' }).eq('id', rosterId);
                setRosterStatus('DRAFT');
                setInfo('Roster di-revert ke DRAFT karena ada perubahan.');
            }
        }
        setRoster({ ...roster });  // force re-render
        validateRoster(roster);
    }

    // ============================================================
    // 7. MARK FINAL / REVERT
    // ============================================================
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

    // ============================================================
    // 8. ADD LEAVE
    // ============================================================
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
        // Reload leaves
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
    // Airport list yang boleh dipilih oleh user ini
    const selectableAirports = useMemo(() => {
        if (isAdmin) return allAirports;
        // MO cabang: cuma cabang sendiri
        return allAirports.filter(a => a.airport_code === userBranchCode);
    }, [isAdmin, userBranchCode, allAirports]);

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-full">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Roster ATC</h1>
                <span className="text-sm text-gray-500">
                    {dbPersonnel.length} personel
                    {!isAdmin && userBranchCode && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                            Cabang {userBranchCode}
                        </span>
                    )}
                </span>
            </header>

            {/* Tab navigation */}
            <div className="flex border-b">
                <button
                    onClick={() => setActiveTab('roster')}
                    className={`px-4 py-2 font-semibold border-b-2 ${
                        activeTab === 'roster'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}>
                    📅 Roster
                </button>
                <button
                    onClick={() => setActiveTab('ca')}
                    className={`px-4 py-2 font-semibold border-b-2 ${
                        activeTab === 'ca'
                            ? 'border-blue-600 text-blue-700'
                            : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}>
                    💰 Control Allowance
                </button>
            </div>

            {/* Toolbar (shared antara tab Roster & CA) */}
            <div className="flex flex-wrap gap-3 items-end p-3 bg-gray-50 rounded">
                <label className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-600 mb-1">
                        Cabang {!isAdmin && '(terkunci)'}
                    </span>
                    <select className="border rounded px-2 py-1 min-w-[160px] disabled:bg-gray-100 disabled:cursor-not-allowed"
                            value={airportCode}
                            disabled={!isAdmin}
                            onChange={e => { setAirportCode(e.target.value); setUnit('TWR'); }}>
                        {selectableAirports.map(a => (
                            <option key={a.airport_code} value={a.airport_code}>
                                {a.airport_name}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-600 mb-1">Unit</span>
                    <select className="border rounded px-2 py-1"
                            value={unit} onChange={e => setUnit(e.target.value)}>
                        {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </label>
                <label className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-600 mb-1">Bulan</span>
                    <select className="border rounded px-2 py-1"
                            value={month} onChange={e => setMonth(+e.target.value)}>
                        {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                </label>
                <label className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-600 mb-1">Tahun</span>
                    <input type="number" className="border rounded px-2 py-1 w-24"
                           value={year} onChange={e => setYear(+e.target.value)} />
                </label>
                <button onClick={handleGenerate}
                        disabled={loading || dbPersonnel.length === 0}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50">
                    {loading ? 'Memproses…' : (roster ? 'Re-generate' : 'Generate')}
                </button>
            </div>

            {/* Status banner */}
            {roster && (
                <div className="flex flex-wrap gap-2 items-center">
                    <span className={`px-3 py-1 rounded text-sm font-bold ${
                        rosterStatus === 'FINAL'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                    }`}>
                        {rosterStatus === 'FINAL' ? '✅ FINAL' : '🚧 DRAFT'}
                    </span>
                    <span className="text-sm text-gray-500">Mode: {mode}</span>
                    {rosterStatus === 'DRAFT' ? (
                        <button onClick={handleMarkFinal}
                                disabled={frmsErrors.length > 0}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
                            Mark FINAL
                        </button>
                    ) : (
                        <button onClick={handleRevert}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm">
                            ↩ Revert ke DRAFT
                        </button>
                    )}
                    {swapSelection && (
                        <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs rounded">
                            Klik cell ke-2 di hari yang sama untuk swap, atau klik ulang untuk batal
                        </span>
                    )}
                </div>
            )}

            {/* Alerts */}
            {info && (
                <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded text-sm">
                    {info}
                </div>
            )}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded text-sm whitespace-pre-line">
                    {error}
                </div>
            )}

            {/* ==================== TAB ROSTER ==================== */}
            {activeTab === 'roster' && (
            <>
            {/* FRMS panel */}
            {roster && (frmsErrors.length > 0 || frmsWarnings.length > 0) && (
                <details className="border rounded p-3 bg-white">
                    <summary className="cursor-pointer font-semibold">
                        FRMS: <span className="text-red-700">{frmsErrors.length} errors</span>
                        , <span className="text-amber-700">{frmsWarnings.length} warnings</span>
                    </summary>
                    <ul className="mt-2 text-sm space-y-1">
                        {frmsErrors.map((e, i) =>
                            <li key={`e-${i}`} className="text-red-700">
                                [{e.rule}] {e.message}
                            </li>
                        )}
                        {frmsWarnings.map((w, i) =>
                            <li key={`w-${i}`} className="text-amber-700">
                                [{w.rule}] {w.message}
                            </li>
                        )}
                    </ul>
                </details>
            )}

            {/* Add leave form */}
            <details className="border rounded p-3 bg-white">
                <summary className="cursor-pointer font-semibold">+ Tambah Cuti / Off-Roster</summary>
                <div className="mt-3 flex flex-wrap gap-2 items-end">
                    <select className="border rounded px-2 py-1"
                            value={leaveForm.personnelId}
                            onChange={e => setLeaveForm({ ...leaveForm, personnelId: e.target.value })}>
                        <option value="">— Pilih personel —</option>
                        {dbPersonnel.map(p => (
                            <option key={p.id} value={p.id}>
                                {p.initial}{p.full_name ? ` — ${p.full_name}` : ''}
                            </option>
                        ))}
                    </select>
                    <input type="date" className="border rounded px-2 py-1"
                           value={leaveForm.startDate}
                           onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                    <span className="text-gray-500">—</span>
                    <input type="date" className="border rounded px-2 py-1"
                           value={leaveForm.endDate}
                           onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                    <select className="border rounded px-2 py-1"
                            value={leaveForm.category}
                            onChange={e => setLeaveForm({ ...leaveForm, category: e.target.value as DBLeave['category'] })}>
                        <option value="CUTI">Cuti</option>
                        <option value="SAKIT">Sakit</option>
                        <option value="DIKLAT">Diklat</option>
                        <option value="OTHERS">Lainnya</option>
                    </select>
                    <button onClick={handleAddLeave}
                            className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded text-sm">
                        Tambah
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    Cuti boleh lintas bulan — engine otomatis tracking ke bulan berikutnya.
                </p>
            </details>

            {/* Roster table */}
            {roster ? (
                <div className="overflow-x-auto border rounded">
                    <table className="text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 sticky top-0">
                                <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left min-w-[160px] border-r">
                                    Personel
                                </th>
                                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
                                    const dt = new Date(year, month - 1, d);
                                    const dow = dt.getDay();
                                    const isWeekend = dow === 0 || dow === 6;
                                    return (
                                        <th key={d} className={`px-1 py-2 w-8 text-center border-r ${isWeekend ? 'bg-gray-100' : ''}`}>
                                            <div>{d}</div>
                                            <div className="text-[9px] text-gray-400 font-normal">
                                                {['M', 'S', 'S', 'R', 'K', 'J', 'S'][dow]}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {dbPersonnel.map(p => (
                                <tr key={p.id} className="border-t hover:bg-gray-50">
                                    <td className="sticky left-0 bg-white px-3 py-1 font-semibold border-r whitespace-nowrap">
                                        {p.initial}
                                        {p.full_name && (
                                            <div className="text-[10px] text-gray-500 font-normal">
                                                {p.full_name}
                                            </div>
                                        )}
                                    </td>
                                    {(roster[p.id] || Array.from({ length: daysInMonth }, () => ({ status: '-', locked: false }))).map((c, i) => {
                                        const isSelected = swapSelection?.personnelId === p.id && swapSelection?.day === i + 1;
                                        const symbol = c.status === '-' ? '' : (c.status.length > 1 ? c.status[0] : c.status);
                                        return (
                                            <td key={i}
                                                onClick={() => handleCellClick(p.id, i + 1)}
                                                className={`
                                                    px-1 py-1 text-center cursor-pointer select-none
                                                    ${cellColor(c.status)}
                                                    ${c.locked ? 'opacity-60 cursor-not-allowed border-2 border-gray-400' : 'hover:ring-2 hover:ring-blue-400'}
                                                    ${isSelected ? 'ring-2 ring-green-500' : ''}
                                                    border-r
                                                `}
                                                title={`Hari ${i + 1}: ${c.status}${c.locked ? ' (locked)' : ''}`}>
                                                {symbol}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-gray-500 italic py-8 text-center">
                    Belum ada roster untuk {airportCode}/{unit} {MONTHS[month - 1]} {year}.<br />
                    Klik <strong>Generate</strong> untuk membuat.
                </div>
            )}

            {/* Legenda */}
            {roster && (
                <div className="flex flex-wrap gap-3 text-xs text-gray-600 pt-2">
                    <span className="inline-flex items-center"><span className="w-4 h-4 bg-blue-200 mr-1 inline-block"></span>Shift I</span>
                    <span className="inline-flex items-center"><span className="w-4 h-4 bg-yellow-200 mr-1 inline-block"></span>Shift II</span>
                    <span className="inline-flex items-center"><span className="w-4 h-4 bg-orange-300 mr-1 inline-block"></span>Cuti</span>
                    <span className="inline-flex items-center"><span className="w-4 h-4 bg-red-300 mr-1 inline-block"></span>Sakit</span>
                    <span className="inline-flex items-center"><span className="w-4 h-4 bg-sky-300 mr-1 inline-block"></span>Diklat</span>
                    <span className="inline-flex items-center"><span className="w-4 h-4 bg-gray-100 mr-1 inline-block border"></span>Off</span>
                </div>
            )}
            </>
            )}

            {/* ==================== TAB CONTROL ALLOWANCE ==================== */}
            {activeTab === 'ca' && (
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
// CA PANEL — Sub-component untuk tab Control Allowance
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
            <div className="text-gray-500 italic py-8 text-center">
                Belum ada roster. Buka tab <strong>Roster</strong>, klik Generate dulu,
                baru Control Allowance bisa dihitung.
            </div>
        );
    }

    if (!unitConfig?.rolling) {
        return (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 p-3 rounded text-sm">
                Control Allowance memerlukan konfigurasi rolling.
                Unit <strong>{airportCode}/{unit}</strong> belum punya rolling table —
                tunjangan tidak bisa dihitung.
            </div>
        );
    }

    // Build airport_name untuk lookup konstanta
    const cfg = getAirport(airportCode);
    const airportName = cfg?.airport_name || airportCode;

    // Build fake GenerateResult untuk feed ke engine
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
    const nikLookup: Record<string, string> = {};  // empty for now

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
            <div className="bg-red-50 border border-red-300 text-red-800 p-3 rounded text-sm">
                {allowance.error}
            </div>
        );
    }

    // CSV export
    function downloadCSV() {
        const headers = ['No', 'Inisial', 'Nama', 'Jam Kontrol (jam)', 'Konstanta (Rp/jam)', 'Tunjangan (Rp)'];
        const lines = [
            `Control Allowance - ${airportName} ${unit} - ${month}/${year}`,
            `Status: ${rosterStatus}`,
            `Konstanta: Rp ${allowance.constant_per_hour.toLocaleString('id-ID')}/jam`,
            '',
            headers.join(','),
            ...allowance.rows.map((r, i) =>
                [
                    i + 1,
                    r.initial,
                    `"${r.name}"`,
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
        <div className="space-y-3">
            {/* Header metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white border rounded p-3">
                    <div className="text-xs text-gray-500">Bandara / Unit</div>
                    <div className="text-base font-bold mt-1">{airportName} {unit}</div>
                </div>
                <div className="bg-white border rounded p-3">
                    <div className="text-xs text-gray-500">
                        Konstanta {allowance.is_tma && <span className="text-amber-600">★ TMA</span>}
                    </div>
                    <div className="text-base font-bold mt-1">
                        Rp {allowance.constant_per_hour.toLocaleString('id-ID')}<span className="text-xs font-normal">/jam</span>
                    </div>
                </div>
                <div className="bg-white border rounded p-3">
                    <div className="text-xs text-gray-500">Total Jam Kontrol</div>
                    <div className="text-base font-bold mt-1">
                        {allowance.summary.total_kontrol_hours.toFixed(2)} jam
                    </div>
                </div>
                <div className={`border rounded p-3 ${
                    rosterStatus === 'FINAL'
                        ? 'bg-green-50 border-green-300'
                        : 'bg-yellow-50 border-yellow-300'
                }`}>
                    <div className="text-xs text-gray-500">Status Roster</div>
                    <div className="text-base font-bold mt-1">
                        {rosterStatus === 'FINAL' ? '🔒 FINAL' : '🚧 DRAFT'}
                    </div>
                </div>
            </div>

            {/* Banner DRAFT warning */}
            {rosterStatus !== 'FINAL' && (
                <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 p-3 rounded text-sm">
                    ⚠️ Roster masih <strong>DRAFT</strong>. Tunjangan ini boleh dipakai untuk preview,
                    tapi <strong>jangan submit ke HR/finance</strong> sebelum roster di-mark FINAL
                    di tab Roster.
                </div>
            )}

            {/* Domain rule banner */}
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded text-sm">
                ℹ️ <strong>Jam Kontrol</strong> = waktu Controller + Assistant per personel
                (waktu Istirahat <strong>tidak</strong> dihitung). Tunjangan = Jam Kontrol × Konstanta.
            </div>

            {/* Warnings */}
            {allowance.warnings.length > 0 && (
                <details className="border rounded p-3 bg-white">
                    <summary className="cursor-pointer font-semibold text-amber-700">
                        ⚠️ {allowance.warnings.length} validation warning
                    </summary>
                    <ul className="mt-2 text-sm space-y-1 text-amber-700">
                        {allowance.warnings.map((w, i) => <li key={i}>• {w}</li>)}
                    </ul>
                </details>
            )}

            {/* CA Table */}
            <div className="overflow-x-auto border rounded bg-white">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-3 py-2 text-left w-12">No</th>
                            <th className="px-3 py-2 text-left">Inisial</th>
                            <th className="px-3 py-2 text-left">Nama Lengkap</th>
                            <th className="px-3 py-2 text-right">Jam Kontrol</th>
                            <th className="px-3 py-2 text-right">Konstanta (Rp/jam)</th>
                            <th className="px-3 py-2 text-right">Tunjangan (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allowance.rows.map((r, i) => (
                            <tr key={r.personnel_id} className="border-t hover:bg-gray-50">
                                <td className="px-3 py-2">{i + 1}</td>
                                <td className="px-3 py-2 font-semibold">{r.initial}</td>
                                <td className="px-3 py-2">{r.name}</td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {r.kontrol_hours.toFixed(2)} jam
                                    <div className="text-[10px] text-gray-400">
                                        ({r.kontrol_minutes.toLocaleString('id-ID')} mnt)
                                    </div>
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                    {r.constant_per_hour.toLocaleString('id-ID')}
                                </td>
                                <td className="px-3 py-2 text-right font-bold text-green-700 tabular-nums">
                                    Rp {Math.round(r.allowance_rp).toLocaleString('id-ID')}
                                </td>
                            </tr>
                        ))}
                        <tr className="border-t-2 border-green-600 bg-green-50 font-bold">
                            <td colSpan={3} className="px-3 py-3 text-right">TOTAL</td>
                            <td className="px-3 py-3 text-right tabular-nums">
                                {allowance.summary.total_kontrol_hours.toFixed(2)} jam
                            </td>
                            <td></td>
                            <td className="px-3 py-3 text-right text-green-800 tabular-nums">
                                Rp {Math.round(allowance.summary.total_allowance).toLocaleString('id-ID')}
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="text-xs text-gray-500">
                {allowance.summary.n_personnel} personel •
                Rata-rata Rp {Math.round(allowance.summary.avg_allowance).toLocaleString('id-ID')} per personel
            </div>

            {/* Export */}
            <button
                onClick={downloadCSV}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm">
                ⬇ Download CSV
            </button>
        </div>
    );
}
