/**
 * Shared DB row shapes — match Supabase tables.
 *
 * Beda dengan src/lib/shared/types.ts (engine-level types untuk
 * Personnel + LeaveRange + RosterCell): file ini cuma untuk shape
 * row dari Supabase. Dipakai bersama oleh Legacy.tsx (Roster
 * generator) + OffRosterTab.tsx (CRUD off-roster).
 *
 * DBPersonnel TIDAK didedupe disini — beberapa caller butuh field
 * berbeda (Legacy butuh airport_code+unit, OffRosterTab cuma
 * branch_code). Keep local where shape diverges.
 */

import type { LeaveCategory } from './types';

/**
 * Row dari table `atc_leaves`. `personnel` adalah join optional dari
 * `personnel(initial, full_name)` — di-load via Supabase select.
 */
export interface DBLeave {
    id: string;
    personnel_id: string;
    airport_code: string;
    unit: string;
    start_date: string;  // YYYY-MM-DD
    end_date: string;
    category: LeaveCategory;
    note?: string | null;
    personnel?: {
        initial?: string;
        full_name?: string;
    } | null;
}
