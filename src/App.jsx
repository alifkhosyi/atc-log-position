// ============================================================
// src/App.jsx — Slim app shell: providers, routing, auth
// ──────────────────────────────────────────────────────────
// The original 3,332-line App.jsx has been split into:
//   - lib/utils.js, lib/constants.js, lib/context.jsx
//   - components/ (Icons, Pulse, Toast, ConfirmDialog, ThemeToggle, Stat, Header, Sidebar, Login)
//   - pages/cabang/* and pages/admin/*
// This file now only orchestrates them.
// ============================================================
import React from "react"
import { AppProvider, useApp } from "./lib/context.jsx"
import { ToastProvider } from "./components/Toast.jsx"
import { ConfirmProvider } from "./components/ConfirmDialog.jsx"
import { ThemeToggle } from "./components/ThemeToggle.jsx"
import { Login } from "./components/Login.jsx"
import { Sidebar } from "./components/Sidebar.jsx"
import { RadarLogo } from "./components/Icons.jsx"

// Cabang pages
import { CabangDash }            from "./pages/cabang/Dashboard.jsx"
// CabangLog (Log Position) deprecated — workflow now lives in Daily Report → Section G.
// The "log" page id is intercepted by context.goPage(); this stub catches any
// remaining direct state writes (e.g. restored from localStorage).
import { CabangHandover }        from "./pages/cabang/Handover.jsx"
import { CabangRekap }           from "./pages/cabang/RekapTraffic.jsx"
import { CabangRekapPersonnel }  from "./pages/cabang/RekapPersonnel.jsx"
import { CabangHoToMo }          from "./pages/cabang/HoToMo.jsx"

function LogPositionRedirect() {
  const { goPage } = useApp()
  React.useEffect(() => { goPage("log") }, [goPage])
  return null
}

// Admin pages
import { AdminDash }          from "./pages/admin/Dashboard.jsx"
import { AdminMonLog }        from "./pages/admin/MonLog.jsx"
import { AdminMonRecap }      from "./pages/admin/MonRecap.jsx"
import { AdminMonPersonnel }  from "./pages/admin/MonPersonnel.jsx"
import { AdminMonHandover }   from "./pages/admin/MonHandover.jsx"
import { AdminMonHoToMo }     from "./pages/admin/MonHoToMo.jsx"
import { AdminExport }        from "./pages/admin/Export.jsx"
import { AdminAudit }         from "./pages/admin/Audit.jsx"

// Reports (existing files)
import Reports from "./Reports.jsx"
import AdminReportMonitoring from "./AdminReportMonitoring.jsx"

// === Roster (BARU — atc_roster engine, 3-tab shell) ===
import RosterPage from "./pages/RosterPage/index.tsx"
// === Tunjangan ATC (extract dari CAPanel) ===
import TunjanganPage from "./pages/TunjanganPage.tsx"
// === Rolling Harian (read-only MVP) ===
import RollingPage from "./pages/RollingPage.tsx"

// ── Page routing map ──
const PAGES_CABANG = {
  dashboard:        CabangDash,
  log:              LogPositionRedirect,  // deprecated → forwards to Daily Report
  rekap_personnel:  CabangRekapPersonnel,
  rekap:            CabangRekap,
  handover:         CabangHandover,
  ho_to_mo:         CabangHoToMo,
  reports:          Reports,
  roster:           RosterPage,    // ← BARU
  tunjangan:        TunjanganPage, // ← BARU (step 4)
  rolling:          RollingPage,   // ← BARU (rolling step 2)
}
const PAGES_ADMIN = {
  dashboard:     AdminDash,
  mon_log:       AdminMonLog,
  mon_recap:     AdminMonRecap,
  mon_personnel: AdminMonPersonnel,
  mon_handover:  AdminMonHandover,
  mon_ho_to_mo:  AdminMonHoToMo,
  mon_reports:   AdminReportMonitoring,
  export:        AdminExport,
  audit:         AdminAudit,
  roster:        RosterPage,       // ← BARU
  tunjangan:     TunjanganPage,    // ← BARU (step 4)
  rolling:       RollingPage,      // ← BARU (rolling step 2)
}

// ── App shell (inside providers) ──
function AppShell() {
  const ctx = useApp()
  const { loading, session, user, page, goPage, col, setCol, handleLogin, handleLogout } = ctx

  if (loading) {
    return (
      <div className="loading-screen">
        <RadarLogo size={56}/>
        <p>Memuat...</p>
        <span className="login-spinner"/>
      </div>
    )
  }
  if (!session) return <Login onLogin={handleLogin}/>
  if (!user) {
    return (
      <div className="loading-screen">
        <RadarLogo size={56}/>
        <p>Memuat profil...</p>
        <span className="login-spinner"/>
      </div>
    )
  }

  const pageMap = user.role === "admin" ? PAGES_ADMIN : PAGES_CABANG
  const CurrentPage = pageMap[page] || pageMap.dashboard

  return (
    <div className="app-layout">
      <Sidebar
        page={page}
        go={goPage}
        user={user}
        logout={handleLogout}
        col={col}
        toggle={() => setCol(!col)}
      />
      <main className="main-area"><CurrentPage/></main>
      <ThemeToggle/>
    </div>
  )
}

// ── Root: provider stack ──
export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppProvider>
          <AppShell/>
        </AppProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}
