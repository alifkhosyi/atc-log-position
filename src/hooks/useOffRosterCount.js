// ============================================================
// src/hooks/useOffRosterCount.js
// ──────────────────────────────────────────────────────────
// Count of Off-Roster entries (atc_leaves) yang touches bulan
// berjalan untuk satu branch. Dipakai oleh Sidebar badge di item
// "Roster ATC" (digabung dengan useOvertimeCount).
//
// Anti-pattern §10 dipakai:
//   - Tidak ada toast call di sini → tidak ada toast spam risk
//   - AbortController di setiap fetch (cleanup saat branch berubah)
//   - Empty data (0 rows) → return 0, BUKAN error
//   - 60s polling (badge tidak butuh realtime presisi; cheap query)
// ============================================================

import { useEffect, useState } from "react"
import { supabase } from "../supabase.js"

const POLL_MS = 60 * 1000  // 60 detik

/**
 * @param {string|null} branchCode  user.branch_code (null untuk admin → return 0)
 * @returns {number} count of off-roster rows touching current month
 */
export function useOffRosterCount(branchCode) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!branchCode) return  // no fetch; display 0 via derived value below
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
          .from("atc_leaves")
          .select("id", { count: "exact", head: true })
          .eq("airport_code", branchCode)
          .lte("start_date", monthEnd)
          .gte("end_date", monthStart)
          .abortSignal(ctrl.signal)

        if (ctrl.signal.aborted) return
        // error or empty → 0 (no toast — badge is non-critical)
        if (error) {
          setCount(0)
          return
        }
        setCount(c ?? 0)
      } catch {
        // abort or network blip — keep last good value, no toast
      }
    }

    fetchCount()
    timer = setInterval(fetchCount, POLL_MS)
    return () => {
      ctrl.abort()
      if (timer) clearInterval(timer)
    }
  }, [branchCode])

  // Admin (branchCode === null) → always 0; cabang user → fetched count
  return branchCode ? count : 0
}
