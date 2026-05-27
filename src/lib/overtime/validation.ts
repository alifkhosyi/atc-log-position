// ============================================================
// src/lib/overtime/validation.ts
// ──────────────────────────────────────────────────────────
// Form validation untuk Jam Tambahan (v3 simplified).
//
// Aturan (per ROSTER_HANDOFF.md §6 + §8):
//   - personnel_id required
//   - date required
//   - type required (ADVANCE | EXTEND)
//   - duration_min > 0
//   - duration_min <= 24 * 60 (sanity check)
//   - note OPTIONAL — tidak ada validasi
//
// DIBUANG dari v2:
//   ❌ window check (end_time <= airport.opening_hour, dst)
//   ❌ on-duty soft check (shift I/II/III)
//   ❌ cross-midnight handling
//   ❌ cause enum validation
// ============================================================

import type { OvertimeFormInput, OvertimeFormState } from "./types"
import { OVERTIME_TYPES } from "./types"

export interface OvertimeValidation {
  ok: boolean
  errors: string[]
}

/**
 * Validate a fully-formed input (post-combine duration_min).
 * Returns { ok, errors }.
 */
export function validateOvertime(entry: Partial<OvertimeFormInput>): OvertimeValidation {
  const errors: string[] = []

  if (!entry.personnel_id) {
    errors.push("Personel wajib dipilih.")
  }
  if (!entry.date) {
    errors.push("Tanggal wajib diisi.")
  }
  if (!entry.type) {
    errors.push("Jenis (Advance/Extend) wajib dipilih.")
  } else if (!OVERTIME_TYPES.includes(entry.type)) {
    errors.push(`Jenis "${entry.type}" tidak valid.`)
  }
  if (!entry.airport_code) {
    errors.push("Airport code tidak tersedia.")
  }
  if (!entry.unit) {
    errors.push("Unit tidak tersedia.")
  }

  if (entry.duration_min === undefined || entry.duration_min === null) {
    errors.push("Durasi wajib diisi.")
  } else if (entry.duration_min <= 0) {
    errors.push("Durasi harus lebih dari 0 menit.")
  } else if (entry.duration_min > 24 * 60) {
    errors.push("Durasi tidak masuk akal (> 24 jam). Periksa lagi.")
  }
  // note: optional — tidak divalidasi

  return { ok: errors.length === 0, errors }
}

/**
 * Validate form state directly (uses hours+minutes, not duration_min).
 * Saves caller from doing combineDurationMin first when they just
 * want to check submit-readiness.
 */
export function validateOvertimeForm(
  state: OvertimeFormState,
  airportCode: string,
  unit: string,
): OvertimeValidation {
  return validateOvertime({
    personnel_id: state.personnel_id,
    airport_code: airportCode,
    unit,
    date: state.date,
    type: state.type,
    duration_min: combineDurationMin(state.hours, state.minutes),
    note: state.note || null,
  })
}

/**
 * Derive duration_min dari (jam, menit) picker.
 *   combineDurationMin(2, 30)  → 150
 *   combineDurationMin(0, 0)   → 0
 *   combineDurationMin(-1, 75) → 0 + 59 = 59  (clamped)
 */
export function combineDurationMin(hours: number, minutes: number): number {
  const h = Math.max(0, Math.floor(hours || 0))
  const m = Math.max(0, Math.min(59, Math.floor(minutes || 0)))
  return h * 60 + m
}

/**
 * Inverse: split duration_min ke (jam, menit) untuk pre-fill form
 * saat edit.
 *   splitDurationMin(150) → { hours: 2, minutes: 30 }
 *   splitDurationMin(45)  → { hours: 0, minutes: 45 }
 */
export function splitDurationMin(durationMin: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.floor(durationMin || 0))
  return {
    hours: Math.floor(safe / 60),
    minutes: safe % 60,
  }
}

/**
 * Display-format durasi → "2j 30m" / "45m" / "3j".
 */
export function formatDuration(durationMin: number): string {
  const { hours, minutes } = splitDurationMin(durationMin)
  if (hours === 0 && minutes === 0) return "0m"
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}j`
  return `${hours}j ${minutes}m`
}
