/**
 * Core types untuk ATC Roster Engine.
 *
 * Port dari roster_generator_v4.py (Python).
 * Semua tipe match dengan engine Python supaya parity check di test
 * suite (Section 5) bisa compare output 1:1.
 */

// ============================================================
// LEAVE CATEGORIES (FRMS off-roster per Bab III.3 hlm 14 & 28)
// ============================================================

export const LEAVE_CATEGORIES = ['CUTI', 'SAKIT', 'DIKLAT', 'OTHERS'] as const;
export type LeaveCategory = (typeof LEAVE_CATEGORIES)[number];
export const DEFAULT_LEAVE_CATEGORY: LeaveCategory = 'CUTI';

/** Status tokens yang berarti personel BERTUGAS hari itu. */
export const SHIFT_TOKENS = ['I', 'II', 'III', 'IV', 'V'] as const;
export type ShiftToken = (typeof SHIFT_TOKENS)[number];

/** Semua "off-day" tokens: scheduled rest + setiap leave category. */
export const OFF_STATUSES = ['-', ...LEAVE_CATEGORIES] as const;
export type OffStatus = (typeof OFF_STATUSES)[number];

/** Helper: check apakah status adalah off-day (scheduled OR leave). */
export function isOffStatus(status: string): boolean {
    return (OFF_STATUSES as readonly string[]).includes(status);
}

/** Helper: check apakah status adalah leave (CUTI/SAKIT/DIKLAT/OTHERS). */
export function isLeaveStatus(status: string): boolean {
    return (LEAVE_CATEGORIES as readonly string[]).includes(status);
}

/** Helper: check apakah status adalah shift kerja (I/II/III/IV/V). */
export function isWorkingStatus(status: string): boolean {
    return (SHIFT_TOKENS as readonly string[]).includes(status);
}

// ============================================================
// LEAVE RANGE
// ============================================================

/**
 * Rentang cuti satu personel — cross-month aware.
 *
 * DUAL REPRESENTATION (cross-month support, v4.1):
 *
 * 1. **`startDate` / `endDate`** (Date / ISO) — SUMBER KEBENARAN absolut.
 *    Disimpan persistently (di Supabase `leaves` table). Bisa melintasi
 *    batas bulan (mis. 28 Jun – 5 Jul).
 *
 * 2. **`startDay` / `endDay`** (1..31) — PROYEKSI ke bulan yang sedang
 *    diproses (year/month). Engine generator pakai field ini. Untuk
 *    leave yang melintasi bulan, di-CLIP ke bulan saat ini
 *    (mis. di Juni: 28 Jun – 5 Jul jadi startDay=28, endDay=30).
 *
 * Gunakan factory `leaveRangeFromDates()` atau `leaveRangeFromLegacyDays()`
 * — jangan construct manual.
 */
export interface LeaveRange {
    startDay: number;       // 1..31, proyeksi ke bulan target
    endDay: number;         // 1..31
    category: LeaveCategory;
    /** ISO date (YYYY-MM-DD) sumber kebenaran cross-month. */
    startDate: string;
    /** ISO date (YYYY-MM-DD) sumber kebenaran cross-month. */
    endDate: string;
}

// ============================================================
// PERSONNEL
// ============================================================

export interface Personnel {
    /** Stable identifier — bisa initial ("AA") atau UUID dari DB. */
    id: string;
    /** Display label opsional (untuk readability di logs/UI). */
    initial?: string;
    leaves: LeaveRange[];
    /** Tie-break order di generator (default 0 = first). */
    priorityOrder?: number;
}

// ============================================================
// ROSTER CELL
// ============================================================

export interface RosterCell {
    /** Status token: ShiftToken | OffStatus | 'TNI'. */
    status: string;
    /** True kalau hari ini <= cutoff_day (past, locked from edit). */
    locked: boolean;
}

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

// ============================================================
// AIRPORT CONFIG (read-only reference dari data/airport-configs.json)
// ============================================================

export interface RollingConfig {
    shift_start_utc: string;       // 'HH:MM'
    n_slots: number;
    slot_duration_min: number;
    /** Per slot: array of [Position] strings. */
    positions: string[][];
    /** Per slot: duration in minutes (kalau heterogen). */
    slot_durations?: number[];
    n_personnel?: number;
    _slot_duration_source?: string;
}

export interface UnitConfig {
    unit: string;                  // 'TWR' | 'APP' | 'ACC'
    n_personnel: number;
    min_on_duty_baseline: number;
    is_tni: boolean;
    initials?: string[];
    names?: string[];
    niks?: string[];
    rolling?: RollingConfig;
    /**
     * Baseline pattern flat: [personnel_idx][day_idx] -> "I" / "II" / "-" / etc.
     * Match Python field name `patterns_baseline`.
     * Loader truncate/extend ke target days_in_month.
     */
    patterns_baseline?: string[][];
}

export interface AirportConfig {
    airport_code: string;          // 'AMBON', 'OKSIBIL' (derived from name)
    airport_name: string;          // 'Ambon', 'Oksibil'
    branch_code?: string;          // ICAO 4-letter ('WARR', 'WAPP'), bridges ke Supabase branches.code
    is_tma?: boolean;
    units: UnitConfig[];
}

// ============================================================
// CA CONSTANT (read-only reference dari data/ca-constants.json)
// ============================================================

export interface CAConstantInfo {
    excel_name: string;
    constant_per_hour: number;
    source: string;
    is_tma: boolean;
}

// ============================================================
// POSITION (untuk rolling — Control/Assistant/Rest)
// ============================================================

export const POSITION_KONTROL = 'Kontrol';
export const POSITION_ASISTEN = 'Asisten';
export const POSITION_ISTIRAHAT = 'Istirahat';

export type Position =
    | typeof POSITION_KONTROL
    | typeof POSITION_ASISTEN
    | typeof POSITION_ISTIRAHAT;
