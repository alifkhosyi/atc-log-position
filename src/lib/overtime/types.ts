// ============================================================
// src/lib/overtime/types.ts
// ──────────────────────────────────────────────────────────
// Types untuk fitur Jam Tambahan (Advance/Extend).
// Match dengan schema atc_overtime di Supabase
// (supabase/migrations/20260527_overtime.sql).
//
// v3 simplified — no start_time / end_time / cause enum.
// Form cuma 5 field: personnel · date · type · duration_min · note.
// ============================================================

export type OvertimeType = "ADVANCE" | "EXTEND"

export const OVERTIME_TYPES: OvertimeType[] = ["ADVANCE", "EXTEND"]

/**
 * Row di tabel atc_overtime. `personnel` adalah join optional dari
 * personnel(initial, full_name) — di-load via Supabase select.
 */
export interface OvertimeEntry {
  id: string
  personnel_id: string
  airport_code: string
  unit: string
  date: string                    // YYYY-MM-DD
  type: OvertimeType
  duration_min: number            // 1..1440 (1m..24h)
  note?: string | null            // optional free text
  recorded_by?: string | null     // UUID accounts.id
  recorded_at?: string            // ISO timestamp

  // Joined fields (optional)
  personnel?: {
    initial?: string
    full_name?: string
  } | null
}

/**
 * Input shape untuk insert/update. Tanpa id + audit fields (server
 * akan isi).
 */
export interface OvertimeFormInput {
  personnel_id: string
  airport_code: string
  unit: string
  date: string
  type: OvertimeType
  duration_min: number
  note?: string | null
}

/**
 * Form state — durasi disimpan sebagai jam + menit (2 picker)
 * sebelum di-combine ke duration_min via combineDurationMin.
 */
export interface OvertimeFormState {
  personnel_id: string
  date: string
  type: OvertimeType
  hours: number                   // 0..23
  minutes: number                 // 0..59
  note: string
}

export const blankOvertimeForm = (date: string): OvertimeFormState => ({
  personnel_id: "",
  date,
  type: "ADVANCE",
  hours: 0,
  minutes: 0,
  note: "",
})
