import { describe, it, expect } from 'vitest';
import { generateRoster } from '../generator';
import {
    validateFull, splitBySeverity, FRMS_SHIFT_HOURS,
    validateMinimumPersonnel, validateMaxConsecutiveDays,
    validateMinDaysOffPerWeek, validateMaxHoursPerWeek,
    validateNoLeaveAssignedWork, validateShiftDuration,
} from '../frms-validator';
import {
    getMaxConsecutiveDays, getMaxHoursPerWeek, getMaxShiftHours,
    computePersonnelNeeds,
} from '../frms-rules';
import { leaveRangeFromDates } from '../date-utils';
import type { Personnel, RosterCell } from '../types';

function makePersonnel(ids: string[]): Personnel[] {
    return ids.map(id => ({ id, initial: id, leaves: [] }));
}

function makeCells(statuses: string[]): RosterCell[] {
    return statuses.map(s => ({ status: s, locked: false }));
}

// ============================================================
// FRMS RULES helpers
// ============================================================

describe('FRMS rule limits per service class', () => {
    it('LOW class: 6 hari max consec', () => {
        expect(getMaxConsecutiveDays('LOW')).toBe(6);
    });
    it('HIGH class: 5 hari max consec', () => {
        expect(getMaxConsecutiveDays('HIGH')).toBe(5);
    });
    it('LOW: 60 jam/minggu', () => {
        expect(getMaxHoursPerWeek('LOW')).toBe(60);
    });
    it('HIGH: 40 jam/minggu', () => {
        expect(getMaxHoursPerWeek('HIGH')).toBe(40);
    });
    it('LOW: 12 jam max shift', () => {
        expect(getMaxShiftHours('LOW')).toBe(12);
    });
    it('HIGH: 8 jam max shift', () => {
        expect(getMaxShiftHours('HIGH')).toBe(8);
    });
});

describe('computePersonnelNeeds', () => {
    it('TWR 24-jam HIGH = ceil(24×365×2/1128) = ceil(15.53) = 16', () => {
        // raw = 17520/1128 = 15.53...
        expect(computePersonnelNeeds(24, 2, 'HIGH')).toBe(16);
    });
    it('Floor minimum 5 personel', () => {
        // 8-jam × 2 / 1504 = ~3.88 → ceil 4 → min 5
        expect(computePersonnelNeeds(8, 2, 'LOW')).toBe(5);
    });
});

// ============================================================
// INDIVIDUAL VALIDATORS
// ============================================================

describe('validateMinimumPersonnel', () => {
    it('4 personel → error', () => {
        const issues = validateMinimumPersonnel(4);
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('error');
        expect(issues[0].rule).toBe('MIN_PERSONNEL');
    });
    it('5 personel → no error', () => {
        expect(validateMinimumPersonnel(5)).toHaveLength(0);
    });
});

describe('validateMaxConsecutiveDays', () => {
    it('7 hari berturut-turut di LOW → error (max 6)', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'I', 'I', '-', '-', '-']),
        };
        const issues = validateMaxConsecutiveDays(roster, 10, 'LOW');
        expect(issues).toHaveLength(1);
        expect(issues[0].rule).toBe('MAX_CONSECUTIVE_DAYS');
        expect(issues[0].context?.streak).toBe(7);
    });
    it('6 hari di LOW → no error', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'I', '-', '-', '-', '-']),
        };
        expect(validateMaxConsecutiveDays(roster, 10, 'LOW')).toHaveLength(0);
    });
    it('6 hari di HIGH → error (max 5)', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'I', '-', '-', '-', '-']),
        };
        const issues = validateMaxConsecutiveDays(roster, 10, 'HIGH');
        expect(issues).toHaveLength(1);
    });
});

describe('validateMinDaysOffPerWeek', () => {
    it('rolling 7-day window: kurang dari 2 off → error', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'I', 'I', '-', '-', '-']),
        };
        const issues = validateMinDaysOffPerWeek(roster, 10);
        expect(issues.length).toBeGreaterThan(0);
        expect(issues[0].rule).toBe('MIN_DAYS_OFF_PER_WEEK');
    });
    it('2 off per window → no error', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', '-', 'I', '-', 'I', '-', 'I', '-']),
        };
        expect(validateMinDaysOffPerWeek(roster, 10)).toHaveLength(0);
    });
    it('CUTI counts as off', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'CUTI', 'CUTI', '-', '-', '-']),
        };
        expect(validateMinDaysOffPerWeek(roster, 10)).toHaveLength(0);
    });
});

describe('validateMaxHoursPerWeek', () => {
    it('LOW: 7 hari × 10 jam = 70 jam → warning (max 60)', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'I', 'I', '-', '-', '-']),
        };
        const issues = validateMaxHoursPerWeek(roster, 10, 'LOW', 10);
        expect(issues).toHaveLength(1);
        expect(issues[0].severity).toBe('warning');
        expect(issues[0].rule).toBe('MAX_HOURS_PER_WEEK');
    });
    it('6 hari × 10 jam = 60 jam → boundary, no warning', () => {
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'I', '-', '-', '-', '-']),
        };
        expect(validateMaxHoursPerWeek(roster, 10, 'LOW', 10)).toHaveLength(0);
    });
});

describe('validateShiftDuration', () => {
    it('LOW: 12 jam OK, 14 jam warning', () => {
        expect(validateShiftDuration(10, 'LOW')).toHaveLength(0);
        expect(validateShiftDuration(12, 'LOW')).toHaveLength(0);
        expect(validateShiftDuration(14, 'LOW')).toHaveLength(1);
    });
});

describe('validateNoLeaveAssignedWork', () => {
    it('Personel cuti tapi cell = I → error', () => {
        const personnel = makePersonnel(['AA']);
        personnel[0].leaves = [leaveRangeFromDates('2026-06-10', '2026-06-12', 2026, 6, 'CUTI')!];
        // Bug case: cell hari ke-10 di-set 'I' (seharusnya CUTI)
        const roster = {
            AA: Array.from({ length: 30 }, () => ({ status: 'I', locked: false })),
        };
        const issues = validateNoLeaveAssignedWork(roster, personnel, 30);
        expect(issues.length).toBeGreaterThanOrEqual(3);  // tgl 10,11,12
        expect(issues[0].rule).toBe('LEAVE_ASSIGNED_WORK');
    });
});

// ============================================================
// END-TO-END: validate generated roster
// ============================================================

describe('end-to-end FRMS check pada generated roster', () => {
    it('Oksibil 7 personel no cuti: clean (no errors, no warnings)', () => {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC']);
        const result = generateRoster({ year: 2026, month: 6, personnel });
        expect(result.success).toBe(true);
        const issues = validateFull({
            roster: result.roster,
            personnel,
            daysInMonth: result.daysInMonth,
            serviceClass: 'LOW',
            shiftHours: 10,
            minOnDuty: 3,
        });
        const { errors, warnings } = splitBySeverity(issues);
        expect(errors).toHaveLength(0);
        expect(warnings).toHaveLength(0);
    });

    it('9 personel greedy + partial cuti: clean', () => {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC', 'YO', 'YE']);
        personnel[0].leaves = [leaveRangeFromDates('2026-06-10', '2026-06-12', 2026, 6, 'CUTI')!];
        const result = generateRoster({ year: 2026, month: 6, personnel });
        expect(result.success).toBe(true);
        const issues = validateFull({
            roster: result.roster, personnel,
            daysInMonth: result.daysInMonth, serviceClass: 'LOW',
            shiftHours: 10, minOnDuty: 3,
        });
        const { errors } = splitBySeverity(issues);
        expect(errors).toHaveLength(0);
    });

    it('splitBySeverity: separates correctly', () => {
        const personnel = makePersonnel(['AA']);
        const roster = {
            AA: makeCells(['I', 'I', 'I', 'I', 'I', 'I', 'I', '-', '-', '-']),
        };
        const issues = validateFull({
            roster, personnel,
            daysInMonth: 10, serviceClass: 'LOW',
            shiftHours: 10, minOnDuty: 1,
        });
        const { errors, warnings } = splitBySeverity(issues);
        expect(errors.length).toBeGreaterThan(0);  // MIN_PERSONNEL + MAX_CONSEC
        // Warnings ada karena 70 jam > 60
        expect(warnings.length).toBeGreaterThan(0);
    });
});
