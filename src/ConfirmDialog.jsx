// ============================================================
// ConfirmDialog.jsx — Drop-in confirm dialog
// ──────────────────────────────────────────────────────────
// Usage:
//   1. Wrap app:  <ConfirmProvider><App/></ConfirmProvider>
//   2. Anywhere:  const confirm = useConfirm();
//
//      const ok = await confirm({
//        title:       "Hapus checklist?",
//        detail:      "Aksi ini tidak bisa dibatalkan.",
//        target:      "Shift Morning · 24 Mei · MOD Budi",
//        destructive: true,
//        confirmText: "Hapus",
//      });
//      if (!ok) return;
//      await deleteRecord();
//
// Replaces native confirm() — themed, descriptive, async/await friendly.
// ============================================================

import { createContext, useContext, useState, useCallback, useEffect } from "react"

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

  // ESC to cancel, Enter to confirm
  useEffect(() => {
    if (!state) return
    const onKey = (e) => {
      if (e.key === "Escape") close(false)
      if (e.key === "Enter") close(true)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
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
              <button className="btn btn-ghost" onClick={() => close(false)} autoFocus={!state.destructive}>
                {state.cancelText || "Batal"}
              </button>
              <button
                className={state.destructive ? "btn btn-danger" : "btn btn-primary"}
                onClick={() => close(true)}
                autoFocus={state.destructive}
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
