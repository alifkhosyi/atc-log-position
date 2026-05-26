// ============================================================
// src/hooks/useMonthLock.js
// ──────────────────────────────────────────────────────────
// A "month lock" controls whether Section G cells for a given
// date are still editable. Lock rule:
//
//   - Month strictly in the past  → ALWAYS locked.
//   - Current month, current date → editable until end-of-month.
//   - Future date                 → editable (placeholder data).
//
// The lock can also be set explicitly by an admin via the
// `daily_report_locks` table; that takes precedence and is
// resolved through `useExplicitMonthLock` below if needed.
// ============================================================
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../supabase.js"

const startOfMonth = (d) => {
  const x = new Date(d)
  return new Date(x.getFullYear(), x.getMonth(), 1)
}

const isPastMonth = (date) => {
  const d = startOfMonth(date)
  const now = startOfMonth(new Date())
  return d.getTime() < now.getTime()
}

// Synchronous helper — no DB call, just calendar math.
export const isMonthLocked = (date) => isPastMonth(date)

// Days remaining until end of month for the given date (inclusive).
export const daysToMonthEnd = (date) => {
  const d = new Date(date)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const ms = last - new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

// Hook variant — adds optional check against an explicit lock row.
export const useMonthLock = ({ branchCode, date } = {}) => {
  const [explicit, setExplicit] = useState(false)
  const [loading, setLoading]   = useState(false)

  const refresh = useCallback(async () => {
    if (!branchCode || !date) return
    setLoading(true)
    const month = new Date(date.getFullYear(), date.getMonth(), 1)
      .toISOString().slice(0, 10)
    const { data } = await supabase
      .from("daily_report_locks")
      .select("branch_code")
      .eq("branch_code", branchCode)
      .eq("month", month)
      .maybeSingle()
    setExplicit(!!data)
    setLoading(false)
  }, [branchCode, date && date.getTime()])
  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh() }, [refresh])

  const locked = explicit || isMonthLocked(date)
  return { locked, explicit, loading, refresh, daysLeft: daysToMonthEnd(date) }
}
