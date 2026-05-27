/**
 * Rolling Engine — types & constants.
 *
 * Split dari old roster-engine/rolling.ts (split-engine refactor).
 * Logic functions tinggal di ./rolling.ts.
 */

import type { Position } from '../airport-data/types';
import {
    POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT,
} from '../airport-data/types';
import type { GenerateResult } from '../roster-engine/types';

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
// COMPUTE OPTIONS
// ============================================================

export interface ComputeSlotTimesOptions {
    shiftStartUtc?: string;
    nSlots?: number;
    slotDurationMin?: number;
    slotDurations?: number[];
}

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

// ============================================================
// RECAP
// ============================================================

export interface RecapEntry {
    [position: string]: number;  // Kontrol, Asisten, Istirahat, plus totals
}
