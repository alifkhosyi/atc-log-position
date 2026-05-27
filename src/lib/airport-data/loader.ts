/**
 * Loader untuk reference data airport-configs.json + ca-constants.json.
 *
 * Data file JSON-nya tidak punya `airport_code` (legacy dari Python),
 * jadi kita derive dari `airport_name` (UPPER, no spaces).
 *
 * Renamed dari roster-engine/airport-config-loader.ts (split-engine refactor).
 */

import airportConfigsRaw from './data/airport-configs.json';
import caConstantsRaw from './data/ca-constants.json';
import type { AirportConfig, UnitConfig, CAConstantInfo } from './types';

// ============================================================
// CODE DERIVATION
// ============================================================

/**
 * Derive airport code dari name.
 * 'Ambon' → 'AMBON', 'Tanjung Pinang' → 'TANJUNG_PINANG', 'Jatsc APP' → 'JATSC_APP'.
 *
 * Match dengan Python `airport_code = airport_name.upper().replace(" ", "_")`.
 */
export function deriveAirportCode(name: string): string {
    return name.toUpperCase().replace(/\s+/g, '_');
}

// ============================================================
// AIRPORTS — load + index
// ============================================================

/**
 * Returns AirportConfig dengan `airport_code` ter-derive.
 * Cached at module load.
 */
const _airports: AirportConfig[] = (airportConfigsRaw as any[]).map(entry => ({
    airport_code: deriveAirportCode(entry.airport_name),
    airport_name: entry.airport_name,
    branch_code: entry.branch_code,
    is_tma: entry.is_tma ?? false,
    units: entry.units,
}));

const _airportsByCode: Record<string, AirportConfig> = {};
const _airportsByBranch: Record<string, AirportConfig> = {};
for (const a of _airports) {
    _airportsByCode[a.airport_code] = a;
    if (a.branch_code) {
        _airportsByBranch[a.branch_code.toUpperCase()] = a;
    }
}

/** Returns all 73 airport configs. */
export function listAirports(): AirportConfig[] {
    return _airports;
}

/**
 * Lookup airport by code. Accepts BOTH:
 *  - airport_code (derived, e.g. 'AMBON'); or
 *  - branch_code (ICAO 4-letter, e.g. 'WAPP', 'WARR').
 * Returns undefined kalau ga ada.
 */
export function getAirport(code: string): AirportConfig | undefined {
    const upper = code.toUpperCase();
    return _airportsByCode[upper] || _airportsByBranch[upper];
}

/**
 * Explicit branch-code lookup (ICAO 4-letter only).
 * Bridges Supabase `branches.code` / `accounts.branch_code` → engine config.
 */
export function getAirportByBranchCode(branchCode: string): AirportConfig | undefined {
    return _airportsByBranch[branchCode.toUpperCase()];
}

/** Find unit di airport. Returns first unit kalau unit name ga match. */
export function getUnit(
    airport: AirportConfig,
    unitName: string,
): UnitConfig | undefined {
    const match = airport.units.find(
        u => u.unit.toUpperCase() === unitName.toUpperCase(),
    );
    return match || airport.units[0];
}

/**
 * Returns baseline pattern untuk (airport, unit) di bulan dengan jumlah hari tsb.
 *
 * Strategy (match Python `get_baseline_for_month`):
 *   - TNI unit: semua cell = "TNI" regardless of length.
 *   - Kalau days_in_month <= len(row): truncate ke days_in_month.
 *   - Kalau days_in_month > len(row): extend dengan repeat 8-day cycle
 *     (ambil cell dari 8 hari sebelumnya).
 */
export function getBaselineForMonth(
    airportCode: string,
    unitName: string,
    daysInMonthCount: number,
): string[][] | undefined {
    const airport = getAirport(airportCode);
    if (!airport) return undefined;
    const unit = getUnit(airport, unitName);
    if (!unit?.patterns_baseline) return undefined;

    const out: string[][] = [];
    for (const row of unit.patterns_baseline) {
        if (unit.is_tni) {
            out.push(Array(daysInMonthCount).fill('TNI'));
            continue;
        }
        if (daysInMonthCount <= row.length) {
            out.push(row.slice(0, daysInMonthCount));
        } else {
            // Extend dengan 8-day cycle
            const extended = [...row];
            while (extended.length < daysInMonthCount) {
                extended.push(extended[extended.length - 8]);
            }
            out.push(extended.slice(0, daysInMonthCount));
        }
    }
    return out;
}

// ============================================================
// CA CONSTANTS
// ============================================================

const _caConstants: Record<string, CAConstantInfo> = caConstantsRaw as any;

/**
 * Returns CA constant info untuk airport (by display name, e.g. 'Ambon').
 * Returns undefined kalau ga ada.
 */
export function getCAConstant(airportName: string): CAConstantInfo | undefined {
    return _caConstants[airportName];
}

/** Returns semua CA constants. */
export function listCAConstants(): Record<string, CAConstantInfo> {
    return _caConstants;
}
