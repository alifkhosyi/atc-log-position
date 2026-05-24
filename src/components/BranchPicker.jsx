// ============================================================
// src/components/BranchPicker.jsx — Shared branch filter dropdown
// Extracted from admin/Dashboard.jsx for reuse in monitoring pages.
// ============================================================
import React, { useState, useEffect, useMemo, useRef } from "react"
import { I } from "./Icons.jsx"

export const BranchPicker = ({ value, onChange, branches, brAct = {} }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return branches
    return branches.filter(b =>
      b.code.toLowerCase().includes(q) ||
      (b.name || "").toLowerCase().includes(q) ||
      (b.city || "").toLowerCase().includes(q)
    )
  }, [branches, query])

  const west = filtered.filter(b => b.region === "west")
  const east = filtered.filter(b => b.region === "east")
  const selectedBranch = branches.find(b => b.code === value)

  return (
    <div className="branch-picker-wrap" ref={wrapRef}>
      <button type="button"
              className={"branch-picker-btn" + (open ? " open" : "")}
              onClick={() => setOpen(o => !o)}>
        <I n="pin" s={13}/>
        <span>{value === "ALL" ? "Semua Cabang" : `${value} — ${selectedBranch?.city || selectedBranch?.name || ""}`}</span>
        <span className="chev"><I n="chev-down" s={12}/></span>
      </button>
      {open && (
        <div className="branch-picker-drop">
          <input
            type="text"
            className="branch-picker-search"
            placeholder="Cari code/nama/kota..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <div className={"branch-picker-opt" + (value === "ALL" ? " selected" : "")}
               onClick={() => { onChange("ALL"); setOpen(false) }}>
            <span className="branch-picker-opt-dot"/>
            <span className="branch-picker-opt-code">ALL</span>
            <span className="branch-picker-opt-name">Tampilkan semua cabang</span>
          </div>
          {west.length > 0 && <>
            <div className="branch-picker-group">West Region · {west.length}</div>
            {west.map(b => {
              const live = (brAct[b.code] || 0) > 0
              return (
                <div key={b.code}
                     className={"branch-picker-opt" + (value === b.code ? " selected" : "") + (live ? " live" : "")}
                     onClick={() => { onChange(b.code); setOpen(false) }}>
                  <span className="branch-picker-opt-dot"/>
                  <span className="branch-picker-opt-code">{b.code}</span>
                  <span className="branch-picker-opt-name">{b.name} · {b.city}</span>
                </div>
              )
            })}
          </>}
          {east.length > 0 && <>
            <div className="branch-picker-group">East Region · {east.length}</div>
            {east.map(b => {
              const live = (brAct[b.code] || 0) > 0
              return (
                <div key={b.code}
                     className={"branch-picker-opt" + (value === b.code ? " selected" : "") + (live ? " live" : "")}
                     onClick={() => { onChange(b.code); setOpen(false) }}>
                  <span className="branch-picker-opt-dot"/>
                  <span className="branch-picker-opt-code">{b.code}</span>
                  <span className="branch-picker-opt-name">{b.name} · {b.city}</span>
                </div>
              )
            })}
          </>}
          {filtered.length === 0 && (
            <div style={{ padding: "16px 10px", textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>
              Tidak ada cabang yang cocok
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Filter badge with × clear button — companion to BranchPicker
export const BranchFilterBadge = ({ value, onClear }) => {
  if (!value || value === "ALL") return null
  return (
    <span className="status-badge"
          style={{ background: "var(--accent-soft)", color: "var(--accent)", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}>
      <I n="eye" s={11}/> Filter: {value}
      <button onClick={onClear}
              style={{ background: "transparent", border: "none", color: "currentColor", cursor: "pointer", marginLeft: 4, fontSize: 14, padding: 0 }}
              title="Clear filter">×</button>
    </span>
  )
}
