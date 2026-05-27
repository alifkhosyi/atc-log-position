// ============================================================
// src/pages/RosterPage/index.tsx — Roster ATC shell (3 tabs)
// ──────────────────────────────────────────────────────────
// Step 5 dari ROSTER_HANDOFF.md §9.
//
// Replaces top-level src/pages/RosterPage.tsx. Tab 1 sementara
// embed Legacy.tsx (existing 1500-line monolith) sambil refactor
// bertahap. Tab 2 (Off-Roster) adalah implementasi BARU yang
// menggantikan <details> di Legacy. Tab 3 (Jam Tambahan) jadi
// placeholder untuk diisi di step 7.
//
// State sharing antar tab: Tab 1 (Legacy) punya toolbar sendiri.
// Tabs 2 & 3 punya toolbar minimal masing-masing (cabang/unit/
// bulan/tahun). Ini limitation sementara; step 10 akan
// consolidate ke shared context untuk konsistensi cross-tab.
//
// Note: badge counter di tab Off-Roster + Jam Tambahan ditarik
// dari hook count yang sama dengan sidebar (useOffRosterCount,
// useOvertimeCount) — biar konsisten.
// ============================================================

import React, { useEffect, useRef, useState } from "react"
import { I } from "../../components/Icons.jsx"
import { useApp } from "../../lib/context.jsx"
import { useOffRosterCount } from "../../hooks/useOffRosterCount"
import { useOvertimeCount } from "../../hooks/useOvertimeCount"
import LegacyRoster from "./Legacy"
import OffRosterTab from "./OffRosterTab"
import OvertimeTab from "./OvertimeTab"
import "./roster-shell.css"

type TabId = "schedule" | "off-roster" | "overtime"

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: "schedule",   label: "Jadwal Bulanan", icon: "calendar" },
  { id: "off-roster", label: "Off-Roster",     icon: "users" },
  { id: "overtime",   label: "Jam Tambahan",   icon: "plus" },
]

const TAB_STORAGE_KEY = "atc-roster-tab"

export default function RosterPage() {
  const ctx: any = useApp()
  const user = ctx?.user
  const branchCode: string | null =
    user?.role === "admin" ? null : (user?.branch_code || null)

  // Persist tab selection across visits — but local state, no URL param.
  const [tab, setTab] = useState<TabId>(() => {
    try {
      const saved = window.localStorage.getItem(TAB_STORAGE_KEY)
      if (saved === "schedule" || saved === "off-roster" || saved === "overtime") {
        return saved
      }
    } catch { /* ignore */ }
    return "schedule"
  })
  const tabRef = useRef(tab)
  useEffect(() => {
    tabRef.current = tab
    try { window.localStorage.setItem(TAB_STORAGE_KEY, tab) }
    catch { /* ignore */ }
  }, [tab])

  // Badges — same hooks dipakai sidebar
  const offCount = useOffRosterCount(branchCode)
  const otCount  = useOvertimeCount(branchCode)

  return (
    <div className="rp-shell">
      <nav className="rp-tabs" role="tablist" aria-label="Roster ATC sections">
        {TABS.map(t => {
          const badgeVal = t.id === "off-roster" ? offCount
                          : t.id === "overtime"   ? otCount
                          : 0
          const showBadge = badgeVal > 0
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              className={"rp-tab" + (selected ? " is-active" : "")}
              aria-selected={selected}
              aria-controls={`rp-pane-${t.id}`}
              id={`rp-tab-${t.id}`}
              onClick={() => setTab(t.id)}
            >
              <I n={t.icon} s={15}/>
              <span>{t.label}</span>
              {showBadge && (
                <span
                  className="rp-tab-badge"
                  aria-label={`${badgeVal} entry bulan ini`}
                >
                  {badgeVal > 99 ? "99+" : badgeVal}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <section
        className="rp-pane"
        role="tabpanel"
        id="rp-pane-schedule"
        aria-labelledby="rp-tab-schedule"
        hidden={tab !== "schedule"}
      >
        <LegacyRoster />
      </section>

      <section
        className="rp-pane"
        role="tabpanel"
        id="rp-pane-off-roster"
        aria-labelledby="rp-tab-off-roster"
        hidden={tab !== "off-roster"}
      >
        {tab === "off-roster" && <OffRosterTab />}
      </section>

      <section
        className="rp-pane"
        role="tabpanel"
        id="rp-pane-overtime"
        aria-labelledby="rp-tab-overtime"
        hidden={tab !== "overtime"}
      >
        {tab === "overtime" && <OvertimeTab />}
      </section>
    </div>
  )
}
