// ============================================================
// src/components/DailyReport/SectionG.jsx — "Pelaporan Personnel"
// ──────────────────────────────────────────────────────────
// New Daily Report section that absorbs the workflow formerly
// served by the Log Position page. The Manager Operasi sees one
// row per ended position_logs session for the chosen date, fills
// DEP/ARR/OVF inline, then submits the day.
//
// Toolbar:
//   ‹ Date › | Today    Shift: All/Morning/Mid/Night   [ ] only-pending
//
// Body:
//   Optional CountdownBanner (≤5 days left + pending > 0)
//   SessionsTable (editable / locked depending on month)
//
// Footer:
//   Live totals + Submit button (disabled until 0 pending).
// ============================================================
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { useToast } from "../Toast.jsx"
import { I } from "../Icons.jsx"
import { isMonthLocked, daysToMonthEnd } from "../../hooks/useMonthLock.js"
import { usePendingSessions } from "../../hooks/usePendingSessions.js"
import { SessionsTable } from "./SessionsTable.jsx"
import { CountdownBanner } from "./CountdownBanner.jsx"
import "../../styles/section-g.css"

const COL_LABEL = {
  departure_count: "DEP",
  arrival_count:   "ARR",
  overfly_count:   "OVF",
}

const toISODate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const fromISODate = (s) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const isPending = (s) =>
  s.departure_count === null
  || s.arrival_count === null
  || s.overfly_count === null

export default function SectionG() {
  const ctx   = useApp()
  const toast = useToast()
  const branchCode = ctx.user?.branch_code

  // Selected date (defaults to today)
  const [date, setDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const dateISO = toISODate(date)

  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(false)
  const [submitting, setSubmit] = useState(false)
  const [shiftFilter, setShiftFilter] = useState("all")
  const [pendingOnly, setPendingOnly] = useState(false)

  // Sidebar-shared counter (current month, not selected date)
  const { count: monthPending, refresh: refreshMonthPending } = usePendingSessions(branchCode)

  const locked = isMonthLocked(date)

  // Load sessions for (branch, date) ------------------------
  const loadSessions = useCallback(async () => {
    if (!branchCode) return
    setLoading(true)
    const start = `${dateISO}T00:00:00.000Z`
    // Range "all sessions whose on_time falls in the local calendar day".
    // Using a 36-hour window then filtering client-side avoids timezone
    // drift between UTC stored timestamps and Asia/Jakarta calendar days.
    const next = new Date(date); next.setDate(next.getDate() + 1)
    const end = `${toISODate(next)}T23:59:59.999Z`
    const { data, error } = await supabase
      .from("position_logs")
      .select("id, branch_code, atc_name, unit, sector, cwp, on_time, off_time, departure_count, arrival_count, overfly_count, notes, submitted_at")
      .eq("branch_code", branchCode)
      .gte("on_time", start)
      .lte("on_time", end)
      .order("on_time", { ascending: true })

    if (error) {
      toast.error("Gagal memuat session", error.message)
      setSessions([])
    } else {
      const ymd = (iso) => {
        const d = new Date(iso); return toISODate(d)
      }
      setSessions((data || []).filter(s => ymd(s.on_time) === dateISO))
    }
    setLoading(false)
  }, [branchCode, dateISO, date, toast])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Realtime invalidation — anyone editing the same date triggers reload
  useEffect(() => {
    if (!branchCode) return
    const ch = supabase
      .channel(`section-g-${branchCode}-${dateISO}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "position_logs", filter: `branch_code=eq.${branchCode}` },
        () => loadSessions(),
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [branchCode, dateISO, loadSessions])

  // Cell save -----------------------------------------------
  const onCellSave = useCallback(async (sessionId, col, value) => {
    // Optimistic update first.
    setSessions((prev) => prev.map(s => s.id === sessionId ? { ...s, [col]: value } : s))
    const { error } = await supabase
      .from("position_logs")
      .update({ [col]: value })
      .eq("id", sessionId)
    if (error) {
      toast.error("Gagal menyimpan", error.message)
      loadSessions() // rollback via reload
      return
    }
    toast.success("Tersimpan", `${COL_LABEL[col] || col} diperbarui`)
    refreshMonthPending()
  }, [toast, loadSessions, refreshMonthPending])

  // Submit Section G ----------------------------------------
  const pendingHere = useMemo(
    () => sessions.filter(isPending).length,
    [sessions],
  )

  const canSubmit = !locked && sessions.length > 0 && pendingHere === 0
  const allSubmitted = sessions.length > 0 && sessions.every(s => !!s.submitted_at)

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || submitting) return
    setSubmit(true)
    const { error } = await supabase
      .from("position_logs")
      .update({
        submitted_at: new Date().toISOString(),
        submitted_by: ctx.user?.id || null,
      })
      .eq("branch_code", branchCode)
      .gte("on_time", `${dateISO}T00:00:00.000Z`)
      .lte("on_time", `${dateISO}T23:59:59.999Z`)
    setSubmit(false)
    if (error) {
      toast.error("Submit gagal", error.message)
      return
    }
    toast.success("Section G dikirim", `Personnel ${dateISO}`)
    loadSessions()
  }, [canSubmit, submitting, ctx.user?.id, branchCode, dateISO, toast, loadSessions])

  // Date nav ------------------------------------------------
  const shiftDate = (deltaDays) => {
    const d = new Date(date); d.setDate(d.getDate() + deltaDays); setDate(d)
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isToday = date.getTime() === today.getTime()

  return (
    <div className="sg-page">
      <CountdownBanner
        date={date}
        pendingCount={monthPending}
        onJump={() => setPendingOnly(true)}
      />

      {/* Toolbar */}
      <div className="sg-toolbar">
        <div className="sg-date-nav">
          <button
            type="button"
            className="sg-btn-ghost"
            onClick={() => shiftDate(-1)}
            aria-label="Hari sebelumnya"
          >
            <I n="chevron-left" s={16}/>
          </button>
          <input
            type="date"
            className="sg-date-input"
            value={dateISO}
            onChange={(e) => e.target.value && setDate(fromISODate(e.target.value))}
          />
          <button
            type="button"
            className="sg-btn-ghost"
            onClick={() => shiftDate(1)}
            aria-label="Hari berikutnya"
          >
            <I n="chevron-right" s={16}/>
          </button>
          {!isToday && (
            <button
              type="button"
              className="sg-btn-today"
              onClick={() => setDate(today)}
            >
              Hari ini
            </button>
          )}
        </div>

        <div className="sg-filters">
          <label className="sg-filter-label" htmlFor="sg-shift">Shift</label>
          <select
            id="sg-shift"
            className="sg-select"
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
          >
            <option value="all">Semua</option>
            <option value="Morning">Morning</option>
            <option value="Mid">Mid</option>
            <option value="Night">Night</option>
          </select>

          <label className="sg-toggle">
            <input
              type="checkbox"
              checked={pendingOnly}
              onChange={(e) => setPendingOnly(e.target.checked)}
            />
            <span>Hanya yang belum diisi</span>
          </label>
        </div>

        <div className="sg-toolbar-meta">
          {locked && <span className="sg-pill sg-pill-locked">Bulan terkunci</span>}
          {!locked && (
            <span className="sg-meta-text">
              {pendingHere > 0
                ? <>Pending tanggal ini: <b>{pendingHere}</b></>
                : <>✓ Tanggal ini lengkap</>}
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="sg-loading">Memuat session…</div>
      ) : (
        <SessionsTable
          sessions={sessions}
          locked={locked}
          filterShift={shiftFilter}
          pendingOnly={pendingOnly}
          onCellSave={onCellSave}
        />
      )}

      {/* Submit bar */}
      {!locked && sessions.length > 0 && (
        <div className="sg-submitbar">
          <span className="sg-submitbar-help">
            {pendingHere > 0
              ? <>Isi {pendingHere} session lagi sebelum submit.</>
              : allSubmitted
                ? <>Sudah disubmit pada {new Date(sessions[0].submitted_at).toLocaleString("id-ID")}.</>
                : <>Semua session lengkap — siap di-submit.</>}
          </span>
          <button
            type="button"
            className="sg-btn-submit"
            disabled={!canSubmit || submitting || allSubmitted}
            onClick={handleSubmit}
          >
            {submitting ? "Mengirim…" : allSubmitted ? "✓ Sudah disubmit" : "Submit Section G"}
          </button>
        </div>
      )}

      {/* Deadline footer (current month only) */}
      {!locked && date.getMonth() === today.getMonth() && (
        <div className="sg-deadline-hint">
          Deadline akhir bulan — {daysToMonthEnd(date)} hari lagi. Bulan sebelumnya read-only.
        </div>
      )}
    </div>
  )
}
