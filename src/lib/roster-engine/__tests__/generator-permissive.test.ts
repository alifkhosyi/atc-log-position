/**
 * Test: generator engine permissive baseline.
 *
 * Test untuk Fix B di BASELINE_ENFORCEMENT_HANDOFF.md — engine harus
 * SELALU apply baseline kalau ada (tidak fallback ke greedy untuk
 * count mismatch).
 *
 * Behavior:
 *  - personnel.length == baseline.length → 1:1 mapping (mode: baseline)
 *  - personnel.length > baseline.length  → REPEAT pattern (mode: baseline,
 *    pattern di-loop modulo)
 *  - personnel.length < baseline.length  → TRUNCATE (first N pattern,
 *    sisa pattern tidak dipakai; mode: baseline)
 *  - baseline === null                   → fallback greedy (OK edge case)
 *  - hasPartialLeave === true            → fallback greedy (OK edge case)
 *
 * Note: vitest tidak terinstall di package.json saat ini — file ini
 * disiapkan tapi tidak runnable sampai `npm install --save-dev vitest`.
 * Setelah vitest terinstall, run `npm run test`.
 */

import { describe, it, expect } from 'vitest';
import { generateRoster } from '../generator';
import type { Personnel } from '../../shared/types';

describe('generator: permissive baseline', () => {
    const mockPersonnel = (n: number): Personnel[] =>
        Array.from({ length: n }, (_, i) => ({
            id: `P${i + 1}`,
            initial: `P${i + 1}`,
            leaves: [],
        }));

    // 9-row baseline: pattern simple "I I - - I I" rotation (6-day cycle, repeated)
    const ninePatternBaseline: string[][] = Array.from({ length: 9 }, (_, i) => {
        // Each row offset by 1 day so they don't all overlap
        const base = ['I', 'I', '-', '-', 'I', 'I'];
        const rotated = [...base.slice(i % 6), ...base.slice(0, i % 6)];
        // Repeat to 31 days
        const full: string[] = [];
        while (full.length < 31) full.push(...rotated);
        return full.slice(0, 31);
    });

    it('apply baseline when personnel.length == baseline.length', () => {
        const result = generateRoster({
            year: 2026, month: 5,
            personnel: mockPersonnel(9),
            baselinePattern: ninePatternBaseline,
        });
        expect(result.success).toBe(true);
        expect(result.mode).toMatch(/^baseline/);
        // Personnel 1 (P1) should have baseline[0] applied
        expect(result.roster['P1'][0].status).toBe(ninePatternBaseline[0][0]);
    });

    it('REPEAT baseline when personnel.length > baseline.length (NEW behavior)', () => {
        const result = generateRoster({
            year: 2026, month: 5,
            personnel: mockPersonnel(22),
            baselinePattern: ninePatternBaseline,
        });
        expect(result.success).toBe(true);
        // Critical: should STILL be baseline, NOT greedy
        expect(result.mode).toMatch(/^baseline/);
        // Personnel 10 (index 9) → pattern row 9 % 9 = 0 = same as P1
        expect(result.roster['P10'][0].status).toBe(result.roster['P1'][0].status);
        expect(result.roster['P10'][1].status).toBe(result.roster['P1'][1].status);
        // Personnel 19 (index 18) → pattern row 18 % 9 = 0 = same as P1
        expect(result.roster['P19'][0].status).toBe(result.roster['P1'][0].status);
        // Personnel 22 (index 21) → pattern row 21 % 9 = 3 = same as P4
        expect(result.roster['P22'][0].status).toBe(result.roster['P4'][0].status);
    });

    it('TRUNCATE-style: personnel.length < baseline.length uses first N (NEW behavior)', () => {
        const result = generateRoster({
            year: 2026, month: 5,
            personnel: mockPersonnel(5),  // less than 9 baseline rows
            baselinePattern: ninePatternBaseline,
        });
        expect(result.success).toBe(true);
        expect(result.mode).toMatch(/^baseline/);
        // First 5 patterns used; pattern[5..8] not applied (no personnel for those)
        expect(result.roster['P1'][0].status).toBe(ninePatternBaseline[0][0]);
        expect(result.roster['P5'][0].status).toBe(ninePatternBaseline[4][0]);
        // P6+ doesn't exist in mock
        expect(result.roster['P6']).toBeUndefined();
    });

    it('fallback to greedy when baseline is null', () => {
        const result = generateRoster({
            year: 2026, month: 5,
            personnel: mockPersonnel(9),
            baselinePattern: null,
        });
        expect(result.success).toBe(true);
        // OK to fall back: no baseline available, greedy is the only path
        expect(result.mode).toBe('greedy');
    });

    it('fallback to greedy when baseline is empty array', () => {
        const result = generateRoster({
            year: 2026, month: 5,
            personnel: mockPersonnel(9),
            baselinePattern: [],
        });
        expect(result.success).toBe(true);
        // length === 0 → guard fires, fallback greedy
        expect(result.mode).toBe('greedy');
    });

    it('preserve leave cells when applying baseline (multi-shift)', () => {
        // Mock personnel where P1 has a leave on day 15 (1-indexed)
        const personnel: Personnel[] = mockPersonnel(9).map((p, i) => {
            if (i === 0) {
                return {
                    ...p,
                    leaves: [{
                        startDay: 15, endDay: 15,
                        startDate: '2026-05-15', endDate: '2026-05-15',
                        category: 'CUTI',
                    }],
                };
            }
            return p;
        });

        const result = generateRoster({
            year: 2026, month: 5,
            personnel,
            baselinePattern: ninePatternBaseline,
        });
        expect(result.success).toBe(true);
        // Day 15 (index 14) for P1 should be CUTI, not the baseline value
        expect(result.roster['P1'][14].status).toBe('CUTI');
        // Other days for P1 should follow baseline
        expect(result.roster['P1'][0].status).toBe(ninePatternBaseline[0][0]);
    });
});
