// ============================================================
// src/components/Combobox.jsx — accessible combobox primitive
// ============================================================
// Phase 3 fix N-06 + C-03: shared, keyboard-accessible combobox
// dengan WAI-ARIA semantics.
//
// Features:
//   - role="combobox" pada input + aria-expanded, aria-controls, aria-activedescendant
//   - role="listbox" / "option" pada dropdown items
//   - Keyboard nav: ArrowDown, ArrowUp, Home, End
//   - Enter to select; Escape to close
//   - Close on outside click
//   - Search-as-you-type (startsWith first, then contains — preserved from original)
//
// Props:
//   value          — current input value (string)
//   onChange       — called dengan string apa pun yang di-ketik / dipilih
//   options        — array of { id, name } (atau key apapun + .name untuk display)
//   placeholder    — input placeholder
//   inputId        — opsional, untuk associated <label htmlFor>
//   maxResults     — default 8
//   allowFreeText  — default true (combobox style). Set false untuk listbox-only.
// ============================================================

import React, { useState, useRef, useEffect, useId } from "react"

export const Combobox = ({
  value,
  onChange,
  options,
  placeholder,
  inputId,
  maxResults = 8,
  allowFreeText = true,
}) => {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listboxId = useId()

  // Filter options
  const q = (value || "").toLowerCase()
  const filtered = q.trim() === ""
    ? options
    : [
        ...options.filter(p => p.name.toLowerCase().startsWith(q)),
        ...options.filter(p =>
          !p.name.toLowerCase().startsWith(q) && p.name.toLowerCase().includes(q)
        ),
      ]
  const shown = filtered.slice(0, maxResults)

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Reset active index when filter changes
  useEffect(() => { setActiveIndex(-1) }, [q])

  function selectAt(idx) {
    const opt = shown[idx]
    if (!opt) return
    onChange(opt.name)
    setOpen(false)
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setActiveIndex(i => Math.min((i < 0 ? -1 : i) + 1, shown.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) { setOpen(true); return }
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === "Home") {
      if (open && shown.length > 0) { e.preventDefault(); setActiveIndex(0) }
    } else if (e.key === "End") {
      if (open && shown.length > 0) { e.preventDefault(); setActiveIndex(shown.length - 1) }
    } else if (e.key === "Enter") {
      if (open && activeIndex >= 0) {
        e.preventDefault()
        selectAt(activeIndex)
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        setOpen(false)
        setActiveIndex(-1)
      }
    } else if (e.key === "Tab") {
      // Don't trap focus — just close
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const activeId = activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined

  return (
    <div className="combobox" ref={rootRef}>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value || ""}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck="false"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={activeId}
        onChange={e => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div
          className="combobox-list"
          id={listboxId}
          role="listbox"
        >
          {shown.length === 0 ? (
            <div className="combobox-empty" role="status">Tidak ditemukan</div>
          ) : (
            shown.map((p, i) => (
              <div
                key={p.id ?? p.name}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={i === activeIndex}
                className={"combobox-item" + (i === activeIndex ? " combobox-item-active" : "")}
                onMouseDown={e => { e.preventDefault(); selectAt(i) }}
                onMouseEnter={() => setActiveIndex(i)}
                style={i === activeIndex ? {
                  background: "var(--accent-soft, rgba(59,130,246,0.1))",
                } : undefined}
              >
                {p.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
