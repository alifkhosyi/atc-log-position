// ============================================================
// src/hooks/usePendingSessions.js
// ──────────────────────────────────────────────────────────
// Returns the number of position_logs rows in the current month
// that are still missing at least one of departure_count /
// arrival_count / overfly_count. Powers the Sidebar badge and
// the Section G countdown banner.
//
// `branchCode` is the cabang the user is responsible for; an
// admin can pass null and we fall back to "ALL branches" (a
// single broad count).
//
// Refresh strategy:
//   - Initial fetch on mount / when deps change.
//   - Subscribes to postgres_changes on `position_logs` so any
//     edit anywhere re-runs the count.
//   - Exposes `refresh()` for explicit invalidation after a
//     local write (avoids waiting on realtime echo).
// ============================================================
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../supabase.js"

const monthBounds = (d = new Date()) => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last  = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const fmt = (x) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
  return { first: fmt(first), last: fmt(last) }
}

export const usePendingSessions = (branchCode) => {
  const [count, setCount]     = useState(0)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { first, last } = monthBounds()
    let q = supabase
      .from("position_logs")
      .select("id", { count: "exact", head: true })
      .gte("on_time", `${first}T00:00:00.000Z`)
      .lte("on_time", `${last}T23:59:59.999Z`)
      .not("off_time", "is", null) // only ended sessions count as pending
      .or("departure_count.is.null,arrival_count.is.null,overfly_count.is.null")
    if (branchCode) q = q.eq("branch_code", branchCode)

    const { count: c, error } = await q
    if (!error) setCount(c ?? 0)
    setLoading(false)
  }, [branchCode])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase
      .channel(`pending-sessions-${branchCode || "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "position_logs" },
        () => refresh(),
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [refresh, branchCode])

  return { count, loading, refresh }
}
