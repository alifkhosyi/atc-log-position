// ============================================================
// src/components/ConfirmDialog.jsx — Async confirm dialog (replaces confirm)
// ──────────────────────────────────────────────────────────
// Usage:
//   const confirm = useConfirm();
//   const ok = await confirm({
//     title: "Hapus checklist?",
//     detail: "Aksi ini tidak bisa dibatalkan.",
//     target: "Shift Morning · 24 Mei · MOD Budi",
//     destructive: true,
//     confirmText: "Hapus",
//   });
//   if (!ok) return;
// ============================================================
import React, { createContext, useContext, useState, useCallback, useEffect } from "react"

const ConfirmCtx = createContext(null)
export const useConfirm = () => useContext(ConfirmCtx)

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState(null)

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setState({ ...opts, resolve })
  }), [])

  const close = (result) => {
    state?.resolve?.(result)
    setState(null)
  }

  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === "Escape") close(false)
      if (e.key === "Enter") close(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="dialog-backdrop" onClick={() => close(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="dialog-title">{state.title || "Konfirmasi"}</h3>
            {state.detail && <p className="dialog-detail">{state.detail}</p>}
            {state.target && <div className="dialog-target">{state.target}</div>}
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => close(false)}>
                {state.cancelText || "Batal"}
              </button>
              <button
                className={state.destructive ? "btn btn-danger" : "btn btn-primary"}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmText || "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  )
}
