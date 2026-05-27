/**
 * Control Allowance Engine — types only.
 *
 * Split dari old roster-engine/control-allowance.ts (split-engine refactor).
 * Logic functions tinggal di ./control-allowance.ts.
 */

import type { GenerateResult } from '../roster-engine/types';
import type { UnitConfig } from '../airport-data/types';

// ============================================================
// PER-PERSONNEL ALLOWANCE ROW
// ============================================================

export interface PersonnelAllowance {
    personnel_id: string;       // engine key (= initial dalam Python)
    initial: string;
    name: string;
    kontrol_minutes: number;
    kontrol_hours: number;
    constant_per_hour: number;
    allowance_rp: number;       // regular only (kontrol_hours × constant)

    // Step 9 — Jam Tambahan (Advance/Extend) additions.
    // Default 0 kalau tidak ada data overtime. Rate SAMA dengan reguler.
    advance_minutes: number;
    extend_minutes: number;
    advance_hours: number;
    extend_hours: number;
    total_hours: number;        // kontrol_hours + advance_hours + extend_hours
    total_allowance_rp: number; // total_hours × constant
}

// ============================================================
// SUMMARY
// ============================================================

export interface AllowanceSummary {
    n_personnel: number;
    total_kontrol_hours: number;     // regular only
    total_advance_hours: number;
    total_extend_hours: number;
    total_hours_all: number;         // regular + advance + extend
    total_allowance: number;         // regular only — legacy field, retained
    total_allowance_all: number;     // regular + overtime tunjangan
    avg_allowance: number;           // avg regular per personnel (legacy)
}

// ============================================================
// OVERTIME INPUT
// ============================================================

/**
 * Jam Tambahan input shape. Match dengan row di
 * public.atc_overtime (lihat supabase/migrations/20260527_overtime.sql).
 *
 * Optional di ComputeAllowanceOptions — kalau caller tidak kirim,
 * advance/extend semua 0 dan total_* sama dengan regular_*.
 */
export interface OvertimeInput {
    personnel_id: string;
    type: 'ADVANCE' | 'EXTEND';
    duration_min: number;
}

// ============================================================
// COMPUTE OPTIONS + RESULT
// ============================================================

export interface ComputeAllowanceOptions {
    airportName: string;
    result: GenerateResult;
    unitConfig: UnitConfig | null | undefined;
    priorityOrder: string[];
    nameLookup?: Record<string, string>;
    nikLookup?: Record<string, string>;
    rosterStatus?: string;
    /** Jam Tambahan rows. Optional — default [] (semua personel 0 menit). */
    overtime?: OvertimeInput[];
}

export interface AllowanceResult {
    rows: PersonnelAllowance[];
    summary: AllowanceSummary;
    constant_per_hour: number;
    is_tma: boolean;
    warnings: string[];
    error?: string;
}
