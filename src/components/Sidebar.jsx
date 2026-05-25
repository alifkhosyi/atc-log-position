// ============================================================
// src/components/Sidebar.jsx — Side navigation (grouped per mockup)
// Structure follows mockups in Dashboard_Redesign.html (cabang) and
// INMC_Dashboard_Redesign.html (admin).
// Menu items unique to the real app are placed in the most-similar group.
// ============================================================
import React from "react"
import { I, RadarLogo } from "./Icons.jsx"

export const Sidebar = ({ page, go, user, logout, col, toggle }) => {
  const groups = user.role === "admin" ? [
    {
      section: "Monitoring",
      items: [
        { id:"dashboard",     label:"Dashboard INMC",   icon:"dashboard" },
        { id:"mon_log",       label:"Log Position",     icon:"mic" },
        { id:"mon_recap",     label:"Rekap Traffic",    icon:"chart" },
        { id:"mon_personnel", label:"Personnel",        icon:"users" },
        { id:"mon_handover",  label:"Handover",         icon:"checklist" },
        { id:"mon_ho_to_mo",  label:"HO/TO MO",         icon:"shield" },
      ],
    },
    {
      section: "Penjadwalan",
      items: [
        { id:"roster", label:"Roster ATC", icon:"checklist" },   // ← BARU
      ],
    },
    {
      section: "Reports",
      items: [
        { id:"mon_reports", label:"Daily Reports", icon:"note" },
      ],
    },
    {
      section: "Tools",
      items: [
        { id:"export", label:"Export",     icon:"download" },
        { id:"audit",  label:"Audit Log",  icon:"shield" },
      ],
    },
  ] : [
    {
      section: "Operasional",
      items: [
        { id:"dashboard",       label:"Dashboard",         icon:"dashboard" },
        { id:"log",             label:"Log Position",      icon:"mic" },
        { id:"handover",        label:"Handover/Takeover", icon:"checklist" },
        { id:"ho_to_mo",        label:"HO/TO MO",          icon:"shield" },
        { id:"rekap_personnel", label:"Rekap Personnel",   icon:"users" },
        { id:"rekap",           label:"Rekap Traffic",     icon:"chart" },
      ],
    },
    {
      section: "Penjadwalan",
      items: [
        { id:"roster", label:"Roster ATC", icon:"checklist" },   // ← BARU
      ],
    },
    {
      section: "Laporan",
      items: [
        { id:"reports", label:"Report", icon:"note" },
      ],
    },
  ]

  return (
    <aside className={"sidebar" + (col ? " sidebar-collapsed" : "")}>
      <div className="sidebar-header">
        {!col && (
          <div className="sidebar-brand">
            <RadarLogo size={28}/>
            <div>
              <div className="sidebar-brand-title">ATC LOG</div>
              <div className="sidebar-brand-sub">AIRNAV INDONESIA</div>
            </div>
          </div>
        )}
        <button className="sidebar-toggle" onClick={toggle}><I n="menu" s={18}/></button>
      </div>
      <nav className="sidebar-nav">
        {groups.map((g, gi) => (
          <div key={gi} className="sidebar-group">
            {!col && <div className="sidebar-section">{g.section}</div>}
            {g.items.map(it => (
              <button
                key={it.id}
                className={"sidebar-item" + (page === it.id ? " sidebar-item-active" : "")}
                onClick={() => go(it.id)}
                title={col ? it.label : undefined}
              >
                <I n={it.icon} s={17}/>
                {!col && <span>{it.label}</span>}
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{(user.display_name || "U")[0].toUpperCase()}</div>
          {!col && (
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.display_name}</div>
              <div className="sidebar-user-role">
                {user.role === "admin" ? "Admin Pusat" : "Cabang " + user.branch_code}
              </div>
            </div>
          )}
        </div>
        <button className="sidebar-logout" onClick={logout}>
          <I n="logout" s={16}/>{!col && " Keluar"}
        </button>
      </div>
    </aside>
  )
}
