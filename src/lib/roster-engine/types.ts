/**
 * Roster Engine — types only.
 *
 * Port dari roster_generator_v4.py (Python).
 * Engine-specific shapes saja. Untuk shared types lihat:
 *   - Personnel, LeaveRange, RosterCell, shift+leave constants → ../shared
 *   - AirportConfig, UnitConfig, RollingConfig, Position → ../airport-data
 */

import type { Personnel, RosterCell } from '../shared/types';

// ============================================================
// GENERATE RESULT
// ============================================================

export type RosterMode =
    | 'template'
    | 'baseline'
    | 'baseline-multishift'
    | 'greedy'
    | 'partial'
    | 'tni'
    | '';

export interface GenerateResult {
    success: boolean;
    year: number;
    month: number;
    daysInMonth: number;
    /** Keyed by Personnel.id. */
    roster: Record<string, RosterCell[]>;
    personnel: Personnel[];
    mode: RosterMode;
    cutoffDay: number;
    requiredPerDay: number;
    isTni: boolean;
    /** Hanya di-set kalau success=false. */
    errorMessage?: string;
    /** Days yang punya kekurangan personel (kalau insufficient). */
    insufficientDays?: Array<[number, number]>;
}

// ============================================================
// FRMS ISSUE (untuk validator output di Section 3)
// ============================================================

/** Severity values match Python lowercase strings untuk parity. */
export type FrmsSeverity = 'error' | 'warning';

export interface FrmsIssue {
    rule: string;
    severity: FrmsSeverity;
    message: string;
    personnel?: string;
    day?: number;
    context?: Record<string, unknown>;
}
