/**
 * Swap shift between 2 personnel di hari yang sama.
 *
 * Port dari Python `swap_shift()` di roster_generator_v4.py.
 *
 * Validations:
 *   - Tidak swap dengan dirinya sendiri
 *   - Personnel must exist di roster
 *   - Cell tidak locked (past day)
 *   - Tidak swap dengan personel yang sedang cuti/sakit/diklat
 *   - Status A ≠ B (swap tidak berguna)
 *   - After swap, on-duty count tetap = required_per_day
 *   - (Optional) FRMS pre/post check: swap di-reject kalau menyebabkan
 *     pelanggaran FRMS BARU untuk A atau B
 */

import type { Personnel, RosterCell, FrmsIssue } from './types';
import { SHIFT_TOKENS, isLeaveStatus } from './types';
import { type ServiceClass } from './frms-rules';
import { validateFull, splitBySeverity } from './frms-validator';

export interface SwapResult {
    success: boolean;
    message: string;
    /** Kalau success=true, ini roster yang sudah ter-swap (mutated in place). */
    roster?: Record<string, RosterCell[]>;
    /** Kalau swap di-reject karena FRMS, list issues yang BARU muncul. */
    newFrmsIssues?: FrmsIssue[];
}

export interface SwapOptions {
    roster: Record<string, RosterCell[]>;
    personnel: Personnel[];
    personnelA: string;
    personnelB: string;
    day: number;
    requiredPerDay?: number;
    daysInMonth?: number;
    serviceClass?: ServiceClass;
    shiftHours?: number;
}

const SHIFT_SET = new Set<string>(SHIFT_TOKENS as readonly string[]);

export function swapShift(opts: SwapOptions): SwapResult {
    const {
        roster, personnel, personnelA, personnelB, day,
        requiredPerDay = 3,
        daysInMonth, serviceClass, shiftHours = 10,
    } = opts;

    if (personnelA === personnelB) {
        return { success: false, message: 'Tidak bisa swap personel dengan dirinya sendiri.' };
    }
    if (!roster[personnelA] || !roster[personnelB]) {
        return {
            success: false,
            message: `Personel tidak ditemukan: ${personnelA} atau ${personnelB}`,
        };
    }

    const cellA = roster[personnelA][day - 1];
    const cellB = roster[personnelB][day - 1];

    if (cellA.locked || cellB.locked) {
        return {
            success: false,
            message: `Hari ${day} sudah locked (past), tidak bisa di-swap.`,
        };
    }
    if (isLeaveStatus(cellA.status) || isLeaveStatus(cellB.status)) {
        return {
            success: false,
            message: 'Tidak bisa swap dengan personel yang sedang cuti/sakit/diklat/lainnya.',
        };
    }
    if (cellA.status === cellB.status) {
        return {
            success: false,
            message: `Kedua personel punya status sama (${cellA.status}), swap tidak berguna.`,
        };
    }

    // ===== Pre-swap FRMS snapshot (kalau enabled) =====
    const frmsCheckEnabled = daysInMonth !== undefined && serviceClass !== undefined;
    let preErrorKeys = new Set<string>();
    if (frmsCheckEnabled) {
        try {
            const preIssues = validateFull({
                roster, personnel,
                daysInMonth: daysInMonth!,
                serviceClass: serviceClass!,
                shiftHours,
                minOnDuty: requiredPerDay,
            });
            const { errors: preErrs } = splitBySeverity(preIssues);
            preErrorKeys = new Set(
                preErrs
                    .filter(e => e.personnel === personnelA || e.personnel === personnelB)
                    .map(e => `${e.rule}|${e.personnel}|${e.day}`),
            );
        } catch {
            // Validator error → skip FRMS check
        }
    }

    // ===== Perform swap =====
    const tmp = cellA.status;
    cellA.status = cellB.status;
    cellB.status = tmp;

    // Validate: jumlah on-duty di hari ini tetap required_per_day?
    let onDutyCount = 0;
    for (const ini of Object.keys(roster)) {
        if (SHIFT_SET.has(roster[ini][day - 1].status)) onDutyCount++;
    }
    if (onDutyCount !== requiredPerDay) {
        // Rollback
        const back = cellA.status;
        cellA.status = cellB.status;
        cellB.status = back;
        return {
            success: false,
            message: `Setelah swap, jumlah on-duty = ${onDutyCount} (harus ${requiredPerDay}). Swap dibatalkan.`,
        };
    }

    // ===== Post-swap FRMS check =====
    if (frmsCheckEnabled) {
        try {
            const postIssues = validateFull({
                roster, personnel,
                daysInMonth: daysInMonth!,
                serviceClass: serviceClass!,
                shiftHours,
                minOnDuty: requiredPerDay,
            });
            const { errors: postErrs } = splitBySeverity(postIssues);
            const postErrorKeys = postErrs
                .filter(e => e.personnel === personnelA || e.personnel === personnelB);
            const newErrors = postErrorKeys.filter(
                e => !preErrorKeys.has(`${e.rule}|${e.personnel}|${e.day}`),
            );
            if (newErrors.length > 0) {
                // Rollback
                const back = cellA.status;
                cellA.status = cellB.status;
                cellB.status = back;
                const shown = newErrors.slice(0, 3).map(e => `[${e.rule}] ${e.message}`);
                const more = newErrors.length - shown.length;
                let msg = `Swap dibatalkan: menyebabkan ${newErrors.length} pelanggaran FRMS baru:\n  - ${shown.join('\n  - ')}`;
                if (more > 0) msg += `\n  ...dan ${more} pelanggaran lain.`;
                return {
                    success: false,
                    message: msg,
                    newFrmsIssues: newErrors,
                };
            }
        } catch {
            // FRMS validator failed post-swap — surface as warning but allow
            return {
                success: true,
                message: `Berhasil swap ${personnelA} ↔ ${personnelB} di tanggal ${day}. (Peringatan: FRMS post-check gagal dijalankan.)`,
                roster,
            };
        }
    }

    return {
        success: true,
        message: `Berhasil swap ${personnelA} ↔ ${personnelB} di tanggal ${day}.`,
        roster,
    };
}
