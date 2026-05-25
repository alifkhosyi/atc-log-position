/**
 * FRMS-aware greedy assignment untuk satu hari.
 *
 * Port dari Python `assign_day_greedy()` di roster_generator_v4.py.
 *
 * Algoritma:
 *   1. Filter kandidat (yang tidak cuti hari ini)
 *   2. Hard constraint filter:
 *      - Max 6 hari consec_work (LOW class FRMS)
 *      - Min 2 hari libur per 7 hari rolling (cross-month aware via prevMonthTail)
 *   3. Fallback: kalau eligible < required_per_day, pull "least bad" dari forced-rest
 *   4. Preference scoring (target_work/target_off based on n_active)
 *   5. Sort & pick top required_per_day
 */

import type { Personnel, RosterCell } from './types';
import { SHIFT_TOKENS, isLeaveStatus, isOffStatus } from './types';
import { personnelIsOnLeave } from './date-utils';

export interface GreedyState {
    consec_work: number;
    consec_off: number;
    total_work: number;
    last_work_day: number;
}

/**
 * In-place modifies `roster` dan `state` untuk satu hari (1-indexed).
 *
 * @param day                   1..days_in_month
 * @param personnel             list personnel
 * @param roster                Record<personnelId, RosterCell[]>, indexed [day-1]
 * @param state                 GreedyState per personnel
 * @param priorityOrder         tie-break order (initial strings)
 * @param requiredPerDay        minimum on-duty per hari (default 3)
 * @param prevMonthTail         optional, untuk rolling check di hari 1..6
 */
export function assignDayGreedy(
    day: number,
    personnel: Personnel[],
    roster: Record<string, RosterCell[]>,
    state: Record<string, GreedyState>,
    priorityOrder: string[],
    requiredPerDay: number = 3,
    prevMonthTail?: Record<string, string[]> | null,
): void {
    // Cuti dulu di-handle (mereka sudah marked CUTI di roster sebelum panggil ini)
    const candidates = personnel.filter(p => !personnelIsOnLeave(p.leaves, day));

    // ===== HARD CONSTRAINT FILTER =====
    function violatesHardConstraint(p: Personnel): boolean {
        const s = state[p.id];
        // Constraint 1: Max consecutive days = 6 (LOW class)
        if (s.consec_work >= 6) return true;

        // Constraint 2: Min 2 hari libur per 7 hari rolling
        const cells = roster[p.id];

        // CASE A: d >= 7 — full window dalam bulan ini
        if (day >= 7) {
            let windowOffBefore = 0;
            for (let dayCheck = day - 6; dayCheck < day; dayCheck++) {
                if (isOffStatus(cells[dayCheck - 1].status)) {
                    windowOffBefore++;
                }
            }
            if (windowOffBefore < 2) return true;
        }
        // CASE B (v4.1): d < 7, window melintasi batas bulan
        else if (prevMonthTail) {
            const tail = prevMonthTail[p.id] || [];
            const prevDaysNeeded = 7 - day;  // 6..1 untuk day=1..6
            if (tail.length >= prevDaysNeeded) {
                const prevPart = tail.slice(-prevDaysNeeded);
                const currPart: string[] = [];
                for (let i = 0; i < day - 1; i++) {
                    currPart.push(cells[i].status);
                }
                const fullWindow = [...prevPart, ...currPart];  // 6 items
                const windowOffBefore = fullWindow.filter(s => isOffStatus(s)).length;
                if (windowOffBefore < 2) return true;
            }
            // Tail kurang panjang → skip check (= behavior lama Python).
        }
        return false;
    }

    let eligible = candidates.filter(p => !violatesHardConstraint(p));
    const forcedRest = candidates.filter(p => violatesHardConstraint(p));

    // FALLBACK: kalau eligible < required, pull "least bad" dari forced_rest
    if (eligible.length < requiredPerDay) {
        const shortfall = requiredPerDay - eligible.length;
        // Sort forced_rest by least severe violation
        const forcedRestSorted = [...forcedRest].sort((a, b) => {
            const sa = state[a.id];
            const sb = state[b.id];
            // Lower consec_work = less bad; tie-break by total_work
            return (sa.consec_work - sb.consec_work)
                || (sa.total_work - sb.total_work);
        });
        eligible = [...eligible, ...forcedRestSorted.slice(0, shortfall)];
    }

    // ===== PREFERENCE SCORING =====
    function workPref(p: Personnel): [number, number, number] {
        const s = state[p.id];
        const cw = s.consec_work;
        const co = s.consec_off;

        // Target block size based on n_active
        const nActiveToday = personnel.filter(
            pp => !personnelIsOnLeave(pp.leaves, day),
        ).length;
        let targetWork: number, targetOff: number;
        if (nActiveToday >= 2 * requiredPerDay) {
            // Classic 4-on/4-off staggered
            targetWork = 4;
            targetOff = 4;
        } else if (nActiveToday >= requiredPerDay + 2) {
            targetWork = 3;
            targetOff = 2;
        } else if (nActiveToday >= requiredPerDay + 1) {
            targetWork = 3;
            targetOff = 1;
        } else {
            // Equal/less than required — everyone must work most days
            targetWork = 99;
            targetOff = 0;
        }

        // Category: 0=MUST WORK, 1=CAN WORK, 2=SHOULD REST
        let category: number;
        if (cw >= targetWork) {
            category = 2;
        } else if (co >= targetOff && targetOff > 0) {
            category = 0;
        } else {
            category = 1;
        }

        const prioIdx = priorityOrder.indexOf(p.id);
        return [category, s.total_work, prioIdx === -1 ? 999 : prioIdx];
    }

    // Sort by (category, total_work, priority_idx) ascending
    const eligibleSorted = [...eligible].sort((a, b) => {
        const [ca, ta, pa] = workPref(a);
        const [cb, tb, pb] = workPref(b);
        return (ca - cb) || (ta - tb) || (pa - pb);
    });

    const chosen = eligibleSorted.slice(0, requiredPerDay);
    const chosenSet = new Set(chosen.map(p => p.id));

    // Update roster + state
    for (const p of personnel) {
        const cell = roster[p.id][day - 1];
        const s = state[p.id];

        if (isLeaveStatus(cell.status)) {
            // Leave already marked: counts as off-day
            s.consec_work = 0;
            s.consec_off += 1;
            continue;
        }

        if (chosenSet.has(p.id)) {
            cell.status = 'I';
            s.consec_work += 1;
            s.consec_off = 0;
            s.total_work += 1;
            s.last_work_day = day;
        } else {
            cell.status = '-';
            s.consec_off += 1;
            s.consec_work = 0;
        }
    }
}
