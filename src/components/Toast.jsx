// ============================================================
// src/components/Toast.jsx — Toast notification (replaces alert)
// ──────────────────────────────────────────────────────────
// Usage:
//   const toast = useToast();
//   toast.success("Berhasil disimpan");
//   toast.error("Gagal menghapus", "ATC sedang on mic");
//
// Phase 4 audit fix C-07: error.message dari Supabase di-translate
// ke pesan friendly bahasa Indonesia. Raw message tetap di-log ke
// console untuk debug.
// ============================================================
import React, { createContext, useContext, useState, useCallback } from "react"

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

// ─── Error message translator (C-07 fix) ───
// Mapping common Supabase / Postgres / network errors → bahasa Indonesia.
// Selalu return string. Kalau ga match, kembalikan apa adanya.
function translateError(raw) {
  if (!raw) return raw
  if (typeof raw !== "string") raw = String(raw)
  const lc = raw.toLowerCase()

  // Auth
  if (lc.includes("invalid login credentials")) return "Email atau password salah"
  if (lc.includes("email not confirmed")) return "Email belum dikonfirmasi"
  if (lc.includes("jwt") || lc.includes("token expired") || lc.includes("invalid token"))
    return "Sesi habis, silakan login ulang"
  if (lc.includes("user not found")) return "Akun tidak ditemukan"

  // Postgres / DB
  if (lc.includes("duplicate key") || lc.includes("unique constraint") || lc.includes("already exists"))
    return "Data sudah ada (duplikasi)"
  if (lc.includes("violates foreign key"))
    return "Data masih terhubung dengan record lain, tidak bisa dihapus"
  if (lc.includes("not null") || lc.includes("required"))
    return "Ada kolom wajib yang belum diisi"
  if (lc.includes("invalid input") || lc.includes("invalid syntax") || lc.includes("invalid uuid"))
    return "Format input tidak valid"
  if (lc.includes("does not exist") || lc.includes("not found"))
    return "Data tidak ditemukan"
  if (lc.includes("check constraint"))
    return "Nilai input di luar yang diperbolehkan"

  // RLS / permissions
  if (lc.includes("permission denied") || lc.includes("not authorized") ||
      lc.includes("row-level security") || lc.includes("rls"))
    return "Tidak punya izin untuk operasi ini"

  // Network
  if (lc.includes("network") || lc.includes("fetch failed") ||
      lc.includes("failed to fetch") || lc.includes("connection"))
    return "Koneksi terputus, coba lagi"
  if (lc.includes("timeout") || lc.includes("timed out"))
    return "Permintaan terlalu lama, coba lagi"
  if (lc.includes("rate limit") || lc.includes("too many requests"))
    return "Terlalu banyak permintaan, tunggu sebentar"

  // Server
  if (lc.includes("internal server") || lc.includes("500"))
    return "Server bermasalah sementara, coba lagi nanti"
  if (lc.includes("503") || lc.includes("service unavailable"))
    return "Layanan tidak tersedia sementara"

  // Default: return original (mungkin sudah friendly atau aplikasi-spesifik)
  return raw
}

const Icon = ({ kind }) => {
  const s = { width:20, height:20, viewBox:"0 0 24 24", fill:"none", stroke:"currentColor",
              strokeWidth:2.5, strokeLinecap:"round", strokeLinejoin:"round" }
  if (kind === "success") return <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>
  if (kind === "error")   return <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
  if (kind === "info")    return <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
  if (kind === "warn")    return <svg {...s}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  return null
}

let __id = 0
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(t => t.map(x => x.id === id ? {...x, out:true} : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 200)
  }, [])

  const push = useCallback((kind, title, msg, duration = 4000) => {
    // C-07 fix: untuk error toast, translate raw Supabase message
    let displayMsg = msg
    if (kind === "error" && msg) {
      const translated = translateError(msg)
      if (translated !== msg) {
        // Log raw ke console supaya developer bisa debug
        if (typeof console !== "undefined") {
          console.warn(`[toast] raw error (translated to "${translated}"):`, msg)
        }
        displayMsg = translated
      }
    }
    const id = ++__id
    setToasts(t => [...t, { id, kind, title, msg: displayMsg }])
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }, [dismiss])

  const api = {
    success: (title, msg, duration) => push("success", title, msg, duration),
    error:   (title, msg, duration) => push("error",   title, msg, duration ?? 6000),
    info:    (title, msg, duration) => push("info",    title, msg, duration),
    warn:    (title, msg, duration) => push("warn",    title, msg, duration),
    dismiss,
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind} ${t.out ? "toast-out" : ""}`} role="alert">
            <div className="toast-icon"><Icon kind={t.kind}/></div>
            <div className="toast-text">
              <div className="toast-title">{t.title}</div>
              {t.msg && <div className="toast-msg">{t.msg}</div>}
            </div>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Tutup">×</button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
