/**
 * Shared types & constants — dipakai lintas engine (roster, rolling, ca).
 *
 * SRP boundary: ini cuma kumpulan domain primitive yang sama di mana-mana.
 * Engine-specific types tinggal di folder masing-masing (roster-engine/types.ts,
 * rolling-engine/types.ts, ca-engine/types.ts).
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
