/**
 * src/hooks/useScheduledTodayPersonnel.ts
 *
 * Read-only hook untuk Dashboard Cabang. Query atc_rosters +
 * atc_roster_cells untuk tanggal hari ini, return personnel yang
 * SCHEDULED hari ini (status di {I, II, III, IV, V}), grouped per
 * unit × shift token.
 *
 * Source of truth: atc_roster_cells (yang dihasilkan engine generator).
 * BUKAN position_logs (yang sekarang deprecated).
 *
 * Anti-pattern §10 stability:
 *   - Dependency array CUMA [branchCode]
 *   - TIDAK ada toast call (badge non-critical, no spam)
 *   - AbortController OWNED by useEffect
 *   - Empty data → empty result, no toast.error
 *
 * Schema notes (verified):
 *   - atc_rosters.airport_code → ICAO branch code (mis. 'WAOO', 'WARR')
 *     ATAU engine-derived name (mis. 'AMBON') — pakai ICAO untuk MO cabang
 *   - atc_roster_cells.day = 1..31 (1-indexed)
 *   - atc_roster_cells.status: 'I' | 'II' | 'III' | 'IV' | 'V' | '-' | 'CUTI' | 'SAKIT' | dst
 *   - Join personnel(name) untuk dapat full name di cell row
 */

import { useEffect, useState } from "react"
import { supabase } from "../supabase.js"
import { getAirport } from "../lib/airport-data"

// Shift token set untuk filter — skip '-' dan leave categories
const SHIFT_TOKENS = new Set(["I", "II", "III", "IV", "V"])

export interface ScheduledPerson {
  personnel_id: string
  name: string
  initial: string
  unit: string
  shiftToken: string  // 'I' | 'II' | 'III' | 'IV' | 'V'
  shiftStartUtc?: string  // dari rolling config (kalau ada)
}

export interface ScheduledTodayResult {
  /** Group by unit, then by shiftToken. unit → shiftToken → personnel list */
  byUnit: Record<string, Record<string, ScheduledPerson[]>>
  /** Flat list semua scheduled (untuk count + flat iterate) */
  all: ScheduledPerson[]
  /** True selama fetch berjalan */
  loading: boolean
  /** Error string (cuma untuk display di UI, bukan toast) */
  error: string | null
  /** Set unit names yang punya roster tapi 0 personnel scheduled hari ini */
  emptyUnits: string[]
  /** Roster status per unit: 'FINAL' | 'DRAFT' | 'NONE' */
  rosterStatusByUnit: Record<string, "FINAL" | "DRAFT" | "NONE">
}

/**
 * Hook untuk fetch personnel scheduled hari ini.
 *
 * @param branchCode  user.branch_code (ICAO 4-letter), null untuk admin
 * @returns           ScheduledTodayResult
 */
export function useScheduledTodayPersonnel(
  branchCode: string | null,
): ScheduledTodayResult {
  const [state, setState] = useState<ScheduledTodayResult>({
    byUnit: {},
    all: [],
    loading: false,
    error: null,
    emptyUnits: [],
    rosterStatusByUnit: {},
  })

  useEffect(() => {
    if (!branchCode) return

    const ctrl = new AbortController()

    const fetchData = async () => {
      setState(s => ({ ...s, loading: true, error: null }))

      try {
        // Resolve airport from ICAO branch code via airport-data loader
        const airport = getAirport(branchCode)
        if (!airport) {
          if (ctrl.signal.aborted) return
          setState({
            byUnit: {},
            all: [],
            loading: false,
            error: `Cabang ${branchCode} belum di-mapping di airport-configs`,
            emptyUnits: [],
            rosterStatusByUnit: {},
          })
          return
        }

        const today = new Date()
        const year = today.getFullYear()
        const month = today.getMonth() + 1
        const day = today.getDate()

        const byUnit: Record<string, Record<string, ScheduledPerson[]>> = {}
        const flat: ScheduledPerson[] = []
        const emptyUnits: string[] = []
        const statusByUnit: Record<string, "FINAL" | "DRAFT" | "NONE"> = {}

        // Loop per unit (TWR, APP, ACC sesuai airport config)
        for (const unitCfg of airport.units) {
          // Fetch roster id untuk (cabang, unit, year, month)
          const { data: roster, error: rErr } = await supabase
            .from("atc_rosters")
            .select("id, status")
            .eq("airport_code", branchCode)
            .eq("unit", unitCfg.unit)
            .eq("year", year)
            .eq("month", month)
            .abortSignal(ctrl.signal)
            .maybeSingle()

          if (ctrl.signal.aborted) return

          if (rErr || !roster) {
            statusByUnit[unitCfg.unit] = "NONE"
            continue
          }

          statusByUnit[unitCfg.unit] =
            (roster.status as "FINAL" | "DRAFT") || "DRAFT"

          // Fetch cells hari ini, join personnel(name)
          const { data: cells, error: cErr } = await supabase
            .from("atc_roster_cells")
            .select("personnel_id, status, personnel:personnel(name)")
            .eq("roster_id", roster.id)
            .eq("day", day)
            .abortSignal(ctrl.signal)

          if (ctrl.signal.aborted) return
          if (cErr) continue  // skip kalau error, no toast

          const unitGroup: Record<string, ScheduledPerson[]> = {}
          for (const c of cells || []) {
            const status = (c as any).status as string
            if (!SHIFT_TOKENS.has(status)) continue  // skip '-', CUTI, dst.

            // personnel(name) join: bisa null kalau personnel sudah dihapus
            const joinedPerson = (c as any).personnel
            const fullName: string =
              (joinedPerson && joinedPerson.name) || (c as any).personnel_id || "—"

            const sp: ScheduledPerson = {
              personnel_id: (c as any).personnel_id,
              name: fullName,
              initial: deriveInitial(fullName),
              unit: unitCfg.unit,
              shiftToken: status,
              shiftStartUtc: unitCfg.rolling?.shift_start_utc,
            }
            if (!unitGroup[status]) unitGroup[status] = []
            unitGroup[status].push(sp)
            flat.push(sp)
          }

          if (Object.keys(unitGroup).length > 0) {
            byUnit[unitCfg.unit] = unitGroup
          } else {
            // Roster ada tapi tidak ada personnel scheduled hari ini di unit
            emptyUnits.push(unitCfg.unit)
          }
        }

        if (ctrl.signal.aborted) return

        setState({
          byUnit,
          all: flat,
          loading: false,
          error: null,
          emptyUnits,
          rosterStatusByUnit: statusByUnit,
        })
      } catch (e: any) {
        if (e?.name === "AbortError" || ctrl.signal.aborted) return
        setState({
          byUnit: {},
          all: [],
          loading: false,
          error: e?.message || "Gagal memuat jadwal",
          emptyUnits: [],
          rosterStatusByUnit: {},
        })
      }
    }

    fetchData()
    return () => ctrl.abort()
  }, [branchCode])

  return state
}

/**
 * Derive 2-letter display initial dari full name.
 * "AKHMAD NASUKHA" → "AN", "BUDI" → "B".
 */
function deriveInitial(name: string): string {
  if (!name) return "—"
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return "—"
  const a = words[0][0]?.toUpperCase() || ""
  const b = words[1]?.[0]?.toUpperCase() || ""
  return (a + b) || "—"
}

/**
 * Helper: detect shift token untuk current time (WIB).
 * Default 2-shift mapping untuk cabang kecil/medium:
 *   06:00–14:00 WIB → 'I'
 *   14:00–22:00 WIB → 'II'
 *   22:00–06:00 WIB → 'III'
 *
 * Untuk cabang TMA 5-shift (Surabaya WARR, dll), perlu logic dari
 * rolling config per cabang (Phase 2). MVP: pakai default mapping.
 */
export function detectCurrentShiftToken(now: Date = new Date()): string {
  const utcHours = now.getUTCHours()
  const wibHours = (utcHours + 7) % 24
  if (wibHours >= 6 && wibHours < 14) return "I"
  if (wibHours >= 14 && wibHours < 22) return "II"
  return "III"
}

/**
 * Helper: format shift time range UTC → WIB string.
 * computed: shift_start_utc + shift_end_utc dari rolling config.
 */
export function formatShiftTimeWib(
  startUtc?: string,
  endUtc?: string,
): string {
  if (!startUtc) return ""
  const toWib = (utc: string): string => {
    const [h, m] = utc.split(":").map(Number)
    const wibH = (h + 7) % 24
    return `${String(wibH).padStart(2, "0")}:${String(m).padStart(2, "0")}`
  }
  if (!endUtc) return `${toWib(startUtc)} WIB`
  return `${toWib(startUtc)}–${toWib(endUtc)} WIB`
}
