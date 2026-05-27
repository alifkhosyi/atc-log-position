// ============================================================
// src/pages/RosterPage/OvertimeTab.tsx — Tab 3 "Jam Tambahan"
// ──────────────────────────────────────────────────────────
// Step 7 dari ROSTER_HANDOFF.md §9 — full implementation v3 simplified.
//
// Form 5-field (per §8):
//   1. Personel        (dropdown)
//   2. Tanggal         (date picker)
//   3. Jenis           (radio segmented Advance/Extend)
//   4. Durasi          (2 dropdown sebelah: Jam 0-23 + Menit 0/15/30/45)
//   5. Catatan         (textarea, optional — free text)
//
// Validasi:
//   - Personel + Tanggal + Jenis wajib (block submit)
//   - Durasi > 0 menit
//   - Durasi <= 24 jam (sanity)
//   - Catatan optional
//
// Tabel kolom: tgl · personel · jenis (pill) · durasi · catatan · aksi
// Filter chips: Semua / Advance / Extend / Personel ▾
//
// Anti-pattern §10 dipakai:
//   - toast lewat useRef (TIDAK di deps array)
//   - AbortController di fetch
//   - empty data → empty state UI, BUKAN toast.error
// ============================================================

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { useToast } from "../../components/Toast.jsx"
import { useConfirm } from "../../components/ConfirmDialog.jsx"
import { I } from "../../components/Icons.jsx"
import {
  listAirports, getAirport,
} from "../../lib/roster-engine/airport-config-loader"
import type {
  OvertimeEntry, OvertimeFormState, OvertimeType,
} from "../../lib/overtime/types"
import {
  blankOvertimeForm, OVERTIME_TYPES,
} from "../../lib/overtime/types"
import {
  validateOvertimeForm, combineDurationMin, splitDurationMin, formatDuration,
} from "../../lib/overtime/validation"
import { computeMonthSummary } from "../../lib/overtime/compute"

/* ----------------------------------------------------------------
   Local helpers
   ---------------------------------------------------------------- */
const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]

const HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES_OPTIONS = [0, 15, 30, 45]  // common-case; advanced user pakai picker fallback

const isUuidLike = (s: string | undefined): boolean =>
  typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)

const deriveDisplayInitial = (name?: string, fallback = "P"): string => {
  if (!name) return fallback
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return fallback
  return words[0][0].toUpperCase() + (words[1]?.[0]?.toUpperCase() || "")
}

const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

interface DBPersonnel {
  id: string
  full_name?: string
  initial?: string
  branch_code?: string | null
}

/* ----------------------------------------------------------------
   Month-lock check — mirror Section G via useMonthLock
   ---------------------------------------------------------------- */
const isMonthLocked = (year: number, month: number): boolean => {
  const now = new Date()
  if (year < now.getFullYear()) return true
  if (year === now.getFullYear() && month < now.getMonth() + 1) return true
  return false
}

/* ----------------------------------------------------------------
   Airport resolution (mirror OffRosterTab)
   ---------------------------------------------------------------- */
function useResolvedAirport(branchCode: string, isAdmin: boolean) {
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

  return { resolved, selectable }
}

/* ----------------------------------------------------------------
   Main
   ---------------------------------------------------------------- */
export default function OvertimeTab() {
  const ctx: any = useApp()
  const toast: any = useToast()
  const confirm: any = useConfirm()
  const user = ctx?.user
  const isAdmin = user?.role === "admin"
  const userBranchCode = (user?.branch_code || "").toUpperCase()

  // toast + confirm via ref (anti-pattern §10)
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])
  const confirmRef = useRef(confirm)
  useEffect(() => { confirmRef.current = confirm }, [confirm])

  // Airport / unit / period
  const { resolved, selectable } = useResolvedAirport(userBranchCode, isAdmin)
  const [airportCode, setAirportCode] = useState<string>(
    resolved || userBranchCode || "WARR"
  )
  const [unit, setUnit] = useState<string>("TWR")
  const now = new Date()
  const [year, setYear]   = useState<number>(now.getFullYear())
  const [month, setMonth] = useState<number>(now.getMonth() + 1)

  const airport = useMemo(() => getAirport(airportCode), [airportCode])
  const availableUnits = useMemo(
    () => airport?.units?.map(u => u.unit) || ["TWR"],
    [airport]
  )

  const locked = isMonthLocked(year, month)

  // Personnel
  const dbPersonnel = useMemo<DBPersonnel[]>(() => {
    const branchFilter = isAdmin ? null : userBranchCode
    const ctxPersonnel: any[] = ctx?.personnel || []
    return ctxPersonnel
      .filter((p: any) => !branchFilter || p.branch_code === branchFilter)
      .map((p: any, i: number) => {
        const name = p.name || p.full_name || ""
        const rawInit = p.initial && !isUuidLike(p.initial) ? p.initial : null
        const initial = rawInit || deriveDisplayInitial(name, `P${i + 1}`)
        return { id: p.id, full_name: name, initial, branch_code: p.branch_code }
      })
  }, [isAdmin, userBranchCode, ctx?.personnel])

  // Data state
  const [entries, setEntries] = useState<OvertimeEntry[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [formEdit, setFormEdit] = useState<OvertimeEntry | null>(null)
  const [form, setForm] = useState<OvertimeFormState>(() => blankOvertimeForm(todayISO()))
  const [formErrors, setFormErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Filter chip
  type Filter = "ALL" | OvertimeType
  const [filter, setFilter] = useState<Filter>("ALL")
  const [personnelFilter, setPersonnelFilter] = useState<string>("")  // "" = all

  /* ── Load entries untuk current period (signal-owned by useEffect) ── */
  const loadEntriesWithSignal = useCallback(async (signal: AbortSignal) => {
    if (!airportCode || !unit || !year || !month) return
    if (signal.aborted) return
    setLoading(true)
    try {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

      const { data, error } = await supabase
        .from("atc_overtime")
        .select("*, personnel:atc_personnel(initial, full_name)")
        .eq("airport_code", airportCode)
        .eq("unit", unit)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false })
        .abortSignal(signal)

      if (signal.aborted) return
      if (error) {
        if (!/no rows/i.test(error.message)) {
          toastRef.current?.error?.("Gagal memuat jam tambahan", error.message)
        }
        setEntries([])
        return
      }
      setEntries((data as OvertimeEntry[]) || [])
    } catch (e: any) {
      if (e?.name === "AbortError" || signal.aborted) return
      toastRef.current?.error?.("Gagal memuat", e?.message || String(e))
      setEntries([])
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [airportCode, unit, year, month])

  useEffect(() => {
    const ctrl = new AbortController()
    loadEntriesWithSignal(ctrl.signal)
    return () => ctrl.abort()
  }, [loadEntriesWithSignal])

  // One-shot reload for buttons / post-mutation refresh.
  const loadEntries = useCallback(() => {
    const ctrl = new AbortController()
    loadEntriesWithSignal(ctrl.signal)
  }, [loadEntriesWithSignal])

  /* ── Summary ── */
  const summary = useMemo(() => computeMonthSummary(entries), [entries])

  /* ── Filtered ── */
  const filteredEntries = useMemo(() => {
    let out = entries
    if (filter !== "ALL") out = out.filter(e => e.type === filter)
    if (personnelFilter) out = out.filter(e => e.personnel_id === personnelFilter)
    return out
  }, [entries, filter, personnelFilter])

  /* ── Personnel list for filter chip dropdown ── */
  const personnelOptions = useMemo(() => {
    const present = new Set(entries.map(e => e.personnel_id))
    return dbPersonnel.filter(p => present.has(p.id))
  }, [entries, dbPersonnel])

  /* ── Form handlers ── */
  const openAdd = useCallback(() => {
    setFormEdit(null)
    setForm(blankOvertimeForm(todayISO()))
    setFormErrors([])
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((e: OvertimeEntry) => {
    const { hours, minutes } = splitDurationMin(e.duration_min)
    setFormEdit(e)
    setForm({
      personnel_id: e.personnel_id,
      date: e.date,
      type: e.type,
      hours,
      minutes,
      note: e.note || "",
    })
    setFormErrors([])
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
    setFormErrors([])
  }, [])

  const submitForm = useCallback(async () => {
    if (submitting) return
    const validation = validateOvertimeForm(form, airportCode, unit)
    if (!validation.ok) {
      setFormErrors(validation.errors)
      return
    }

    setSubmitting(true)
    const payload = {
      personnel_id: form.personnel_id,
      airport_code: airportCode,
      unit,
      date: form.date,
      type: form.type,
      duration_min: combineDurationMin(form.hours, form.minutes),
      note: form.note?.trim() || null,
    }

    try {
      if (formEdit) {
        const { error } = await supabase
          .from("atc_overtime")
          .update(payload)
          .eq("id", formEdit.id)
        if (error) throw error
        toastRef.current?.success?.("Tersimpan", "Jam tambahan diperbarui.")
      } else {
        const { error } = await supabase
          .from("atc_overtime")
          .insert({ ...payload, recorded_by: user?.id || null })
        if (error) throw error
        toastRef.current?.success?.("Tersimpan", "Jam tambahan dicatat.")
      }
      setFormOpen(false)
      loadEntries()
    } catch (e: any) {
      toastRef.current?.error?.(
        formEdit ? "Gagal memperbarui" : "Gagal mencatat",
        e?.message || String(e),
      )
    } finally {
      setSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, formEdit, airportCode, unit, submitting, user?.id, loadEntries])

  const handleDelete = useCallback((entry: OvertimeEntry) => {
    const personName = entry.personnel?.full_name || entry.personnel?.initial
      || dbPersonnel.find(p => p.id === entry.personnel_id)?.full_name
      || "personel"
    const fn = confirmRef.current
    const doDelete = async () => {
      const { error } = await supabase.from("atc_overtime").delete().eq("id", entry.id)
      if (error) {
        toastRef.current?.error?.("Gagal menghapus", error.message)
        return
      }
      toastRef.current?.success?.("Terhapus", "Jam tambahan dihapus.")
      loadEntries()
    }
    if (fn) {
      Promise.resolve(fn({
        title: "Hapus Jam Tambahan?",
        detail: "Aksi ini tidak bisa dibatalkan.",
        target: `${entry.type} · ${personName} · ${fmtDate(entry.date)} · ${formatDuration(entry.duration_min)}`,
        destructive: true,
        confirmText: "Hapus",
      })).then((ok: boolean) => { if (ok) doDelete() })
    } else {
      if (window.confirm(`Hapus jam tambahan ${entry.type} untuk ${personName}?`)) doDelete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadEntries, dbPersonnel])

  /* ── Live durasi preview ── */
  const previewDuration = combineDurationMin(form.hours, form.minutes)

  /* ── Render ── */
  return (
    <div className="or-tab ot-tab">
      {/* Toolbar */}
      <div className="or-toolbar">
        <div className="or-field">
          <label htmlFor="ot-airport">Cabang</label>
          <select
            id="ot-airport"
            value={airportCode}
            onChange={e => setAirportCode(e.target.value)}
            disabled={!isAdmin && selectable.length <= 1}
          >
            {selectable.map(a => (
              <option key={a.airport_code} value={a.airport_code}>
                {a.airport_code} — {a.airport_name}
              </option>
            ))}
          </select>
        </div>
        <div className="or-field">
          <label htmlFor="ot-unit">Unit</label>
          <select id="ot-unit" value={unit} onChange={e => setUnit(e.target.value)}>
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="or-field">
          <label htmlFor="ot-month">Bulan</label>
          <select id="ot-month" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="or-field">
          <label htmlFor="ot-year">Tahun</label>
          <select id="ot-year" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="or-spacer"/>
        <button className="or-btn" type="button" onClick={loadEntries} disabled={loading}>
          <I n="refresh" s={14}/> Reload
        </button>
      </div>

      {locked && (
        <div className="ot-locked-banner">
          <I n="info" s={14}/>
          <span>
            <b>{MONTHS[month - 1]} {year}</b> sudah lewat — entries tampil read-only.
            Edit/hapus tidak diizinkan untuk bulan lampau.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="ot-summary">
        <div className="ot-card main">
          <div className="ot-card-lbl">Ringkasan Bulan {MONTHS[month - 1]} {year}</div>
          <div className="ot-card-val">
            {summary.totalEntries} entries · {formatDuration(summary.totalMin)}
          </div>
          <div className="ot-card-sub">
            Total jam kontrol di luar window operasi {airportCode}
            {airport ? ` (${airport.airport_name})` : ""}
          </div>
          <div className="ot-card-split">
            <div>
              <span className="lbl">Advance</span>
              <b>{summary.advanceEntries} · {formatDuration(summary.advanceMin)}</b>
            </div>
            <div>
              <span className="lbl">Extend</span>
              <b>{summary.extendEntries} · {formatDuration(summary.extendMin)}</b>
            </div>
            <div>
              <span className="lbl">Personel terlibat</span>
              <b>{summary.uniquePersonnel} orang</b>
            </div>
          </div>
        </div>
      </div>

      {/* Form (inline expand) */}
      {formOpen && (
        <div className="or-form-card">
          <h3>
            {formEdit ? "✏ Edit Jam Tambahan" : "➕ Catat Jam Tambahan"}
            <button
              className="or-close-btn"
              type="button"
              onClick={closeForm}
              aria-label="Tutup form"
            >×</button>
          </h3>

          <div className="or-form-row">
            <div className="or-form-field">
              <label htmlFor="ot-form-pers">Personel</label>
              <select
                id="ot-form-pers"
                value={form.personnel_id}
                onChange={e => setForm({ ...form, personnel_id: e.target.value })}
              >
                <option value="">— Pilih personel —</option>
                {dbPersonnel.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.initial}{p.full_name ? ` — ${p.full_name}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="or-form-field">
              <label htmlFor="ot-form-date">Tanggal</label>
              <input
                id="ot-form-date"
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
              />
            </div>

            <div className="or-form-field">
              <label>Jenis</label>
              <div className="ot-radio-seg" role="radiogroup" aria-label="Jenis jam tambahan">
                {OVERTIME_TYPES.map(t => (
                  <label
                    key={t}
                    className={"ot-radio-seg-item" + (form.type === t ? " is-checked" : "")}
                  >
                    <input
                      type="radio"
                      name="ot-form-type"
                      value={t}
                      checked={form.type === t}
                      onChange={() => setForm({ ...form, type: t })}
                    />
                    {t === "ADVANCE" ? "⤴ Advance" : "⤵ Extend"}
                  </label>
                ))}
              </div>
              <span className="or-hint">
                Advance = sebelum window operasi · Extend = setelahnya.
              </span>
            </div>
          </div>

          <div className="or-form-row">
            <div className="or-form-field">
              <label htmlFor="ot-form-hours">Durasi · Jam</label>
              <select
                id="ot-form-hours"
                value={form.hours}
                onChange={e => setForm({ ...form, hours: Number(e.target.value) })}
              >
                {HOURS_OPTIONS.map(h => <option key={h} value={h}>{h} jam</option>)}
              </select>
            </div>
            <div className="or-form-field">
              <label htmlFor="ot-form-minutes">Durasi · Menit</label>
              <select
                id="ot-form-minutes"
                value={form.minutes}
                onChange={e => setForm({ ...form, minutes: Number(e.target.value) })}
              >
                {MINUTES_OPTIONS.map(m => <option key={m} value={m}>{m} menit</option>)}
              </select>
            </div>
            <div className="or-form-field">
              <label>Total Durasi</label>
              <div className="ot-duration-preview mono">
                {previewDuration > 0 ? formatDuration(previewDuration) : "—"}
              </div>
              <span className="or-hint">
                Auto dari Jam + Menit di atas.
              </span>
            </div>
            <div className="or-form-field">
              <label>&nbsp;</label>
              <div className="ot-context mono">{airportCode} · {unit}</div>
              <span className="or-hint">Konteks airport + unit dari toolbar.</span>
            </div>
          </div>

          <div className="or-form-row single">
            <div className="or-form-field">
              <label htmlFor="ot-form-note">Catatan (opsional)</label>
              <textarea
                id="ot-form-note"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Mis. flight delay GA-152, medevac, ferry flight, dst."
                rows={2}
              />
              <span className="or-hint">
                Free text — tulis konteks/penyebab bebas. Disimpan untuk audit trail.
              </span>
            </div>
          </div>

          {formErrors.length > 0 && (
            <div className="or-form-err" role="alert">
              <I n="alert" s={14}/>
              <span>
                {formErrors.map((err, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && " · "}
                    {err}
                  </React.Fragment>
                ))}
              </span>
            </div>
          )}

          <div className="or-form-actions">
            <button className="or-btn" type="button" onClick={closeForm} disabled={submitting}>Batal</button>
            <button
              className="or-btn or-btn-primary"
              type="button"
              onClick={submitForm}
              disabled={submitting}
            >
              {submitting
                ? "Menyimpan…"
                : formEdit ? "Simpan Perubahan" : "Catat Jam Tambahan"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="or-table-wrap">
        <div className="or-table-toolbar">
          <div className="or-filters">
            <button
              className={"or-chip" + (filter === "ALL" ? " is-active" : "")}
              onClick={() => setFilter("ALL")}
              type="button"
            >Semua · {summary.totalEntries}</button>
            <button
              className={"or-chip" + (filter === "ADVANCE" ? " is-active" : "")}
              onClick={() => setFilter("ADVANCE")}
              type="button"
            >Advance · {summary.advanceEntries}</button>
            <button
              className={"or-chip" + (filter === "EXTEND" ? " is-active" : "")}
              onClick={() => setFilter("EXTEND")}
              type="button"
            >Extend · {summary.extendEntries}</button>
            {personnelOptions.length > 0 && (
              <select
                className="or-chip ot-pers-filter"
                value={personnelFilter}
                onChange={e => setPersonnelFilter(e.target.value)}
                aria-label="Filter personel"
              >
                <option value="">Semua personel</option>
                {personnelOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.initial}</option>
                ))}
              </select>
            )}
          </div>
          {!formOpen && !locked && (
            <button
              className="or-btn or-btn-primary"
              type="button"
              onClick={openAdd}
            >+ Catat Jam Tambahan</button>
          )}
        </div>

        <div className="or-table-scroll">
          <table className="or-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Personel</th>
                <th>Jenis</th>
                <th>Durasi</th>
                <th>Catatan</th>
                <th className="th-actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-row">
                    {loading
                      ? "Memuat jam tambahan…"
                      : entries.length === 0
                        ? `Belum ada jam tambahan untuk ${MONTHS[month - 1]} ${year}.`
                        : "Tidak ada entry yang cocok dengan filter."}
                  </td>
                </tr>
              ) : filteredEntries.map(e => {
                const personName = e.personnel?.full_name || e.personnel?.initial
                  || dbPersonnel.find(p => p.id === e.personnel_id)?.full_name
                  || "—"
                const personInit = e.personnel?.initial
                  || dbPersonnel.find(p => p.id === e.personnel_id)?.initial
                  || "—"
                return (
                  <tr key={e.id}>
                    <td className="mono">{fmtDate(e.date)}</td>
                    <td className="name">
                      <b>{personInit}</b>
                      {personName !== personInit && <span className="sub"> — {personName}</span>}
                    </td>
                    <td>
                      <span className={`or-pill ot-pill-${e.type.toLowerCase()}`}>
                        {e.type === "ADVANCE" ? "⤴ ADVANCE" : "⤵ EXTEND"}
                      </span>
                    </td>
                    <td className="mono">{formatDuration(e.duration_min)}</td>
                    <td className="note">{e.note || <span className="faint">—</span>}</td>
                    <td className="actions">
                      {locked ? (
                        <span className="faint" style={{ fontSize: 11 }}>locked</span>
                      ) : (
                        <>
                          <button
                            className="or-ic-btn"
                            type="button"
                            onClick={() => openEdit(e)}
                            aria-label="Edit"
                          >✏</button>
                          <button
                            className="or-ic-btn danger"
                            type="button"
                            onClick={() => handleDelete(e)}
                            aria-label="Hapus"
                          >🗑</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
