// ============================================================
// src/lib/overtime/compute.ts
// ──────────────────────────────────────────────────────────
// Per-personnel aggregation utilities untuk Jam Tambahan.
// Dipakai oleh Tunjangan ATC page (step 9) untuk derive
// advance_hours / extend_hours per personel di bulan tertentu.
//
// No DB access here — pure compute from in-memory entries.
// ============================================================

import type { OvertimeEntry } from "./types"

export interface PersonnelOvertimeAgg {
  personnel_id: string
  advance_min: number
  extend_min: number
  total_min: number
  advance_hours: number
  extend_hours: number
  total_hours: number
  entries: number
}

/**
 * Aggregate overtime entries per personnel.
 * Returns map keyed by personnel_id.
 */
export function computeOvertimeAgg(
  entries: OvertimeEntry[],
): Record<string, PersonnelOvertimeAgg> {
  const out: Record<string, PersonnelOvertimeAgg> = {}

  for (const e of entries) {
    if (!e.personnel_id) continue
    if (!out[e.personnel_id]) {
      out[e.personnel_id] = {
        personnel_id: e.personnel_id,
        advance_min: 0,
        extend_min: 0,
        total_min: 0,
        advance_hours: 0,
        extend_hours: 0,
        total_hours: 0,
        entries: 0,
      }
    }
    const agg = out[e.personnel_id]
    if (e.type === "ADVANCE") agg.advance_min += e.duration_min
    if (e.type === "EXTEND")  agg.extend_min  += e.duration_min
    agg.total_min += e.duration_min
    agg.entries += 1
  }

  // Derive hours
  for (const id of Object.keys(out)) {
    const a = out[id]
    a.advance_hours = a.advance_min / 60
    a.extend_hours  = a.extend_min  / 60
    a.total_hours   = a.total_min   / 60
  }

  return out
}

export interface OvertimeMonthSummary {
  totalEntries: number
  totalMin: number
  advanceEntries: number
  advanceMin: number
  extendEntries: number
  extendMin: number
  uniquePersonnel: number
}

/**
 * Month-level summary card untuk display di OvertimeTab UI.
 */
export function computeMonthSummary(entries: OvertimeEntry[]): OvertimeMonthSummary {
  let totalMin = 0
  let advanceEntries = 0, advanceMin = 0
  let extendEntries = 0,  extendMin = 0
  const personnel = new Set<string>()

  for (const e of entries) {
    totalMin += e.duration_min
    if (e.personnel_id) personnel.add(e.personnel_id)
    if (e.type === "ADVANCE") { advanceEntries++; advanceMin += e.duration_min }
    if (e.type === "EXTEND")  { extendEntries++;  extendMin  += e.duration_min }
  }

  return {
    totalEntries: entries.length,
    totalMin,
    advanceEntries,
    advanceMin,
    extendEntries,
    extendMin,
    uniquePersonnel: personnel.size,
  }
}
