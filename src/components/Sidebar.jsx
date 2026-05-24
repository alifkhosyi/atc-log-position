// ============================================================
// src/components/Sidebar.jsx — Side navigation (different items per role)
// ============================================================
import React from "react"
import { I, RadarLogo } from "./Icons.jsx"

export const Sidebar = ({ page, go, user, logout, col, toggle }) => {
  const items = user.role === "admin" ? [
    { id:"dashboard",     label:"Dashboard",                   icon:"dashboard" },
    { id:"mon_log",       label:"Monitoring Log Position",     icon:"monitor" },
    { id:"mon_recap",     label:"Monitoring Rekap Traffic",    icon:"chart" },
    { id:"mon_personnel", label:"Monitoring Rekap Personel",   icon:"users" },
    { id:"mon_handover",  label:"Monitoring Handover/Takeover",icon:"checklist" },
    { id:"mon_ho_to_mo",  label:"Monitoring HO/TO MO",         icon:"shield" },
    { id:"mon_reports",   label:"Monitoring Daily Reports",    icon:"note" },
    { id:"export",        label:"Export Laporan",              icon:"download" },
    { id:"audit",         label:"Audit Log",                   icon:"shield" },
  ] : [
    { id:"dashboard",         label:"Dashboard",         icon:"dashboard" },
    { id:"log",               label:"Log Position",      icon:"mic" },
    { id:"rekap_personnel",   label:"Rekap Personel",    icon:"users" },
    { id:"rekap",             label:"Rekap Traffic",     icon:"chart" },
    { id:"handover",          label:"Handover/Takeover", icon:"checklist" },
    { id:"ho_to_mo",          label:"HO/TO MO",          icon:"shield" },
    { id:"reports",           label:"Report",            icon:"note" },
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
        {!col && (
          <div className="sidebar-section">
            {user.role === "admin" ? "Admin Pusat" : "Cabang " + user.branch_code}
          </div>
        )}
        {items.map(it => (
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
