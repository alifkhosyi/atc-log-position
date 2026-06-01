import { describe, it, expect } from 'vitest';
// Split-engine: rolling pindah ke rolling-engine/, ca-engine, airport-data,
// shared types & date-utils ke shared/.
import {
    computeSlotTimes, computeDailyRolling, computeMonthlyRolling,
    computeRecap, ROLLING_PATTERN, assignPersonnelToABC,
} from '../../rolling-engine';
import { swapShift } from '../swap';
import {
    kontrolMinutesPerShift, computeAllowanceTable, summarizeAllowance,
} from '../../ca-engine';
import { generateRoster } from '../generator';
import { getAirport, getUnit } from '../../airport-data';
import { leaveRangeFromDates } from '../../shared/date-utils';
import {
    POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT,
} from '../../airport-data/types';
import type { Personnel, RosterCell } from '../../shared/types';

function makePersonnel(ids: string[]): Personnel[] {
    return ids.map(id => ({ id, initial: id, leaves: [] }));
}

// ============================================================
// ROLLING
// ============================================================

describe('rolling — slot times', () => {
    it('Oksibil 21:00 UTC start, 6 slot × 100 mnt', () => {
        const times = computeSlotTimes({
            shiftStartUtc: '21:00', nSlots: 6, slotDurationMin: 100,
        });
        expect(times).toHaveLength(6);
        expect(times[0]).toEqual(['21:00', '22:40']);
        expect(times[1]).toEqual(['22:40', '00:20']);  // crosses midnight
        expect(times[5][1]).toBe('07:00');             // ends at 07:00 next day
    });

    it('variable slot durations (Tambolaka 240/240/60/60)', () => {
        const times = computeSlotTimes({
            shiftStartUtc: '00:00', nSlots: 4, slotDurations: [240, 240, 60, 60],
        });
        expect(times[0]).toEqual(['00:00', '04:00']);
        expect(times[1]).toEqual(['04:00', '08:00']);
        expect(times[2]).toEqual(['08:00', '09:00']);
        expect(times[3]).toEqual(['09:00', '10:00']);
    });
});

describe('rolling — daily 3-personnel', () => {
    it('compute daily rolling for 3 on-duty', () => {
        const priority = ['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC'];
        const daily = computeDailyRolling({
            day: 15, onDutyInitials: ['AT', 'AA', 'AX'], priorityOrder: priority,
            shiftStartUtc: '21:00',
        });
        expect(daily.day).toBe(15);
        // Sorted A, B, C by priority
        expect(daily.on_duty).toEqual(['AA', 'AX', 'AT']);
        expect(daily.slots).toHaveLength(6);
    });

    it('recap: distribusi merata 200 mnt per posisi', () => {
        const priority = ['AA', 'AX', 'AT'];
        const daily = computeDailyRolling({
            day: 1, onDutyInitials: ['AA', 'AX', 'AT'], priorityOrder: priority,
        });
        const recap = computeRecap(daily);
        for (const ini of ['AA', 'AX', 'AT']) {
            expect(recap[ini][POSITION_KONTROL]).toBe(200);
            expect(recap[ini][POSITION_ASISTEN]).toBe(200);
            expect(recap[ini][POSITION_ISTIRAHAT]).toBe(200);
            expect(recap[ini]['Total Pemanduan']).toBe(400);
            expect(recap[ini]['Total Shift']).toBe(600);
        }
    });

    it('assignPersonnelToABC sorts by priority', () => {
        const sorted = assignPersonnelToABC(
            ['ZZ', 'BB', 'AA'], ['AA', 'BB', 'CC', 'ZZ'],
        );
        expect(sorted).toEqual(['AA', 'BB', 'ZZ']);
    });

    it('rejects wrong personnel count', () => {
        expect(() => computeDailyRolling({
            day: 1, onDutyInitials: ['AA', 'BB'], priorityOrder: ['AA', 'BB'],
            nPersonnel: 3,
        })).toThrow();
    });
});

describe('rolling — monthly', () => {
    it('compute monthly untuk Oksibil 7 personel', () => {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC']);
        const result = generateRoster({ year: 2026, month: 6, personnel });
        expect(result.success).toBe(true);
        const monthly = computeMonthlyRolling({
            result, priorityOrder: ['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC'],
        });
        // Setiap hari ada 3 on-duty → semua hari masuk monthly
        expect(Object.keys(monthly).length).toBe(30);
    });
});

// ============================================================
// SWAP
// ============================================================

describe('swap shift', () => {
    function setupRoster(): {
        roster: Record<string, RosterCell[]>;
        personnel: Personnel[];
    } {
        const personnel = makePersonnel(['AA', 'AX', 'AZ', 'AC', 'AW', 'AT', 'BC']);
        const result = generateRoster({ year: 2026, month: 6, personnel });
        return { roster: result.roster, personnel };
    }

    it('cannot swap personnel with itself', () => {
        const { roster, personnel } = setupRoster();
        const r = swapShift({
            roster, personnel,
            personnelA: 'AA', personnelB: 'AA', day: 10,
        });
        expect(r.success).toBe(false);
        expect(r.message).toContain('dirinya sendiri');
    });

    it('cannot swap with cuti personnel', () => {
        const { roster, personnel } = setupRoster();
        // Mark AA's day 10 as CUTI
        roster.AA[9].status = 'CUTI';
        const r = swapShift({
            roster, personnel,
            personnelA: 'AA', personnelB: 'AX', day: 10,
        });
        expect(r.success).toBe(false);
        expect(r.message).toContain('cuti');
    });

    it('cannot swap if status sama', () => {
        const { roster, personnel } = setupRoster();
        // Force both to be 'I' on day 1 (artificial)
        roster.AA[0].status = 'I';
        roster.AX[0].status = 'I';
        const r = swapShift({
            roster, personnel,
            personnelA: 'AA', personnelB: 'AX', day: 1,
        });
        expect(r.success).toBe(false);
        expect(r.message).toContain('status sama');
    });

    it('successful swap exchanges status', () => {
        const { roster, personnel } = setupRoster();
        // Find a day where AA='I' and AX='-'
        let swapDay: number | null = null;
        for (let d = 1; d <= 30; d++) {
            if (roster.AA[d - 1].status === 'I' && roster.AX[d - 1].status === '-') {
                swapDay = d;
                break;
            }
            if (roster.AA[d - 1].status === '-' && roster.AX[d - 1].status === 'I') {
                swapDay = d;
                break;
            }
        }
        if (swapDay === null) throw new Error('no swappable day found in fixture');

        const beforeA = roster.AA[swapDay - 1].status;
        const beforeB = roster.AX[swapDay - 1].status;
        const r = swapShift({
            roster, personnel,
            personnelA: 'AA', personnelB: 'AX', day: swapDay,
        });
        expect(r.success).toBe(true);
        expect(roster.AA[swapDay - 1].status).toBe(beforeB);
        expect(roster.AX[swapDay - 1].status).toBe(beforeA);
    });

    it('cannot swap locked day', () => {
        const { roster, personnel } = setupRoster();
        roster.AA[2].locked = true;
        roster.AX[2].locked = true;
        const r = swapShift({
            roster, personnel,
            personnelA: 'AA', personnelB: 'AX', day: 3,
        });
        expect(r.success).toBe(false);
        expect(r.message).toContain('locked');
    });
});

// ============================================================
// CONTROL ALLOWANCE
// ============================================================

describe('kontrolMinutesPerShift', () => {
    it('Oksibil default pattern: 200+200 = 400 mnt per shift', () => {
        const rolling = {
            shift_start_utc: '21:00',
            n_slots: 6,
            slot_duration_min: 100,
            positions: [
                [POSITION_ASISTEN, POSITION_ISTIRAHAT, POSITION_KONTROL],
                [POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT],
                [POSITION_ISTIRAHAT, POSITION_KONTROL, POSITION_ASISTEN],
                [POSITION_ASISTEN, POSITION_ISTIRAHAT, POSITION_KONTROL],
                [POSITION_KONTROL, POSITION_ASISTEN, POSITION_ISTIRAHAT],
                [POSITION_ISTIRAHAT, POSITION_KONTROL, POSITION_ASISTEN],
            ],
        };
        // Personnel 0 di slot 1 = Asisten (100), slot 2 = Kontrol (100),
        //              slot 3 = Istirahat (0, excluded),
        //              slot 4 = Asisten, slot 5 = Kontrol, slot 6 = Istirahat
        // Total: 100+100+100+100 = 400 mnt
        expect(kontrolMinutesPerShift(rolling)).toBe(400);
    });

    it('returns 0 untuk rolling null', () => {
        expect(kontrolMinutesPerShift(null)).toBe(0);
    });

    it('returns 0 untuk rolling tanpa positions', () => {
        expect(kontrolMinutesPerShift({
            shift_start_utc: '21:00', n_slots: 6, slot_duration_min: 100, positions: [],
        })).toBe(0);
    });
});

describe('Control Allowance — end to end', () => {
    it('Ambon TWR June 2026: hitung CA dari roster', () => {
        const airport = getAirport('AMBON');
        expect(airport).toBeDefined();
        const unit = getUnit(airport!, 'TWR');
        expect(unit).toBeDefined();
        // Pakai initials dari config
        const personnel = (unit!.initials || []).map((ini, i) => ({
            id: ini, initial: ini, leaves: [], priorityOrder: i,
        }));
        const result = generateRoster({
            year: 2026, month: 6, personnel,
            requiredPerDay: unit!.min_on_duty_baseline,
        });
        expect(result.success).toBe(true);

        const allowance = computeAllowanceTable({
            airportName: 'Ambon',
            result,
            unitConfig: unit,
            priorityOrder: personnel.map(p => p.id),
            nameLookup: Object.fromEntries(personnel.map(p => [p.id, p.initial])),
        });
        expect(allowance.error).toBeUndefined();
        expect(allowance.rows.length).toBeGreaterThan(0);
        expect(allowance.summary.total_allowance).toBeGreaterThan(0);
        expect(allowance.constant_per_hour).toBeGreaterThan(0);
        // Ambon = non-TMA
        expect(allowance.is_tma).toBe(false);
    });

    it('warning DRAFT muncul kalau status bukan FINAL', () => {
        const airport = getAirport('AMBON');
        const unit = getUnit(airport!, 'TWR');
        const personnel = (unit!.initials || []).map((ini, i) => ({
            id: ini, initial: ini, leaves: [], priorityOrder: i,
        }));
        const result = generateRoster({
            year: 2026, month: 6, personnel,
            requiredPerDay: unit!.min_on_duty_baseline,
        });
        const allowance = computeAllowanceTable({
            airportName: 'Ambon', result, unitConfig: unit,
            priorityOrder: personnel.map(p => p.id),
            rosterStatus: 'DRAFT',
        });
        expect(allowance.warnings.some(w => w.includes('DRAFT'))).toBe(true);
    });

    it('returns error untuk airport name yang tidak ada', () => {
        const personnel = makePersonnel(['AA', 'BB', 'CC', 'DD', 'EE', 'FF', 'GG']);
        const result = generateRoster({ year: 2026, month: 6, personnel });
        const allowance = computeAllowanceTable({
            airportName: 'Atlantis', result, unitConfig: null,
            priorityOrder: personnel.map(p => p.id),
        });
        expect(allowance.error).toBeDefined();
        expect(allowance.rows).toHaveLength(0);
    });

    it('summarizeAllowance: total + avg', () => {
        // Test fixture: PersonnelAllowance shape (Step 9 — Jam Tambahan
        // additions to interface require advance/extend fields too).
        const rows = [
            {
                personnel_id: 'a', initial: 'A', name: 'A',
                kontrol_minutes: 600, kontrol_hours: 10,
                constant_per_hour: 50000, allowance_rp: 500000,
                advance_minutes: 0, extend_minutes: 0,
                advance_hours: 0, extend_hours: 0,
                total_hours: 10, total_allowance_rp: 500000,
            },
            {
                personnel_id: 'b', initial: 'B', name: 'B',
                kontrol_minutes: 1200, kontrol_hours: 20,
                constant_per_hour: 50000, allowance_rp: 1000000,
                advance_minutes: 0, extend_minutes: 0,
                advance_hours: 0, extend_hours: 0,
                total_hours: 20, total_allowance_rp: 1000000,
            },
        ];
        const s = summarizeAllowance(rows);
        expect(s.n_personnel).toBe(2);
        expect(s.total_kontrol_hours).toBe(30);
        expect(s.total_allowance).toBe(1500000);
        expect(s.avg_allowance).toBe(750000);
    });
});
