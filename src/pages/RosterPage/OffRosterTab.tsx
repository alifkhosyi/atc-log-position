// ============================================================
// src/pages/RosterPage/OffRosterTab.tsx — Tab 2 "Off-Roster"
// ──────────────────────────────────────────────────────────
// Naik kelas dari <details> di Legacy.tsx jadi tab penuh.
//
// AC dari ROSTER_HANDOFF.md §8 "Off-Roster":
//   ✓ Stats strip 4 cards
//   ✓ [+ Tambah Off-Roster] di kanan-atas tabel
//   ✓ Form inline expand (bukan modal), close "×"
//   ✓ Fields: personel · kategori · tgl mulai · tgl selesai · catatan
//   ✓ Validasi: endDate >= startDate; semua required kecuali catatan
//   ✓ Tabel: tgl mulai · tgl selesai · personel · kategori (pill) ·
//            durasi · catatan · aksi
//   ✓ Cross-month row highlighted dengan border-left amber
//   ✓ Filter chips: Semua / CUTI / SAKIT / DIKLAT / Cross-month
//   ✓ Aksi: ✏ edit + 🗑 hapus (ConfirmDialog)
//
// Anti-pattern §10 dipakai:
//   - toast lewat useRef (TIDAK di deps)
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
} from "../../lib/airport-data"
import type { DBLeave } from "../../lib/shared"
import { deriveDisplayInitial, isUuidLike } from "../../lib/shared"
import { useResolvedAirport } from "../../hooks/useResolvedAirport"

/* ----------------------------------------------------------------
   Types — DBLeave dipindah ke src/lib/shared/db-types.ts (cleanup #3)
   ---------------------------------------------------------------- */
type LeaveCategory = "CUTI" | "SAKIT" | "DIKLAT" | "OTHERS"

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
const CATEGORIES: LeaveCategory[] = ["CUTI", "SAKIT", "DIKLAT", "OTHERS"]

// deriveDisplayInitial + isUuidLike → import dari ../../lib/shared (Phase 4 dedup)

const isCrossMonth = (lv: DBLeave, year: number, month: number): boolean => {
  const start = new Date(lv.start_date)
  const end = new Date(lv.end_date)
  return start.getMonth() + 1 !== month || end.getMonth() + 1 !== month
      || start.getFullYear() !== year   || end.getFullYear() !== year
}

const durationDays = (lv: DBLeave): number => {
  const start = new Date(lv.start_date)
  const end = new Date(lv.end_date)
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1
}

const fmtDate = (iso: string): string => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`
}

const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/* ----------------------------------------------------------------
   Personnel resolution (mirror RosterPage pattern)
   ---------------------------------------------------------------- */
interface DBPersonnel {
  id: string
  full_name?: string
  initial?: string
  branch_code?: string | null
}

// useResolvedAirport → import dari ../../hooks/useResolvedAirport (Phase 4 dedup)

/* ----------------------------------------------------------------
   Component
   ---------------------------------------------------------------- */
export default function OffRosterTab() {
  const ctx: any = useApp()
  const toast: any = useToast()
  const confirm: any = useConfirm()
  const user = ctx?.user
  const isAdmin = user?.role === "admin"
  const userBranchCode = (user?.branch_code || "").toUpperCase()

  // toast via ref (anti-pattern §10)
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])
  const confirmRef = useRef(confirm)
  useEffect(() => { confirmRef.current = confirm }, [confirm])

  // Airport resolution
  const { resolved, selectable } = useResolvedAirport(userBranchCode, isAdmin)

  // Filter state
  const [airportCode, setAirportCode] = useState<string>(
    resolved || userBranchCode || "WARR"
  )
  const [unit, setUnit] = useState<string>("TWR")
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [month, setMonth] = useState<number>(now.getMonth() + 1)

  const airport = useMemo(() => getAirport(airportCode), [airportCode])
  const availableUnits = useMemo(
    () => airport?.units?.map(u => u.unit) || ["TWR"],
    [airport]
  )

  // Personnel from context (already loaded by AppProvider).
  // Filter by branch + unit + is_active — mirror Legacy.tsx (line 222-226)
  // supaya Off-Roster dropdown scope ke unit yang dipilih. Sebelumnya:
  // TWR tab tampil semua branch personnel (TWR+APP) → MO bisa pilih APP
  // person sambil unit=TWR → leave tersimpan unit-mismatch → Legacy roster
  // generator silent-skip karena `personnel.find(pp => pp.id === lv.personnel_id)`
  // tidak ketemu (personnel TWR list tidak include APP person).
  const dbPersonnel = useMemo<DBPersonnel[]>(() => {
    const branchFilter = isAdmin ? null : userBranchCode
    const ctxPersonnel: any[] = ctx?.personnel || []
    return ctxPersonnel
      .filter((p: any) => {
        if (branchFilter && p.branch_code !== branchFilter) return false
        // p.unit boleh null/undefined (legacy data), kalau set HARUS match.
        if (p.unit && p.unit !== unit) return false
        if (p.is_active === false) return false
        return true
      })
      .map((p: any, i: number) => {
        const name = p.name || p.full_name || ""
        const rawInit = p.initial && !isUuidLike(p.initial) ? p.initial : null
        const initial = rawInit || deriveDisplayInitial(name, `P${i + 1}`)
        return {
          id: p.id, full_name: name, initial,
          branch_code: p.branch_code,
        }
      })
  }, [isAdmin, userBranchCode, unit, ctx?.personnel])

  // Leaves state
  const [leaves, setLeaves] = useState<DBLeave[]>([])
  const [loading, setLoading] = useState(false)

  // Form state
  const [formOpen, setFormOpen] = useState(false)
  const [formEdit, setFormEdit] = useState<DBLeave | null>(null)
  const blankForm = useMemo(() => ({
    personnel_id: "",
    category: "CUTI" as LeaveCategory,
    start_date: todayISO(),
    end_date: todayISO(),
    note: "",
  }), [])
  const [form, setForm] = useState(blankForm)
  const [formErr, setFormErr] = useState<string>("")

  // Filter chip
  type Filter = "ALL" | LeaveCategory | "CROSS_MONTH"
  const [filter, setFilter] = useState<Filter>("ALL")

  /* ── Load leaves yang touches bulan ini (signal-owned by useEffect) ── */
  const loadLeavesWithSignal = useCallback(async (signal: AbortSignal) => {
    if (!airportCode || !unit || !year || !month) return
    if (signal.aborted) return
    setLoading(true)
    try {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

      // FK relation atc_leaves.personnel_id → personnel.id tidak
      // terdefinisi di Supabase, jadi PostgREST embed join via
      // alias-syntax (initial, full_name) return 400 Bad Request.
      // Lagipula column `full_name` tidak ada di personnel (canonical
      // column adalah `name`). Solusi: split jadi 2 query.
      //   1. Query atc_leaves tanpa embed
      //   2. Query personnel by IN ids, build map, attach ke setiap row
      // dengan shape { initial, full_name } supaya consumer di UI
      // (`lv.personnel?.full_name || lv.personnel?.initial`) tetap kerja.
      const { data: rawLeaves, error } = await supabase
        .from("atc_leaves")
        .select("*")
        .eq("airport_code", airportCode)
        .eq("unit", unit)
        .lte("start_date", monthEnd)
        .gte("end_date", monthStart)
        .order("start_date")
        .abortSignal(signal)

      if (signal.aborted) return
      if (error) {
        if (!/no rows/i.test(error.message)) {
          toastRef.current?.error?.("Gagal memuat off-roster", error.message)
        }
        setLeaves([])
        return
      }

      // Lookup personnel names secara terpisah (no FK = no embed)
      const personnelIds = [
        ...new Set((rawLeaves || []).map((r: any) => r.personnel_id)),
      ]
      const personnelMap: Record<string, { initial: string; full_name: string }> = {}
      if (personnelIds.length > 0) {
        const { data: persons } = await supabase
          .from("personnel")
          .select("id, initial, name")
          .in("id", personnelIds)
          .abortSignal(signal)
        if (signal.aborted) return
        for (const p of (persons || []) as any[]) {
          personnelMap[p.id] = {
            initial: p.initial || "",
            full_name: p.name || "",  // personnel.name → attach as full_name
          }
        }
      }

      const merged: DBLeave[] = (rawLeaves || []).map((r: any) => ({
        ...r,
        personnel: personnelMap[r.personnel_id] || { initial: "", full_name: "" },
      }))
      setLeaves(merged)
    } catch (e: any) {
      if (e?.name === "AbortError" || signal.aborted) return
      toastRef.current?.error?.("Gagal memuat", e?.message || String(e))
      setLeaves([])
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [airportCode, unit, year, month])

  // useEffect OWNS the AbortController — proper cleanup on dep change/unmount.
  useEffect(() => {
    const ctrl = new AbortController()
    loadLeavesWithSignal(ctrl.signal)
    return () => ctrl.abort()
  }, [loadLeavesWithSignal])

  // One-shot reload for the Reload button / post-mutation refresh.
  const loadLeaves = useCallback(() => {
    const ctrl = new AbortController()
    loadLeavesWithSignal(ctrl.signal)
    // No cleanup — one-shot. Abort if a newer auto-load fires.
  }, [loadLeavesWithSignal])

  /* ── Stats ── */
  const stats = useMemo(() => {
    const total = leaves.length
    const totalDays = leaves.reduce((s, l) => s + durationDays(l), 0)
    const byCat: Record<LeaveCategory, number> = { CUTI: 0, SAKIT: 0, DIKLAT: 0, OTHERS: 0 }
    leaves.forEach(l => { byCat[l.category] = (byCat[l.category] || 0) + 1 })
    const dominant = (Object.entries(byCat) as Array<[LeaveCategory, number]>)
      .sort((a, b) => b[1] - a[1])[0]
    const crossMonth = leaves.filter(l => isCrossMonth(l, year, month)).length
    return { total, totalDays, dominant, crossMonth, byCat }
  }, [leaves, year, month])

  /* ── Filtered list ── */
  const filteredLeaves = useMemo(() => {
    if (filter === "ALL") return leaves
    if (filter === "CROSS_MONTH") return leaves.filter(l => isCrossMonth(l, year, month))
    return leaves.filter(l => l.category === filter)
  }, [leaves, filter, year, month])

  /* ── Form handlers ── */
  const openAdd = useCallback(() => {
    setFormEdit(null)
    setForm(blankForm)
    setFormErr("")
    setFormOpen(true)
  }, [blankForm])

  const openEdit = useCallback((lv: DBLeave) => {
    setFormEdit(lv)
    setForm({
      personnel_id: lv.personnel_id,
      category: lv.category,
      start_date: lv.start_date,
      end_date: lv.end_date,
      note: lv.note || "",
    })
    setFormErr("")
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
    setFormErr("")
  }, [])

  const validateForm = (): string => {
    if (!form.personnel_id) return "Personel wajib dipilih."
    if (!form.start_date)   return "Tanggal mulai wajib diisi."
    if (!form.end_date)     return "Tanggal selesai wajib diisi."
    if (form.end_date < form.start_date) {
      return "Tanggal selesai harus ≥ tanggal mulai."
    }
    return ""
  }

  const submitForm = useCallback(async () => {
    const err = validateForm()
    if (err) { setFormErr(err); return }

    const payload = {
      personnel_id: form.personnel_id,
      airport_code: airportCode,
      unit,
      start_date: form.start_date,
      end_date: form.end_date,
      category: form.category,
      note: form.note || null,
    }

    try {
      if (formEdit) {
        const { error } = await supabase
          .from("atc_leaves")
          .update(payload)
          .eq("id", formEdit.id)
        if (error) throw error
        toastRef.current?.success?.("Tersimpan", "Off-roster diperbarui.")
      } else {
        const { error } = await supabase
          .from("atc_leaves")
          .insert(payload)
        if (error) throw error
        toastRef.current?.success?.("Tersimpan", "Off-roster ditambahkan.")
      }
      setFormOpen(false)
      loadLeaves()
    } catch (e: any) {
      toastRef.current?.error?.(
        formEdit ? "Gagal memperbarui" : "Gagal menambah",
        e?.message || String(e),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, formEdit, airportCode, unit, loadLeaves])

  const handleDelete = useCallback((lv: DBLeave) => {
    const personName = lv.personnel?.full_name || lv.personnel?.initial || "personel"
    const fn = confirmRef.current
    const doDelete = async () => {
      const { error } = await supabase.from("atc_leaves").delete().eq("id", lv.id)
      if (error) {
        toastRef.current?.error?.("Gagal menghapus", error.message)
        return
      }
      toastRef.current?.success?.("Terhapus", "Off-roster dihapus.")
      loadLeaves()
    }
    if (fn) {
      Promise.resolve(fn({
        title: "Hapus Off-Roster?",
        detail: "Aksi ini tidak bisa dibatalkan.",
        target: `${lv.category} · ${personName} · ${fmtDate(lv.start_date)} – ${fmtDate(lv.end_date)}`,
        destructive: true,
        confirmText: "Hapus",
      })).then((ok: boolean) => { if (ok) doDelete() })
    } else {
      if (window.confirm(`Hapus ${lv.category} ${personName}?`)) doDelete()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLeaves])

  /* ── Render ── */
  return (
    <div className="or-tab">
      {/* Toolbar — minimal, scoped to this tab */}
      <div className="or-toolbar">
        <div className="or-field">
          <label htmlFor="or-airport">Cabang</label>
          <select
            id="or-airport"
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
          <label htmlFor="or-unit">Unit</label>
          <select id="or-unit" value={unit} onChange={e => setUnit(e.target.value)}>
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="or-field">
          <label htmlFor="or-month">Bulan</label>
          <select id="or-month" value={month} onChange={e => setMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div className="or-field">
          <label htmlFor="or-year">Tahun</label>
          <select id="or-year" value={year} onChange={e => setYear(Number(e.target.value))}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="or-spacer"/>
        <button className="or-btn" type="button" onClick={loadLeaves} disabled={loading}>
          <I n="refresh" s={14}/> Reload
        </button>
      </div>

      {/* Stats */}
      <div className="or-stats">
        <div className="or-stat">
          <div className="or-stat-ic warn"><I n="users" s={16}/></div>
          <div>
            <div className="or-stat-l">Bulan ini</div>
            <div className="or-stat-v">{stats.total}</div>
            <div className="or-stat-s">Off-Roster entries</div>
          </div>
        </div>
        <div className="or-stat">
          <div className="or-stat-ic alert"><I n="bell" s={16}/></div>
          <div>
            <div className="or-stat-l">Hari Leave</div>
            <div className="or-stat-v">{stats.totalDays}</div>
            <div className="or-stat-s">total person-hari</div>
          </div>
        </div>
        <div className="or-stat">
          <div className="or-stat-ic acc"><I n="list" s={16}/></div>
          <div>
            <div className="or-stat-l">Tersering</div>
            <div className="or-stat-v sm">
              {stats.dominant && stats.dominant[1] > 0
                ? `${stats.dominant[0]} · ${stats.dominant[1]}`
                : "—"}
            </div>
            <div className="or-stat-s">kategori dominan</div>
          </div>
        </div>
        <div className="or-stat">
          <div className="or-stat-ic warn"><I n="clock" s={16}/></div>
          <div>
            <div className="or-stat-l">Cross-month</div>
            <div className="or-stat-v">{stats.crossMonth}</div>
            <div className="or-stat-s">leave melintasi bulan</div>
          </div>
        </div>
      </div>

      {/* Form (expand inline) */}
      {formOpen && (
        <div className="or-form-card">
          <h3>
            {formEdit ? "✏ Edit Off-Roster" : "➕ Tambah Off-Roster"}
            <button
              className="or-close-btn"
              type="button"
              onClick={closeForm}
              aria-label="Tutup form"
            >×</button>
          </h3>
          <div className="or-form-row">
            <div className="or-form-field">
              <label htmlFor="or-form-pers">Personel</label>
              <select
                id="or-form-pers"
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
              <label htmlFor="or-form-cat">Kategori</label>
              <select
                id="or-form-cat"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value as LeaveCategory })}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="or-form-field">
              <label htmlFor="or-form-start">Tanggal Mulai</label>
              <input
                id="or-form-start"
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="or-form-field">
              <label htmlFor="or-form-end">Tanggal Selesai</label>
              <input
                id="or-form-end"
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          <div className="or-form-row single">
            <div className="or-form-field">
              <label htmlFor="or-form-note">Catatan (opsional)</label>
              <textarea
                id="or-form-note"
                value={form.note}
                onChange={e => setForm({ ...form, note: e.target.value })}
                placeholder="Mis. nomor surat cuti, alasan diklat"
                rows={2}
              />
              <span className="or-hint">
                Cuti boleh lintas bulan — engine otomatis tracking ke bulan berikutnya.
              </span>
            </div>
          </div>
          {formErr && (
            <div className="or-form-err" role="alert">
              <I n="alert" s={14}/> {formErr}
            </div>
          )}
          <div className="or-form-actions">
            <button className="or-btn" type="button" onClick={closeForm}>Batal</button>
            <button className="or-btn or-btn-primary" type="button" onClick={submitForm}>
              {formEdit ? "Simpan Perubahan" : "Tambah Off-Roster"}
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
            >Semua · {stats.total}</button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                className={"or-chip" + (filter === c ? " is-active" : "")}
                onClick={() => setFilter(c)}
                type="button"
              >{c} · {stats.byCat[c]}</button>
            ))}
            <button
              className={"or-chip" + (filter === "CROSS_MONTH" ? " is-active" : "")}
              onClick={() => setFilter("CROSS_MONTH")}
              type="button"
            >Cross-month · {stats.crossMonth}</button>
          </div>
          {!formOpen && (
            <button
              className="or-btn or-btn-primary"
              type="button"
              onClick={openAdd}
            >+ Tambah Off-Roster</button>
          )}
        </div>

        <div className="or-table-scroll">
          <table className="or-table">
            <thead>
              <tr>
                <th>Tgl Mulai</th>
                <th>Tgl Selesai</th>
                <th>Personel</th>
                <th>Kategori</th>
                <th>Durasi</th>
                <th>Catatan</th>
                <th className="th-actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row">
                    {loading
                      ? "Memuat off-roster…"
                      : leaves.length === 0
                        ? `Belum ada off-roster untuk ${MONTHS[month - 1]} ${year}.`
                        : "Tidak ada entry yang cocok dengan filter."}
                  </td>
                </tr>
              ) : filteredLeaves.map(lv => {
                const isCross = isCrossMonth(lv, year, month)
                const personName = lv.personnel?.full_name || lv.personnel?.initial
                  || (dbPersonnel.find(p => p.id === lv.personnel_id)?.full_name)
                  || "—"
                const personInit = lv.personnel?.initial
                  || (dbPersonnel.find(p => p.id === lv.personnel_id)?.initial)
                  || "—"
                return (
                  <tr key={lv.id} className={isCross ? "is-cross-month" : ""}>
                    <td className="mono">{fmtDate(lv.start_date)}</td>
                    <td className="mono">{fmtDate(lv.end_date)}</td>
                    <td className="name">
                      <b>{personInit}</b>
                      {personName !== personInit && <span className="sub"> — {personName}</span>}
                    </td>
                    <td>
                      <span className={`or-pill or-pill-${lv.category.toLowerCase()}`}>
                        {lv.category}
                      </span>
                    </td>
                    <td className="mono">{durationDays(lv)} hari</td>
                    <td className="note">{lv.note || <span className="faint">—</span>}</td>
                    <td className="actions">
                      <button
                        className="or-ic-btn"
                        type="button"
                        onClick={() => openEdit(lv)}
                        aria-label="Edit"
                      >✏</button>
                      <button
                        className="or-ic-btn danger"
                        type="button"
                        onClick={() => handleDelete(lv)}
                        aria-label="Hapus"
                      >🗑</button>
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
