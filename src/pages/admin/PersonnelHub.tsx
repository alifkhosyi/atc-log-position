// ============================================================
// src/pages/admin/PersonnelHub.tsx
//
// Phase 6 — merge admin "Pengaturan Personel" (master CRUD) + "Statistik
// Personel" (operational stats) jadi 1 menu "Personel" dengan 2 internal tab.
//
// Sebelumnya admin sidebar punya 2 item icon sama (users):
//   - personnel     → PersonnelPage (master data CRUD)
//   - mon_personnel → AdminMonPersonnel (operational stats)
//
// Now: 1 sidebar item `personnel` → PersonnelHub, 2 tab di dalam.
// MO route `personnel` tetap render PersonnelPage langsung (single tab,
// no stats — MO doesn't need cross-cabang ops view).
// ============================================================
import React, { useState } from "react"
import PersonnelPage from "../PersonnelPage"
import { AdminMonPersonnel } from "./MonPersonnel.jsx"
import "./personnel-hub.css"

type Tab = "master" | "stats"

export default function PersonnelHub() {
  const [tab, setTab] = useState<Tab>("master")

  return (
    <div className="ph-shell">
      <div className="ph-tabs" role="tablist" aria-label="Personel sub-pages">
        <button
          role="tab"
          aria-selected={tab === "master"}
          className={"ph-tab" + (tab === "master" ? " is-active" : "")}
          onClick={() => setTab("master")}
        >
          Master Data
        </button>
        <button
          role="tab"
          aria-selected={tab === "stats"}
          className={"ph-tab" + (tab === "stats" ? " is-active" : "")}
          onClick={() => setTab("stats")}
        >
          Statistik
        </button>
      </div>
      <div className="ph-body" role="tabpanel">
        {tab === "master" && <PersonnelPage />}
        {tab === "stats" && <AdminMonPersonnel />}
      </div>
    </div>
  )
}
