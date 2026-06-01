/**
 * src/hooks/useResolvedAirport.ts
 *
 * Shared hook untuk resolve user.branch_code (ICAO) ke engine-derived
 * airport_code + return list of selectable airports per role.
 *
 * Phase 4 — dedup dari 3 callsite (OffRosterTab, OvertimeTab, RollingPage)
 * yang sebelumnya copy-paste signature identik.
 *
 * Resolve algorithm:
 *   1. `getAirport(branchCode)` — direct airport-configs lookup (dual-key
 *      ICAO + derived). Kalau cabang ada di config: return airport_code.
 *   2. Fallback: cari di `ctx.branches` table → branch.name → fuzzy match
 *      ke airport_name di config. Untuk cabang yang ICAO sudah di-loader
 *      via branch_code field, ini biasanya tidak ke-trigger.
 *   3. Kalau tidak ketemu: return null. Consumer handle (mis. show error).
 *
 * Selectable airports:
 *   - Admin: semua 73 airports (full picker)
 *   - MO: filter ke 1 cabang yang resolved (atau branchCode fallback)
 */

import { useMemo } from "react"
import { useApp } from "../lib/context.jsx"
import { listAirports, getAirport } from "../lib/airport-data"
import type { AirportConfig } from "../lib/airport-data/types"

export interface ResolvedAirport {
  /** Engine-derived airport_code untuk MO branch (e.g. "KUPANG"), null kalau tidak ditemukan */
  resolved: string | null
  /** Filtered airports list — semua untuk admin, single untuk MO */
  selectable: AirportConfig[]
  /** Full list semua 73 airports (untuk admin reference) */
  allAirports: AirportConfig[]
}

export function useResolvedAirport(
  branchCode: string,
  isAdmin: boolean,
): ResolvedAirport {
  const allAirports = useMemo(() => listAirports(), [])
  const ctx: any = useApp()

  const resolved = useMemo(() => {
    if (!branchCode) return null
    const direct = getAirport(branchCode)
    if (direct) return direct.airport_code
    const branchObj = ctx?.branches?.find((b: any) => b.code === branchCode)
    if (!branchObj) return null
    const branchName = (branchObj.name || "").toLowerCase()
    for (const a of allAirports) {
      const engName = a.airport_name.toLowerCase()
      if (engName === branchName) return a.airport_code
      if (branchName.includes(engName)) return a.airport_code
      if (engName.includes(branchName)) return a.airport_code
    }
    return null
  }, [branchCode, ctx?.branches, allAirports])

  const selectable = useMemo(() => {
    if (isAdmin) return allAirports
    return allAirports.filter(a => a.airport_code === (resolved || branchCode))
  }, [isAdmin, allAirports, resolved, branchCode])

  return { resolved, selectable, allAirports }
}
