// ============================================================
// src/pages/PersonnelPage.tsx — Pengaturan Personnel (MO + Admin)
// ──────────────────────────────────────────────────────────
// CRUD personnel dengan scope:
//   - MO cabang: full CRUD personnel cabangnya sendiri (RLS-enforced)
//   - Admin INMC: full CRUD semua cabang + cabang picker enabled
//
// UI pattern mirror OffRosterTab.tsx untuk konsistensi:
//   - Toolbar (filter dropdowns + search) → Stats strip → Form expand
//     inline → Table dengan aksi
//
// Soft delete via is_active toggle (no hard delete button untuk MO).
// Admin masih bisa hard delete via Supabase Dashboard jika perlu.
//
// Anti-pattern §10 compliant:
//   - toast/confirm via useRef (TIDAK di dependency array)
//   - AbortController OWNED by useEffect
//   - Empty data → empty state UI, no toast spam
//   - Dependency array minimal
// ============================================================

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react"
import { supabase } from "../supabase.js"
import { useApp } from "../lib/context.jsx"
import { useToast } from "../components/Toast.jsx"
import { useConfirm } from "../components/ConfirmDialog.jsx"
import { I } from "../components/Icons.jsx"
import { listAirports } from "../lib/airport-data"
import { deriveDisplayInitial } from "../lib/shared"
import "./RosterPage/roster-shell.css"  // OR classes (or-tab, or-stat, or-table, dst)

interface DBPersonnel {
  id: string
  name: string
  unit: string | null
  branch_code: string | null
  is_active: boolean
  priority_order: number
  nik?: string | null
  created_at?: string
}

interface PersonnelFormState {
  name: string
  unit: string
  nik: string
  priority_order: number
  is_active: boolean
}

const blankForm = (defaultUnit: string): PersonnelFormState => ({
  name: "",
  unit: defaultUnit,
  nik: "",
  priority_order: 0,
  is_active: true,
})

// deriveDisplayInitial → import dari ../lib/shared (Phase 4 dedup)

export default function PersonnelPage() {
  const ctx: any = useApp()
  const toast: any = useToast()
  const confirm: any = useConfirm()
  const user = ctx?.user
  const isAdmin = user?.role === "admin"
  const userBranchCode = (user?.branch_code || "").toUpperCase()

  // toast/confirm via ref (anti-pattern §10 — JANGAN deps)
  const toastRef = useRef(toast)
  useEffect(() => { toastRef.current = toast }, [toast])
  const confirmRef = useRef(confirm)
  useEffect(() => { confirmRef.current = confirm }, [confirm])

  // ─── Airport resolution ──────────────────────────────────────
  const allAirports = useMemo(() => listAirports(), [])
  const selectableAirports = useMemo(() => {
    if (isAdmin) return allAirports
    return allAirports.filter(a =>
      a.airport_code === userBranchCode
      || a.branch_code?.toUpperCase() === userBranchCode,
    )
  }, [isAdmin, allAirports, userBranchCode])

  // ─── Toolbar state ──────────────────────────────────────────
  const [branchCode, setBranchCode] = useState<string>(() => {
    if (isAdmin) return selectableAirports[0]?.branch_code || ""
    return userBranchCode
  })
  const [unitFilter, setUnitFilter] = useState<string>("ALL")
  const [activeFilter, setActiveFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ACTIVE")
  const [search, setSearch] = useState("")

  const currentAirport = useMemo(() => {
    return allAirports.find(a =>
      a.branch_code?.toUpperCase() === branchCode.toUpperCase(),
    )
  }, [branchCode, allAirports])

  const availableUnits = useMemo<string[]>(
    () => currentAirport?.units?.map(u => u.unit) || ["TWR"],
    [currentAirport],
  )

  // ─── Data state ────────────────────────────────────────────
  const [personnel, setPersonnel] = useState<DBPersonnel[]>([])
  const [loading, setLoading] = useState(false)

  // ─── Form state ─────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [formEdit, setFormEdit] = useState<DBPersonnel | null>(null)
  const [form, setForm] = useState<PersonnelFormState>(() => blankForm(availableUnits[0]))
  const [formErr, setFormErr] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // ─── Load personnel (signal-owned) ─────────────────────────
  const loadPersonnelWithSignal = useCallback(async (signal: AbortSignal) => {
    if (!branchCode) return
    if (signal.aborted) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, unit, branch_code, is_active, priority_order, nik, created_at")
        .eq("branch_code", branchCode)
        .order("priority_order", { ascending: true })
        .order("name", { ascending: true })
        .abortSignal(signal)

      if (signal.aborted) return
      if (error) {
        if (!/no rows/i.test(error.message)) {
          toastRef.current?.error?.("Gagal memuat personel", error.message)
        }
        setPersonnel([])
        return
      }
      setPersonnel((data || []) as DBPersonnel[])
    } catch (e: any) {
      if (e?.name === "AbortError" || signal.aborted) return
      toastRef.current?.error?.("Gagal memuat", e?.message || String(e))
      setPersonnel([])
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [branchCode])

  useEffect(() => {
    const ctrl = new AbortController()
    loadPersonnelWithSignal(ctrl.signal)
    return () => ctrl.abort()
  }, [loadPersonnelWithSignal])

  const reload = useCallback(() => {
    const ctrl = new AbortController()
    loadPersonnelWithSignal(ctrl.signal)
  }, [loadPersonnelWithSignal])

  // ─── Stats ─────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = personnel.filter(p => p.is_active).length
    const inactive = personnel.length - active
    const byUnit: Record<string, number> = {}
    for (const p of personnel) {
      if (!p.is_active) continue
      const u = p.unit || "—"
      byUnit[u] = (byUnit[u] || 0) + 1
    }
    return { total: personnel.length, active, inactive, byUnit }
  }, [personnel])

  // ─── Filtered list ─────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = personnel
    if (activeFilter === "ACTIVE") out = out.filter(p => p.is_active)
    else if (activeFilter === "INACTIVE") out = out.filter(p => !p.is_active)
    if (unitFilter !== "ALL") out = out.filter(p => p.unit === unitFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      out = out.filter(p =>
        p.name.toLowerCase().includes(q)
        || (p.nik || "").toLowerCase().includes(q),
      )
    }
    return out
  }, [personnel, activeFilter, unitFilter, search])

  // ─── Form handlers ─────────────────────────────────────────
  const openAdd = useCallback(() => {
    setFormEdit(null)
    setForm(blankForm(availableUnits[0]))
    setFormErr("")
    setFormOpen(true)
  }, [availableUnits])

  const openEdit = useCallback((p: DBPersonnel) => {
    setFormEdit(p)
    setForm({
      name: p.name,
      unit: p.unit || availableUnits[0],
      nik: p.nik || "",
      priority_order: p.priority_order ?? 0,
      is_active: p.is_active,
    })
    setFormErr("")
    setFormOpen(true)
  }, [availableUnits])

  const closeForm = useCallback(() => {
    setFormOpen(false)
    setFormErr("")
  }, [])

  const validateForm = (): string => {
    if (!form.name.trim()) return "Nama wajib diisi."
    if (form.name.trim().length < 2) return "Nama terlalu pendek (min 2 huruf)."
    if (!form.unit) return "Unit wajib dipilih."
    if (form.priority_order < 0 || form.priority_order > 999) {
      return "Urutan harus antara 0-999."
    }
    return ""
  }

  const submitForm = useCallback(async () => {
    if (submitting) return
    const err = validateForm()
    if (err) { setFormErr(err); return }

    setSubmitting(true)
    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      branch_code: branchCode,
      is_active: form.is_active,
      priority_order: form.priority_order,
      nik: form.nik.trim() || null,
    }

    try {
      if (formEdit) {
        const { error } = await supabase
          .from("personnel")
          .update(payload)
          .eq("id", formEdit.id)
        if (error) throw error
        toastRef.current?.success?.("Tersimpan", `${form.name} diperbarui.`)
      } else {
        const { error } = await supabase
          .from("personnel")
          .insert(payload)
        if (error) throw error
        toastRef.current?.success?.("Tersimpan", `${form.name} ditambahkan.`)
      }
      setFormOpen(false)
      reload()
    } catch (e: any) {
      toastRef.current?.error?.(
        formEdit ? "Gagal memperbarui" : "Gagal menambah",
        e?.message || String(e),
      )
    } finally {
      setSubmitting(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, formEdit, branchCode, submitting, reload])

  const toggleActive = useCallback((p: DBPersonnel) => {
    const newActive = !p.is_active
    const fn = confirmRef.current
    const doToggle = async () => {
      const { error } = await supabase
        .from("personnel")
        .update({ is_active: newActive })
        .eq("id", p.id)
      if (error) {
        toastRef.current?.error?.("Gagal update status", error.message)
        return
      }
      toastRef.current?.success?.(
        newActive ? "Diaktifkan" : "Dinonaktifkan",
        `${p.name} ${newActive ? "aktif" : "tidak aktif"}.`,
      )
      reload()
    }
    if (fn) {
      Promise.resolve(fn({
        title: newActive ? "Aktifkan Personel?" : "Nonaktifkan Personel?",
        detail: newActive
          ? `${p.name} akan muncul lagi di roster baru.`
          : `${p.name} tidak akan masuk roster baru. Roster bulan lampau tidak terpengaruh.`,
        target: `${p.name} · ${p.unit || "—"} · ${p.branch_code}`,
        destructive: !newActive,
        confirmText: newActive ? "Aktifkan" : "Nonaktifkan",
      })).then((ok: boolean) => { if (ok) doToggle() })
    } else {
      if (window.confirm(`${newActive ? "Aktifkan" : "Nonaktifkan"} ${p.name}?`)) doToggle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="or-tab">
      {/* Toolbar */}
      <div className="or-toolbar">
        <div className="or-field">
          <label htmlFor="p-branch">Cabang</label>
          <select
            id="p-branch"
            value={branchCode}
            onChange={e => setBranchCode(e.target.value)}
            disabled={!isAdmin && selectableAirports.length <= 1}
          >
            {selectableAirports.map(a => (
              <option key={a.branch_code || a.airport_code} value={a.branch_code || a.airport_code}>
                {a.branch_code} — {a.airport_name}
              </option>
            ))}
          </select>
        </div>
        <div className="or-field">
          <label htmlFor="p-unit">Unit</label>
          <select id="p-unit" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
            <option value="ALL">Semua Unit</option>
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="or-field">
          <label htmlFor="p-active">Status</label>
          <select
            id="p-active"
            value={activeFilter}
            onChange={e => setActiveFilter(e.target.value as any)}
          >
            <option value="ACTIVE">Aktif saja</option>
            <option value="INACTIVE">Nonaktif saja</option>
            <option value="ALL">Semua</option>
          </select>
        </div>
        <div className="or-field" style={{ flex: 1, minWidth: 180 }}>
          <label htmlFor="p-search">Cari</label>
          <input
            id="p-search"
            type="text"
            placeholder="Nama atau NIK…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="or-spacer"/>
        <button className="or-btn" type="button" onClick={reload} disabled={loading}>
          <I n="refresh" s={14}/> Reload
        </button>
      </div>

      {/* Stats */}
      <div className="or-stats">
        <div className="or-stat">
          <div className="or-stat-ic acc"><I n="users" s={16}/></div>
          <div>
            <div className="or-stat-l">Aktif</div>
            <div className="or-stat-v">{stats.active}</div>
            <div className="or-stat-s">personel terdaftar</div>
          </div>
        </div>
        <div className="or-stat">
          <div className="or-stat-ic warn"><I n="users" s={16}/></div>
          <div>
            <div className="or-stat-l">Nonaktif</div>
            <div className="or-stat-v">{stats.inactive}</div>
            <div className="or-stat-s">soft-deleted</div>
          </div>
        </div>
        {availableUnits.map(u => (
          <div key={u} className="or-stat">
            <div className="or-stat-ic"><I n="tower" s={16}/></div>
            <div>
              <div className="or-stat-l">{u}</div>
              <div className="or-stat-v">{stats.byUnit[u] || 0}</div>
              <div className="or-stat-s">aktif di unit</div>
            </div>
          </div>
        ))}
      </div>

      {/* Form expand inline */}
      {formOpen && (
        <div className="or-form-card">
          <h3>
            {formEdit ? "Edit Personel" : "Tambah Personel"}
            <button
              className="or-close-btn"
              type="button"
              onClick={closeForm}
              aria-label="Tutup form"
            >×</button>
          </h3>
          <div className="or-form-row">
            <div className="or-form-field" style={{ gridColumn: "span 2" }}>
              <label htmlFor="p-form-name">Nama Lengkap</label>
              <input
                id="p-form-name"
                type="text"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="AKHMAD NASUKHA"
                autoFocus
              />
              <span className="or-hint">
                Inisial otomatis: <b>{deriveDisplayInitial(form.name)}</b>
              </span>
            </div>
            <div className="or-form-field">
              <label htmlFor="p-form-unit">Unit</label>
              <select
                id="p-form-unit"
                value={form.unit}
                onChange={e => setForm({ ...form, unit: e.target.value })}
              >
                {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="or-form-field">
              <label htmlFor="p-form-nik">NIK (opsional)</label>
              <input
                id="p-form-nik"
                type="text"
                value={form.nik}
                onChange={e => setForm({ ...form, nik: e.target.value })}
                placeholder="2024xxxx"
              />
              <span className="or-hint">Untuk Tunjangan ATC.</span>
            </div>
            <div className="or-form-field">
              <label htmlFor="p-form-priority">Urutan</label>
              <input
                id="p-form-priority"
                type="number"
                min={0}
                max={999}
                value={form.priority_order}
                onChange={e => setForm({ ...form, priority_order: Number(e.target.value) })}
              />
              <span className="or-hint">0-999, makin kecil makin awal.</span>
            </div>
            <div className="or-form-field">
              <label htmlFor="p-form-active">Status</label>
              <select
                id="p-form-active"
                value={form.is_active ? "1" : "0"}
                onChange={e => setForm({ ...form, is_active: e.target.value === "1" })}
              >
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </div>
          </div>
          {formErr && (
            <div className="or-form-err" role="alert">
              <I n="alert" s={14}/> {formErr}
            </div>
          )}
          <div className="or-form-actions">
            <button className="or-btn" type="button" onClick={closeForm} disabled={submitting}>
              Batal
            </button>
            <button
              className="or-btn or-btn-primary"
              type="button"
              onClick={submitForm}
              disabled={submitting}
            >
              {submitting
                ? "Menyimpan…"
                : formEdit ? "Simpan Perubahan" : "Tambah Personel"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="or-table-wrap">
        <div className="or-table-toolbar">
          <div className="or-filters">
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
              Menampilkan {filtered.length} dari {personnel.length} personel
            </span>
          </div>
          {!formOpen && (
            <button
              className="or-btn or-btn-primary"
              type="button"
              onClick={openAdd}
            >+ Tambah Personel</button>
          )}
        </div>

        <div className="or-table-scroll">
          <table className="or-table">
            <thead>
              <tr>
                <th>Inisial</th>
                <th>Nama Lengkap</th>
                <th>Unit</th>
                <th>NIK</th>
                <th>Urutan</th>
                <th>Status</th>
                <th className="th-actions">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-row" style={{ textAlign: "center", padding: "32px 12px", color: "var(--text-faint)" }}>
                    {loading
                      ? "Memuat personel…"
                      : personnel.length === 0
                        ? `Belum ada personel untuk ${branchCode}. Klik "+ Tambah Personel" untuk mulai.`
                        : "Tidak ada personel yang cocok dengan filter."}
                  </td>
                </tr>
              ) : filtered.map(p => (
                <tr key={p.id} className={p.is_active ? "" : "is-inactive"}>
                  <td className="name"><b>{deriveDisplayInitial(p.name)}</b></td>
                  <td>{p.name}</td>
                  <td>
                    <span className={`or-pill or-pill-${(p.unit || "").toLowerCase()}`}>
                      {p.unit || "—"}
                    </span>
                  </td>
                  <td className="mono">{p.nik || <span className="faint" style={{ color: "var(--text-faint)" }}>—</span>}</td>
                  <td className="mono">{p.priority_order}</td>
                  <td>
                    {p.is_active ? (
                      <span className="or-pill or-pill-active">Aktif</span>
                    ) : (
                      <span className="or-pill or-pill-inactive">Nonaktif</span>
                    )}
                  </td>
                  <td className="actions">
                    <button
                      className="or-ic-btn"
                      type="button"
                      onClick={() => openEdit(p)}
                      aria-label="Edit"
                      title="Edit personel"
                    ><I n="edit" s={14}/></button>
                    <button
                      className={"or-ic-btn" + (p.is_active ? " danger" : "")}
                      type="button"
                      onClick={() => toggleActive(p)}
                      aria-label={p.is_active ? "Nonaktifkan" : "Aktifkan"}
                      title={p.is_active ? "Nonaktifkan (soft delete)" : "Aktifkan kembali"}
                    >
                      <I n={p.is_active ? "x" : "check"} s={14}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
