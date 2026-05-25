/**
 * FRMS (Fatigue Risk Management System) Rules.
 *
 * Port dari Python `frms_rules.py`.
 *
 * Encodes scheduling limits dari dokumen AirNav Indonesia:
 * "Kebutuhan Personel Pemandu Lalu Lintas Penerbangan Tahun 2022 - 2026"
 *
 * Reference: ICAO Annex 11, ICAO Doc 9966, MoS Part 69-01, PR 15 Tahun 2022.
 */

// ============================================================
// CLASSIFICATION
// ============================================================

export const ServiceClass = {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
    VERY_LOW: 'VERY_LOW',
    EXTREMELY_LOW: 'EXTREMELY_LOW',
} as const;

export type ServiceClass = typeof ServiceClass[keyof typeof ServiceClass];

/** Effective working hours per year (Tabel 2). */
export const EFFECTIVE_HOURS_PER_YEAR: Record<ServiceClass, number> = {
    HIGH: 1128,       // 47 weeks × 24 hours
    MEDIUM: 1504,     // 47 weeks × 32 hours
    LOW: 1504,
    VERY_LOW: 1504,
    EXTREMELY_LOW: 1504,
};

// ============================================================
// SCHEDULING LIMITS (FRMS strict)
// ============================================================

export interface SchedulingLimits {
    // Shift hours
    max_shift_hours_standard: number;
    max_shift_hours_exception: number;
    max_night_shift_hours: number;
    // Consecutive work days
    max_consecutive_days_standard: number;
    max_consecutive_days_exception: number;
    min_rest_after_max_consecutive_standard_hours: number;
    min_rest_after_max_consecutive_exception_hours: number;
    // Hours per week
    max_hours_per_week_standard: number;
    max_hours_per_week_exception: number;
    // Time-in-position
    max_time_in_position_standard_minutes: number;
    max_time_in_position_medium_minutes: number;
    max_time_in_position_low_minutes: number;
    min_break_after_2h_minutes: number;
    min_break_after_3h_minutes: number;
    min_break_after_4h_minutes: number;
    // Inter-shift rest
    min_rest_between_shifts_hours: number;
    // Days off per week
    min_days_off_per_week: number;
    // Night shift
    night_shift_start_hour_utc: number;
    night_shift_end_hour_utc: number;
    min_rest_after_1_night_shift_hours: number;
    min_rest_after_2_night_shifts_hours: number;
    max_consecutive_night_shifts: number;
    // Minimum personnel per unit
    min_personnel_per_unit: number;
    // Set crew per unit (TWR aerodrome control position)
    twr_set_crew: number;
}

export const DEFAULT_LIMITS: SchedulingLimits = {
    max_shift_hours_standard: 8,
    max_shift_hours_exception: 12,
    max_night_shift_hours: 10,

    max_consecutive_days_standard: 5,
    max_consecutive_days_exception: 6,
    min_rest_after_max_consecutive_standard_hours: 48,
    min_rest_after_max_consecutive_exception_hours: 60,

    max_hours_per_week_standard: 40,
    max_hours_per_week_exception: 60,

    max_time_in_position_standard_minutes: 120,
    max_time_in_position_medium_minutes: 180,
    max_time_in_position_low_minutes: 240,
    min_break_after_2h_minutes: 30,
    min_break_after_3h_minutes: 45,
    min_break_after_4h_minutes: 60,

    min_rest_between_shifts_hours: 11,

    min_days_off_per_week: 2,

    night_shift_start_hour_utc: 1.5,    // 0130 UTC
    night_shift_end_hour_utc: 5.5,      // 0529 UTC
    min_rest_after_1_night_shift_hours: 30,
    min_rest_after_2_night_shifts_hours: 54,
    max_consecutive_night_shifts: 2,

    min_personnel_per_unit: 5,

    twr_set_crew: 2,
};

// ============================================================
// HELPERS — return limit per service class
// ============================================================

export function isEligibleForExtendedLimits(sc: ServiceClass): boolean {
    return sc === 'LOW' || sc === 'MEDIUM' || sc === 'VERY_LOW' || sc === 'EXTREMELY_LOW';
}

export function getMaxConsecutiveDays(sc: ServiceClass): number {
    return isEligibleForExtendedLimits(sc)
        ? DEFAULT_LIMITS.max_consecutive_days_exception  // 6
        : DEFAULT_LIMITS.max_consecutive_days_standard;  // 5
}

export function getMaxHoursPerWeek(sc: ServiceClass): number {
    return isEligibleForExtendedLimits(sc)
        ? DEFAULT_LIMITS.max_hours_per_week_exception    // 60
        : DEFAULT_LIMITS.max_hours_per_week_standard;    // 40
}

export function getMaxShiftHours(sc: ServiceClass): number {
    return isEligibleForExtendedLimits(sc)
        ? DEFAULT_LIMITS.max_shift_hours_exception       // 12
        : DEFAULT_LIMITS.max_shift_hours_standard;       // 8
}

export function getMaxTimeInPositionMinutes(sc: ServiceClass): number {
    if (sc === 'LOW' || sc === 'VERY_LOW' || sc === 'EXTREMELY_LOW') {
        return DEFAULT_LIMITS.max_time_in_position_low_minutes;     // 240
    }
    if (sc === 'MEDIUM') {
        return DEFAULT_LIMITS.max_time_in_position_medium_minutes;  // 180
    }
    return DEFAULT_LIMITS.max_time_in_position_standard_minutes;    // 120
}

export function getMinBreakAfterPositionMinutes(sc: ServiceClass): number {
    if (sc === 'LOW' || sc === 'VERY_LOW' || sc === 'EXTREMELY_LOW') {
        return DEFAULT_LIMITS.min_break_after_4h_minutes;   // 60
    }
    if (sc === 'MEDIUM') {
        return DEFAULT_LIMITS.min_break_after_3h_minutes;   // 45
    }
    return DEFAULT_LIMITS.min_break_after_2h_minutes;       // 30
}

export function getMinRestAfterMaxConsecutiveHours(sc: ServiceClass): number {
    return isEligibleForExtendedLimits(sc)
        ? DEFAULT_LIMITS.min_rest_after_max_consecutive_exception_hours  // 60
        : DEFAULT_LIMITS.min_rest_after_max_consecutive_standard_hours;  // 48
}

// ============================================================
// FORMULA: Personnel needs
// ============================================================

export function computePersonnelNeeds(
    operatingHoursPerDay: number,
    setCrew: number,
    serviceClass: ServiceClass,
): number {
    const effective = EFFECTIVE_HOURS_PER_YEAR[serviceClass];
    const raw = (operatingHoursPerDay * 365 * setCrew) / effective;
    const rounded = Math.ceil(raw);
    return Math.max(rounded, DEFAULT_LIMITS.min_personnel_per_unit);
}
