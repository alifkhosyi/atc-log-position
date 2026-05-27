/**
 * FRMS Validator — cek roster terhadap aturan AirNav.
 *
 * Port dari Python `frms_validator.py`.
 *
 * Returns FrmsIssue[] dengan severity 'error' (hard reject) atau 'warning'.
 */

import type { Personnel, RosterCell } from '../shared/types';
import type { FrmsIssue } from './types';
import { personnelIsOnLeave } from '../shared/date-utils';
import {
    type ServiceClass,
    DEFAULT_LIMITS,
    getMaxConsecutiveDays,
    getMaxHoursPerWeek,
    getMaxShiftHours,
    getMinRestAfterMaxConsecutiveHours,
} from './frms-rules';

// ============================================================
// CONSTANTS
// ============================================================

export const FRMS_SHIFT_HOURS = 10;  // Oksibil shift = 10 jam

/** Any shift token counts as working day. */
const WORKING_STATUSES: ReadonlySet<string> = new Set(['I', 'II', 'III', 'IV', 'V']);

/** Off-day: scheduled rest "-" OR any leave category. TNI handled separately. */
const OFF_STATUSES: ReadonlySet<string> = new Set([
    '-', 'CUTI', 'SAKIT', 'DIKLAT', 'OTHERS',
]);

// ============================================================
// INDIVIDUAL VALIDATORS
// ============================================================

export function validateMinimumPersonnel(personnelCount: number): FrmsIssue[] {
    if (personnelCount < DEFAULT_LIMITS.min_personnel_per_unit) {
        return [{
            severity: 'error',
            rule: 'MIN_PERSONNEL',
            message: `Jumlah personel (${personnelCount}) kurang dari minimum ${DEFAULT_LIMITS.min_personnel_per_unit} per unit (aturan AirNav).`,
        }];
    }
    return [];
}

export function validateMinOnDutyPerDay(
    roster: Record<string, RosterCell[]>,
    daysInMonth: number,
    minRequired: number = 3,
): FrmsIssue[] {
    const issues: FrmsIssue[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
        let onDuty = 0;
        for (const ini of Object.keys(roster)) {
            if (WORKING_STATUSES.has(roster[ini][day - 1].status)) onDuty++;
        }
        if (onDuty < minRequired) {
            issues.push({
                severity: 'error',
                rule: 'MIN_ON_DUTY',
                message: `Tanggal ${day}: hanya ${onDuty} personel on-duty (min ${minRequired}).`,
                day,
                context: { on_duty: onDuty, required: minRequired },
            });
        }
    }
    return issues;
}

export function validateNoSoloController(
    roster: Record<string, RosterCell[]>,
    daysInMonth: number,
): FrmsIssue[] {
    const issues: FrmsIssue[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
        let onDuty = 0;
        for (const ini of Object.keys(roster)) {
            if (WORKING_STATUSES.has(roster[ini][day - 1].status)) onDuty++;
        }
        if (onDuty === 1) {
            issues.push({
                severity: 'error',
                rule: 'NO_SOLO_CONTROLLER',
                message: `Tanggal ${day}: hanya 1 personel on-duty (Controller solo tidak diperbolehkan).`,
                day,
            });
        }
    }
    return issues;
}

export function validateMaxConsecutiveDays(
    roster: Record<string, RosterCell[]>,
    daysInMonth: number,
    serviceClass: ServiceClass,
): FrmsIssue[] {
    const issues: FrmsIssue[] = [];
    const maxAllowed = getMaxConsecutiveDays(serviceClass);
    for (const initial of Object.keys(roster)) {
        const cells = roster[initial];
        let consecutive = 0;
        let maxStreak = 0;
        let streakEndDay = 0;
        for (let dIdx = 0; dIdx < cells.length; dIdx++) {
            if (WORKING_STATUSES.has(cells[dIdx].status)) {
                consecutive++;
                if (consecutive > maxStreak) {
                    maxStreak = consecutive;
                    streakEndDay = dIdx + 1;
                }
            } else {
                consecutive = 0;
            }
        }
        if (maxStreak > maxAllowed) {
            issues.push({
                severity: 'error',
                rule: 'MAX_CONSECUTIVE_DAYS',
                message: `Personel ${initial}: kerja ${maxStreak} hari berturut-turut (max ${maxAllowed} untuk klasifikasi ${serviceClass}).`,
                personnel: initial,
                day: streakEndDay,
                context: { streak: maxStreak, max: maxAllowed },
            });
        }
    }
    return issues;
}

export function validateMinDaysOffPerWeek(
    roster: Record<string, RosterCell[]>,
    daysInMonth: number,
): FrmsIssue[] {
    const issues: FrmsIssue[] = [];
    const minOff = DEFAULT_LIMITS.min_days_off_per_week;
    for (const initial of Object.keys(roster)) {
        const cells = roster[initial];
        for (let start = 0; start <= daysInMonth - 7; start++) {
            const window = cells.slice(start, start + 7);
            const offCount = window.filter(c => OFF_STATUSES.has(c.status)).length;
            if (offCount < minOff) {
                issues.push({
                    severity: 'error',
                    rule: 'MIN_DAYS_OFF_PER_WEEK',
                    message: `Personel ${initial}: hari ${start + 1}-${start + 7} hanya ${offCount} hari libur (min ${minOff} per 7 hari).`,
                    personnel: initial,
                    day: start + 1,
                    context: { off_count: offCount, required: minOff },
                });
                break;  // 1 issue per personnel
            }
        }
    }
    return issues;
}

export function validateMaxHoursPerWeek(
    roster: Record<string, RosterCell[]>,
    daysInMonth: number,
    serviceClass: ServiceClass,
    shiftHours: number = FRMS_SHIFT_HOURS,
): FrmsIssue[] {
    const issues: FrmsIssue[] = [];
    const maxHours = getMaxHoursPerWeek(serviceClass);
    for (const initial of Object.keys(roster)) {
        const cells = roster[initial];
        for (let start = 0; start <= daysInMonth - 7; start++) {
            const window = cells.slice(start, start + 7);
            const workDays = window.filter(c => WORKING_STATUSES.has(c.status)).length;
            const totalHours = workDays * shiftHours;
            if (totalHours > maxHours) {
                issues.push({
                    severity: 'warning',
                    rule: 'MAX_HOURS_PER_WEEK',
                    message: `Personel ${initial}: hari ${start + 1}-${start + 7} = ${totalHours} jam kerja (max ${maxHours} untuk klasifikasi ${serviceClass}).`,
                    personnel: initial,
                    day: start + 1,
                    context: { hours: totalHours, max: maxHours },
                });
                break;
            }
        }
    }
    return issues;
}

export function validateShiftDuration(
    shiftHours: number,
    serviceClass: ServiceClass,
): FrmsIssue[] {
    const maxAllowed = getMaxShiftHours(serviceClass);
    if (shiftHours > maxAllowed) {
        return [{
            severity: 'warning',
            rule: 'MAX_SHIFT_HOURS',
            message: `Durasi shift ${shiftHours} jam melebihi max ${maxAllowed} jam untuk klasifikasi ${serviceClass}.`,
            context: { shift_hours: shiftHours, max: maxAllowed },
        }];
    }
    return [];
}

export function validateConsecutiveFollowedByRest(
    roster: Record<string, RosterCell[]>,
    daysInMonth: number,
    serviceClass: ServiceClass,
    _shiftHours: number = FRMS_SHIFT_HOURS,
): FrmsIssue[] {
    const issues: FrmsIssue[] = [];
    const maxConsecutive = getMaxConsecutiveDays(serviceClass);
    const requiredRestHours = getMinRestAfterMaxConsecutiveHours(serviceClass);
    const minOffDaysAfterMax = Math.ceil(requiredRestHours / 24);

    for (const initial of Object.keys(roster)) {
        const cells = roster[initial];
        let i = 0;
        while (i < daysInMonth) {
            if (WORKING_STATUSES.has(cells[i].status)) {
                const streakStart = i;
                while (i < daysInMonth && WORKING_STATUSES.has(cells[i].status)) i++;
                const streakLength = i - streakStart;
                if (streakLength >= maxConsecutive) {
                    // Count consecutive off days right after
                    let offStreak = 0;
                    let j = i;
                    while (j < daysInMonth && OFF_STATUSES.has(cells[j].status)) {
                        offStreak++;
                        j++;
                    }
                    if (j < daysInMonth && offStreak < minOffDaysAfterMax) {
                        issues.push({
                            severity: 'error',
                            rule: 'MIN_REST_AFTER_MAX_CONSECUTIVE',
                            message: `Personel ${initial}: setelah ${streakLength} hari kerja (hari ${streakStart + 1}-${streakStart + streakLength}), hanya ${offStreak} hari libur (min ${minOffDaysAfterMax} = ${requiredRestHours} jam).`,
                            personnel: initial,
                            day: streakStart + streakLength,
                            context: {
                                streak: streakLength,
                                off: offStreak,
                                required_off_days: minOffDaysAfterMax,
                            },
                        });
                    }
                }
            } else {
                i++;
            }
        }
    }
    return issues;
}

export function validateNoLeaveAssignedWork(
    roster: Record<string, RosterCell[]>,
    personnelObjs: Personnel[],
    daysInMonth: number,
): FrmsIssue[] {
    const issues: FrmsIssue[] = [];
    for (const p of personnelObjs) {
        for (let d = 1; d <= daysInMonth; d++) {
            if (personnelIsOnLeave(p.leaves, d)) {
                if (WORKING_STATUSES.has(roster[p.id][d - 1].status)) {
                    issues.push({
                        severity: 'error',
                        rule: 'LEAVE_ASSIGNED_WORK',
                        message: `Personel ${p.id} sedang cuti tanggal ${d} tapi di-assign kerja.`,
                        personnel: p.id,
                        day: d,
                    });
                }
            }
        }
    }
    return issues;
}

// ============================================================
// MAIN VALIDATOR
// ============================================================

export interface ValidateFullOptions {
    roster: Record<string, RosterCell[]>;
    personnel: Personnel[];
    daysInMonth: number;
    serviceClass: ServiceClass;
    shiftHours?: number;
    minOnDuty?: number;
}

export function validateFull(opts: ValidateFullOptions): FrmsIssue[] {
    const {
        roster, personnel, daysInMonth, serviceClass,
        shiftHours = FRMS_SHIFT_HOURS,
        minOnDuty = 3,
    } = opts;

    return [
        ...validateMinimumPersonnel(personnel.length),
        ...validateMinOnDutyPerDay(roster, daysInMonth, minOnDuty),
        ...validateNoSoloController(roster, daysInMonth),
        ...validateMaxConsecutiveDays(roster, daysInMonth, serviceClass),
        ...validateMinDaysOffPerWeek(roster, daysInMonth),
        ...validateMaxHoursPerWeek(roster, daysInMonth, serviceClass, shiftHours),
        ...validateShiftDuration(shiftHours, serviceClass),
        ...validateConsecutiveFollowedByRest(roster, daysInMonth, serviceClass, shiftHours),
        ...validateNoLeaveAssignedWork(roster, personnel, daysInMonth),
    ];
}

export function splitBySeverity(
    issues: FrmsIssue[],
): { errors: FrmsIssue[]; warnings: FrmsIssue[] } {
    return {
        errors: issues.filter(i => i.severity === 'error'),
        warnings: issues.filter(i => i.severity === 'warning'),
    };
}
