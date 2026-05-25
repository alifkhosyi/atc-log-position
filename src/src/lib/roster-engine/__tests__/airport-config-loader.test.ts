import { describe, it, expect } from 'vitest';
import {
    deriveAirportCode,
    listAirports,
    getAirport,
    getUnit,
    getBaselineForMonth,
    getCAConstant,
    listCAConstants,
} from '../airport-config-loader';

describe('deriveAirportCode', () => {
    it('uppers + replaces spaces', () => {
        expect(deriveAirportCode('Ambon')).toBe('AMBON');
        expect(deriveAirportCode('Tanjung Pinang')).toBe('TANJUNG_PINANG');
        expect(deriveAirportCode('Jatsc APP')).toBe('JATSC_APP');
        expect(deriveAirportCode('Gunung Sitoli')).toBe('GUNUNG_SITOLI');
    });
});

describe('airport configs', () => {
    it('loads 73 airports', () => {
        expect(listAirports()).toHaveLength(73);
    });

    it('finds Ambon by code', () => {
        const a = getAirport('AMBON');
        expect(a).toBeDefined();
        expect(a!.airport_name).toBe('Ambon');
        expect(a!.units.length).toBeGreaterThanOrEqual(1);
    });

    it('case-insensitive lookup', () => {
        expect(getAirport('ambon')).toBeDefined();
        expect(getAirport('Ambon')).toBeDefined();
    });

    it('returns undefined for non-existent', () => {
        expect(getAirport('ATLANTIS')).toBeUndefined();
    });

    it('finds unit within airport', () => {
        const a = getAirport('AMBON');
        const twr = getUnit(a!, 'TWR');
        expect(twr).toBeDefined();
        expect(twr!.unit).toBe('TWR');
    });
});

describe('baseline pattern', () => {
    it('returns pattern for Ambon TWR June 2026 (30 days)', () => {
        const baseline = getBaselineForMonth('AMBON', 'TWR', 30);
        expect(baseline).toBeDefined();
        if (baseline) {
            // Should have rows per personnel, each 30 days
            expect(baseline.length).toBeGreaterThan(0);
            expect(baseline[0].length).toBe(30);
        }
    });

    it('returns undefined for non-existent airport', () => {
        expect(getBaselineForMonth('ATLANTIS', 'TWR', 30)).toBeUndefined();
    });
});

describe('CA constants', () => {
    it('loads 73 airports', () => {
        const all = listCAConstants();
        expect(Object.keys(all).length).toBe(73);
    });

    it('finds Ambon', () => {
        const c = getCAConstant('Ambon');
        expect(c).toBeDefined();
        expect(c!.constant_per_hour).toBeGreaterThan(0);
        expect(c!.is_tma).toBe(false);
    });

    it('finds TMA airport with is_tma=true', () => {
        const c = getCAConstant('Surabaya');
        expect(c).toBeDefined();
        expect(c!.is_tma).toBe(true);
    });

    it('returns undefined for non-existent', () => {
        expect(getCAConstant('Atlantis')).toBeUndefined();
    });
});
