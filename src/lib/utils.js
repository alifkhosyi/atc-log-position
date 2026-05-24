// ============================================================
// src/lib/utils.js — Pure helper functions (no React)
// ============================================================
import { supabase } from "../supabase.js"

// ── Date/time formatting ──────────────────────────────────────
export const fmtT = d => d ? new Date(d).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}) : "-"
export const fmtD = d => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-"
export const fmtDT = d => d ? new Date(d).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "-"
export const durMin = (a,b) => a && b ? Math.round((new Date(b)-new Date(a))/60000) : 0

// ── Shift logic ──────────────────────────────────────────────
export const SHIFTS = ["Morning","Afternoon","Night"]
export const getShift = () => {
  const h = new Date().getHours()
  return h>=6 && h<14 ? "Morning" : h>=14 && h<22 ? "Afternoon" : "Night"
}

// ── Branch access recursion ──────────────────────────────────
// Get all branch codes this MO can access (recursive, stop at child with own MO)
export const getAccessibleBranches = (myCode, branches, moBranchCodes) => {
  const result = [myCode]
  const children = branches.filter(b => b.parent_code === myCode)
  for (const child of children) {
    if (moBranchCodes.includes(child.code) && child.code !== myCode) {
      continue
    }
    result.push(child.code)
    const grandchildren = getAccessibleBranches(child.code, branches, moBranchCodes)
    grandchildren.forEach(gc => { if (!result.includes(gc)) result.push(gc) })
  }
  return result
}

// ── Audit log helper — fire and forget, never blocks UI ──────
export const logAudit = (action, detail="", user=null) => {
  try {
    supabase.from("audit_logs").insert({
      user_id: user?.id || null,
      user_name: user?.display_name || user?.username || "-",
      branch_code: user?.branch_code || (user?.role==="admin" ? "ADMIN" : "-"),
      action,
      detail: typeof detail === "object" ? JSON.stringify(detail) : String(detail),
    }).then(({error}) => { if(error) console.warn("[AUDIT]", error.message) })
  } catch(e) { console.warn("[AUDIT catch]", e) }
}
