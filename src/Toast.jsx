// ============================================================
// Toast.jsx — Drop-in toast notification system
// ──────────────────────────────────────────────────────────
// Usage:
//   1. Wrap app:  <ToastProvider><App/></ToastProvider>
//   2. Anywhere:  const toast = useToast();
//                 toast.success("Berhasil disimpan");
//                 toast.error("Gagal menghapus", "ATC sedang on mic");
//                 toast.info("Memuat data...");
//                 toast.warn("Shift hampir berakhir");
//
// Replaces native alert() — non-blocking, themed, auto-dismiss.
// ============================================================

import { createContext, useContext, useState, useCallback, useEffect } from "react"

const ToastCtx = createContext(null)
export const useToast = () => useContext(ToastCtx)

const ICONS = {
  success: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  error:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  info:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  warn:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
}

let __id = 0

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(t => t.map(x => x.id === id ? {...x, out:true} : x))
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 200)
  }, [])

  const push = useCallback((kind, title, msg, duration = 4000) => {
    const id = ++__id
    setToasts(t => [...t, { id, kind, title, msg }])
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
            <div className="toast-icon">{ICONS[t.kind]}</div>
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
