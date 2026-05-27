import { describe, it, expect } from 'vitest';
// Split-engine: date-utils + shared types pindah ke ../../shared/.
import {
    daysInMonth,
    toISODate,
    parseISODate,
    compareISO,
    leaveRangeFromDates,
    leaveRangeFromLegacyDays,
    leaveOverlapsMonth,
    leaveCoversDay,
    personnelIsOnLeave,
    personnelLeaveCategory,
} from '../../shared/date-utils';
import type { LeaveRange } from '../../shared/types';

describe('daysInMonth', () => {
    it('returns 30 for June 2026', () => {
        expect(daysInMonth(2026, 6)).toBe(30);
    });
    it('returns 31 for July 2026', () => {
        expect(daysInMonth(2026, 7)).toBe(31);
    });
    it('returns 28 for Feb 2026 (non-leap)', () => {
        expect(daysInMonth(2026, 2)).toBe(28);
    });
    it('returns 29 for Feb 2024 (leap)', () => {
        expect(daysInMonth(2024, 2)).toBe(29);
    });
});

describe('toISODate / parseISODate', () => {
    it('formats with zero-padding', () => {
        expect(toISODate(2026, 6, 5)).toBe('2026-06-05');
        expect(toISODate(2026, 11, 30)).toBe('2026-11-30');
    });
    it('round-trips', () => {
        const iso = toISODate(2026, 6, 28);
        expect(parseISODate(iso)).toEqual({ year: 2026, month: 6, day: 28 });
    });
});

describe('compareISO', () => {
    it('compares chronologically', () => {
        expect(compareISO('2026-06-01', '2026-06-02')).toBe(-1);
        expect(compareISO('2026-06-01', '2026-06-01')).toBe(0);
        expect(compareISO('2026-07-01', '2026-06-30')).toBe(1);
    });
});

describe('leaveRangeFromDates — match Python behavior', () => {
    it('inside-month: dates dan day-numbers match calendar', () => {
        const lr = leaveRangeFromDates('2026-06-10', '2026-06-15', 2026, 6, 'CUTI');
        expect(lr).not.toBeNull();
        expect(lr!.startDay).toBe(10);
        expect(lr!.endDay).toBe(15);
        expect(lr!.category).toBe('CUTI');
        expect(lr!.startDate).toBe('2026-06-10');
        expect(lr!.endDate).toBe('2026-06-15');
    });

    it('cross-month-LEFT: leave 28 May – 5 Jun, target June → (1, 5)', () => {
        const lr = leaveRangeFromDates('2026-05-28', '2026-06-05', 2026, 6, 'CUTI');
        expect(lr).not.toBeNull();
        expect(lr!.startDay).toBe(1);   // clipped to June 1
        expect(lr!.endDay).toBe(5);
        // Absolute dates preserved
        expect(lr!.startDate).toBe('2026-05-28');
        expect(lr!.endDate).toBe('2026-06-05');
    });

    it('cross-month-RIGHT: leave 28 Jun – 5 Jul, target June → (28, 30)', () => {
        const lr = leaveRangeFromDates('2026-06-28', '2026-07-05', 2026, 6, 'CUTI');
        expect(lr).not.toBeNull();
        expect(lr!.startDay).toBe(28);
        expect(lr!.endDay).toBe(30);  // June has 30 days
    });

    it('cross-month-RIGHT projected to July → (1, 5)', () => {
        const lr = leaveRangeFromDates('2026-06-28', '2026-07-05', 2026, 7, 'CUTI');
        expect(lr).not.toBeNull();
        expect(lr!.startDay).toBe(1);
        expect(lr!.endDay).toBe(5);
    });

    it('no overlap returns null', () => {
        const lr = leaveRangeFromDates('2026-07-10', '2026-07-15', 2026, 6, 'CUTI');
        expect(lr).toBeNull();
    });

    it('invalid range throws', () => {
        expect(() => leaveRangeFromDates('2026-06-10', '2026-06-05', 2026, 6, 'CUTI'))
            .toThrow();
    });
});

describe('leaveRangeFromLegacyDays — migration helper', () => {
    it('day-numbers projected to dates within target month', () => {
        const lr = leaveRangeFromLegacyDays(10, 15, 2026, 6, 'SAKIT');
        expect(lr.startDay).toBe(10);
        expect(lr.endDay).toBe(15);
        expect(lr.startDate).toBe('2026-06-10');
        expect(lr.endDate).toBe('2026-06-15');
        expect(lr.category).toBe('SAKIT');
    });
    it('clips day-numbers to month bounds', () => {
        const lr = leaveRangeFromLegacyDays(50, 100, 2026, 6, 'CUTI');
        expect(lr.startDay).toBe(30);  // June max
        expect(lr.endDay).toBe(30);
    });
});

describe('leaveOverlapsMonth', () => {
    const lr: LeaveRange = {
        startDay: 28, endDay: 30, category: 'CUTI',
        startDate: '2026-06-28', endDate: '2026-07-05',
    };
    it('overlaps June 2026', () => {
        expect(leaveOverlapsMonth(lr, 2026, 6)).toBe(true);
    });
    it('overlaps July 2026', () => {
        expect(leaveOverlapsMonth(lr, 2026, 7)).toBe(true);
    });
    it('does not overlap May 2026', () => {
        expect(leaveOverlapsMonth(lr, 2026, 5)).toBe(false);
    });
    it('does not overlap August 2026', () => {
        expect(leaveOverlapsMonth(lr, 2026, 8)).toBe(false);
    });
});

describe('leaveCoversDay + personnel helpers', () => {
    const leaves: LeaveRange[] = [
        {
            startDay: 10, endDay: 12, category: 'CUTI',
            startDate: '2026-06-10', endDate: '2026-06-12',
        },
        {
            startDay: 20, endDay: 22, category: 'SAKIT',
            startDate: '2026-06-20', endDate: '2026-06-22',
        },
    ];

    it('covers correctly', () => {
        expect(leaveCoversDay(leaves[0], 10)).toBe(true);
        expect(leaveCoversDay(leaves[0], 12)).toBe(true);
        expect(leaveCoversDay(leaves[0], 13)).toBe(false);
    });

    it('personnelIsOnLeave finds any covering leave', () => {
        expect(personnelIsOnLeave(leaves, 11)).toBe(true);
        expect(personnelIsOnLeave(leaves, 21)).toBe(true);
        expect(personnelIsOnLeave(leaves, 15)).toBe(false);
    });

    it('personnelLeaveCategory returns first matching', () => {
        expect(personnelLeaveCategory(leaves, 11)).toBe('CUTI');
        expect(personnelLeaveCategory(leaves, 21)).toBe('SAKIT');
        // Default kalau ga match
        expect(personnelLeaveCategory(leaves, 15)).toBe('CUTI');
    });
});
