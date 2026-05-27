// ============================================================
// src/hooks/useOvertimeCount.js
// ──────────────────────────────────────────────────────────
// Count of Jam Tambahan entries (atc_overtime) di bulan berjalan
// untuk satu branch. Dipakai oleh Sidebar badge di item "Roster
// ATC" (digabung dengan useOffRosterCount).
//
// Anti-pattern §10 dipakai (mirror useOffRosterCount):
//   - Tidak ada toast call di sini
//   - AbortController di fetch
//   - Empty data → return 0
//   - 60s polling
// ============================================================

import { useEffect, useState } from "react"
import { supabase } from "../supabase.js"

const POLL_MS = 60 * 1000

/**
 * @param {string|null} branchCode  user.branch_code (null → return 0)
 * @returns {number} count of overtime rows di current month
 */
export function useOvertimeCount(branchCode) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!branchCode) return
    const ctrl = new AbortController()
    let timer = null

    const fetchCount = async () => {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth() + 1
      const monthStart = `${y}-${String(m).padStart(2, "0")}-01`
      const lastDay = new Date(y, m, 0).getDate()
      const monthEnd = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

      try {
        const { count: c, error } = await supabase
          .from("atc_overtime")
          .select("id", { count: "exact", head: true })
          .eq("airport_code", branchCode)
          .gte("date", monthStart)
          .lte("date", monthEnd)
          .abortSignal(ctrl.signal)

        if (ctrl.signal.aborted) return
        if (error) {
          setCount(0)
          return
        }
        setCount(c ?? 0)
      } catch {
        // abort or network blip
      }
    }

    fetchCount()
    timer = setInterval(fetchCount, POLL_MS)
    return () => {
      ctrl.abort()
      if (timer) clearInterval(timer)
    }
  }, [branchCode])

  return branchCode ? count : 0
}
