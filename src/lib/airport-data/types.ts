/**
 * Airport reference data types — dipakai oleh roster-engine, rolling-engine,
 * dan ca-engine (read-only metadata dari airport-configs.json + ca-constants.json).
 *
 * Split dari old roster-engine/types.ts (split-engine refactor).
 */

// ============================================================
// ROLLING CONFIG (rotasi posisi intra-shift)
// ============================================================

export interface RollingConfig {
    shift_start_utc: string;       // 'HH:MM'
    n_slots: number;
    slot_duration_min: number;
    /** Per slot: array of [Position] strings. */
    positions: string[][];
    /** Per slot: duration in minutes (kalau heterogen). */
    slot_durations?: number[];
    n_personnel?: number;
    _slot_duration_source?: string;
}

// ============================================================
// UNIT CONFIG (TWR / APP / ACC dst.)
// ============================================================

export interface UnitConfig {
    unit: string;                  // 'TWR' | 'APP' | 'ACC'
    n_personnel: number;
    min_on_duty_baseline: number;
    is_tni: boolean;
    initials?: string[];
    names?: string[];
    niks?: string[];
    rolling?: RollingConfig;
    /**
     * Baseline pattern flat: [personnel_idx][day_idx] -> "I" / "II" / "-" / etc.
     * Match Python field name `patterns_baseline`.
     * Loader truncate/extend ke target days_in_month.
     */
    patterns_baseline?: string[][];
}

// ============================================================
// AIRPORT CONFIG (read-only reference dari data/airport-configs.json)
// ============================================================

export interface AirportConfig {
    airport_code: string;          // 'AMBON', 'OKSIBIL' (derived from name)
    airport_name: string;          // 'Ambon', 'Oksibil'
    branch_code?: string;          // ICAO 4-letter ('WARR', 'WAPP'), bridges ke Supabase branches.code
    is_tma?: boolean;
    units: UnitConfig[];
}

// ============================================================
// CA CONSTANT (read-only reference dari data/ca-constants.json)
// ============================================================

export interface CAConstantInfo {
    excel_name: string;
    constant_per_hour: number;
    source: string;
    is_tma: boolean;
}

// ============================================================
// POSITION (untuk rolling — Control/Assistant/Rest)
// ============================================================

export const POSITION_KONTROL = 'Kontrol';
export const POSITION_ASISTEN = 'Asisten';
export const POSITION_ISTIRAHAT = 'Istirahat';

export type Position =
    | typeof POSITION_KONTROL
    | typeof POSITION_ASISTEN
    | typeof POSITION_ISTIRAHAT;
