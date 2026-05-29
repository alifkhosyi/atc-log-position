/**
 * src/hooks/useAllRosterStatusByBranch.ts
 *
 * Read-only hook untuk INMC Dashboard. Batch query atc_rosters untuk
 * current year+month, return roster status per cabang × per unit.
 *
 * Beda dengan useScheduledTodayPersonnel:
 *   - useScheduledTodayPersonnel: 1 cabang, detailed personnel list hari ini
 *   - useAllRosterStatusByBranch: 73 cabang, hanya status FINAL/DRAFT/MISSING
 *
 * Mapping airport_code → branch_code:
 *   atc_rosters.airport_code bisa di-stored sebagai:
 *     - ICAO 4-letter ("WATT", "WARR") — legacy MO
 *     - Engine-derived nama ("KUPANG", "SURABAYA") — dari Legacy.tsx
 *   Hook accept kedua format via dual-lookup di airport-data loader.
 *
 * Anti-pattern §10:
 *   - Dependency CUMA [branchesKey, ymKey]
 *   - TIDAK ada toast
 *   - AbortController OWNED by useEffect
 *   - Empty data → empty map, no error toast
 */

import { useEffect, useState, useMemo } from "react"
import { supabase } from "../supabase.js"
import { getAirportByBranchCode, deriveAirportCode } from "../lib/airport-data"

export type RosterStatus = "FINAL" | "DRAFT" | "MISSING"

export interface BranchRosterStatus {
  /** Per-unit status. Key = unit name (TWR/APP/ACC). */
  byUnit: Record<string, RosterStatus>
  /** Aggregate: 'FINAL' jika semua unit FINAL, 'MISSING' jika ada MISSING,
   *  else 'DRAFT'. */
  aggregate: RosterStatus
  /** Total unit yang punya roster non-MISSING (DRAFT or FINAL). */
  unitsWithRoster: number
  /** Total expected units di cabang (dari airport config). */
  expectedUnits: number
}

export interface AllRosterStatusResult {
  /** Map branch_code → BranchRosterStatus. */
  byBranch: Record<string, BranchRosterStatus>
  loading: boolean
  error: string | null
}

interface BranchInput {
  code: string  // ICAO 4-letter
  name?: string
}

const EMPTY_RESULT: AllRosterStatusResult = {
  byBranch: {},
  loading: false,
  error: null,
}

export function useAllRosterStatusByBranch(
  branches: BranchInput[],
  yearMonth?: { year: number; month: number },
): AllRosterStatusResult {
  const [state, setState] = useState<AllRosterStatusResult>(EMPTY_RESULT)

  // Stable dep key — concat all branch codes sorted
  const branchesKey = useMemo(() => {
    return branches.map(b => b.code).sort().join(",")
  }, [branches])

  // Year-month resolved (default current)
  const { year, month, ymKey } = useMemo(() => {
    const ym = yearMonth || (() => {
      const now = new Date()
      return { year: now.getFullYear(), month: now.getMonth() + 1 }
    })()
    return { year: ym.year, month: ym.month, ymKey: `${ym.year}-${ym.month}` }
  }, [yearMonth?.year, yearMonth?.month])

  useEffect(() => {
    if (branches.length === 0) {
      setState(EMPTY_RESULT)
      return
    }

    const ctrl = new AbortController()

    const fetchData = async () => {
      setState(s => ({ ...s, loading: true, error: null }))

      try {
        // Single batch query — semua roster bulan ini di seluruh sistem.
        // RLS: atc_rosters policy permissive untuk admin role (lihat
        // existing migrations). Tech debt: tighten kalau perlu.
        const { data: rows, error } = await supabase
          .from("atc_rosters")
          .select("airport_code, unit, status")
          .eq("year", year)
          .eq("month", month)
          .abortSignal(ctrl.signal)

        if (ctrl.signal.aborted) return

        if (error) {
          setState({
            byBranch: {},
            loading: false,
            error: error.message,
          })
          return
        }

        // Build lookup: airport_code (in DB) → { unit: status }
        // Untuk satu cabang, ada 1-3 rows (per unit).
        const dbRowsByAirportCode: Record<
          string,
          Record<string, "FINAL" | "DRAFT">
        > = {}
        for (const r of (rows || []) as any[]) {
          const ac = r.airport_code as string
          const unit = r.unit as string
          const status = (r.status as "FINAL" | "DRAFT") || "DRAFT"
          if (!dbRowsByAirportCode[ac]) dbRowsByAirportCode[ac] = {}
          // FINAL menang dari DRAFT kalau ada duplikat key
          if (
            !dbRowsByAirportCode[ac][unit]
            || status === "FINAL"
          ) {
            dbRowsByAirportCode[ac][unit] = status
          }
        }

        // Per branch, lookup airport config untuk dapat expected units +
        // candidate airport codes (ICAO + derived).
        const byBranch: Record<string, BranchRosterStatus> = {}

        for (const b of branches) {
          const airport = getAirportByBranchCode(b.code)
          if (!airport) {
            // Cabang tidak ada di airport-configs — kemungkinan branch
            // baru atau yang belum di-onboard ke engine. Empty status.
            byBranch[b.code] = {
              byUnit: {},
              aggregate: "MISSING",
              unitsWithRoster: 0,
              expectedUnits: 0,
            }
            continue
          }

          const expectedUnits = airport.units.map(u => u.unit)

          // Candidate keys yang mungkin di-pakai untuk simpan roster:
          //   1. ICAO branch_code (e.g. "WATT") — legacy MO
          //   2. Engine-derived dari config (e.g. "KUPANG")
          //   3. Engine-derived dari b.name (defensive untuk DB)
          const candidateKeys = [
            b.code,
            airport.airport_code,
            b.name ? deriveAirportCode(b.name) : "",
          ].filter(Boolean) as string[]

          // Gabung dari semua candidate keys jadi satu unit→status map
          const unitStatus: Record<string, "FINAL" | "DRAFT"> = {}
          for (const key of candidateKeys) {
            const rows = dbRowsByAirportCode[key]
            if (!rows) continue
            for (const [unit, status] of Object.entries(rows)) {
              if (!unitStatus[unit] || status === "FINAL") {
                unitStatus[unit] = status
              }
            }
          }

          // Build per-unit status untuk SEMUA expected units (MISSING
          // untuk yang tidak ada row).
          const byUnit: Record<string, RosterStatus> = {}
          let unitsWithRoster = 0
          let hasMissing = false
          let hasDraft = false

          for (const u of expectedUnits) {
            const s = unitStatus[u]
            if (!s) {
              byUnit[u] = "MISSING"
              hasMissing = true
            } else {
              byUnit[u] = s
              unitsWithRoster++
              if (s === "DRAFT") hasDraft = true
            }
          }

          let aggregate: RosterStatus
          if (hasMissing) aggregate = "MISSING"
          else if (hasDraft) aggregate = "DRAFT"
          else aggregate = "FINAL"

          byBranch[b.code] = {
            byUnit,
            aggregate,
            unitsWithRoster,
            expectedUnits: expectedUnits.length,
          }
        }

        if (ctrl.signal.aborted) return

        setState({
          byBranch,
          loading: false,
          error: null,
        })
      } catch (e: any) {
        if (e?.name === "AbortError" || ctrl.signal.aborted) return
        setState({
          byBranch: {},
          loading: false,
          error: e?.message || "Gagal memuat status roster",
        })
      }
    }

    fetchData()
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchesKey, ymKey])

  return state
}
