// ============================================================
// src/lib/context.jsx — AppContext + AppProvider (data hub)
// ──────────────────────────────────────────────────────────
// Holds:
//   - user / session
//   - static reference data (branches, sectors, personnel, moBranchCodes)
//   - dynamic data (logs, handovers, handoverChecklists)
//   - global UI state (navBranch, currentPage, sidebar collapsed)
//   - realtime subscription to Supabase
//
// Pages access via: const ctx = useApp();
//
// Phase 5 perf + data integrity:
//   - Provider `value` wrapped in useMemo → child no longer re-mount tiap render
//   - 120s polling DROPPED → realtime subscription handle it (existing channel)
//   - position_logs `.limit(500)` → `.gte(on_time, -7 day window)`, no truncation
//   - usePendingSessions etc consume ctx.logs (no duplicate subscription)
// ============================================================
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "../supabase.js"
import { logAudit } from "./utils.js"

const AppContext = createContext()
export const useApp = () => useContext(AppContext)

// Date window for dynamic data — 7 days ago at midnight UTC (sufficient
// untuk Dashboard "current day" + "this week" view + handover history).
// Realtime channel handle live updates beyond window edge.
const SEVEN_DAYS_MS = 7 * 86400 * 1000
const getDynamicSinceISO = () => new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

export const AppProvider = ({ children }) => {
  // ── Auth/user ──
  const [session, setSession] = useState(null)
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // ── UI state ──
  const [page, setPage]           = useState("dashboard")
  const [col, setCol]             = useState(false)
  const [navBranch, setNavBranch] = useState(null) // dashboard → mon_log handoff

  // Log Position deprecated — workflow merged into Daily Report Section G.
  // Phase 2 cleanup: removed log redirect intercept + deprecation flag.
  // LogPosition.jsx + LogPositionRedirect stub deleted (zero importers).
  const goPage = useCallback((id) => setPage(id), [])

  // ── REDESIGN: persistent branch filter (admin) ──
  // Survives page refresh via localStorage. Default "ALL" = show all branches.
  const [globalBranch, setGlobalBranchState] = useState(() => {
    try { return localStorage.getItem("atc-global-branch") || "ALL" }
    catch { return "ALL" }
  })
  const setGlobalBranch = useCallback((code) => {
    setGlobalBranchState(code || "ALL")
    try { localStorage.setItem("atc-global-branch", code || "ALL") }
    catch { /* localStorage unavailable — ignore */ }
  }, [])

  // ── Static data ──
  const [branches, setBranches]               = useState([])
  const [sectors, setSectors]                 = useState([])
  const [personnel, setPersonnel]             = useState([])
  const [moBranchCodes, setMoBranchCodes]     = useState([])

  // ── Dynamic data ──
  const [logs, setLogs]                                 = useState([])
  const [handovers, setHandovers]                       = useState([])
  const [handoverChecklists, setHandoverChecklists]     = useState([])

  // ── Profile load ──
  const loadProfile = useCallback(async (s) => {
    const { data } = await supabase.from("accounts").select("*").eq("id", s.user.id).single()
    if (data) { setUser(data); setSession(s); logAudit("LOGIN","Masuk ke sistem", data) }
    else { window.dispatchEvent(new CustomEvent("atc:auth-error", { detail:"Akun tidak ditemukan" })); await supabase.auth.signOut() }
    setLoading(false)
  }, [])

  // ── Initial session check ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) loadProfile(s)
      else setLoading(false)
    })
  }, [loadProfile])

  // ── Personnel paginated fetch (>1000 rows possible) ──
  const fetchAllPersonnel = async () => {
    let all = [], from = 0, batchSize = 1000
    while (true) {
      const { data } = await supabase.from("personnel")
        .select("id,name,branch_code,unit").eq("is_active", true).order("name")
        .range(from, from + batchSize - 1)
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < batchSize) break
      from += batchSize
    }
    return all
  }

  // ── Load static data once on login ──
  const loadStaticData = useCallback(async () => {
    const [brRes, secRes] = await Promise.all([
      supabase.from("branches").select("*").order("code"),
      supabase.from("sectors").select("*").order("sort_order"),
    ])
    const allPersonnel = await fetchAllPersonnel()
    const { data: moData } = await supabase.from("accounts")
      .select("branch_code").like("username", "mo_%")
    const uniqueMoCodes = [...new Set((moData || []).map(a => a.branch_code))]
    setMoBranchCodes(uniqueMoCodes)
    if (brRes.data) setBranches(brRes.data)
    if (secRes.data) setSectors(secRes.data)
    if (allPersonnel.length) setPersonnel(allPersonnel)
  }, [])

  // ── Load dynamic data on change ──
  // Phase 5: replaced `.limit(500)` with date-window. Reasoning:
  //   - 500 row hard cap silently truncate untuk admin INMC (73 cabang × N logs)
  //   - 7-day window cover all Dashboard use cases (today + week view)
  //   - Older data tetap accessible via dedicated query di Reports/Audit page
  const loadDynamicData = useCallback(async () => {
    const sinceISO = getDynamicSinceISO()
    const [logRes, hoRes, hcRes] = await Promise.all([
      supabase.from("position_logs")
        .select("*").gte("on_time", sinceISO).order("on_time", { ascending: false }),
      supabase.from("handover_notes")
        .select("*").gte("created_at", sinceISO).order("created_at", { ascending: false }),
      supabase.from("handover_checklists")
        .select("*").gte("created_at", sinceISO).order("created_at", { ascending: false }),
    ])
    if (logRes.data) setLogs(logRes.data)
    if (hoRes.data) setHandovers(hoRes.data)
    if (hcRes.data) setHandoverChecklists(hcRes.data)
  }, [])

  // ── Full reload (for manual refresh) ──
  const loadData = useCallback(async () => {
    await loadStaticData()
    await loadDynamicData()
  }, [loadStaticData, loadDynamicData])

  // ── Set up realtime when user is loaded ──
  // Phase 5: dropped 120s polling — realtime channel sudah subscribe ke
  // semua 3 tabel dengan event="*", redundant.
  useEffect(() => {
    if (!user) return

    loadStaticData().then(() => loadDynamicData())

    const channel = supabase.channel("db-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "position_logs" },       () => loadDynamicData())
      .on("postgres_changes", { event: "*", schema: "public", table: "handover_notes" },      () => loadDynamicData())
      .on("postgres_changes", { event: "*", schema: "public", table: "handover_checklists" }, () => loadDynamicData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, loadStaticData, loadDynamicData])

  // ── Auth actions ──
  const handleLogin = useCallback(async (s) => {
    setSession(s)
    setLoading(true)
    await loadProfile(s)
  }, [loadProfile])

  const handleLogout = useCallback(async () => {
    logAudit("LOGOUT", "Keluar dari sistem", user)
    await supabase.auth.signOut()
    setSession(null); setUser(null); setPage("dashboard")
    setBranches([]); setSectors([]); setLogs([])
    setHandovers([]); setHandoverChecklists([]); setPersonnel([])
  }, [user])

  // Phase 5: memoize value untuk avoid child re-mount tiap render parent.
  // Sebelumnya plain object literal → reference berubah tiap render → semua
  // consumer (puluhan komponen) re-render walaupun nilai effective tetap.
  const value = useMemo(() => ({
    // auth
    session, user, loading, handleLogin, handleLogout,
    // ui
    page, goPage, col, setCol, navBranch, setNavBranch,
    globalBranch, setGlobalBranch,
    // data
    branches, sectors, personnel, moBranchCodes,
    logs, handovers, handoverChecklists,
    reload: loadData,
  }), [
    session, user, loading, handleLogin, handleLogout,
    page, goPage, col, navBranch,
    globalBranch, setGlobalBranch,
    branches, sectors, personnel, moBranchCodes,
    logs, handovers, handoverChecklists,
    loadData,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
