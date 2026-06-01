// ============================================================
// src/App.jsx — Slim app shell: providers, routing, auth
// ──────────────────────────────────────────────────────────
// The original 3,332-line App.jsx has been split into:
//   - lib/utils.js, lib/constants.js, lib/context.jsx
//   - components/ (Icons, Pulse, Toast, ConfirmDialog, ThemeToggle, Stat, Header, Sidebar, Login)
//   - pages/cabang/* and pages/admin/*
// This file now only orchestrates them.
// ============================================================
import React, { Suspense, lazy } from "react"
import { AppProvider, useApp } from "./lib/context.jsx"
import { ToastProvider } from "./components/Toast.jsx"
import { ConfirmProvider } from "./components/ConfirmDialog.jsx"
import { ThemeToggle } from "./components/ThemeToggle.jsx"
import { Login } from "./components/Login.jsx"
import { Sidebar } from "./components/Sidebar.jsx"
import { RadarLogo, I } from "./components/Icons.jsx"
import { Loading } from "./components/ui"

// ────────────────────────────────────────────────────────────────────
// Phase 11 — Code-split per route via React.lazy().
// Sebelumnya semua page di-import eager → initial bundle 1,157 KB.
// Sekarang per-route chunk lazy-load saat first visit → main bundle
// turun ~40%. Suspense fallback pakai design system Loading.
//
// Helper untuk named-export (CabangDash, AdminDash, dst).
// React.lazy expects default-export module shape; kita wrap untuk
// translate named export jadi { default: Component }.
// ────────────────────────────────────────────────────────────────────
const namedLazy = (importer, exportName) =>
  lazy(() => importer().then(m => ({ default: m[exportName] })))

// Cabang pages (lazy)
const CabangDash           = namedLazy(() => import("./pages/cabang/Dashboard.jsx"), "CabangDash")
const CabangHandover       = namedLazy(() => import("./pages/cabang/Handover.jsx"), "CabangHandover")
const CabangRekap          = namedLazy(() => import("./pages/cabang/RekapTraffic.jsx"), "CabangRekap")
const CabangRekapPersonnel = namedLazy(() => import("./pages/cabang/RekapPersonnel.jsx"), "CabangRekapPersonnel")
const CabangHoToMo         = namedLazy(() => import("./pages/cabang/HoToMo.jsx"), "CabangHoToMo")

// Admin pages (lazy)
const AdminDash          = namedLazy(() => import("./pages/admin/Dashboard.jsx"), "AdminDash")
const AdminMonLog        = namedLazy(() => import("./pages/admin/MonLog.jsx"), "AdminMonLog")
const AdminMonRecap      = namedLazy(() => import("./pages/admin/MonRecap.jsx"), "AdminMonRecap")
const AdminMonHandover   = namedLazy(() => import("./pages/admin/MonHandover.jsx"), "AdminMonHandover")
const AdminMonHoToMo     = namedLazy(() => import("./pages/admin/MonHoToMo.jsx"), "AdminMonHoToMo")
const AdminExport        = namedLazy(() => import("./pages/admin/Export.jsx"), "AdminExport")
const AdminAudit         = namedLazy(() => import("./pages/admin/Audit.jsx"), "AdminAudit")

// Reports (existing files, default export — lazy)
const Reports                = lazy(() => import("./Reports.jsx"))
const AdminReportMonitoring  = lazy(() => import("./AdminReportMonitoring.jsx"))

// Roster / Tunjangan / Rolling / Personnel (default export — lazy)
const RosterPage     = lazy(() => import("./pages/RosterPage/index.tsx"))
const TunjanganPage  = lazy(() => import("./pages/TunjanganPage.tsx"))
const RollingPage    = lazy(() => import("./pages/RollingPage.tsx"))
const PersonnelPage  = lazy(() => import("./pages/PersonnelPage.tsx"))
const PersonnelHub   = lazy(() => import("./pages/admin/PersonnelHub.tsx"))

// ── Page routing map ──
const PAGES_CABANG = {
  dashboard:        CabangDash,
  rekap_personnel:  CabangRekapPersonnel,
  rekap:            CabangRekap,
  handover:         CabangHandover,
  ho_to_mo:         CabangHoToMo,
  reports:          Reports,
  roster:           RosterPage,
  tunjangan:        TunjanganPage,
  rolling:          RollingPage,
  personnel:        PersonnelPage,
}
const PAGES_ADMIN = {
  dashboard:     AdminDash,
  mon_log:       AdminMonLog,
  mon_recap:     AdminMonRecap,
  // Phase 6: personnel route admin → PersonnelHub (2-tab: master + stats).
  // mon_personnel kept as legacy alias yang juga route ke PersonnelHub
  // supaya old bookmark / deep link tetap work.
  personnel:     PersonnelHub,
  mon_personnel: PersonnelHub,
  mon_handover:  AdminMonHandover,
  mon_ho_to_mo:  AdminMonHoToMo,
  mon_reports:   AdminReportMonitoring,
  export:        AdminExport,
  audit:         AdminAudit,
  roster:        RosterPage,
  tunjangan:     TunjanganPage,
  rolling:       RollingPage,
}

// ── App shell (inside providers) ──
function AppShell() {
  const ctx = useApp()
  const { loading, session, user, page, goPage, col, setCol, handleLogin, handleLogout } = ctx

  // Phase 7: mobile sidebar drawer state. On mobile (<768px), sidebar
  // hidden by default; burger button opens it. Click backdrop / nav item
  // closes it. Desktop perilaku tidak terpengaruh (sidebar always visible).
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const isMobile = typeof window !== "undefined"
    && window.matchMedia?.("(max-width: 768px)").matches
  const closeMobile = React.useCallback(() => setMobileOpen(false), [])

  // Auto-close mobile sidebar saat page change (navigate)
  React.useEffect(() => { setMobileOpen(false) }, [page])

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
        mobileOpen={mobileOpen}
      />
      {/* Phase 7: mobile burger + backdrop. Hidden by default via CSS, only
          visible at < 768px breakpoint. */}
      <button
        type="button"
        className="mobile-burger"
        onClick={() => setMobileOpen(o => !o)}
        aria-label={mobileOpen ? "Tutup navigasi" : "Buka navigasi"}
        aria-expanded={mobileOpen}
      >
        <I n={mobileOpen ? "x" : "menu"} s={20}/>
      </button>
      <div
        className={"sidebar-backdrop" + (mobileOpen ? " is-active" : "")}
        onClick={closeMobile}
        aria-hidden="true"
      />
      <main className="main-area">
        <Suspense fallback={<Loading text="Memuat halaman…" size="lg" />}>
          <CurrentPage/>
        </Suspense>
      </main>
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
