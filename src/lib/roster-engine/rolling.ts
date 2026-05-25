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
 */

import type { GenerateResult, Position } from './types';
import {
    POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT,
} from './types';

// ============================================================
// CONSTANTS
// ============================================================

export const SLOT_DURATION_MIN = 100;
export const N_SLOTS = 6;
export const SHIFT_DURATION_MIN = SLOT_DURATION_MIN * N_SLOTS;

/** Default 3-personnel rolling pattern (Oksibil-style). */
export const ROLLING_PATTERN: Position[][] = [
    [POSITION_ASISTEN, POSITION_ISTIRAHAT, POSITION_KONTROL],
    [POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT],
    [POSITION_ISTIRAHAT, POSITION_KONTROL, POSITION_ASISTEN],
    [POSITION_ASISTEN, POSITION_ISTIRAHAT, POSITION_KONTROL],
    [POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT],
    [POSITION_ISTIRAHAT, POSITION_KONTROL, POSITION_ASISTEN],
];

// ============================================================
// DATA STRUCTURES
// ============================================================

export interface TimeSlot {
    slot_no: number;
    start_utc: string;     // 'HH:MM'
    end_utc: string;
    duration_min: number;
    /** {personnelId: position} */
    assignments: Record<string, string>;
}

export interface DailyRolling {
    day: number;
    /** N initial sorted by priority_order: [A, B, (C)]. */
    on_duty: string[];
    slots: TimeSlot[];
}

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

export interface ComputeSlotTimesOptions {
    shiftStartUtc?: string;
    nSlots?: number;
    slotDurationMin?: number;
    slotDurations?: number[];
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

export interface ComputeDailyRollingOptions {
    day: number;
    onDutyInitials: string[];
    priorityOrder: string[];
    shiftStartUtc?: string;
    nSlots?: number;
    slotDurationMin?: number;
    positionsPerSlot?: string[][];
    slotDurations?: number[];
    nPersonnel?: number;
}

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

export interface ComputeMonthlyRollingOptions {
    result: GenerateResult;
    priorityOrder: string[];
    shiftStartUtc?: string;
    nSlots?: number;
    slotDurationMin?: number;
    positionsPerSlot?: string[][];
    slotDurations?: number[];
    nPersonnel?: number;
}

export function computeMonthlyRolling(
    opts: ComputeMonthlyRollingOptions,
): Record<number, DailyRolling> {
    const {
        result, priorityOrder,
        shiftStartUtc = '21:00',
        nSlots = N_SLOTS,
        slotDurationMin = SLOT_DURATION_MIN,
        positionsPerSlot,
        slotDurations,
        nPersonnel,
    } = opts;

    const nPers = nPersonnel ?? (positionsPerSlot && positionsPerSlot.length > 0
        ? positionsPerSlot[0].length
        : 3);

    const monthly: Record<number, DailyRolling> = {};
    for (let day = 1; day <= result.daysInMonth; day++) {
        const onDuty: string[] = [];
        for (const ini of Object.keys(result.roster)) {
            if (result.roster[ini][day - 1].status === 'I') {
                onDuty.push(ini);
            }
        }
        if (onDuty.length === nPers) {
            monthly[day] = computeDailyRolling({
                day, onDutyInitials: onDuty, priorityOrder,
                shiftStartUtc, nSlots, slotDurationMin,
                positionsPerSlot, slotDurations, nPersonnel: nPers,
            });
        }
    }
    return monthly;
}

// ============================================================
// RECAP (total menit per personel per posisi)
// ============================================================

export interface RecapEntry {
    [position: string]: number;  // Kontrol, Asisten, Istirahat, plus totals
}

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
