/**
 * src/lib/shared/personnel.ts
 *
 * Shared personnel utilities — single source of truth untuk pattern yang
 * sebelumnya duplicate di 8 callsite (TunjanganPage, OffRosterTab,
 * OvertimeTab, RollingPage, PersonnelPage, Legacy, useScheduledTodayPersonnel,
 * bootstrap-rosters script).
 *
 * Phase 4 — duplication removal.
 */

/**
 * Derive 2-letter display initial dari full name.
 *   "AKHMAD NASUKHA" → "AN"
 *   "BUDI"           → "B"
 *   ""               → fallback
 *
 * @param name     Full name (boleh empty / undefined / null)
 * @param fallback Fallback string kalau name kosong (default "—")
 * @returns        1-2 letter uppercase initial, atau fallback
 */
export function deriveDisplayInitial(
  name?: string | null,
  fallback = "—",
): string {
  if (!name) return fallback
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return fallback
  const a = words[0][0]?.toUpperCase() || ""
  const b = words[1]?.[0]?.toUpperCase() || ""
  return (a + b) || fallback
}

/**
 * Check apakah string look like UUID (v4 or general hex-dash format).
 * Sebelumnya isUuidLike di-define inline di banyak file.
 *
 *   "550e8400-e29b-41d4-..."  → true
 *   "AKHMAD"                   → false
 *   undefined                  → false
 */
export function isUuidLike(s: unknown): boolean {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)
}
