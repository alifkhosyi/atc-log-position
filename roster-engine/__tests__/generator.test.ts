import { describe, it, expect } from 'vitest';
import { generateRoster } from '../generator';
import { getTemplate } from '../templates';
import { leaveRangeFromDates } from '../date-utils';
import type { Personnel } from '../types';
import { SHIFT_TOKENS } from '../types';

function makePersonnel(ids: string[]): Personnel[] {
    return ids.map(id => ({ id, initial: id, leaves: [] }));
}

const SHIFT_SET: readonly string[] = SHIFT_TOKENS;

describe('getTemplate', () => {
    it('returns 7-row template for n=7', () => {
        const t = getTemplate(7, 30);
        expect(t).not.toBeNull();
        expect(t!.length).toBe(7);
        expect(t![0].length).toBe(30);
    });

    it('returns 6-row template for n=6', () => {
        const t = getTemplate(6, 30);
        expect(t).not.toBeNull();
        expect(t!.length).toBe(6);
        // Pattern: IIII---- repeated for 3 personel, ----IIII for 3
        expect(t![0].slice(0, 4).join('')).toBe('IIII');
        expect(t![3].slice(0, 4).join('')).toBe('----');
    });

    it('returns null for n not in 3..7', () => {
        expect(getTemplate(2, 30)).toBeNull();
        expect(getTemplate(8, 30)).toBeNull();
    });

    it('truncates to requested days', () => {
        const t = getTemplate(5, 15);
        expect(t).not.toBeNull();
        expect(t![0].length).toBe(15);
    });
});

describe('generateRoster — basic', () => {
    it('Oksibil-like 7 personel pakai template', () => {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC']);
        const result = generateRoster({
            year: 2026, month: 6, personnel,
        });
        expect(result.success).toBe(true);
        expect(result.mode).toBe('template');
        expect(result.daysInMonth).toBe(30);
        // 3 on-duty per day
        for (let d = 1; d <= 30; d++) {
            const onDuty = Object.keys(result.roster).filter(
                ini => SHIFT_SET.includes(result.roster[ini][d - 1].status),
            ).length;
            expect(onDuty).toBe(3);
        }
    });

    it('9 personel + 1 partial leave → greedy', () => {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC', 'YO', 'YE']);
        const lv = leaveRangeFromDates('2026-06-10', '2026-06-15', 2026, 6, 'CUTI')!;
        personnel[0].leaves = [lv];
        const result = generateRoster({
            year: 2026, month: 6, personnel,
        });
        expect(result.success).toBe(true);
        expect(result.mode).toBe('greedy');
        // AA harus CUTI di 10-15 Juni
        for (let d = 10; d <= 15; d++) {
            expect(result.roster.AA[d - 1].status).toBe('CUTI');
        }
        // 3 on-duty per day
        for (let d = 1; d <= 30; d++) {
            const onDuty = Object.keys(result.roster).filter(
                ini => SHIFT_SET.includes(result.roster[ini][d - 1].status),
            ).length;
            expect(onDuty).toBe(3);
        }
    });

    it('TNI mode: all cells = TNI', () => {
        const personnel = makePersonnel(['AA', 'AB', 'AC']);
        const result = generateRoster({
            year: 2026, month: 6, personnel, isTni: true,
        });
        expect(result.success).toBe(true);
        expect(result.mode).toBe('tni');
        for (const ini of ['AA', 'AB', 'AC']) {
            for (let d = 1; d <= 30; d++) {
                expect(result.roster[ini][d - 1].status).toBe('TNI');
            }
        }
    });

    it('TNI mode preserves cuti days', () => {
        const personnel = makePersonnel(['AA', 'AB', 'AC']);
        personnel[0].leaves = [leaveRangeFromDates('2026-06-10', '2026-06-12', 2026, 6, 'CUTI')!];
        const result = generateRoster({
            year: 2026, month: 6, personnel, isTni: true,
        });
        expect(result.roster.AA[9].status).toBe('CUTI');  // day 10
        expect(result.roster.AA[10].status).toBe('CUTI');
        expect(result.roster.AA[11].status).toBe('CUTI');
        expect(result.roster.AA[12].status).toBe('TNI');  // day 13
    });

    it('insufficient personnel returns failure', () => {
        const personnel = makePersonnel(['AA', 'AB']);
        const result = generateRoster({
            year: 2026, month: 6, personnel, requiredPerDay: 3,
        });
        expect(result.success).toBe(false);
        expect(result.errorMessage).toContain('TIDAK CUKUP PERSONEL');
        expect(result.insufficientDays?.length).toBeGreaterThan(0);
    });
});

describe('generateRoster — cross-month continuity', () => {
    it('cuti 28 Jun – 5 Jul muncul di Juli hari 1-5', () => {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC', 'YO', 'YE']);
        const lv = leaveRangeFromDates('2026-06-28', '2026-07-05', 2026, 7, 'CUTI')!;
        personnel[0].leaves = [lv];
        const result = generateRoster({
            year: 2026, month: 7, personnel,
        });
        expect(result.success).toBe(true);
        // Hari 1-5 Juli: AA harus CUTI
        for (let d = 1; d <= 5; d++) {
            expect(result.roster.AA[d - 1].status).toBe('CUTI');
        }
    });

    it('prevMonthTail seed state: consec_work=6 → harus libur d=1', () => {
        const personnel = makePersonnel(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG']);
        // Force greedy via partial leave
        personnel[0].leaves = [leaveRangeFromDates('2026-07-20', '2026-07-22', 2026, 7, 'CUTI')!];
        // Tail: AA kerja 6 hari berturut-turut → consec_work=6
        const prevMonthTail = {
            AA: ['-', 'I', 'I', 'I', 'I', 'I', 'I'],
            BB: ['I', 'I', 'I', 'I', '-', '-', '-'],
            CC: ['I', 'I', 'I', 'I', '-', '-', '-'],
            DD: ['I', 'I', 'I', 'I', '-', '-', '-'],
            EE: ['I', 'I', 'I', 'I', '-', '-', '-'],
            FF: ['I', 'I', 'I', 'I', '-', '-', '-'],
            GG: ['I', 'I', 'I', 'I', '-', '-', '-'],
        };
        const result = generateRoster({
            year: 2026, month: 7, personnel, prevMonthTail,
        });
        expect(result.success).toBe(true);
        expect(result.mode).toBe('greedy');
        // AA consec_work=6 → di d=1 harus libur (Constraint 1)
        expect(result.roster.AA[0].status).toBe('-');
    });

    it('tanpa prevMonthTail → state mulai fresh', () => {
        const personnel = makePersonnel(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG']);
        personnel[0].leaves = [leaveRangeFromDates('2026-07-20', '2026-07-22', 2026, 7, 'CUTI')!];
        const result = generateRoster({
            year: 2026, month: 7, personnel, prevMonthTail: null,
        });
        expect(result.success).toBe(true);
        // No assertion ketat — engine ga crash dengan state fresh
    });
});

describe('generateRoster — partial re-generate', () => {
    it('cutoff_day=7 preserves past days', () => {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC']);
        // Step 1: fresh generate
        const initial = generateRoster({ year: 2026, month: 6, personnel });
        expect(initial.success).toBe(true);

        // Step 2: AT mendadak cuti tgl 10-20, re-generate cutoff_day=7
        const updated = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC']);
        updated[5].leaves = [leaveRangeFromDates('2026-06-10', '2026-06-20', 2026, 6, 'CUTI')!];
        const result = generateRoster({
            year: 2026, month: 6, personnel: updated,
            existingRoster: initial.roster, cutoffDay: 7,
        });
        expect(result.success).toBe(true);
        expect(result.mode).toBe('partial');
        // Past days (1-7) sama persis
        for (let d = 1; d <= 7; d++) {
            for (const ini of Object.keys(initial.roster)) {
                expect(result.roster[ini][d - 1].status).toBe(initial.roster[ini][d - 1].status);
                expect(result.roster[ini][d - 1].locked).toBe(true);
            }
        }
        // AT cuti di 10-20
        for (let d = 10; d <= 20; d++) {
            expect(result.roster.AT[d - 1].status).toBe('CUTI');
        }
    });
});
