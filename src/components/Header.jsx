// ============================================================
// src/components/Header.jsx — Topbar with title + sub + live clock
// ============================================================
import React, { useState, useEffect } from "react"
import { I } from "./Icons.jsx"

export const Header = ({ title, sub }) => {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">{title}</h1>
        {sub && <p className="topbar-sub">{sub}</p>}
      </div>
      <div className="topbar-right">
        <div className="topbar-pill"><I n="clock" s={14}/> {t.toLocaleTimeString("id-ID")}</div>
        <div className="topbar-pill">
          {t.toLocaleDateString("id-ID", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}
        </div>
      </div>
    </header>
  )
}
