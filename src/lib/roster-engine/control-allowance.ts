/**
 * Control Allowance — hitung tunjangan per personel per bulan.
 *
 * Port dari Python `control_allowance.py`.
 *
 * ATURAN DOMAIN — "Jam Kontrol" / "Control Hours"
 * Jam Kontrol = waktu Controller + waktu Assistant (Istirahat DIKECUALIKAN).
 *
 * Rumus: tunjangan_rp = jam_kontrol × konstanta_per_jam
 *
 * Konstanta:
 *   - Non-TMA: dari kolom L "Konstanta" (sebelum subsidi)
 *   - 12 TMA: dari kolom R "konstata final"
 */

import type { GenerateResult, Personnel, RollingConfig, UnitConfig } from './types';
import {
    POSITION_KONTROL, POSITION_ASISTEN, SHIFT_TOKENS,
} from './types';
import { computeMonthlyRolling, computeRecap, type DailyRolling } from './rolling';
import { getCAConstant } from './airport-config-loader';

const SHIFT_SET = new Set<string>(SHIFT_TOKENS as readonly string[]);

// ============================================================
// HELPER: Jam kontrol per shift dari rolling config
// ============================================================

/**
 * Hitung total menit Jam Kontrol (Controller + Assistant) untuk 1 shift,
 * untuk SATU personel.
 *
 * Per rotasi simetris, semua personel dapat porsi Kontrol+Asisten yang sama,
 * jadi cukup hitung untuk personnel index 0.
 *
 * Returns 0 kalau rolling null atau positions kosong.
 */
export function kontrolMinutesPerShift(rolling: RollingConfig | null | undefined): number {
    if (!rolling || !rolling.positions || rolling.positions.length === 0) return 0;

    // Resolve durations
    let durations: number[];
    if (rolling.slot_durations && rolling.slot_durations.some(d => d > 0)) {
        durations = rolling.slot_durations;
    } else {
        durations = Array(rolling.n_slots).fill(rolling.slot_duration_min);
    }

    let total = 0;
    for (let slotIdx = 0; slotIdx < rolling.positions.length; slotIdx++) {
        if (slotIdx >= durations.length) break;
        const slotPositions = rolling.positions[slotIdx];
        if (!slotPositions || slotPositions.length === 0) continue;
        const pos = slotPositions[0];  // personnel idx 0
        if (pos === POSITION_KONTROL || pos === POSITION_ASISTEN) {
            total += durations[slotIdx];
        }
        // POSITION_ISTIRAHAT → tidak dihitung (aturan domain)
    }
    return total;
}

// ============================================================
// COMPUTE JAM KONTROL TOTALS PER PERSONNEL
// ============================================================

/**
 * Hitung total menit Jam Kontrol per personel sepanjang bulan,
 * via monthly_rolling (lebih akurat per-slot).
 */
export function computeMonthlyKontrolMinutes(
    monthlyRolling: Record<number, DailyRolling>,
): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const dailyKey of Object.keys(monthlyRolling)) {
        const daily = monthlyRolling[Number(dailyKey)];
        const recap = computeRecap(daily);
        for (const [ini, posdata] of Object.entries(recap)) {
            const kontrol = posdata[POSITION_KONTROL] || 0;
            const asisten = posdata[POSITION_ASISTEN] || 0;
            totals[ini] = (totals[ini] || 0) + kontrol + asisten;
        }
    }
    return totals;
}

/**
 * Hitung total menit Jam Kontrol per personel via roster langsung
 * (tanpa harus run compute_monthly_rolling dulu). Lebih toleran untuk
 * multi-shift airport di mana monthly_rolling kadang gagal compute.
 *
 * Setiap hari personel punya shift token → tambah kontrolMinutesPerShift.
 */
export function computeKontrolMinutesFromRoster(
    result: GenerateResult,
    unitConfig: UnitConfig | null | undefined,
): Record<string, number> {
    if (!unitConfig?.rolling) return {};
    const perShift = kontrolMinutesPerShift(unitConfig.rolling);
    const totals: Record<string, number> = {};
    for (let day = 1; day <= result.daysInMonth; day++) {
        for (const ini of Object.keys(result.roster)) {
            if (SHIFT_SET.has(result.roster[ini][day - 1].status)) {
                totals[ini] = (totals[ini] || 0) + perShift;
            }
        }
    }
    // Round to int
    for (const ini of Object.keys(totals)) {
        totals[ini] = Math.round(totals[ini]);
    }
    return totals;
}

// ============================================================
// VALIDATION GUARDS
// ============================================================

export interface PersonnelAllowance {
    personnel_id: string;       // engine key (= initial dalam Python)
    initial: string;
    name: string;
    kontrol_minutes: number;
    kontrol_hours: number;
    constant_per_hour: number;
    allowance_rp: number;
}

export interface AllowanceSummary {
    n_personnel: number;
    total_kontrol_hours: number;
    total_allowance: number;
    avg_allowance: number;
}

function validateInputs(
    rows: PersonnelAllowance[],
    airportName: string,
    unitConfig: UnitConfig | null | undefined,
    nameLookup: Record<string, string>,
    nikLookup: Record<string, string>,
    rosterStatus: string,
): string[] {
    const warnings: string[] = [];

    // Guard 0: roster status — kalau bukan FINAL, warning tegas
    if (rosterStatus && rosterStatus !== 'FINAL') {
        warnings.push(
            `🚧 Roster ini masih **${rosterStatus}** (belum FINAL). `
            + 'Tunjangan yang dihitung BOLEH dipakai untuk preview, tapi '
            + 'JANGAN di-submit ke HR/finance sebelum roster di-mark FINAL.',
        );
    }

    // Guard 1: rolling slot duration valid (mencegah Rp 0 silent bug)
    if (unitConfig?.rolling) {
        const r = unitConfig.rolling;
        let total = 0;
        if (r.slot_durations && r.slot_durations.some(d => d > 0)) {
            total = r.slot_durations.reduce((a, b) => a + b, 0);
        } else {
            total = r.n_slots * r.slot_duration_min;
        }
        if (total <= 0) {
            warnings.push(
                `⚠️ Data rolling untuk ${airportName}/${unitConfig.unit} BERMASALAH: `
                + 'slot_durations semua 0 → Jam Kontrol = 0. '
                + 'Tunjangan akan Rp 0 untuk semua personel.',
            );
        } else if (r._slot_duration_source) {
            warnings.push(
                `ℹ️ Rolling slot durations untuk ${airportName}/${unitConfig.unit} `
                + `adalah ESTIMASI (${r._slot_duration_source}). `
                + 'Konfirmasi ke ops sebelum dipakai payroll.',
            );
        }
    }

    // Guard 2: personnel tanpa nama lengkap
    if (rows.length > 0) {
        const noName = rows
            .filter(r => r.initial === r.name || !r.name.trim())
            .map(r => r.initial);
        if (noName.length > 0) {
            const sample = noName.slice(0, 5).join(', ');
            const more = noName.length > 5 ? '…' : '';
            warnings.push(
                `⚠️ ${noName.length} personel tidak punya nama lengkap (cuma inisial): ${sample}${more}.`,
            );
        }
    }

    // Guard 3: personnel tanpa NIK
    if (rows.length > 0 && Object.keys(nikLookup).length > 0) {
        const noNik = rows
            .filter(r => !(nikLookup[r.personnel_id] || '').trim())
            .map(r => r.initial);
        if (noNik.length > 0) {
            const sample = noNik.slice(0, 5).join(', ');
            const more = noNik.length > 5 ? '…' : '';
            warnings.push(
                `⚠️ ${noNik.length} personel tanpa NIK: ${sample}${more}. `
                + 'NIK biasanya diperlukan untuk payroll/finance.',
            );
        }
    } else if (rows.length > 0 && Object.keys(nikLookup).length === 0) {
        warnings.push(
            'ℹ️ NIK belum di-load — pastikan field NIK ada sebelum dipakai payroll.',
        );
    }

    // Guard 4: personnel dengan 0 jam kontrol
    if (rows.length > 0) {
        const zeroHours = rows.filter(r => r.kontrol_minutes === 0).map(r => r.initial);
        if (zeroHours.length > 0) {
            const sample = zeroHours.slice(0, 5).join(', ');
            const more = zeroHours.length > 5 ? '…' : '';
            warnings.push(
                `ℹ️ ${zeroHours.length} personel dengan 0 Jam Kontrol bulan ini `
                + `(tidak masuk shift): ${sample}${more}. Pastikan ini disengaja.`,
            );
        }
    }

    return warnings;
}

// ============================================================
// MAIN COMPUTE
// ============================================================

export interface ComputeAllowanceOptions {
    airportName: string;
    result: GenerateResult;
    unitConfig: UnitConfig | null | undefined;
    priorityOrder: string[];
    nameLookup?: Record<string, string>;
    nikLookup?: Record<string, string>;
    rosterStatus?: string;
}

export interface AllowanceResult {
    rows: PersonnelAllowance[];
    summary: AllowanceSummary;
    constant_per_hour: number;
    is_tma: boolean;
    warnings: string[];
    error?: string;
}

export function computeAllowanceTable(opts: ComputeAllowanceOptions): AllowanceResult {
    const {
        airportName, result, unitConfig, priorityOrder,
        nameLookup = {}, nikLookup = {},
        rosterStatus = 'DRAFT',
    } = opts;

    // Constant lookup
    const constInfo = getCAConstant(airportName);
    if (!constInfo) {
        return {
            rows: [], summary: { n_personnel: 0, total_kontrol_hours: 0, total_allowance: 0, avg_allowance: 0 },
            constant_per_hour: 0, is_tma: false, warnings: [],
            error: `Konstanta tidak ditemukan untuk '${airportName}'`,
        };
    }

    // Compute kontrol minutes: prefer monthly_rolling kalau bisa, fallback ke roster direct
    let kontrolMin: Record<string, number>;
    if (unitConfig?.rolling) {
        try {
            const monthly = computeMonthlyRolling({
                result, priorityOrder,
                shiftStartUtc: unitConfig.rolling.shift_start_utc,
                nSlots: unitConfig.rolling.n_slots,
                slotDurationMin: unitConfig.rolling.slot_duration_min,
                positionsPerSlot: unitConfig.rolling.positions,
                slotDurations: unitConfig.rolling.slot_durations,
                nPersonnel: unitConfig.rolling.n_personnel,
            });
            if (Object.keys(monthly).length > 0) {
                kontrolMin = computeMonthlyKontrolMinutes(monthly);
            } else {
                kontrolMin = computeKontrolMinutesFromRoster(result, unitConfig);
            }
        } catch {
            kontrolMin = computeKontrolMinutesFromRoster(result, unitConfig);
        }
    } else {
        kontrolMin = {};
    }

    // Build rows
    const constant = constInfo.constant_per_hour;
    const rows: PersonnelAllowance[] = [];
    const entries = Object.entries(kontrolMin).sort((a, b) => b[1] - a[1]);
    for (const [ini, minutes] of entries) {
        const hours = minutes / 60.0;
        const allowance = hours * constant;
        rows.push({
            personnel_id: ini,
            initial: ini,
            name: nameLookup[ini] || ini,
            kontrol_minutes: minutes,
            kontrol_hours: hours,
            constant_per_hour: constant,
            allowance_rp: allowance,
        });
    }

    const warnings = validateInputs(
        rows, airportName, unitConfig, nameLookup, nikLookup, rosterStatus,
    );

    return {
        rows,
        summary: summarizeAllowance(rows),
        constant_per_hour: constant,
        is_tma: constInfo.is_tma,
        warnings,
    };
}

export function summarizeAllowance(rows: PersonnelAllowance[]): AllowanceSummary {
    if (rows.length === 0) {
        return { n_personnel: 0, total_kontrol_hours: 0, total_allowance: 0, avg_allowance: 0 };
    }
    const totalRp = rows.reduce((s, r) => s + r.allowance_rp, 0);
    const totalHours = rows.reduce((s, r) => s + r.kontrol_hours, 0);
    return {
        n_personnel: rows.length,
        total_kontrol_hours: totalHours,
        total_allowance: totalRp,
        avg_allowance: totalRp / rows.length,
    };
}
