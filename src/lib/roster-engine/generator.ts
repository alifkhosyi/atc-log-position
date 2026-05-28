/**
 * Main `generateRoster()` function.
 *
 * Port dari Python `generate_roster()` di roster_generator_v4.py.
 *
 * Generation paths (in priority order):
 *   1. TNI mode — all cells = "TNI", FRMS skipped
 *   2. Multi-shift view-only — apply baseline as-is, preserve leaves
 *   3. Single-shift baseline — apply baseline kalau no partial leave
 *   4. Built-in template (Oksibil-style) — kalau no partial leave + n_active match
 *   5. Greedy mode — FRMS-aware fallback
 *
 * Cross-month support (v4.1):
 *   - `prevMonthTail`: seed state (consec_work/off) di greedy mode
 *   - Pass-through ke `assignDayGreedy` untuk rolling check di hari 1..6
 */

import type {
    Personnel, RosterCell,
} from '../shared/types';
import { SHIFT_TOKENS, isLeaveStatus } from '../shared/types';
import type { GenerateResult, RosterMode } from './types';
import {
    daysInMonth as daysInMonthCalendar,
    personnelIsOnLeave, personnelLeaveCategory,
    personnelIsOnLeaveEntireMonth, personnelHasAnyLeave,
} from '../shared/date-utils';
import { getTemplate } from './templates';
import { assignDayGreedy, type GreedyState } from './greedy';

const DEFAULT_REQUIRED_PER_DAY = 3;

export interface GenerateRosterOptions {
    year: number;
    month: number;
    personnel: Personnel[];
    /** Tie-break order. Default = urutan personnel. */
    priorityOrder?: string[];
    /** Existing roster untuk partial re-generate. */
    existingRoster?: Record<string, RosterCell[]> | null;
    /** 0 = fresh generate. >0 = partial (preserve days 1..cutoff). */
    cutoffDay?: number;
    /** Minimum on-duty per hari. Default 3. */
    requiredPerDay?: number;
    /**
     * Per-airport baseline pattern (override built-in template).
     * Index: [personnelIdx][dayIdx] -> "I" | "II" | "-" | etc.
     */
    baselinePattern?: string[][] | null;
    /** TNI flag — semua cell = "TNI", skip FRMS. */
    isTni?: boolean;
    /**
     * Tail status dari roster bulan N-1, keyed by personnel id.
     * Format: tail[i] = status hari (lastDayPrevMonth - (n-1-i)).
     * Untuk continuity pattern + FRMS rolling check di minggu pertama.
     */
    prevMonthTail?: Record<string, string[]> | null;
}

/**
 * Scan baseline_pattern untuk multi-shift tokens (II/III/IV/V).
 * Returns Set of tokens yang muncul.
 */
function scanMultiShiftTokens(baseline: string[][] | null | undefined): Set<string> {
    const found = new Set<string>();
    if (!baseline) return found;
    for (const row of baseline) {
        for (const cell of row) {
            if (typeof cell === 'string' && (cell === 'II' || cell === 'III' || cell === 'IV' || cell === 'V')) {
                found.add(cell);
            }
        }
    }
    return found;
}

export function generateRoster(opts: GenerateRosterOptions): GenerateResult {
    const {
        year, month, personnel,
        cutoffDay = 0,
        requiredPerDay = DEFAULT_REQUIRED_PER_DAY,
        baselinePattern = null,
        isTni = false,
        existingRoster = null,
        prevMonthTail = null,
    } = opts;

    const daysInMonth = daysInMonthCalendar(year, month);
    const initials = personnel.map(p => p.id);
    const priorityOrder = opts.priorityOrder ?? [...initials];

    // ===== TNI MODE =====
    if (isTni) {
        const roster: Record<string, RosterCell[]> = {};
        for (const p of personnel) {
            roster[p.id] = Array.from({ length: daysInMonth }, () => ({
                status: 'TNI', locked: false,
            }));
        }
        // Mark leaves untuk TNI personnel
        for (const p of personnel) {
            for (let d = 1; d <= daysInMonth; d++) {
                if (personnelIsOnLeave(p.leaves, d)) {
                    roster[p.id][d - 1].status = personnelLeaveCategory(p.leaves, d);
                }
            }
        }
        return {
            success: true, year, month, daysInMonth,
            personnel, roster, mode: 'tni',
            cutoffDay: 0, requiredPerDay, isTni: true,
        };
    }

    // ===== MULTI-SHIFT DETECTION =====
    const multiShiftTokens = scanMultiShiftTokens(baselinePattern);
    const isMultiShift = multiShiftTokens.size > 0;

    // Multi-shift + cutoff_day > 0: engine MVP-1.3 belum support
    if (isMultiShift && cutoffDay > 0) {
        const tokensStr = [...multiShiftTokens].sort((a, b) => a.length - b.length).join(', ');
        return {
            success: false,
            year, month, daysInMonth, personnel,
            roster: {},
            mode: '' as RosterMode,
            cutoffDay, requiredPerDay, isTni: false,
            errorMessage:
                'RE-GENERATE multi-shift belum di-support.\n\n'
                + `Bandara ini memakai pola multi-shift (${tokensStr}). Engine MVP-1.3 `
                + 'hanya bisa apply baseline penuh + tambah cuti, BUKAN re-generate hari '
                + 'future setelah cutoff.\n\n'
                + 'Solusi: edit roster secara manual via tombol swap antar personel, '
                + 'atau hapus cutoff override (set ke 0) lalu generate ulang dari awal.',
        };
    }

    // ===== PRE-CHECK: cukup personel kah? =====
    const insufficient: Array<[number, number]> = [];
    const startCheckDay = cutoffDay > 0 ? cutoffDay + 1 : 1;
    for (let d = startCheckDay; d <= daysInMonth; d++) {
        const avail = personnel.filter(p => !personnelIsOnLeave(p.leaves, d)).length;
        if (avail < requiredPerDay) {
            insufficient.push([d, avail]);
        }
    }
    if (insufficient.length > 0) {
        const lines = [
            `TIDAK CUKUP PERSONEL untuk generate roster ${String(month).padStart(2, '0')}/${year}.`,
            `Aturan: minimum ${requiredPerDay} personel on-duty per hari.`,
            'Hari yang bermasalah:',
        ];
        for (const [day, count] of insufficient) {
            lines.push(`  - Tanggal ${String(day).padStart(2, '0')}: hanya ${count} personel tersedia`);
        }
        return {
            success: false, year, month, daysInMonth, personnel,
            roster: {},
            mode: '' as RosterMode,
            cutoffDay, requiredPerDay, isTni: false,
            errorMessage: lines.join('\n'),
            insufficientDays: insufficient,
        };
    }

    // ===== FRMS FEASIBILITY PRE-CHECK =====
    interface InfeasibleWindow {
        start: number; end: number; available: number; needed: number;
    }
    const infeasibleWindows: InfeasibleWindow[] = [];
    for (let d = startCheckDay; d <= daysInMonth - 6; d++) {
        for (const p of personnel) {
            let cutiInWindow = 0;
            for (let day = d; day < d + 7; day++) {
                if (personnelIsOnLeave(p.leaves, day)) cutiInWindow++;
            }
            const nonCutiDays = 7 - cutiInWindow;
            if (nonCutiDays < 2) continue;

            let totalPersonDaysInWindow = 0;
            for (let day = d; day < d + 7; day++) {
                const active = personnel.filter(pp => !personnelIsOnLeave(pp.leaves, day)).length;
                totalPersonDaysInWindow += active;
            }
            const personDaysOffAvailable = totalPersonDaysInWindow - (7 * requiredPerDay);
            const activePersonnelInWindow = personnel.filter(pp => {
                for (let day = d; day < d + 7; day++) {
                    if (!personnelIsOnLeave(pp.leaves, day)) return true;
                }
                return false;
            }).length;
            const minLiburNeeded = 2 * activePersonnelInWindow;
            if (personDaysOffAvailable < minLiburNeeded) {
                infeasibleWindows.push({
                    start: d, end: d + 6,
                    available: personDaysOffAvailable,
                    needed: minLiburNeeded,
                });
                break;
            }
        }
    }
    if (infeasibleWindows.length > 0) {
        const lines = [
            'PELANGGARAN FRMS terdeteksi: jadwal tidak dapat memenuhi aturan minimum 2 hari libur per 7 hari.',
            'Aturan AirNav: setiap personel min 2 hari libur per 7 hari kalender.',
            'Window yang bermasalah:',
        ];
        for (const w of infeasibleWindows.slice(0, 5)) {
            lines.push(`  - Hari ${w.start}-${w.end}: tersedia ${w.available} person-days libur, dibutuhkan ${w.needed}`);
        }
        lines.push('');
        lines.push('Saran: kurangi jumlah personel yang cuti bersamaan, atau ajukan pengecualian FRMS.');
        return {
            success: false, year, month, daysInMonth, personnel,
            roster: {},
            mode: '' as RosterMode,
            cutoffDay, requiredPerDay, isTni: false,
            errorMessage: lines.join('\n'),
        };
    }

    // ===== INIT ROSTER =====
    const roster: Record<string, RosterCell[]> = {};
    for (const p of personnel) {
        roster[p.id] = Array.from({ length: daysInMonth }, () => ({
            status: '-', locked: false,
        }));
    }

    // ===== INIT STATE =====
    const state: Record<string, GreedyState> = {};
    for (const ini of initials) {
        state[ini] = { consec_work: 0, consec_off: 0, total_work: 0, last_work_day: 0 };
    }

    // ===== SEED STATE DARI prevMonthTail (v4.1 cross-month) =====
    if (prevMonthTail) {
        for (const ini of initials) {
            const tail = prevMonthTail[ini] || [];
            if (tail.length === 0) continue;
            const s = state[ini];
            for (const status of tail) {
                if ((SHIFT_TOKENS as readonly string[]).includes(status)) {
                    s.consec_work += 1;
                    s.consec_off = 0;
                    s.total_work += 1;
                } else if (status === '-') {
                    s.consec_off += 1;
                    s.consec_work = 0;
                } else {
                    // CUTI/SAKIT/DIKLAT/OTHERS/TNI
                    s.consec_off += 1;
                    s.consec_work = 0;
                }
            }
            // total_work direset di awal bulan baru
            s.total_work = 0;
        }
    }

    // ============ PARTIAL RE-GENERATE PATH ============
    if (cutoffDay > 0 && existingRoster) {
        // Copy past days (1..cutoff_day) dari existing_roster
        for (const p of personnel) {
            if (!existingRoster[p.id]) continue;
            for (let d = 1; d <= Math.min(cutoffDay, daysInMonth); d++) {
                const oldCell = existingRoster[p.id][d - 1];
                roster[p.id][d - 1] = { status: oldCell.status, locked: true };
                const s = state[p.id];
                if ((SHIFT_TOKENS as readonly string[]).includes(oldCell.status)) {
                    s.consec_work += 1;
                    s.consec_off = 0;
                    s.total_work += 1;
                    s.last_work_day = d;
                } else if (oldCell.status === '-') {
                    s.consec_off += 1;
                    s.consec_work = 0;
                } else {
                    s.consec_work = 0;
                    s.consec_off += 1;
                }
            }
        }
        // Mark leave untuk future days
        for (const p of personnel) {
            for (let d = cutoffDay + 1; d <= daysInMonth; d++) {
                if (personnelIsOnLeave(p.leaves, d)) {
                    roster[p.id][d - 1].status = personnelLeaveCategory(p.leaves, d);
                }
            }
        }
        // Greedy untuk future
        for (let d = cutoffDay + 1; d <= daysInMonth; d++) {
            assignDayGreedy(d, personnel, roster, state, priorityOrder, requiredPerDay, prevMonthTail);
        }
        return {
            success: true, year, month, daysInMonth, personnel,
            roster, mode: 'partial',
            cutoffDay, requiredPerDay, isTni: false,
        };
    }

    // ============ FRESH GENERATE (cutoff_day == 0) ============
    // Mark CUTI untuk semua hari
    for (const p of personnel) {
        for (let d = 1; d <= daysInMonth; d++) {
            if (personnelIsOnLeave(p.leaves, d)) {
                roster[p.id][d - 1].status = personnelLeaveCategory(p.leaves, d);
            }
        }
    }

    // Decide baseline vs template vs greedy
    let hasPartialLeave = false;
    const fullyActive: Personnel[] = [];
    for (const p of personnel) {
        if (personnelIsOnLeaveEntireMonth(p.leaves, daysInMonth)) {
            // Full-leave personnel — skip dari kategori manapun
        } else if (!personnelHasAnyLeave(p.leaves)) {
            fullyActive.push(p);
        } else {
            hasPartialLeave = true;
        }
    }

    // Order personnel by priorityOrder so pattern row 0 → highest priority
    // personnel. Stable assignment: personnel ke-i selalu dapat pattern
    // baselinePattern[i % length] (modulo loop) — repeat untuk overflow.
    const orderedPersonnel = [...personnel].sort((a, b) => {
        const ia = priorityOrder.indexOf(a.id);
        const ib = priorityOrder.indexOf(b.id);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    // ---- MULTI-SHIFT VIEW-ONLY PATH (PERMISSIVE) ----
    // Permissive: selalu apply baseline kalau ada, auto-fit via modulo loop.
    //  - personnel.length > baseline.length → repeat pattern (parallel teams)
    //  - personnel.length < baseline.length → first N pattern dipakai
    //  - personnel.length == baseline.length → 1:1 mapping (original behavior)
    if (isMultiShift && baselinePattern && baselinePattern.length > 0) {
        let ok = true;
        for (let i = 0; i < orderedPersonnel.length; i++) {
            const p = orderedPersonnel[i];
            const pat = baselinePattern[i % baselinePattern.length];
            if (pat.length < daysInMonth) { ok = false; break; }
            for (let d = 1; d <= daysInMonth; d++) {
                const cell = roster[p.id][d - 1];
                if (isLeaveStatus(cell.status)) continue;
                const src = pat[d - 1];
                // Preserve I/II/III/IV/V/-, anything else → '-'
                cell.status = ((SHIFT_TOKENS as readonly string[]).includes(src) || src === '-') ? src : '-';
            }
        }
        if (ok) {
            return {
                success: true, year, month, daysInMonth, personnel,
                roster, mode: 'baseline-multishift',
                cutoffDay: 0, requiredPerDay, isTni: false,
            };
        }
    }

    // ---- PATH 1: airport-provided baseline (single-shift, PERMISSIVE) ----
    if (baselinePattern && !hasPartialLeave
        && fullyActive.length === personnel.length
        && baselinePattern.length > 0) {
        let ok = true;
        for (let i = 0; i < orderedPersonnel.length; i++) {
            const p = orderedPersonnel[i];
            const pat = baselinePattern[i % baselinePattern.length];
            if (pat.length < daysInMonth) { ok = false; break; }
            for (let d = 1; d <= daysInMonth; d++) {
                const cell = roster[p.id][d - 1];
                if (isLeaveStatus(cell.status)) continue;
                const src = pat[d - 1];
                // Single-shift: preserve 'I' & '-', reset others
                cell.status = (src === 'I' || src === '-') ? src : '-';
            }
        }
        if (ok) {
            return {
                success: true, year, month, daysInMonth, personnel,
                roster, mode: 'baseline',
                cutoffDay: 0, requiredPerDay, isTni: false,
            };
        }
    }

    // ---- PATH 2: built-in templates ----
    if (!hasPartialLeave) {
        const nActive = fullyActive.length;
        const template = getTemplate(nActive, daysInMonth);
        if (template) {
            for (let i = 0; i < fullyActive.length; i++) {
                const p = fullyActive[i];
                const pat = template[i];
                for (let d = 1; d <= daysInMonth; d++) {
                    if (isLeaveStatus(roster[p.id][d - 1].status)) continue;
                    roster[p.id][d - 1].status = pat[d - 1];
                }
            }
            return {
                success: true, year, month, daysInMonth, personnel,
                roster, mode: 'template',
                cutoffDay: 0, requiredPerDay, isTni: false,
            };
        }
    }

    // ---- PATH 3: GREEDY ----
    for (let d = 1; d <= daysInMonth; d++) {
        assignDayGreedy(d, personnel, roster, state, priorityOrder, requiredPerDay, prevMonthTail);
    }
    return {
        success: true, year, month, daysInMonth, personnel,
        roster, mode: 'greedy',
        cutoffDay: 0, requiredPerDay, isTni: false,
    };
}
