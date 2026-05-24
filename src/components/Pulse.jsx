// ============================================================
// src/components/Pulse.jsx — Animated pulse indicator (ATC "on mic")
// ============================================================
import React from "react"

export const Pulse = ({ on = true, s = 8 }) => (
  <span style={{position:"relative", display:"inline-flex", verticalAlign:"middle"}}>
    <span style={{
      width:s, height:s, borderRadius:"50%",
      background: on ? "var(--status-on, #10b981)" : "var(--text-faint, #4b5563)",
      display:"block",
    }}/>
    {on && <span style={{
      position:"absolute", inset:0, borderRadius:"50%",
      background: "var(--status-on, #10b981)",
      opacity:.4, animation:"ping 1.5s cubic-bezier(0,0,.2,1) infinite",
    }}/>}
  </span>
)
