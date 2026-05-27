/**
 * Date utilities untuk LeaveRange cross-month support.
 *
 * Port dari roster_generator_v4.py LeaveRange factory methods.
 * Semua operasi pakai date-only (tanpa time component) — gunakan ISO format
 * 'YYYY-MM-DD' untuk konsistensi.
 *
 * NOTE (split-engine refactor): file pindah dari roster-engine/ ke shared/
 * karena LeaveRange & helpers dipakai cross-engine (roster + ca + future).
 */

import type { LeaveRange, LeaveCategory } from './types';
import { DEFAULT_LEAVE_CATEGORY } from './types';

// ============================================================
// CORE DATE HELPERS (no timezone — kerja di calendar dates)
// ============================================================

/** Returns last day of (year, month). e.g. (2026, 6) → 30. */
export function daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

/** Returns ISO 'YYYY-MM-DD' dari (year, month, day). */
export function toISODate(year: number, month: number, day: number): string {
    const m = String(month).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
}

/** Parse 'YYYY-MM-DD' → {year, month, day}. */
export function parseISODate(iso: string): {
    year: number;
    month: number;
    day: number;
} {
    const [y, m, d] = iso.split('-').map(Number);
    return { year: y, month: m, day: d };
}

/** Compare 2 ISO dates: -1 / 0 / 1. */
export function compareISO(a: string, b: string): number {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
}

/** True kalau dateISO di dalam [startISO, endISO] (inclusive). */
export function isBetween(
    dateISO: string,
    startISO: string,
    endISO: string,
): boolean {
    return compareISO(dateISO, startISO) >= 0
        && compareISO(dateISO, endISO) <= 0;
}

// ============================================================
// LEAVE RANGE FACTORIES
// ============================================================

/**
 * Buat LeaveRange yang di-clip ke (year, month).
 *
 * Returns null kalau leave tidak overlap dengan bulan tsb.
 *
 * Port dari Python `LeaveRange.from_dates()`.
 *
 * @example
 * // Leave 28 Jun – 5 Jul, target June → clipped to (28, 30)
 * leaveRangeFromDates('2026-06-28', '2026-07-05', 2026, 6, 'CUTI')
 * // → { startDay: 28, endDay: 30, startDate: '2026-06-28', endDate: '2026-07-05', category: 'CUTI' }
 *
 * @example
 * // Same leave projected to July → (1, 5)
 * leaveRangeFromDates('2026-06-28', '2026-07-05', 2026, 7, 'CUTI')
 * // → { startDay: 1, endDay: 5, ... }
 */
export function leaveRangeFromDates(
    startDate: string,
    endDate: string,
    year: number,
    month: number,
    category: LeaveCategory = DEFAULT_LEAVE_CATEGORY,
): LeaveRange | null {
    if (compareISO(endDate, startDate) < 0) {
        throw new Error(
            `endDate ${endDate} sebelum startDate ${startDate}`,
        );
    }

    const monthStart = toISODate(year, month, 1);
    const monthEnd = toISODate(year, month, daysInMonth(year, month));

    // Overlap check
    if (compareISO(startDate, monthEnd) > 0) return null;
    if (compareISO(endDate, monthStart) < 0) return null;

    // Clip
    const clipStart = compareISO(startDate, monthStart) > 0 ? startDate : monthStart;
    const clipEnd = compareISO(endDate, monthEnd) < 0 ? endDate : monthEnd;

    return {
        startDay: parseISODate(clipStart).day,
        endDay: parseISODate(clipEnd).day,
        category,
        startDate,
        endDate,
    };
}

/**
 * Migration helper: legacy LeaveRange (day-number only) → date-based.
 *
 * Asumsinya leave berada di dalam 1 bulan saja (legacy data constraint).
 *
 * Port dari Python `LeaveRange.from_legacy_days()`.
 */
export function leaveRangeFromLegacyDays(
    startDay: number,
    endDay: number,
    year: number,
    month: number,
    category: LeaveCategory = DEFAULT_LEAVE_CATEGORY,
): LeaveRange {
    const lastDay = daysInMonth(year, month);
    const sd = Math.max(1, Math.min(startDay, lastDay));
    const ed = Math.max(1, Math.min(endDay, lastDay));
    return {
        startDay: sd,
        endDay: ed,
        category,
        startDate: toISODate(year, month, sd),
        endDate: toISODate(year, month, ed),
    };
}

// ============================================================
// LEAVE RANGE OPERATIONS
// ============================================================

/** True kalau leave (date-based) overlap dengan (year, month). */
export function leaveOverlapsMonth(
    leave: LeaveRange,
    year: number,
    month: number,
): boolean {
    const monthStart = toISODate(year, month, 1);
    const monthEnd = toISODate(year, month, daysInMonth(year, month));
    return compareISO(leave.startDate, monthEnd) <= 0
        && compareISO(leave.endDate, monthStart) >= 0;
}

/** True kalau `day` (1..31) berada dalam leave range (untuk current month context). */
export function leaveCoversDay(leave: LeaveRange, day: number): boolean {
    return day >= leave.startDay && day <= leave.endDay;
}

// ============================================================
// PERSONNEL HELPERS
// ============================================================

/**
 * True kalau personel sedang cuti di hari (day) — relative ke bulan saat ini.
 * Dipakai oleh engine generator.
 */
export function personnelIsOnLeave(
    leaves: LeaveRange[],
    day: number,
): boolean {
    return leaves.some(lv => leaveCoversDay(lv, day));
}

/**
 * Return kategori leave yang cover hari ini (first-matching wins).
 * Returns DEFAULT_LEAVE_CATEGORY kalau ga ada cuti.
 */
export function personnelLeaveCategory(
    leaves: LeaveRange[],
    day: number,
): LeaveCategory {
    for (const lv of leaves) {
        if (leaveCoversDay(lv, day)) {
            return lv.category;
        }
    }
    return DEFAULT_LEAVE_CATEGORY;
}

/** True kalau personel cuti SELURUH bulan (semua hari di-cover oleh leave). */
export function personnelIsOnLeaveEntireMonth(
    leaves: LeaveRange[],
    daysInMonthCount: number,
): boolean {
    for (let d = 1; d <= daysInMonthCount; d++) {
        if (!personnelIsOnLeave(leaves, d)) return false;
    }
    return true;
}

/** True kalau personel punya minimal 1 leave. */
export function personnelHasAnyLeave(leaves: LeaveRange[]): boolean {
    return leaves.length > 0;
}
