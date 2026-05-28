/**
 * Rolling Intra-Shift Module.
 *
 * Port dari Python `rolling.py`.
 *
 * Compute pola rolling Control/Assistant/Rest per slot waktu, untuk
 * personel on-duty hari tertentu.
 *
 * Mendukung:
 *   - 3-personnel rolling (default Oksibil, 6 slot × 100 menit)
 *   - 2-personnel rolling (untuk 2-on-duty seperti Tambolaka)
 *   - Variable slot duration (Tambolaka 240/240/60/60)
 *
 * NOTE (split-engine refactor): file pindah dari roster-engine/rolling.ts.
 * Logic UNCHANGED — bug "cuma cek shift I" sengaja dibiarkan, akan di-fix
 * di PR berikutnya (lihat SPLIT_ENGINE_HANDOFF.md §13).
 */

import type {
    DailyRolling, TimeSlot,
    RecapEntry,
    MonthlyRolling,
    ComputeSlotTimesOptions,
    ComputeDailyRollingOptions,
    ComputeMonthlyRollingOptions,
} from './types';
import {
    SLOT_DURATION_MIN, N_SLOTS, ROLLING_PATTERN,
} from './types';
import {
    POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT,
} from '../airport-data/types';
import { SHIFT_TOKENS } from '../shared/types';

const SHIFT_TOKEN_SET = new Set<string>(SHIFT_TOKENS as readonly string[]);

// ============================================================
// SLOT TIMES
// ============================================================

function formatTime(hour: number, minute: number): string {
    const h = String(hour).padStart(2, '0');
    const m = String(minute).padStart(2, '0');
    return `${h}:${m}`;
}

function addMinutes(hour: number, minute: number, addMin: number): [number, number] {
    const total = hour * 60 + minute + addMin;
    return [Math.floor((total / 60) % 24), total % 60];
}

export function computeSlotTimes(opts: ComputeSlotTimesOptions = {}): Array<[string, string]> {
    const {
        shiftStartUtc = '21:00',
        nSlots = N_SLOTS,
        slotDurationMin = SLOT_DURATION_MIN,
        slotDurations,
    } = opts;

    let durations: number[];
    if (slotDurations && slotDurations.length > 0) {
        durations = [...slotDurations];
        while (durations.length < nSlots) durations.push(slotDurationMin);
    } else {
        durations = Array(nSlots).fill(slotDurationMin);
    }

    const [startH, startM] = shiftStartUtc.split(':').map(Number);
    let curH = startH;
    let curM = startM;
    const times: Array<[string, string]> = [];
    for (let i = 0; i < nSlots; i++) {
        const [endH, endM] = addMinutes(curH, curM, durations[i]);
        times.push([formatTime(curH, curM), formatTime(endH, endM)]);
        curH = endH;
        curM = endM;
    }
    return times;
}

// ============================================================
// PERSONNEL ABC ASSIGNMENT
// ============================================================

export function assignPersonnelToABC(
    onDutyInitials: string[],
    priorityOrder: string[],
): string[] {
    return [...onDutyInitials].sort((a, b) => {
        const ia = priorityOrder.indexOf(a);
        const ib = priorityOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
}

// ============================================================
// DAILY ROLLING
// ============================================================

export function computeDailyRolling(opts: ComputeDailyRollingOptions): DailyRolling {
    const {
        day,
        onDutyInitials,
        priorityOrder,
        shiftStartUtc = '21:00',
        nSlots = N_SLOTS,
        slotDurationMin = SLOT_DURATION_MIN,
        positionsPerSlot,
        slotDurations,
        nPersonnel,
    } = opts;

    const pattern: string[][] = positionsPerSlot ?? (ROLLING_PATTERN as unknown as string[][]);
    const nPers = nPersonnel ?? (pattern.length > 0 ? pattern[0].length : 3);

    if (onDutyInitials.length !== nPers) {
        throw new Error(
            `Rolling butuh tepat ${nPers} personel, dapat ${onDutyInitials.length}`,
        );
    }

    // Extend pattern jika kurang dari n_slots (repeat base cycle)
    const fullPattern = [...pattern];
    while (fullPattern.length < nSlots) {
        fullPattern.push(fullPattern[fullPattern.length - nPers]);
    }

    // Resolve durations
    let durations: number[];
    if (slotDurations && slotDurations.length > 0) {
        durations = [...slotDurations];
        while (durations.length < nSlots) durations.push(slotDurationMin);
    } else {
        durations = Array(nSlots).fill(slotDurationMin);
    }

    // Sort personnel A, B, (C) by priority
    const sortedInitials = assignPersonnelToABC(onDutyInitials, priorityOrder);

    // Slot times
    const slotTimes = computeSlotTimes({
        shiftStartUtc, nSlots, slotDurationMin, slotDurations,
    });

    // Build slots
    const slots: TimeSlot[] = [];
    for (let i = 0; i < nSlots; i++) {
        const positions = fullPattern[i];
        const assignments: Record<string, string> = {};
        for (let p = 0; p < nPers; p++) {
            assignments[sortedInitials[p]] = positions[p];
        }
        slots.push({
            slot_no: i + 1,
            start_utc: slotTimes[i][0],
            end_utc: slotTimes[i][1],
            duration_min: durations[i],
            assignments,
        });
    }

    return { day, on_duty: sortedInitials, slots };
}

// ============================================================
// MONTHLY ROLLING
// ============================================================

/**
 * Generate adaptive positions[][] pattern berdasarkan actual personnel count.
 *
 * Strategi:
 * - Kalau `configPositions` sudah match nPersonnel (inner length sama),
 *   pakai apa adanya (preserve cabang-specific operational config).
 * - Else generate default rotation untuk 2/3/4 personnel.
 * - Untuk 1 personnel: solo Kontrol full shift.
 * - Untuk 5+ personnel: simplified pattern (idx 0 Kontrol, 1 Asisten,
 *   sisanya Istirahat).
 */
export function generateAdaptivePositions(
    nPersonnel: number,
    nSlots: number,
    configPositions?: string[][],
): string[][] {
    if (
        configPositions
        && configPositions.length > 0
        && configPositions[0].length === nPersonnel
    ) {
        // Config already matches actual personnel count — preserve operational truth.
        // Make sure length === nSlots (truncate or extend by repeating the cycle).
        if (configPositions.length === nSlots) return configPositions;
        const out: string[][] = [];
        for (let i = 0; i < nSlots; i++) {
            out.push(configPositions[i % configPositions.length]);
        }
        return out;
    }

    if (nPersonnel <= 0) return [];

    if (nPersonnel === 1) {
        return Array.from({ length: nSlots }, () => [POSITION_KONTROL]);
    }

    if (nPersonnel === 2) {
        return Array.from(
            { length: nSlots },
            (_, i) => i % 2 === 0
                ? [POSITION_KONTROL, POSITION_ISTIRAHAT]
                : [POSITION_ISTIRAHAT, POSITION_KONTROL],
        );
    }

    if (nPersonnel === 3) {
        const pattern = [
            [POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT],
            [POSITION_ASISTEN, POSITION_ISTIRAHAT, POSITION_KONTROL],
            [POSITION_ISTIRAHAT, POSITION_KONTROL, POSITION_ASISTEN],
        ];
        return Array.from({ length: nSlots }, (_, i) => pattern[i % 3]);
    }

    if (nPersonnel === 4) {
        // 4-personnel default rotation: 1 Kontrol + 1 Asisten + 2 Istirahat
        // dengan posisi rotating biar adil. Ops cabang TMA bisa override
        // via config positions kalau pola berbeda.
        const pattern = [
            [POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT, POSITION_ISTIRAHAT],
            [POSITION_ISTIRAHAT, POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT],
            [POSITION_ISTIRAHAT, POSITION_ISTIRAHAT, POSITION_KONTROL, POSITION_ASISTEN],
            [POSITION_ASISTEN, POSITION_ISTIRAHAT, POSITION_ISTIRAHAT, POSITION_KONTROL],
        ];
        return Array.from({ length: nSlots }, (_, i) => pattern[i % 4]);
    }

    // 5+ personnel: simplified — idx 0 Kontrol, idx 1 Asisten, sisanya Istirahat.
    // Cabang TMA besar dengan operasional khusus disarankan provide explicit
    // `rolling.positions` di airport-configs.json.
    const baseSlot = Array.from(
        { length: nPersonnel },
        (_, idx) => idx === 0
            ? POSITION_KONTROL
            : idx === 1
                ? POSITION_ASISTEN
                : POSITION_ISTIRAHAT,
    );
    return Array.from({ length: nSlots }, () => baseSlot);
}

/**
 * Compute rolling untuk seluruh bulan, group by shift token.
 *
 * Output: `MonthlyRolling = Record<day, Record<shiftToken, DailyRolling>>`.
 *
 * Algoritme:
 *   1. Untuk setiap hari, group personnel berdasarkan shift token mereka.
 *      Personnel yang status-nya bukan SHIFT_TOKEN ('-'/CUTI/SAKIT/dst)
 *      di-skip.
 *   2. Untuk setiap shift group dengan ≥1 personnel, compute daily
 *      rolling SEPARATE dengan adaptive nPersonnel (= actual count
 *      group ini, bukan strict config nPersonnel).
 *   3. Positions pattern: pakai config kalau cocok, else generate default.
 *   4. Hari tanpa shift token apapun → tidak masuk hasil.
 *
 * Multi-shift TMA cabang (Surabaya/Denpasar/dst) bakal punya multiple
 * entries per hari (shift I + II + III + IV + V). Single-shift cabang
 * cuma punya 'I' entry per hari aktif.
 *
 * Catatan: parameter legacy `nPersonnel` di opts sudah TIDAK strict —
 * cuma dipakai sebagai fallback untuk pilih positions default. Engine
 * sekarang adaptive based on actual on-duty count.
 */
export function computeMonthlyRolling(
    opts: ComputeMonthlyRollingOptions,
): MonthlyRolling {
    const {
        result, priorityOrder,
        shiftStartUtc = '21:00',
        nSlots = N_SLOTS,
        slotDurationMin = SLOT_DURATION_MIN,
        positionsPerSlot,
        slotDurations,
    } = opts;

    const monthly: MonthlyRolling = {};
    for (let day = 1; day <= result.daysInMonth; day++) {
        // Group personnel by shift token di hari ini.
        // Defensive: `result.roster[ini]` bisa sparse array kalau sumber data
        // dari DB (mis. TunjanganPage build dari atc_roster_cells) — skip
        // slot undefined supaya tidak crash render path.
        const byShiftToken: Record<string, string[]> = {};
        for (const ini of Object.keys(result.roster)) {
            const cell = result.roster[ini]?.[day - 1];
            if (!cell) continue; // sparse roster slot
            const status = cell.status;
            if (SHIFT_TOKEN_SET.has(status)) {
                if (!byShiftToken[status]) byShiftToken[status] = [];
                byShiftToken[status].push(ini);
            }
        }

        if (Object.keys(byShiftToken).length === 0) continue;

        const dayRolling: Record<string, DailyRolling> = {};
        for (const [shiftToken, onDutyList] of Object.entries(byShiftToken)) {
            if (onDutyList.length === 0) continue;
            try {
                const adaptivePositions = generateAdaptivePositions(
                    onDutyList.length,
                    nSlots,
                    positionsPerSlot,
                );
                const daily = computeDailyRolling({
                    day,
                    onDutyInitials: onDutyList,
                    priorityOrder,
                    shiftStartUtc,
                    nSlots,
                    slotDurationMin,
                    positionsPerSlot: adaptivePositions,
                    slotDurations,
                    nPersonnel: onDutyList.length,
                });
                // Tag shift token onto the DailyRolling for downstream consumers.
                daily.shift_token = shiftToken;
                dayRolling[shiftToken] = daily;
            } catch (e) {
                // Defensive: log + continue. Shouldn't happen since we pass
                // adaptive positions matching onDutyList.length, but if
                // anything throws we skip this shift slot for this day.
                console.warn(
                    `[rolling] day ${day} shift ${shiftToken} failed:`,
                    (e as Error)?.message || e,
                );
            }
        }

        if (Object.keys(dayRolling).length > 0) {
            monthly[day] = dayRolling;
        }
    }
    return monthly;
}

// ============================================================
// MONTHLY ROLLING HELPERS (multi-shift aware)
// ============================================================

/**
 * Get DailyRolling untuk hari + shift token spesifik.
 * Returns null kalau tidak ada.
 */
export function getRollingForShift(
    monthly: MonthlyRolling,
    day: number,
    shiftToken: string,
): DailyRolling | null {
    return monthly[day]?.[shiftToken] ?? null;
}

/**
 * Get all DailyRolling entries untuk hari spesifik (semua shift token).
 * Returns empty object kalau hari tidak punya rolling.
 */
export function getRollingForDay(
    monthly: MonthlyRolling,
    day: number,
): Record<string, DailyRolling> {
    return monthly[day] ?? {};
}

/**
 * Get list shift tokens yang ada di hari spesifik.
 * Sort by shift order (I < II < III < IV < V) untuk display consistency.
 */
export function getShiftTokensForDay(
    monthly: MonthlyRolling,
    day: number,
): string[] {
    const dayData = monthly[day];
    if (!dayData) return [];
    return Object.keys(dayData).sort((a, b) => {
        const order = ['I', 'II', 'III', 'IV', 'V'];
        const ia = order.indexOf(a);
        const ib = order.indexOf(b);
        if (ia === -1 && ib === -1) return a.localeCompare(b);
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
    });
}

/**
 * Backward-compat: get the "primary" DailyRolling untuk hari spesifik.
 * Returns shift 'I' kalau ada, else first shift di sort order.
 * Untuk single-shift cabang ini behavior identik dengan old API.
 */
export function getPrimaryRollingForDay(
    monthly: MonthlyRolling,
    day: number,
): DailyRolling | null {
    const dayData = monthly[day];
    if (!dayData) return null;
    if (dayData['I']) return dayData['I'];
    const tokens = getShiftTokensForDay(monthly, day);
    return tokens.length > 0 ? dayData[tokens[0]] : null;
}

// ============================================================
// RECAP (total menit per personel per posisi)
// ============================================================

export function computeRecap(daily: DailyRolling): Record<string, RecapEntry> {
    const recap: Record<string, RecapEntry> = {};
    for (const ini of daily.on_duty) {
        recap[ini] = {
            [POSITION_KONTROL]: 0,
            [POSITION_ASISTEN]: 0,
            [POSITION_ISTIRAHAT]: 0,
        };
    }
    for (const slot of daily.slots) {
        for (const [ini, pos] of Object.entries(slot.assignments)) {
            if (!recap[ini]) recap[ini] = {
                [POSITION_KONTROL]: 0,
                [POSITION_ASISTEN]: 0,
                [POSITION_ISTIRAHAT]: 0,
            };
            recap[ini][pos] = (recap[ini][pos] || 0) + slot.duration_min;
        }
    }
    // Add totals
    for (const ini of Object.keys(recap)) {
        const r = recap[ini];
        r['Total Pemanduan'] = (r[POSITION_KONTROL] || 0) + (r[POSITION_ASISTEN] || 0);
        r['Total Shift'] = r['Total Pemanduan'] + (r[POSITION_ISTIRAHAT] || 0);
    }
    return recap;
}
