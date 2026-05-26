// ============================================================
// src/components/DailyReport/EditableCell.jsx
// ──────────────────────────────────────────────────────────
// Inline-editable numeric cell for Section G's DEP/ARR/OVF
// columns. UX rules:
//
//   - Display mode: shows the number, or a dashed-border "—"
//     placeholder when value is null.
//   - Click / Enter → enter edit mode.
//   - Enter / Tab / Blur → save (when value changed).
//   - Esc → cancel and restore previous value.
//   - When `locked` is true, the cell is never editable.
//
// The save call is async; while in flight the cell shows a
// faint loading state and ignores further input. The parent
// passes onSave(value) and decides whether to surface a toast.
// ============================================================
import React, { useEffect, useRef, useState } from "react"

const sanitize = (raw) => {
  if (raw === "" || raw === null || raw === undefined) return null
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export const EditableCell = ({
  value,
  onSave,
  locked = false,
  ariaLabel,
}) => {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? "")
  const [saving, setSaving]   = useState(false)
  const inputRef              = useRef(null)

  useEffect(() => { setDraft(value ?? "") }, [value])

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = async () => {
    const next = sanitize(draft)
    if (next === (value ?? null)) { setEditing(false); return }
    setSaving(true)
    try {
      await onSave?.(next)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const cancel = () => {
    setDraft(value ?? "")
    setEditing(false)
  }

  if (locked) {
    return (
      <td className="sg-cell sg-cell-locked" aria-label={ariaLabel}>
        {value ?? "—"}
      </td>
    )
  }

  if (!editing) {
    const empty = value === null || value === undefined
    return (
      <td
        className={`sg-cell${empty ? " sg-cell-empty" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={ariaLabel}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault(); setEditing(true)
          }
        }}
      >
        {empty ? <span className="sg-cell-placeholder">—</span> : value}
      </td>
    )
  }

  return (
    <td className="sg-cell sg-cell-editing">
      <input
        ref={inputRef}
        type="number"
        inputMode="numeric"
        min="0"
        className="sg-cell-input"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault(); commit()
          } else if (e.key === "Escape") {
            e.preventDefault(); cancel()
          }
        }}
        aria-label={ariaLabel}
      />
    </td>
  )
}
