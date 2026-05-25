/**
 * Built-in templates (Oksibil-style) untuk roster generator.
 *
 * Port dari Python `get_template()` di roster_generator_v4.py.
 *
 * Templates ini dipakai kalau:
 *   - Tidak ada airport-provided baseline pattern
 *   - Semua personnel "fully active" (tidak ada partial leave)
 *
 * Personnel count yang di-support: 3, 4, 5, 6, 7.
 */

/**
 * Get built-in template untuk (n_active, days).
 * Returns null kalau n_active ga match template yang ada.
 *
 * Output: array of (n_active) rows, masing-masing array dengan length=days.
 */
export function getTemplate(
    nActive: number,
    days: number,
): string[][] | null {
    if (nActive === 7) {
        const patterns7 = [
            'IIII----IIII----IIII--------IIII----IIII----IIII',
            'IIII----IIII--------IIII----IIII----IIII--------',
            'IIII--------IIII----IIII----IIII--------IIII----',
            '----IIII----IIII----IIII--------IIII----IIII----',
            '----IIII----IIII--------IIII----IIII----IIII----',
            '----IIII--------IIII----IIII----IIII--------IIII',
            '--------IIII----IIII----IIII--------IIII----IIII',
        ];
        return patterns7.map(p => p.slice(0, days).split(''));
    }

    if (nActive === 6) {
        const pattern1 = 'IIII----'.repeat(4);
        const pattern2 = '----IIII'.repeat(4);
        const patterns6 = [
            pattern1, pattern1, pattern1,
            pattern2, pattern2, pattern2,
        ];
        return patterns6.map(p => p.slice(0, days).split(''));
    }

    if (nActive === 5) {
        const base = 'II-I-';
        const offsets5 = [0, 3, 1, 4, 2];
        return offsets5.map(ofs => {
            const rotated = base.slice(ofs) + base.slice(0, ofs);
            // Repeat 7x = enough for 31+ days
            return (rotated.repeat(7)).slice(0, days).split('');
        });
    }

    if (nActive === 4) {
        const base = 'III-';
        const offsets4 = [0, 1, 2, 3];
        return offsets4.map(ofs => {
            const rotated = base.slice(ofs) + base.slice(0, ofs);
            return (rotated.repeat(8)).slice(0, days).split('');
        });
    }

    if (nActive === 3) {
        return [
            'I'.repeat(days).split(''),
            'I'.repeat(days).split(''),
            'I'.repeat(days).split(''),
        ];
    }

    return null;
}
