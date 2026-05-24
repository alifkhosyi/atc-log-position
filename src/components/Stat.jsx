// ============================================================
// src/components/Stat.jsx — Stat card (icon + label + value + sub)
// ============================================================
import React from "react"
import { I } from "./Icons.jsx"

export const Stat = ({ icon, label, value, sub, color = "var(--accent, #38bdf8)" }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + "26", color }}>
      <I n={icon} s={22}/>
    </div>
    <div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  </div>
)
