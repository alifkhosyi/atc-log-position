import { useState, useEffect, useRef, createContext, useContext } from "react"
import { supabase } from "./supabase.js"
import Reports from './Reports'
import DailyReport from './DailyReport'
import AdminReportMonitoring from './AdminReportMonitoring'

// ============================================================
// CONTEXT
// ============================================================
const AppContext = createContext()
const useApp = () => useContext(AppContext)

// ============================================================
// HELPERS
// ============================================================
const fmtT = d => d ? new Date(d).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}) : "-"
const fmtD = d => d ? new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"}) : "-"
const fmtDT = d => d ? new Date(d).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : "-"
const durMin = (a,b) => a && b ? Math.round((new Date(b)-new Date(a))/60000) : 0
const SHIFTS = ["Morning","Afternoon","Night"]
const getShift = () => { const h = new Date().getHours(); return h>=6&&h<14?"Morning":h>=14&&h<22?"Afternoon":"Night" }

// Get all branch codes this MO can access (recursive, stop at child with own MO)
const getAccessibleBranches = (myCode, branches, moBranchCodes) => {
  const result = [myCode]
  const children = branches.filter(b => b.parent_code === myCode)
  for (const child of children) {
    if (moBranchCodes.includes(child.code) && child.code !== myCode) {
      continue
    }
    result.push(child.code)
    const grandchildren = getAccessibleBranches(child.code, branches, moBranchCodes)
    grandchildren.forEach(gc => { if (!result.includes(gc)) result.push(gc) })
  }
  return result
}

// Audit log helper — fire and forget, never blocks UI
const logAudit = (action, detail="", user=null) => {
  try {
    supabase.from("audit_logs").insert({
      user_id: user?.id || null,
      user_name: user?.display_name || user?.username || "-",
      branch_code: user?.branch_code || (user?.role==="admin"?"ADMIN":"-"),
      action,
      detail: typeof detail === "object" ? JSON.stringify(detail) : String(detail),
    }).then(({error}) => { if(error) console.warn("[AUDIT]",error.message) })
  } catch(e) { console.warn("[AUDIT catch]",e) }
}

const Pulse = ({on=true,s=8}) => (
  <span style={{position:"relative",display:"inline-flex",verticalAlign:"middle"}}>
    <span style={{width:s,height:s,borderRadius:"50%",background:on?"#10b981":"#4b5563",display:"block"}}/>
    {on && <span style={{position:"absolute",inset:0,borderRadius:"50%",background:"#10b981",opacity:.4,animation:"ping 1.5s cubic-bezier(0,0,.2,1) infinite"}}/>}
  </span>
)

const ICONS = {
  radar:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 2v10l7 4",
  tower:"M8 22V2h8v20M4 10h16M6 22h12",
  mic:"M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3ZM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",
  micOff:"M2 2l20 20M18.89 13.23A7.12 7.12 0 0 0 19 12v-2M5 10v2a7 7 0 0 0 12 5M15 9.34V5a3 3 0 0 0-5.68-1.33M9 9v3a3 3 0 0 0 5.12 2.12M12 19v3",
  dashboard:"M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  log:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M16 13H8M16 17H8M10 9H8",
  chart:"M18 20V10M12 20V4M6 20v-6",
  upload:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  download:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  clock:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 6v6l4 2",
  plane:"M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z",
  shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  note:"M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
  x:"M18 6 6 18M6 6l12 12",
  menu:"M4 12h16M4 6h16M4 18h16",
  plus:"M12 5v14M5 12h14",
  logout:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  handover:"M3 12h4l3-9 4 18 3-9h4",
  checklist:"M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  eye:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  monitor:"M2 3h20v14H2zM8 21h8M12 17v4",
  building:"M4 2h16v20H4zM9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01",
  users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
}
const I = ({n,s=18}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[n]||""}/></svg>

const RadarLogo = ({size=28}) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" style={{flexShrink:0}}>
    <circle cx="28" cy="28" r="26" stroke="rgba(56,189,248,0.5)" strokeWidth="2"/>
    <circle cx="28" cy="28" r="18" stroke="rgba(56,189,248,0.25)" strokeWidth="1.5"/>
    <line x1="28" y1="2" x2="28" y2="28" stroke="rgba(56,189,248,0.7)" strokeWidth="2">
      <animateTransform attributeName="transform" type="rotate" from="0 28 28" to="360 28 28" dur="5s" repeatCount="indefinite"/>
    </line>
    <circle cx="28" cy="5" r="3" fill="#38bdf8">
      <animateTransform attributeName="transform" type="rotate" from="0 28 28" to="360 28 28" dur="5s" repeatCount="indefinite"/>
    </circle>
  </svg>
)

// ============================================================
// SHARED COMPONENTS
// ============================================================
const Header = ({title,sub}) => {
  const [t,setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()),1000); return () => clearInterval(i) },[])
  return (
    <header className="topbar">
      <div><h1 className="topbar-title">{title}</h1>{sub && <p className="topbar-sub">{sub}</p>}</div>
      <div className="topbar-right">
        <div className="topbar-pill"><Pulse s={8}/> Shift: <strong>{getShift()}</strong></div>
        <div className="topbar-pill"><I n="clock" s={14}/> {t.toLocaleTimeString("id-ID")}</div>
        <div className="topbar-pill">{t.toLocaleDateString("id-ID",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
      </div>
    </header>
  )
}

const Stat = ({icon,label,value,sub,color="#38bdf8"}) => (
  <div className="stat-card">
    <div className="stat-icon" style={{background:color+"18",color}}><I n={icon} s={22}/></div>
    <div><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{sub && <div className="stat-sub">{sub}</div>}</div>
  </div>
)

// ============================================================
// LOGIN
// ============================================================
const Login = ({onLogin}) => {
  const [email,setEmail] = useState("")
  const [pw,setPw] = useState("")
  const [err,setErr] = useState("")
  const [ld,setLd] = useState(false)

  const go = async () => {
    if (!email.trim() || !pw.trim()) { setErr("Masukkan email dan password"); return }
    setLd(true); setErr("")
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw.trim() })
    if (error) { setErr(error.message); setLd(false); return }
    onLogin(data.session)
    // Audit logged after profile load in handleLogin
    setLd(false)
  }

  return (
    <div className="login-bg">
      <div className="login-particles">{Array.from({length:15}).map((_,i) => <div key={i} className="particle" style={{left:Math.random()*100+"%",top:Math.random()*100+"%",animationDelay:Math.random()*6+"s",animationDuration:4+Math.random()*4+"s"}}/>)}</div>
      <div className="login-container">
        <div className="login-brand">
          <div style={{marginBottom:16}}><RadarLogo size={56}/></div>
          <h1 className="login-title">ATC LOG POSITION</h1>
          <p className="login-subtitle">AIRNAV INDONESIA</p>
          <p className="login-desc">Air Traffic Control Position Management System</p>
        </div>
        <div className="login-card">
          <h2 className="login-card-title">Masuk ke Sistem</h2>
          {err && <div className="login-error">{err}</div>}
          <div className="field"><label>Email</label><input value={email} onChange={e => setEmail(e.target.value)} placeholder="email@airnav.co.id" onKeyDown={e => e.key==="Enter" && go()}/></div>
          <div className="field"><label>Password</label><input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key==="Enter" && go()}/></div>
          <button className="login-btn" onClick={go} disabled={ld}>{ld ? <span className="login-spinner"/> : "Masuk"}</button>
        </div>
        <p className="login-footer">© 2026 Airnav Indonesia</p>
      </div>
    </div>
  )
}

// ============================================================
// SIDEBAR
// ============================================================
const Sidebar = ({page,go,user,logout,col,toggle}) => {
  const items = user.role === "admin" ? [
    {id:"dashboard",label:"Dashboard",icon:"dashboard"},
    {id:"mon_log",label:"Monitoring Log Position",icon:"monitor"},
    {id:"mon_recap",label:"Monitoring Rekap Traffic",icon:"chart"},
    {id:"mon_personnel",label:"Monitoring Rekap Personel",icon:"users"},
    {id:"mon_handover",label:"Monitoring Handover/Takeover",icon:"checklist"},
    {id:"mon_ho_to_mo",label:"Monitoring HO/TO MO",icon:"shield"},
    {id:"mon_reports",label:"Monitoring Daily Reports",icon:"note"},
    {id:"export",label:"Export Laporan",icon:"download"},
    {id:"audit",label:"Audit Log",icon:"shield"},
  ] : [
    {id:"dashboard",label:"Dashboard",icon:"dashboard"},
    {id:"log",label:"Log Position",icon:"mic"},
    {id:"rekap_personnel",label:"Rekap Personel",icon:"users"},
    {id:"rekap",label:"Rekap Traffic",icon:"chart"},
    {id:"handover",label:"Handover/Takeover",icon:"checklist"},
    {id:"ho_to_mo",label:"HO/TO MO",icon:"shield"},
    {id:"reports",label:"Report",icon:"note"},
  ]
  return (
    <aside className={"sidebar"+(col?" sidebar-collapsed":"")}>
      <div className="sidebar-header">
        {!col && <div className="sidebar-brand"><RadarLogo size={28}/><div><div className="sidebar-brand-title">ATC LOG</div><div className="sidebar-brand-sub">AIRNAV INDONESIA</div></div></div>}
        <button className="sidebar-toggle" onClick={toggle}><I n="menu" s={18}/></button>
      </div>
      <nav className="sidebar-nav">
        {!col && <div className="sidebar-section">{user.role==="admin"?"Admin Pusat":"Cabang "+user.branch_code}</div>}
        {items.map(it => <button key={it.id} className={"sidebar-item"+(page===it.id?" sidebar-item-active":"")} onClick={() => go(it.id)} title={col?it.label:undefined}><I n={it.icon} s={17}/>{!col && <span>{it.label}</span>}</button>)}
      </nav>
      <div className="sidebar-footer">
        <div className="sidebar-user"><div className="sidebar-avatar">{(user.display_name||"U")[0].toUpperCase()}</div>{!col && <div className="sidebar-user-info"><div className="sidebar-user-name">{user.display_name}</div><div className="sidebar-user-role">{user.role==="admin"?"Admin Pusat":"Cabang "+user.branch_code}</div></div>}</div>
        <button className="sidebar-logout" onClick={logout}><I n="logout" s={16}/>{!col && " Keluar"}</button>
      </div>
    </aside>
  )
}

// ============================================================
// CABANG: DASHBOARD
// ============================================================
const CabangDash = () => {
  const ctx = useApp()
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const active = ctx.logs.filter(l => !l.off_time && myBranches.includes(l.branch_code))
  const today = ctx.logs.filter(l => myBranches.includes(l.branch_code) && new Date(l.on_time).toDateString() === new Date().toDateString())
  const todayTC = today.filter(l => l.off_time).reduce((a,l) => a+(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0), 0)
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || {name:"",city:"",units:[]}

  return (
    <div className="page-content">
      <Header title="Dashboard" sub={br.name+" ("+ctx.user.branch_code+") — "+br.city}/>
      <div className="stats-grid">
        <Stat icon="mic" label="On Mic" value={active.length} sub="Saat ini" color="#10b981"/>
        <Stat icon="log" label="Log Hari Ini" value={today.length} sub={"Shift "+getShift()} color="#38bdf8"/>
        <Stat icon="plane" label="Traffic" value={todayTC} sub="Hari ini" color="#f59e0b"/>
        <Stat icon="tower" label="Unit" value={br.units?br.units.join(", "):"-"} sub={(br.units?br.units.length:0)+" unit"} color="#8b5cf6"/>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><Pulse s={10}/> Posisi Aktif</h2><span className="panel-badge">LIVE</span></div>
        <div className="panel-body">
          {active.length===0 ? <div className="empty-state"><I n="micOff" s={44}/><p>Belum ada ATC on mic</p></div> :
          <div className="position-grid">{active.map(l => (
            <div key={l.id} className="position-card">
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Pulse s={7}/><span className="position-unit">{l.unit}</span><span className="position-sector">{l.sector}</span></div>
              <div className="position-cwp">{l.cwp}</div>
              <div className="position-name">{l.atc_name}</div>
              <div className="position-time">On: {fmtT(l.on_time)} ({durMin(l.on_time,new Date().toISOString())}m)</div>
            </div>
          ))}</div>}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Timeline Hari Ini</h2><span className="panel-counter">{today.length}</span></div>
        <div className="panel-body">
          {today.length===0 ? <div className="empty-state"><p>Belum ada log</p></div> :
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>On</th><th>Off</th><th>Status</th></tr></thead>
          <tbody>{today.map(l => <tr key={l.id}><td><strong>{l.atc_name}</strong></td><td><span className="unit-tag">{l.unit}</span></td><td>{l.sector}</td><td>{l.cwp}</td><td>{fmtT(l.on_time)}</td><td>{l.off_time?fmtT(l.off_time):"-"}</td><td>{l.off_time?<span className="status-badge status-off">Off</span>:<span className="status-badge status-on"><Pulse s={6}/> On</span>}</td></tr>)}</tbody></table></div>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CABANG: LOG POSITION
// ============================================================
const CabangLog = () => {
  const ctx = useApp()
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || {units:["TWR"]}
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const mySectors = ctx.sectors.filter(s => myBranches.includes(s.branch_code))
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))

  const [nmSearch,setNmSearch] = useState("")
  const [nmOpen,setNmOpen] = useState(false)
  const nmRef = useRef(null)
  const filteredPersonnel = [
    ...myPersonnel.filter(p => p.name.toLowerCase().startsWith(nmSearch.toLowerCase())),
    ...myPersonnel.filter(p => !p.name.toLowerCase().startsWith(nmSearch.toLowerCase()) && p.name.toLowerCase().includes(nmSearch.toLowerCase()))
  ]

  useEffect(() => {
    const handleClick = (e) => { if (nmRef.current && !nmRef.current.contains(e.target)) setNmOpen(false) }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const selectPerson = (name) => { setNm(name); setNmSearch(name); setNmOpen(false) }

  const [unit,setUnit] = useState(br.units[0]||"TWR")
  const [nm,setNm] = useState("")
  const [show,setShow] = useState(false)
  const [offId,setOffId] = useState(null)
  const [dep,setDep] = useState("")
  const [arr,setArr] = useState("")
  const [ovf,setOvf] = useState("")
  const [saving,setSaving] = useState(false)

  const unitSectors = mySectors.filter(s => s.unit === unit)
  const [si,setSi] = useState(0)
  const cwps = unitSectors[si] ? unitSectors[si].cwps : ["Controller","Assistant"]
  const [ci,setCi] = useState(0)

  const active = ctx.logs.filter(l => !l.off_time && myBranches.includes(l.branch_code))
  const today = ctx.logs.filter(l => myBranches.includes(l.branch_code) && new Date(l.on_time).toDateString() === new Date().toDateString())

  const onMic = async () => {
    if (!nm.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from("position_logs").insert({
      branch_code: ctx.user.branch_code,
      atc_name: nm.trim(),
      unit,
      sector: unitSectors[si]?.name || "Sector 1",
      cwp: cwps[ci] || "Controller",
      shift: getShift(),
      on_time: new Date().toISOString(),
      logged_by: ctx.user.id
    })
    if (error) alert("Error: " + error.message)
    else { logAudit("ON_MIC",nm.trim()+" — "+unit+" "+unitSectors[si]?.name+" ("+cwps[ci]+")",ctx.user); await ctx.reload(); setNm(""); setNmSearch(""); setShow(false) }
    setSaving(false)
  }

  const offMic = async (id, isController) => {
    setSaving(true)
    const updateData = { off_time: new Date().toISOString() }
    if (isController) {
      const d = parseInt(dep)||0, a = parseInt(arr)||0, o = parseInt(ovf)||0
      updateData.departure_count = d
      updateData.arrival_count = a
      updateData.overfly_count = o
      updateData.traffic_count = d + a + o
    }
    const { error } = await supabase.from("position_logs").update(updateData).eq("id", id)
    if (error) alert("Error: " + error.message)
    else {
      const lg = ctx.logs.find(x=>x.id===id)
      logAudit("OFF_MIC",(lg?.atc_name||"?")+" — "+(lg?.unit||"")+" "+(lg?.sector||"")+(isController?" DEP:"+updateData.departure_count+" ARR:"+updateData.arrival_count+" OVF:"+updateData.overfly_count:""),ctx.user)
      await ctx.reload(); setOffId(null); setDep(""); setArr(""); setOvf("")
    }
    setSaving(false)
  }

  const isControllerCwp = (cwp) => (cwp||"").toLowerCase().includes("controller")

  return (
    <div className="page-content">
      <Header title="Log Position" sub={"Input posisi ATC — "+ctx.user.branch_code}/>
      {active.length > 0 && <div className="panel panel-glow">
        <div className="panel-header"><h2 className="panel-title"><Pulse s={10}/> ATC On Mic ({active.length})</h2></div>
        <div className="panel-body">{active.map(l => {
          const isCtr = isControllerCwp(l.cwp)
          return (
          <div key={l.id} className="active-position">
            <div className="active-position-info">
              {[["Nama",l.atc_name],["Unit",l.unit],["Sektor",l.sector],["CWP",l.cwp],["On",fmtT(l.on_time)],["Durasi",durMin(l.on_time,new Date().toISOString())+"m"]].map(([k,v]) => <div key={k} className="active-pos-row"><span className="active-pos-label">{k}</span><span className="active-pos-value">{v}</span></div>)}
            </div>
            {offId===l.id ? (
              <div className="off-mic-form">
                {isCtr ? (
                  <>
                    <div style={{width:"100%",marginBottom:8}}>
                      <div style={{fontSize:11,fontWeight:600,color:"var(--fg-muted)",marginBottom:6}}>Laporan Traffic — {l.sector}</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                        <div className="field" style={{marginBottom:0}}><label style={{fontSize:11,color:"#0284C7"}}>DEP</label><input type="number" value={dep} onChange={e => setDep(e.target.value)} placeholder="0" min="0" style={{textAlign:"center"}}/></div>
                        <div className="field" style={{marginBottom:0}}><label style={{fontSize:11,color:"#CA8A04"}}>ARR</label><input type="number" value={arr} onChange={e => setArr(e.target.value)} placeholder="0" min="0" style={{textAlign:"center"}}/></div>
                        <div className="field" style={{marginBottom:0}}><label style={{fontSize:11,color:"#64748B"}}>OVF</label><input type="number" value={ovf} onChange={e => setOvf(e.target.value)} placeholder="0" min="0" style={{textAlign:"center"}}/></div>
                      </div>
                      {(dep||arr||ovf) && <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginTop:6,textAlign:"center"}}>Total: {(parseInt(dep)||0)+(parseInt(arr)||0)+(parseInt(ovf)||0)}</div>}
                    </div>
                    <div className="off-mic-actions">
                      <button className="btn btn-danger btn-sm" onClick={() => offMic(l.id, true)} disabled={saving}><I n="micOff" s={14}/> Off + Lapor</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => {setOffId(null);setDep("");setArr("");setOvf("")}}>Batal</button>
                    </div>
                  </>
                ) : (
                  <div className="off-mic-actions">
                    <button className="btn btn-danger btn-sm" onClick={() => offMic(l.id, false)} disabled={saving}><I n="micOff" s={14}/> Off Mic</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOffId(null)}>Batal</button>
                  </div>
                )}
              </div>
            ) : <button className="btn btn-danger btn-sm" onClick={() => setOffId(l.id)}><I n="micOff" s={14}/> Off Mic</button>}
          </div>
        )})}</div>
      </div>}

      <button className="btn btn-primary btn-lg" onClick={() => setShow(!show)} style={{marginBottom:20}}><I n={show?"x":"mic"} s={18}/> {show?"Tutup Form":"Input ATC On Mic"}</button>

      {show && <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Form On Mic</h2></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field"><label>Nama ATC</label><div ref={nmRef} style={{position:"relative"}}><input type="text" placeholder="Ketik nama..." value={nmSearch} onChange={e => {setNmSearch(e.target.value);setNm("");setNmOpen(true)}} onFocus={() => setNmOpen(true)} style={{width:"100%"}} autoComplete="off"/>{nmOpen && <div style={{position:"absolute",top:"100%",left:0,right:0,maxHeight:220,overflowY:"auto",background:"var(--panel-bg,#1e293b)",border:"1px solid var(--border,#334155)",borderRadius:8,marginTop:4,zIndex:999,boxShadow:"0 8px 24px rgba(0,0,0,0.4)"}}>{filteredPersonnel.length===0?<div style={{padding:"12px 16px",color:"var(--fg-muted,#94a3b8)",fontSize:13}}>Tidak ditemukan</div>:filteredPersonnel.map(p => <div key={p.id} onClick={() => selectPerson(p.name)} style={{padding:"10px 16px",cursor:"pointer",fontSize:13,color:"var(--fg,#e2e8f0)",borderBottom:"1px solid var(--border,#1e293b)",transition:"background .15s"}} onMouseEnter={e => e.target.style.background="rgba(56,189,248,0.1)"} onMouseLeave={e => e.target.style.background="transparent"}>{p.name}</div>)}</div>}</div></div>
            <div className="field"><label>Unit</label><select value={unit} onChange={e => {setUnit(e.target.value);setSi(0);setCi(0)}}>{br.units.map(u => <option key={u}>{u}</option>)}</select></div>
            <div className="field"><label>Sektor</label><select value={si} onChange={e => {setSi(+e.target.value);setCi(0)}}>{unitSectors.map((s,i) => <option key={i} value={i}>{s.name}</option>)}</select></div>
            <div className="field"><label>CWP</label><select value={ci} onChange={e => setCi(+e.target.value)}>{cwps.map((c,i) => <option key={i} value={i}>{c}</option>)}</select></div>
            <div className="field"><label>Shift</label><input value={getShift()} disabled/></div>
          </div>
          <button className="btn btn-primary" onClick={onMic} style={{marginTop:16}} disabled={!nm.trim()||saving}><I n="mic" s={16}/> {saving?"Menyimpan...":"On Mic Sekarang"}</button>
        </div>
      </div>}

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Log Hari Ini</h2><span className="panel-counter">{today.length}</span></div>
        <div className="panel-body">
          {today.length===0 ? <div className="empty-state"><p>Belum ada log</p></div> :
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>Shift</th><th>On</th><th>Off</th><th>Durasi</th><th>DEP</th><th>ARR</th><th>OVF</th><th>Status</th></tr></thead>
          <tbody>{today.map(l => <tr key={l.id}><td><strong>{l.atc_name}</strong></td><td><span className="unit-tag">{l.unit}</span></td><td>{l.sector}</td><td>{l.cwp}</td><td>{l.shift}</td><td>{fmtT(l.on_time)}</td><td>{l.off_time?fmtT(l.off_time):"-"}</td><td>{l.off_time?durMin(l.on_time,l.off_time)+"m":"..."}</td><td style={{textAlign:"center",color:"#0284C7"}}>{l.departure_count||"-"}</td><td style={{textAlign:"center",color:"#CA8A04"}}>{l.arrival_count||"-"}</td><td style={{textAlign:"center",color:"#64748B"}}>{l.overfly_count||"-"}</td><td>{l.off_time?<span className="status-badge status-off">Off</span>:<span className="status-badge status-on"><Pulse s={6}/> On</span>}</td></tr>)}</tbody></table></div>}
        </div>
      </div>
    </div>
  )
}


// ============================================================
// CABANG: HANDOVER/TAKEOVER (Checklist + Notes in 1 page)
// ============================================================
const CHECKLIST_ITEMS = [
  {key:"traffic_situation",label:"Traffic Situation"},
  {key:"conflict_solution",label:"Conflict & Solution"},
  {key:"weather",label:"Weather"},
  {key:"facilities",label:"Facilities"},
  {key:"coordination",label:"Coordination"},
  {key:"others",label:"Others"},
]
const STATUS_OPTS = ["OK","Not OK","N/A"]
const STATUS_CLR = {"OK":{bg:"#dcfce7",fg:"#166534",bd:"#86efac"},"Not OK":{bg:"#fef2f2",fg:"#991b1b",bd:"#fca5a5"},"N/A":{bg:"#f1f5f9",fg:"#6b7280",bd:"#d1d5db"}}

const CabangHandover = () => {
  const ctx = useApp()
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))
  const [moAccounts,setMoAccounts] = useState([])

  // Fetch MO accounts for accessible branches
  useEffect(() => {
    (async () => {
      const {data} = await supabase.from('accounts').select('id,username,display_name,branch_code').in('branch_code', myBranches).like('username','mo_%').order('username')
      if(data) setMoAccounts(data)
    })()
  },[ctx.user.branch_code])

  // ── Checklist state ──
  const [showForm,setShowForm] = useState(false)
  const [savingCL,setSavingCL] = useState(false)
  const [expandedId,setExpandedId] = useState(null)
  const initForm = () => ({
    checklist_date:new Date().toISOString().split("T")[0],
    checklist_time:new Date().toTimeString().slice(0,5),
    manager_on_duty:"",shift:"",
    traffic_situation_status:"OK",traffic_situation_notes:"",
    conflict_solution_status:"OK",conflict_solution_notes:"",
    weather_status:"OK",weather_notes:"",
    facilities_status:"OK",facilities_notes:"",
    coordination_status:"OK",coordination_notes:"",
    others_status:"N/A",others_notes:"",
    incoming_list:[""],outgoing_list:[""],
  })
  const [f,setF] = useState(initForm())
  const set = (k,v) => setF(p => ({...p,[k]:v}))

  // Helpers for multi-select incoming/outgoing
  const allSelected = [...f.incoming_list, ...f.outgoing_list].filter(n => n.trim())
  const setListItem = (listKey, idx, val) => {
    setF(p => { const arr = [...p[listKey]]; arr[idx] = val; return {...p, [listKey]: arr} })
  }
  const addListItem = (listKey) => {
    setF(p => p[listKey].length < 30 ? {...p, [listKey]: [...p[listKey], ""]} : p)
  }
  const removeListItem = (listKey, idx) => {
    setF(p => { const arr = p[listKey].filter((_,i) => i !== idx); return {...p, [listKey]: arr.length === 0 ? [""] : arr} })
  }
  const availablePersonnel = (listKey, idx) => {
    const currentVal = f[listKey][idx]
    return myPersonnel.filter(p => !allSelected.includes(p.name) || p.name === currentVal)
  }
  const myChecklists = ctx.handoverChecklists.filter(c => {
    const b = ctx.branches.find(br => br.id === c.branch_id)
    return b && myBranches.includes(b.code)
  })

  const submitCL = async () => {
    const incList = f.incoming_list.filter(n => n.trim())
    const outList = f.outgoing_list.filter(n => n.trim())
    if(!f.manager_on_duty.trim()||incList.length===0||outList.length===0){alert("Mohon isi Manager on Duty, minimal 1 Incoming & 1 Outgoing Personnel");return}
    setSavingCL(true)
    const submitData = {...f, incoming_personnel: incList.join(", "), outgoing_personnel: outList.join(", ")}
    delete submitData.incoming_list
    delete submitData.outgoing_list
    const {error} = await supabase.from("handover_checklists").insert({...submitData, branch_id:ctx.user.id, created_by:ctx.user.id})
    if(error) alert("Error: "+error.message)
    else {logAudit("CHECKLIST_CREATE","Shift "+f.shift+" MOD:"+f.manager_on_duty,ctx.user);setF(initForm());setShowForm(false);await ctx.reload()}
    setSavingCL(false)
  }
  const delCL = async (id) => {
    if(!confirm("Hapus checklist ini?"))return
    logAudit("CHECKLIST_DELETE","ID:"+id.slice(0,8),ctx.user)
    await supabase.from("handover_checklists").delete().eq("id",id)
    await ctx.reload()
  }

  // ── Notes state ──
  const [txt,setTxt] = useState("")
  const [pri,setPri] = useState("normal")
  const [savingN,setSavingN] = useState(false)
  const addNote = async () => {
    if (!txt.trim()||savingN) return
    setSavingN(true)
    const si = SHIFTS.indexOf(getShift())
    const { error } = await supabase.from("handover_notes").insert({
      branch_code: ctx.user.branch_code,
      from_shift: getShift(),
      to_shift: SHIFTS[(si+1)%3],
      author_name: ctx.user.display_name,
      priority: pri,
      content: txt,
      written_by: ctx.user.id
    })
    if (error) alert("Error: "+error.message)
    else { logAudit("NOTE_CREATE","Prioritas:"+pri+" — "+txt.slice(0,50),ctx.user); await ctx.reload(); setTxt(""); setPri("normal") }
    setSavingN(false)
  }

  return (
    <div className="page-content">
      <Header title="Handover/Takeover" sub={"Checklist & catatan serah terima — "+ctx.user.branch_code}/>

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 1: HANDOVER/TAKEOVER CHECKLIST      */}
      {/* ═══════════════════════════════════════════ */}
      <div style={{marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <h2 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:8}}><I n="checklist" s={18}/> Handover/Takeover Checklist</h2>
          {!showForm && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><I n="plus" s={14}/> Buat Checklist</button>}
        </div>
      </div>

      {showForm && <div className="panel" style={{animation:"fadeIn .3s ease"}}>
        <div className="panel-header"><h2 className="panel-title"><I n="checklist" s={16}/> Form Checklist Baru</h2></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field"><label>Date</label><input type="date" value={f.checklist_date} onChange={e => set("checklist_date",e.target.value)}/></div>
            <div className="field"><label>Time</label><input type="time" value={f.checklist_time} onChange={e => set("checklist_time",e.target.value)}/></div>
            <div className="field"><label>Manager on Duty</label><select value={f.manager_on_duty} onChange={e => set("manager_on_duty",e.target.value)}><option value="">— Pilih MOD —</option>{moAccounts.map(m => <option key={m.id} value={m.display_name}>{m.display_name}</option>)}</select></div>
            <div className="field"><label>Shift</label><select value={f.shift} onChange={e => set("shift",e.target.value)}><option value="">Pilih...</option><option value="Pagi">Pagi</option><option value="Siang">Siang</option><option value="Malam">Malam</option></select></div>
          </div>
          <div style={{overflowX:"auto",margin:"20px 0"}}>
            <table className="data-table" style={{minWidth:560}}>
              <thead><tr><th style={{width:36}}>No</th><th style={{width:160}}>Item</th><th style={{width:220}}>Status</th><th>Catatan</th></tr></thead>
              <tbody>{CHECKLIST_ITEMS.map((it,idx) => (
                <tr key={it.key}>
                  <td style={{textAlign:"center",color:"var(--fg-muted)"}}>{idx+1}</td>
                  <td><strong>{it.label}</strong></td>
                  <td>
                    <div style={{display:"flex",gap:4}}>
                      {STATUS_OPTS.map(st => {
                        const active = f[it.key+"_status"]===st
                        const c = STATUS_CLR[st]
                        return <button key={st} type="button" onClick={() => set(it.key+"_status",st)} style={{padding:"5px 12px",borderRadius:6,border:`1.5px solid ${active?c.bd:"var(--border)"}`,background:active?c.bg:"transparent",color:active?c.fg:"var(--fg-muted)",fontSize:12,fontWeight:600,cursor:"pointer",transition:"all .15s"}}>{st}</button>
                      })}
                    </div>
                  </td>
                  <td><input value={f[it.key+"_notes"]} onChange={e => set(it.key+"_notes",e.target.value)} placeholder="Opsional..." style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}/></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,padding:"20px 0",borderTop:"2px solid var(--border)"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"var(--fg-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Incoming Personnel ({f.incoming_list.filter(n=>n.trim()).length})</div>
              {f.incoming_list.map((name, idx) => (
                <div key={idx} style={{display:"flex",gap:4,marginBottom:6,alignItems:"center"}}>
                  <select value={name} onChange={e => setListItem("incoming_list",idx,e.target.value)} style={{flex:1,padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}>
                    <option value="">— Pilih —</option>
                    {availablePersonnel("incoming_list",idx).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  {f.incoming_list.length > 1 && <button type="button" onClick={() => removeListItem("incoming_list",idx)} style={{width:28,height:28,borderRadius:6,border:"1px solid var(--border)",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>}
                </div>
              ))}
              {f.incoming_list.length < 30 && <button type="button" onClick={() => addListItem("incoming_list")} className="btn btn-ghost btn-sm" style={{fontSize:11,marginTop:2}}>+ Add More</button>}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:"var(--fg-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Outgoing Personnel ({f.outgoing_list.filter(n=>n.trim()).length})</div>
              {f.outgoing_list.map((name, idx) => (
                <div key={idx} style={{display:"flex",gap:4,marginBottom:6,alignItems:"center"}}>
                  <select value={name} onChange={e => setListItem("outgoing_list",idx,e.target.value)} style={{flex:1,padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}>
                    <option value="">— Pilih —</option>
                    {availablePersonnel("outgoing_list",idx).map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  {f.outgoing_list.length > 1 && <button type="button" onClick={() => removeListItem("outgoing_list",idx)} style={{width:28,height:28,borderRadius:6,border:"1px solid var(--border)",background:"transparent",color:"#ef4444",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>}
                </div>
              ))}
              {f.outgoing_list.length < 30 && <button type="button" onClick={() => addListItem("outgoing_list")} className="btn btn-ghost btn-sm" style={{fontSize:11,marginTop:2}}>+ Add More</button>}
            </div>
          </div>
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:12}}>
            <button className="btn btn-ghost" onClick={() => {setShowForm(false);setF(initForm())}}>Batal</button>
            <button className="btn btn-primary" onClick={submitCL} disabled={savingCL}><I n="checklist" s={16}/> {savingCL?"Menyimpan...":"Simpan Checklist"}</button>
          </div>
        </div>
      </div>}

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Riwayat Checklist</h2><span className="panel-counter">{myChecklists.length}</span></div>
        <div className="panel-body">
          {myChecklists.length===0 ? <div className="empty-state"><I n="checklist" s={44}/><p>Belum ada checklist</p></div> :
          myChecklists.map(cl => (
            <div key={cl.id} className="handover-card handover-normal" style={{cursor:"pointer"}} onClick={() => setExpandedId(expandedId===cl.id?null:cl.id)}>
              <div className="handover-header">
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:14}}>{expandedId===cl.id?"▾":"▸"}</span>
                  <strong>{fmtD(cl.checklist_date)}</strong>
                  {cl.shift && <span className="priority-tag priority-normal">{cl.shift}</span>}
                  <span style={{color:"var(--fg-muted)",fontSize:12}}>MOD: {cl.manager_on_duty}</span>
                  {CHECKLIST_ITEMS.some(it => cl[it.key+"_status"]==="Not OK") && <span className="priority-tag priority-high">⚠ Not OK</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="handover-time">{cl.checklist_time||""}</span>
                  <button className="btn btn-ghost btn-sm" onClick={e => {e.stopPropagation();delCL(cl.id)}} style={{color:"#ef4444",fontSize:11,padding:"2px 8px"}}>Hapus</button>
                </div>
              </div>
              {expandedId===cl.id && (
                <div style={{padding:"12px 0 4px",borderTop:"1px solid var(--border)"}}>
                  <table className="data-table" style={{fontSize:12}}>
                    <thead><tr><th>Item</th><th>Status</th><th>Catatan</th></tr></thead>
                    <tbody>{CHECKLIST_ITEMS.map(it => (
                      <tr key={it.key}>
                        <td>{it.label}</td>
                        <td><span style={{display:"inline-block",padding:"2px 10px",borderRadius:12,fontSize:11,fontWeight:600,background:STATUS_CLR[cl[it.key+"_status"]]?.bg||"#f1f5f9",color:STATUS_CLR[cl[it.key+"_status"]]?.fg||"#6b7280"}}>{cl[it.key+"_status"]}</span></td>
                        <td style={{color:"var(--fg-muted)"}}>{cl[it.key+"_notes"]||"—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <div style={{display:"flex",gap:24,marginTop:12,padding:12,background:"var(--bg)",borderRadius:8}}>
                    <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase",marginBottom:4}}>Incoming ({(cl.incoming_personnel||"").split(",").filter(n=>n.trim()).length})</div>{(cl.incoming_personnel||"").split(",").map((n,i) => n.trim() && <div key={i} style={{fontSize:13,fontWeight:600,color:"var(--fg)",padding:"2px 0"}}>• {n.trim()}</div>)}</div>
                    <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase",marginBottom:4}}>Outgoing ({(cl.outgoing_personnel||"").split(",").filter(n=>n.trim()).length})</div>{(cl.outgoing_personnel||"").split(",").map((n,i) => n.trim() && <div key={i} style={{fontSize:13,fontWeight:600,color:"var(--fg)",padding:"2px 0"}}>• {n.trim()}</div>)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 2: HANDOVER NOTES                   */}
      {/* ═══════════════════════════════════════════ */}
      <div style={{marginTop:32,marginBottom:16}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:8}}><I n="note" s={18}/> Handover Notes</h2>
      </div>

      <div className="panel"><div className="panel-header"><h2 className="panel-title">Buat Catatan</h2></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field"><label>Prioritas</label><select value={pri} onChange={e => setPri(e.target.value)}><option value="normal">Normal</option><option value="medium">Medium</option><option value="high">Urgent</option></select></div>
            <div className="field"><label>Shift</label><input value={"Shift "+getShift()+" → "+SHIFTS[(SHIFTS.indexOf(getShift())+1)%3]} disabled/></div>
          </div>
          <div className="field"><label>Catatan</label><textarea value={txt} onChange={e => setTxt(e.target.value)} rows={4} placeholder="Catatan untuk shift berikutnya..."/></div>
          <button className="btn btn-primary" onClick={addNote} disabled={!txt.trim()||savingN}><I n="note" s={16}/> {savingN?"Menyimpan...":"Simpan"}</button>
        </div>
      </div>
      <div className="panel"><div className="panel-header"><h2 className="panel-title">Riwayat Notes</h2><span className="panel-counter">{ctx.handovers.filter(n => myBranches.includes(n.branch_code)).length}</span></div>
        <div className="panel-body">
          {ctx.handovers.filter(n => myBranches.includes(n.branch_code)).length===0 ? <div className="empty-state"><p>Belum ada catatan</p></div> :
          ctx.handovers.filter(n => myBranches.includes(n.branch_code)).map(n => (
            <div key={n.id} className={"handover-card handover-"+n.priority}>
              <div className="handover-header"><div><span className={"priority-tag priority-"+n.priority}>{n.priority.toUpperCase()}</span><span className="handover-shift">Shift {n.from_shift} → {n.to_shift}</span></div><span className="handover-time">{fmtDT(n.created_at)}</span></div>
              <div className="handover-body">{n.content}</div>
              <div className="handover-author">— {n.author_name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// CABANG: REKAP TRAFFIC (from position_logs off-mic reports)
// ============================================================
const CabangRekap = () => {
  const ctx = useApp()
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  // Only logs with traffic data (controller off-mic reports)
  const myLogs = ctx.logs.filter(l => myBranches.includes(l.branch_code) && l.off_time && ((l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)) > 0)
  const [period,setPeriod] = useState("month")
  const [filterName,setFilterName] = useState("")
  const [filterSector,setFilterSector] = useState("")

  const filtered = myLogs.filter(l => {
    const d = (new Date()-new Date(l.on_time))/864e5
    const pOk = period==="today" ? new Date(l.on_time).toDateString()===new Date().toDateString() : period==="week" ? d<=7 : d<=30
    const nmOk = !filterName || (l.atc_name||"").toLowerCase().includes(filterName.toLowerCase())
    const secOk = !filterSector || (l.sector||"").toLowerCase().includes(filterSector.toLowerCase())
    return pOk && nmOk && secOk
  }).sort((a,b) => new Date(b.on_time)-new Date(a.on_time))

  const totals = filtered.reduce((a,l) => ({dep:a.dep+(l.departure_count||0),arr:a.arr+(l.arrival_count||0),ovf:a.ovf+(l.overfly_count||0),tc:a.tc+(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)}),{dep:0,arr:0,ovf:0,tc:0})

  // Group by date for chart
  const byDate = {}
  filtered.forEach(l => {
    const dt = new Date(l.on_time).toISOString().slice(0,10)
    if(!byDate[dt]) byDate[dt] = {dep:0,arr:0,ovf:0}
    byDate[dt].dep += l.departure_count||0
    byDate[dt].arr += l.arrival_count||0
    byDate[dt].ovf += l.overfly_count||0
  })
  const dates = Object.keys(byDate).sort()
  const chartMax = Math.max(1,...dates.map(d => byDate[d].dep+byDate[d].arr+byDate[d].ovf))

  // Group by sector
  const bySector = {}
  filtered.forEach(l => {
    const sk = l.unit+" — "+l.sector
    if(!bySector[sk]) bySector[sk] = {dep:0,arr:0,ovf:0}
    bySector[sk].dep += l.departure_count||0
    bySector[sk].arr += l.arrival_count||0
    bySector[sk].ovf += l.overfly_count||0
  })
  const sectorKeys = Object.keys(bySector).sort((a,b) => (bySector[b].dep+bySector[b].arr+bySector[b].ovf) - (bySector[a].dep+bySector[a].arr+bySector[a].ovf))
  const sectorMax = Math.max(1,...sectorKeys.map(k => bySector[k].dep+bySector[k].arr+bySector[k].ovf))

  const exportCSV = () => {
    const head = ["Tanggal","On","Off","Controller","Unit","Sektor","Shift","DEP","ARR","OVF","Total"]
    const rows = filtered.map(l => {const dt=new Date(l.on_time).toISOString().slice(0,10);return[dt,fmtT(l.on_time),fmtT(l.off_time),l.atc_name||"",l.unit||"",l.sector||"",l.shift||"",l.departure_count||0,l.arrival_count||0,l.overfly_count||0,(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)]})
    const csv = [head.join(","),...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"})
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `rekap_traffic_${ctx.user.branch_code}_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page-content">
      <Header title="Rekap Traffic" sub={"Data traffic per sektor — "+ctx.user.branch_code}/>

      {/* Filter bar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <div className="filter-bar" style={{margin:0}}>{[["today","Hari Ini"],["week","7 Hari"],["month","30 Hari"]].map(([k,v]) => <button key={k} className={"filter-btn"+(period===k?" filter-btn-active":"")} onClick={() => setPeriod(k)}>{v}</button>)}</div>
        <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Filter controller..." className="filter-input" style={{flex:1,minWidth:100,padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}/>
        <input value={filterSector} onChange={e => setFilterSector(e.target.value)} placeholder="Sektor..." className="filter-input" style={{width:100,padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}/>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        <Stat icon="plane" label="Total Traffic" value={totals.tc} sub={filtered.length+" laporan"} color="#10b981"/>
        <Stat icon="upload" label="Departure" value={totals.dep} color="#0284C7"/>
        <Stat icon="download" label="Arrival" value={totals.arr} color="#CA8A04"/>
        <Stat icon="radar" label="Overfly" value={totals.ovf} color="#64748B"/>
      </div>

      {/* Traffic per Sector */}
      {sectorKeys.length>0 && <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Traffic Per Sektor</h2></div>
        <div className="panel-body"><div className="simple-chart">{sectorKeys.map(sk => {
          const t = bySector[sk].dep+bySector[sk].arr+bySector[sk].ovf
          return <div key={sk} className="chart-bar-row"><span className="chart-label">{sk}</span><div className="chart-bar-track"><div className="chart-bar-fill" style={{width:(t/sectorMax*100)+"%"}}><span className="chart-bar-value">{t}</span></div></div></div>
        })}</div></div>
      </div>}

      {/* Daily chart */}
      {dates.length>1 && <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Trend Harian</h2></div>
        <div className="panel-body">
          <svg viewBox="0 0 680 200" width="100%" style={{display:"block"}}>
            {[0,.25,.5,.75,1].map(f => {const y=16+(1-f)*150;return <line key={f} x1="46" y1={y} x2="664" y2={y} stroke="var(--border)" strokeWidth=".5"/>})}
            {(() => {
              const pts=dates.map((d,i) => ({x:46+(dates.length===1?309:(i/(dates.length-1))*618),y:16+(1-(byDate[d].dep+byDate[d].arr+byDate[d].ovf)/chartMax)*150,v:byDate[d].dep+byDate[d].arr+byDate[d].ovf,d}))
              const pathD=pts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ")
              return <>
                <path d={`${pathD} L${pts[pts.length-1].x},166 L${pts[0].x},166 Z`} fill="#0284C7" opacity=".1"/>
                <path d={pathD} fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                {pts.map((p,i) => <g key={i}><circle cx={p.x} cy={p.y} r="4" fill="var(--card)" stroke="#0284C7" strokeWidth="2"/><text x={p.x} y={p.y-10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0284C7">{p.v}</text><text x={p.x} y={185} textAnchor="middle" fontSize="9" fill="var(--fg-muted)">{p.d.slice(5)}</text></g>)}
              </>
            })()}
          </svg>
        </div>
      </div>}

      {/* Data Table */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Data Detail</h2><span className="panel-counter">{filtered.length}</span></div>
        <div className="panel-body">
          {filtered.length===0 ? <div className="empty-state"><p>Tidak ada data untuk filter ini</p></div> :
          <div className="table-wrap"><table className="data-table"><thead><tr>
            <th>Tanggal</th><th>On–Off</th><th>Controller</th><th>Unit</th><th>Sektor</th><th>Shift</th>
            <th style={{textAlign:"center",color:"#0284C7"}}>DEP</th>
            <th style={{textAlign:"center",color:"#CA8A04"}}>ARR</th>
            <th style={{textAlign:"center",color:"#64748B"}}>OVF</th>
            <th style={{textAlign:"center"}}>Total</th>
          </tr></thead>
          <tbody>{filtered.map(l => {
            const tc=(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)
            return <tr key={l.id}>
            <td style={{whiteSpace:"nowrap"}}>{fmtD(l.on_time)}</td>
            <td style={{whiteSpace:"nowrap",color:"var(--fg-muted)",fontSize:12}}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
            <td><strong>{l.atc_name||"-"}</strong></td>
            <td><span className="unit-tag">{l.unit}</span></td>
            <td>{l.sector||"-"}</td>
            <td>{l.shift||"-"}</td>
            <td style={{textAlign:"center",color:"#0284C7",fontWeight:700}}>{l.departure_count||0}</td>
            <td style={{textAlign:"center",color:"#CA8A04",fontWeight:700}}>{l.arrival_count||0}</td>
            <td style={{textAlign:"center",color:"#64748B",fontWeight:700}}>{l.overfly_count||0}</td>
            <td style={{textAlign:"center",fontWeight:800}}>{tc}</td>
          </tr>})}
          </tbody>
          <tfoot><tr style={{fontWeight:700}}>
            <td colSpan={6} style={{textAlign:"right",color:"var(--fg-muted)"}}>TOTAL</td>
            <td style={{textAlign:"center",color:"#0284C7"}}>{totals.dep}</td>
            <td style={{textAlign:"center",color:"#CA8A04"}}>{totals.arr}</td>
            <td style={{textAlign:"center",color:"#64748B"}}>{totals.ovf}</td>
            <td style={{textAlign:"center"}}>{totals.tc}</td>
          </tr></tfoot>
          </table></div>}
        </div>
      </div>

      {/* Export */}
      {filtered.length>0 && <button className="btn btn-primary" onClick={exportCSV} style={{marginTop:4}}><I n="download" s={16}/> Export CSV</button>}
    </div>
  )
}

// ============================================================
// CABANG: REKAP PERSONEL
// ============================================================
const CabangRekapPersonnel = () => {
  const ctx = useApp()
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)
  const myPersonnel = ctx.personnel.filter(p => myBranches.includes(p.branch_code))
  const myLogs = ctx.logs.filter(l => myBranches.includes(l.branch_code) && l.off_time)
  const [period,setPeriod] = useState("month")
  const [search,setSearch] = useState("")
  const [expandedName,setExpandedName] = useState(null)
  const [sortBy,setSortBy] = useState("hours") // hours | count | traffic

  const filtered = myLogs.filter(l => {
    const d = (new Date()-new Date(l.on_time))/864e5
    return period==="today" ? new Date(l.on_time).toDateString()===new Date().toDateString() : period==="week" ? d<=7 : d<=30
  })

  // Build per-person stats
  const byPerson = {}
  filtered.forEach(l => {
    const nm = l.atc_name
    if(!byPerson[nm]) byPerson[nm] = {name:nm,count:0,totalMin:0,dep:0,arr:0,ovf:0,shifts:{Morning:0,Afternoon:0,Night:0},sectors:new Set(),logs:[]}
    const p = byPerson[nm]
    p.count++
    p.totalMin += durMin(l.on_time,l.off_time)
    p.dep += l.departure_count||0
    p.arr += l.arrival_count||0
    p.ovf += l.overfly_count||0
    if(l.shift) p.shifts[l.shift] = (p.shifts[l.shift]||0)+1
    if(l.sector) p.sectors.add(l.sector)
    p.logs.push(l)
  })

  // Include personnel with 0 activity
  myPersonnel.forEach(p => {
    if(!byPerson[p.name]) byPerson[p.name] = {name:p.name,count:0,totalMin:0,dep:0,arr:0,ovf:0,shifts:{Morning:0,Afternoon:0,Night:0},sectors:new Set(),logs:[]}
  })

  let personList = Object.values(byPerson)
  if(search) personList = personList.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  // Sort
  personList.sort((a,b) => {
    if(sortBy==="hours") return b.totalMin - a.totalMin
    if(sortBy==="count") return b.count - a.count
    return (b.dep+b.arr+b.ovf) - (a.dep+a.arr+a.ovf)
  })

  const totalPersonnel = myPersonnel.length
  const activePersonnel = Object.values(byPerson).filter(p => p.count > 0).length
  const totalHours = Math.round(Object.values(byPerson).reduce((a,p) => a+p.totalMin, 0) / 60 * 10) / 10
  const totalTraffic = Object.values(byPerson).reduce((a,p) => a+p.dep+p.arr+p.ovf, 0)
  const topMax = personList.length > 0 ? personList[0].totalMin : 1

  const exportCSV = () => {
    const head = ["Nama","On Mic","Total Jam","Rata-rata (mnt)","DEP","ARR","OVF","Total Traffic","Shift Pagi","Shift Siang","Shift Malam","Sektor"]
    const rows = personList.map(p => [p.name,p.count,(p.totalMin/60).toFixed(1),p.count?Math.round(p.totalMin/p.count):0,p.dep,p.arr,p.ovf,p.dep+p.arr+p.ovf,p.shifts.Morning||0,p.shifts.Afternoon||0,p.shifts.Night||0,[...p.sectors].join("; ")])
    const csv = [head.join(","),...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"})
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `rekap_personel_${ctx.user.branch_code}_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page-content">
      <Header title="Rekap Personel" sub={"Statistik personel ATC — "+ctx.user.branch_code}/>

      {/* Filters */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <div className="filter-bar" style={{margin:0}}>{[["today","Hari Ini"],["week","7 Hari"],["month","30 Hari"]].map(([k,v]) => <button key={k} className={"filter-btn"+(period===k?" filter-btn-active":"")} onClick={() => setPeriod(k)}>{v}</button>)}</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama..." style={{flex:1,minWidth:120,padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}/>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}>
          <option value="hours">Urutkan: Jam Kerja</option>
          <option value="count">Urutkan: Frekuensi</option>
          <option value="traffic">Urutkan: Traffic</option>
        </select>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Stat icon="users" label="Total Personel" value={totalPersonnel} sub={activePersonnel+" aktif"} color="#8b5cf6"/>
        <Stat icon="clock" label="Total Jam Kerja" value={totalHours+" jam"} color="#2563eb"/>
        <Stat icon="mic" label="Total On Mic" value={filtered.length} sub="periode ini" color="#10b981"/>
        <Stat icon="plane" label="Total Traffic" value={totalTraffic} color="#f59e0b"/>
      </div>

      {/* Top 10 Bar Chart */}
      {personList.filter(p=>p.count>0).length > 0 && <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Top Personel (Jam Kerja)</h2></div>
        <div className="panel-body">
        <div style={{display:"grid",gridTemplateColumns:"140px 1fr 60px 50px 50px",gap:8,marginBottom:8,paddingBottom:8,borderBottom:"1px solid var(--border)"}}>
          <span/><span/>
          <span style={{fontSize:9,fontWeight:700,color:"var(--fg-muted)",textAlign:"right",textTransform:"uppercase",letterSpacing:".5px"}}>Jam</span>
          <span style={{fontSize:9,fontWeight:700,color:"var(--fg-muted)",textAlign:"center",textTransform:"uppercase",letterSpacing:".5px"}}>On Mic</span>
          <span style={{fontSize:9,fontWeight:700,color:"var(--fg-muted)",textAlign:"center",textTransform:"uppercase",letterSpacing:".5px"}}>Traffic</span>
        </div>
        <div className="simple-chart">{personList.filter(p=>p.count>0).slice(0,10).map(p => {
          const hrs = Math.round(p.totalMin/60*10)/10
          const traffic = p.dep+p.arr+p.ovf
          return <div key={p.name} style={{display:"grid",gridTemplateColumns:"140px 1fr 60px 50px 50px",gap:8,alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:600,color:"var(--fg)",textAlign:"right",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
            <div className="chart-bar-track">
              <div className="chart-bar-fill" style={{width:((p.totalMin/topMax)*100)+"%",minWidth:4}}/>
            </div>
            <span style={{fontSize:12,fontWeight:700,color:"#38bdf8",textAlign:"right"}}>{hrs}</span>
            <span style={{fontSize:11,fontWeight:600,color:"#a78bfa",textAlign:"center"}}>{p.count}x</span>
            <span style={{fontSize:11,fontWeight:600,color:"#94a3b8",textAlign:"center"}}>{traffic>0?traffic:"—"}</span>
          </div>
        })}</div>
        </div>
      </div>}

      {/* Personnel Table */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Detail Personel</h2><span className="panel-counter">{personList.length}</span></div>
        <div className="panel-body">
          {personList.length===0 ? <div className="empty-state"><I n="users" s={44}/><p>Tidak ada data</p></div> :
          personList.map(p => {
            const isExp = expandedName === p.name
            const hrs = Math.round(p.totalMin/60*10)/10
            const avg = p.count ? Math.round(p.totalMin/p.count) : 0
            const tc = p.dep+p.arr+p.ovf
            return (
              <div key={p.name} className={"handover-card "+(p.count>0?"handover-normal":"handover-normal")} style={{cursor:"pointer",opacity:p.count>0?1:0.5,marginBottom:4}} onClick={() => setExpandedName(isExp?null:p.name)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:13}}>{isExp?"▾":"▸"}</span>
                    <strong style={{fontSize:13}}>{p.name}</strong>
                    {p.count===0 && <span style={{fontSize:10,color:"var(--fg-muted)",fontStyle:"italic"}}>Belum on mic</span>}
                  </div>
                  {p.count>0 && <div style={{display:"flex",alignItems:"center",gap:12,fontSize:11,fontWeight:600}}>
                    <span style={{color:"#2563eb"}}>{hrs} jam</span>
                    <span style={{color:"#10b981"}}>{p.count}x</span>
                    <span style={{color:"#0284C7"}}>{p.dep}<span style={{fontWeight:400,fontSize:9}}> D</span></span>
                    <span style={{color:"#CA8A04"}}>{p.arr}<span style={{fontWeight:400,fontSize:9}}> A</span></span>
                    <span style={{color:"#64748B"}}>{p.ovf}<span style={{fontWeight:400,fontSize:9}}> O</span></span>
                  </div>}
                </div>
                {isExp && p.count > 0 && (
                  <div style={{padding:"10px 0 4px",borderTop:"1px solid var(--border)"}}>
                    {/* Shift distribution */}
                    <div style={{display:"flex",gap:12,marginBottom:10,fontSize:11}}>
                      <span>Rata-rata: <strong>{avg} mnt</strong></span>
                      <span>Pagi: <strong>{p.shifts.Morning||0}</strong></span>
                      <span>Siang: <strong>{p.shifts.Afternoon||0}</strong></span>
                      <span>Malam: <strong>{p.shifts.Night||0}</strong></span>
                      <span>Sektor: <strong>{[...p.sectors].join(", ")||"-"}</strong></span>
                    </div>
                    {/* Log detail */}
                    <div className="table-wrap"><table className="data-table" style={{fontSize:11}}>
                      <thead><tr><th>Tanggal</th><th>On–Off</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>Durasi</th><th style={{textAlign:"center",color:"#0284C7"}}>D</th><th style={{textAlign:"center",color:"#CA8A04"}}>A</th><th style={{textAlign:"center",color:"#64748B"}}>O</th></tr></thead>
                      <tbody>{p.logs.sort((a,b)=>new Date(b.on_time)-new Date(a.on_time)).slice(0,20).map(l => (
                        <tr key={l.id}>
                          <td style={{whiteSpace:"nowrap"}}>{fmtD(l.on_time)}</td>
                          <td style={{whiteSpace:"nowrap",color:"var(--fg-muted)"}}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
                          <td><span className="unit-tag">{l.unit}</span></td>
                          <td>{l.sector}</td>
                          <td>{l.cwp}</td>
                          <td>{durMin(l.on_time,l.off_time)}m</td>
                          <td style={{textAlign:"center",color:"#0284C7",fontWeight:600}}>{l.departure_count||0}</td>
                          <td style={{textAlign:"center",color:"#CA8A04",fontWeight:600}}>{l.arrival_count||0}</td>
                          <td style={{textAlign:"center",color:"#64748B",fontWeight:600}}>{l.overfly_count||0}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                    {p.logs.length > 20 && <div style={{fontSize:10,color:"var(--fg-muted)",marginTop:4}}>Menampilkan 20 terbaru dari {p.logs.length} log</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Export */}
      {personList.filter(p=>p.count>0).length>0 && <button className="btn btn-primary" onClick={exportCSV} style={{marginTop:4}}><I n="download" s={16}/> Export CSV</button>}
    </div>
  )
}

// ============================================================
// CABANG: HO/TO MO (Pre-Shift, Handover, Post-Shift Checklists)
// ============================================================
const MO_PRE_SHIFT = [
  {no:1,item:"Kehadiran personel",std:"Seluruh personel hadir minimal 30 menit sebelum shift. Keterlambatan dicatat."},
  {no:2,item:"Fit for duty personel",std:"Setiap personel diverifikasi langsung: fisik/mental, bebas alkohol/obat, tidak fatigue. Personel tidak fit dikeluarkan sebelum shift dimulai."},
  {no:3,item:"Larangan bertugas pasca-kejadian",std:"Personel pasca-BOS, near collision, atau accident tidak dijadwalkan di posisi kerja sesuai SOP."},
  {no:4,item:"Trafik & flow management",std:"Volume trafik, sequencing, proyeksi shift, dan slot/CTOT bila ada — disampaikan dari sumber primer."},
  {no:5,item:"Cuaca & prakiraan",std:"QAM/METAR/TAF terkini, visibility, wind, prakiraan signifikan. Trend yang mempengaruhi kapasitas disampaikan."},
  {no:6,item:"Status fasilitas",std:"COM/NAV/SUR/ATMAS, lighting, power supply, degraded mode. Status 'normal' dikonfirmasi — tidak diasumsikan."},
  {no:7,item:"NOTAM & pembatasan ruang udara",std:"NOTAM aktif dan pembatasan ruang udara beserta implikasi operasionalnya disampaikan kepada seluruh personel."},
  {no:8,item:"Koordinasi ongoing",std:"Pending/ongoing coordination dengan adjacent units, ATFM, INMC, militer, dan otoritas bandara."},
  {no:9,item:"Operasi khusus",std:"VIP, militer, emergency, training, calibration, atau test flight yang terjadwal selama shift."},
  {no:10,item:"Prosedur khusus berlaku",std:"Contingency plan, reduced separation, prosedur sementara, runway change, atau sector reconfiguration yang aktif."},
  {no:11,item:"Penugasan posisi & rotasi FRMS",std:"Position log final dibagikan. Rotasi (2 jam Controller / 3 jam Assistant) ditetapkan dan dipahami seluruh personel."},
  {no:12,item:"Outstanding issue",std:"Pending issue shift sebelumnya, ASOR berproses, dan korespondensi penting disampaikan secara eksplisit."},
  {no:13,item:"Tanya jawab",std:"Seluruh personel diberi kesempatan bertanya sehingga memahami isi briefing dan siap bertugas."},
  {no:14,item:"Closing confirmation",std:"Doa bersama atau persiapan mental yang berlaku di unit dilaksanakan."},
]
const MO_HANDOVER = [
  {no:1,item:"Kehadiran Incoming Manager",std:"Hadir minimal 30 menit sebelum jadwal."},
  {no:2,item:"Observasi situasional mandiri",std:"Minimal 5 menit observasi langsung tanpa intervensi Outgoing Manager (trafik, konfigurasi, cuaca, fasilitas, koordinasi berjalan, potensi konflik)."},
  {no:3,item:"Kondisi trafik menyeluruh",std:"Outgoing Manager menyampaikan gambaran lengkap seluruh sektor/posisi, sequencing, dan flow management secara eksplisit."},
  {no:4,item:"Konflik & mitigasi aktif",std:"Potensi konflik, tindakan yang sedang berjalan, dan koordinasi yang perlu dilanjutkan disampaikan secara spesifik."},
  {no:5,item:"Cuaca & prakiraan",std:"Kondisi cuaca signifikan saat ini dan prakiraan untuk shift mendatang beserta implikasinya."},
  {no:6,item:"Status fasilitas",std:"Gangguan, malfunction, atau service interruption yang berlangsung — termasuk unit teknis yang sudah dihubungi."},
  {no:7,item:"Koordinasi belum tuntas",std:"Outstanding coordination dengan adjacent units, ATFM, INMC, militer, atau otoritas bandara — spesifik dan dapat ditindaklanjuti."},
  {no:8,item:"Isu personel",std:"Kelelahan, performa menurun, kondisi khusus, personel tidak fit, kebutuhan rotasi tambahan — disampaikan faktual."},
  {no:9,item:"Operasi khusus / VIP / militer",std:"Flight plan khusus yang sedang atau akan berlangsung dan kebutuhan koordinasinya."},
  {no:10,item:"Pending administrative issue",std:"ASOR berproses, instruksi pimpinan, korespondensi penting yang perlu ditindaklanjuti."},
  {no:11,item:"Verifikasi dokumentasi",std:"Incoming Manager memverifikasi langsung: ATS Logbook, position log, managerial logbook, dan catatan insiden hingga waktu takeover."},
]
const MO_POST_SHIFT = [
  {no:1,item:"Kehadiran seluruh personel",std:"Seluruh personel shift hadir. Absensi dicatat."},
  {no:2,item:"Ringkasan operasional",std:"Trafik, momen kritis, dan unusual events disampaikan ringkas dan faktual."},
  {no:3,item:"Safety & hazard",std:"Safety occurrences, deviasi prosedur, hazard, dan mitigasi yang dilakukan — disampaikan terbuka."},
  {no:4,item:"Ringkasan cuaca",std:"Cuaca signifikan/perubahan forecast yang mempengaruhi operasional selama shift."},
  {no:5,item:"Ringkasan fasilitas",std:"Malfunction, maintenance action, atau service interruption beserta tindak lanjut yang sudah dilakukan."},
  {no:6,item:"Koordinasi",std:"Koordinasi selesai diverifikasi. Outstanding coordination dicatat dalam managerial logbook."},
  {no:7,item:"Evaluasi performa tim",std:"Performa, beban kerja, dan dinamika teamwork dievaluasi secara konstruktif."},
  {no:8,item:"Verifikasi dokumentasi",std:"ATS Logbook, position log, handover sheet, ASOR, dan catatan insiden diverifikasi lengkap sebelum review ditutup."},
  {no:9,item:"Tindak lanjut keselamatan",std:"Jika terdapat isu keselamatan, inisiasi mekanisme SMS/pelaporan sebelum Post Briefing ditutup."},
  {no:10,item:"Lesson learned",std:"Pembelajaran kunci dari shift dicatat untuk shift berikutnya."},
  {no:11,item:"Umpan balik personel",std:"Seluruh personel diberi kesempatan menyampaikan feedback."},
  {no:12,item:"Managerial logbook",std:"Catatan managerial logbook (pending issue, outstanding coordination, rekomendasi) selesai disusun sebelum review ditutup."},
  {no:13,item:"Penutupan shift",std:"Apresiasi kepada Tim ditutup Doa bersama."},
]
const MO_TABS = [
  {id:"pre_shift",label:"Pre-Shift Briefing",items:MO_PRE_SHIFT,icon:"📋"},
  {id:"handover",label:"Handover/Takeover",items:MO_HANDOVER,icon:"🔄"},
  {id:"post_shift",label:"Post-Shift Briefing",items:MO_POST_SHIFT,icon:"📝"},
]

const CabangHoToMo = () => {
  const ctx = useApp()
  const [activeTab,setActiveTab] = useState("pre_shift")
  const [showForm,setShowForm] = useState(false)
  const [saving,setSaving] = useState(false)
  const [history,setHistory] = useState([])
  const [checkDate,setCheckDate] = useState(new Date().toISOString().slice(0,10))
  const [shift,setShift] = useState("")
  const [notes,setNotes] = useState("")

  const currentTab = MO_TABS.find(t => t.id === activeTab)
  const initChecks = () => currentTab.items.reduce((a,it) => ({...a,[it.no]:null}),{})
  const [checks,setChecks] = useState(initChecks())

  useEffect(() => { setChecks(initChecks()); setShowForm(false) }, [activeTab])

  const moAccounts = ctx.personnel.filter(p => p.branch_code === ctx.user.branch_code)
  const myBranches = getAccessibleBranches(ctx.user.branch_code, ctx.branches, ctx.moBranchCodes)

  // Load history
  useEffect(() => {
    const load = async () => {
      const {data} = await supabase.from("mo_checklists").select("*")
        .in("branch_code",myBranches).eq("checklist_type",activeTab)
        .order("created_at",{ascending:false}).limit(20)
      if (data) setHistory(data)
    }
    load()
  }, [activeTab,ctx.user.branch_code,saving])

  const toggleCheck = (no) => {
    setChecks(p => {
      const cur = p[no]
      // cycle: null → true(✓) → false(✗) → null
      const next = cur === null ? true : cur === true ? false : null
      return {...p,[no]:next}
    })
  }

  const handleSubmit = async () => {
    if (!shift) return alert("Pilih shift terlebih dahulu")
    const hasUnchecked = Object.values(checks).some(v => v === null)
    if (hasUnchecked && !confirm("Masih ada item yang belum dicek. Lanjutkan submit?")) return

    setSaving(true)
    const itemsArr = currentTab.items.map(it => ({no:it.no,item:it.item,checked:checks[it.no]}))
    const {error} = await supabase.from("mo_checklists").insert({
      branch_code: ctx.user.branch_code,
      checklist_date: checkDate,
      shift,
      checklist_type: activeTab,
      items: itemsArr,
      incoming_mo: ctx.user.display_name,
      outgoing_mo: "",
      notes,
      created_by: ctx.user.id,
    })
    if (error) { alert("Gagal menyimpan: "+error.message); setSaving(false); return }
    logAudit("MO_CHECKLIST","Submit "+activeTab+" checklist — shift "+shift,ctx.user)
    setChecks(initChecks()); setNotes(""); setShift(""); setShowForm(false); setSaving(false)
  }

  const checkIcon = (val) => {
    if (val === true) return <span style={{color:"#10b981",fontSize:18,fontWeight:900}}>✓</span>
    if (val === false) return <span style={{color:"#ef4444",fontSize:18,fontWeight:900}}>✗</span>
    return <span style={{color:"var(--fg-muted)",fontSize:14}}>—</span>
  }

  return (
    <div className="page-content">
      <Header title="HO/TO Manager Operasi" sub={"Checklist PRKP — "+ctx.user.branch_code}/>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {MO_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:"10px 18px",borderRadius:8,border:"1px solid "+(activeTab===t.id?"#2563eb":"var(--border)"),
            background:activeTab===t.id?"rgba(37,99,235,0.12)":"transparent",
            color:activeTab===t.id?"#60a5fa":"var(--fg-muted)",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .2s",
            display:"flex",alignItems:"center",gap:6
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* Action */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:8}}>
          <I n="checklist" s={18}/> {currentTab.label}
        </h2>
        {!showForm && <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}><I n="plus" s={14}/> Buat Checklist</button>}
      </div>

      {/* Form */}
      {showForm && <div className="panel" style={{animation:"fadeIn .3s ease",marginBottom:24}}>
        <div className="panel-header"><h2 className="panel-title">{currentTab.icon} {currentTab.label}</h2></div>
        <div className="panel-body">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:20}}>
            <div className="field"><label>Tanggal</label><input type="date" value={checkDate} onChange={e => setCheckDate(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}/></div>
            <div className="field"><label>Shift</label><select value={shift} onChange={e => setShift(e.target.value)} style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}>
              <option value="">Pilih...</option><option value="Pagi">Pagi</option><option value="Siang">Siang</option><option value="Malam">Malam</option>
            </select></div>
            <div className="field"><label>Manager Operasi</label><input value={ctx.user.display_name} disabled style={{width:"100%",padding:"8px 10px",borderRadius:6,border:"1px solid var(--border)",background:"rgba(56,189,248,0.06)",color:"#38bdf8",fontSize:13,fontWeight:600,cursor:"not-allowed"}}/></div>
          </div>

          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"rgba(37,99,235,0.08)"}}>
                  <th style={{padding:"10px 8px",fontSize:11,fontWeight:700,color:"var(--fg-muted)",textAlign:"center",width:40,borderBottom:"2px solid var(--border)"}}>NO</th>
                  <th style={{padding:"10px 12px",fontSize:11,fontWeight:700,color:"var(--fg-muted)",textAlign:"left",width:180,borderBottom:"2px solid var(--border)"}}>ITEM</th>
                  <th style={{padding:"10px 12px",fontSize:11,fontWeight:700,color:"var(--fg-muted)",textAlign:"left",borderBottom:"2px solid var(--border)"}}>STANDAR MINIMUM</th>
                  <th style={{padding:"10px 8px",fontSize:11,fontWeight:700,color:"var(--fg-muted)",textAlign:"center",width:60,borderBottom:"2px solid var(--border)"}}>CEK</th>
                </tr>
              </thead>
              <tbody>
                {currentTab.items.map(it => (
                  <tr key={it.no} style={{borderBottom:"1px solid var(--border)",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <td style={{padding:"12px 8px",textAlign:"center",fontSize:13,fontWeight:700,color:"var(--fg-muted)"}}>{it.no}</td>
                    <td style={{padding:"12px",fontSize:13,fontWeight:600,color:"var(--fg)"}}>{it.item}</td>
                    <td style={{padding:"12px",fontSize:12,color:"var(--fg-muted)",lineHeight:1.5}}>{it.std}</td>
                    <td style={{padding:"12px 8px",textAlign:"center"}}>
                      <button type="button" onClick={() => toggleCheck(it.no)} style={{
                        width:36,height:36,borderRadius:8,border:"1.5px solid "+(checks[it.no]===true?"#10b981":checks[it.no]===false?"#ef4444":"var(--border)"),
                        background:checks[it.no]===true?"rgba(16,185,129,0.1)":checks[it.no]===false?"rgba(239,68,68,0.1)":"transparent",
                        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",
                      }}>{checkIcon(checks[it.no])}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{marginTop:16}}>
            <div className="field"><label>Catatan Tambahan</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Catatan opsional..." rows={3} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13,resize:"vertical"}}/>
            </div>
          </div>

          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)"}}>
            <button className="btn btn-ghost" onClick={() => {setShowForm(false);setChecks(initChecks());setNotes("")}}>Batal</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>{saving?"Menyimpan...":"Submit Checklist"}</button>
          </div>
        </div>
      </div>}

      {/* History */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="clock" s={16}/> Riwayat {currentTab.label}</h2></div>
        <div className="panel-body">
          {history.length === 0 ? <p style={{color:"var(--fg-muted)",fontSize:13,textAlign:"center",padding:20}}>Belum ada riwayat</p>
          : <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {history.map(h => {
              const items = h.items || []
              const checked = items.filter(i => i.checked === true).length
              const unchecked = items.filter(i => i.checked === false).length
              const total = items.length
              return (
                <div key={h.id} style={{padding:16,borderRadius:10,border:"1px solid var(--border)",background:"rgba(255,255,255,0.01)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{display:"flex",gap:12,alignItems:"center"}}>
                      <span style={{fontSize:13,fontWeight:700,color:"var(--fg)"}}>{new Date(h.checklist_date).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</span>
                      <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:"rgba(37,99,235,0.12)",color:"#60a5fa"}}>{h.shift}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#10b981",fontWeight:700}}>✓ {checked}</span>
                      {unchecked > 0 && <span style={{fontSize:11,color:"#ef4444",fontWeight:700}}>✗ {unchecked}</span>}
                      <span style={{fontSize:11,color:"var(--fg-muted)"}}>/ {total}</span>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"var(--fg-muted)"}}>
                    <span>MO: <strong style={{color:"var(--fg)"}}>{h.incoming_mo}</strong></span>
                    <span style={{marginLeft:12,fontSize:11,color:"var(--fg-muted)"}}>{new Date(h.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                  {h.notes && <div style={{marginTop:8,fontSize:12,color:"var(--fg-muted)",fontStyle:"italic"}}>📝 {h.notes}</div>}
                  <details style={{marginTop:10}}>
                    <summary style={{fontSize:11,color:"#38bdf8",cursor:"pointer",fontWeight:600}}>Lihat Detail ({total} item)</summary>
                    <div style={{marginTop:8,display:"flex",flexDirection:"column",gap:4}}>
                      {items.map(it => (
                        <div key={it.no} style={{display:"flex",gap:8,alignItems:"center",padding:"4px 0",fontSize:12}}>
                          {it.checked===true?<span style={{color:"#10b981",fontWeight:900}}>✓</span>:it.checked===false?<span style={{color:"#ef4444",fontWeight:900}}>✗</span>:<span style={{color:"var(--fg-muted)"}}>—</span>}
                          <span style={{color:"var(--fg)"}}>{it.item}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )
            })}
          </div>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ADMIN: DASHBOARD
// ============================================================
const AdminDash = () => {
  const ctx = useApp()
  const allActive = ctx.logs.filter(l => !l.off_time)
  const todayLogs = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const todayTC = ctx.logs.filter(l => l.off_time && new Date(l.on_time).toDateString() === new Date().toDateString()).reduce((a,l) => a+(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0), 0)

  // Per-branch and per-unit active counts
  const brAct = {}
  const brUnitAct = {} // { "WADD": { "TWR": 2, "APP": 1 } }
  allActive.forEach(l => {
    brAct[l.branch_code] = (brAct[l.branch_code]||0)+1
    if(!brUnitAct[l.branch_code]) brUnitAct[l.branch_code] = {}
    brUnitAct[l.branch_code][l.unit] = (brUnitAct[l.branch_code][l.unit]||0)+1
  })

  const handleBranchClick = (code) => {
    ctx.setNavBranch(code)
    ctx.goPage("mon_log")
  }

  return (
    <div className="page-content">
      <Header title="Dashboard Admin Pusat" sub="Monitoring seluruh cabang"/>
      <div className="stats-grid">
        <Stat icon="radar" label="Total Cabang" value={ctx.branches.length} sub="Seluruh Indonesia" color="#38bdf8"/>
        <Stat icon="mic" label="On Mic" value={allActive.length} sub="Seluruh cabang" color="#10b981"/>
        <Stat icon="log" label="Log Hari Ini" value={todayLogs.length} sub={"Shift "+getShift()} color="#8b5cf6"/>
        <Stat icon="plane" label="Traffic" value={todayTC} sub="Hari ini" color="#f59e0b"/>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><Pulse s={10}/> Semua Cabang</h2><span className="panel-badge">LIVE</span></div>
        <div className="panel-body"><div className="branch-grid">{ctx.branches.map(b => {
          const c = brAct[b.code]||0
          const unitAct = brUnitAct[b.code] || {}
          const isActive = c > 0
          return (
            <div
              key={b.code}
              className={"branch-card"+(isActive?" branch-card-active":"")}
              onClick={() => handleBranchClick(b.code)}
              style={{
                cursor:"pointer",
                transition:"all .2s ease",
                opacity: isActive ? 1 : 0.55,
                border: isActive ? "1.5px solid #10b981" : "1px solid var(--border)",
                boxShadow: isActive ? "0 0 16px rgba(16,185,129,0.15), 0 0 4px rgba(16,185,129,0.1)" : "none",
              }}
              onMouseDown={e => { e.currentTarget.style.transform = "scale(0.96)"; e.currentTarget.style.boxShadow = isActive ? "0 0 8px rgba(16,185,129,0.3)" : "0 0 8px rgba(100,116,139,0.15)" }}
              onMouseUp={e => { e.currentTarget.style.transform = "scale(1)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)" }}
            >
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div className="branch-code">{b.code}</div>
                <Pulse on={isActive} s={isActive ? 9 : 6}/>
              </div>
              <div className="branch-name">{b.name}</div>
              <div className="branch-city">{b.city}</div>
              <div className="branch-units" style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>
                {b.units.map(u => {
                  const unitOn = (unitAct[u]||0) > 0
                  return (
                    <span key={u} style={{
                      display:"inline-flex",alignItems:"center",gap:4,
                      padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:700,
                      letterSpacing:".3px",
                      background: unitOn ? "rgba(16,185,129,0.15)" : "rgba(100,116,139,0.08)",
                      color: unitOn ? "#059669" : "#94a3b8",
                      border: unitOn ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                      boxShadow: unitOn ? "0 0 6px rgba(16,185,129,0.2)" : "none",
                      transition:"all .3s ease",
                    }}>
                      <span style={{
                        width:5,height:5,borderRadius:"50%",
                        background: unitOn ? "#10b981" : "#cbd5e1",
                        boxShadow: unitOn ? "0 0 4px #10b981" : "none",
                      }}/>
                      {u}
                      {unitOn && <span style={{fontSize:9,fontWeight:400}}>({unitAct[u]})</span>}
                    </span>
                  )
                })}
              </div>
              <div className="branch-status" style={{
                marginTop:6,fontSize:11,
                color: isActive ? "#059669" : "#94a3b8",
                fontWeight: isActive ? 700 : 400,
              }}>
                <I n="mic" s={11}/> {c > 0 ? c+" on mic" : "Idle"}
              </div>
            </div>
          )
        })}</div></div>
      </div>
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING LOG
// ============================================================
const AdminMonLog = () => {
  const ctx = useApp()
  const [br,setBr] = useState(ctx.navBranch || "ALL")
  
  // Clear navBranch after consuming it
  useEffect(() => {
    if (ctx.navBranch) {
      setBr(ctx.navBranch)
      ctx.setNavBranch(null)
    }
  }, [ctx.navBranch])

  const allActive = ctx.logs.filter(l => !l.off_time)
  const fa = br==="ALL" ? allActive : allActive.filter(l => l.branch_code===br)
  const todayAll = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const ft = br==="ALL" ? todayAll : todayAll.filter(l => l.branch_code===br)

  return (
    <div className="page-content">
      <Header title="Monitoring Log Position" sub="Real-time seluruh cabang"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
      </div>
      <div className="stats-grid">
        <Stat icon="mic" label="On Mic" value={fa.length} sub={br==="ALL"?"Seluruh cabang":br} color="#10b981"/>
        <Stat icon="log" label="Log Hari Ini" value={ft.length} color="#38bdf8"/>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><Pulse s={10}/> ATC On Mic</h2><span className="panel-badge">LIVE</span></div>
        <div className="panel-body">{fa.length===0 ? <div className="empty-state"><I n="micOff" s={44}/><p>Tidak ada ATC on mic</p></div> :
          <div className="position-grid">{fa.map(l => {
            const b = ctx.branches.find(a => a.code===l.branch_code)
            return (
              <div key={l.id} className="position-card">
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Pulse s={7}/><span className="position-unit">{l.branch_code}</span><span className="position-sector">{b?.city}</span></div>
                <div className="position-cwp">{l.unit} — {l.sector} — {l.cwp}</div>
                <div className="position-name">{l.atc_name}</div>
                <div className="position-time">On: {fmtT(l.on_time)} ({durMin(l.on_time,new Date().toISOString())}m)</div>
              </div>
            )
          })}</div>}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Log Hari Ini</h2><span className="panel-counter">{ft.length}</span></div>
        <div className="panel-body">{ft.length===0 ? <div className="empty-state"><p>Belum ada log</p></div> :
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Cabang</th><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>On</th><th>Off</th><th>Status</th></tr></thead>
          <tbody>{ft.map(l => <tr key={l.id}><td><span className="unit-tag">{l.branch_code}</span></td><td><strong>{l.atc_name}</strong></td><td>{l.unit}</td><td>{l.sector}</td><td>{l.cwp}</td><td>{fmtT(l.on_time)}</td><td>{l.off_time?fmtT(l.off_time):"-"}</td><td>{l.off_time?<span className="status-badge status-off">Off</span>:<span className="status-badge status-on"><Pulse s={6}/> On</span>}</td></tr>)}</tbody></table></div>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING REKAP TRAFFIC (detailed per cabang)
// ============================================================
const AdminMonRecap = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [period,setPeriod] = useState("today")
  const [expandBr,setExpandBr] = useState(null) // drill-down into a branch

  // Helper: calc traffic total for a log
  const tc = l => (l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)

  // All traffic logs (off-mic with traffic data)
  const allTraffic = ctx.logs.filter(l => {
    if(!l.off_time || tc(l)===0) return false
    const d = (new Date()-new Date(l.on_time))/864e5
    return period==="today" ? new Date(l.on_time).toDateString()===new Date().toDateString() : period==="week" ? d<=7 : d<=30
  })

  // Filtered by branch
  const filtered = br==="ALL" ? allTraffic : allTraffic.filter(l => l.branch_code===br)

  // Global totals
  const totDep = filtered.reduce((a,l) => a+(l.departure_count||0),0)
  const totArr = filtered.reduce((a,l) => a+(l.arrival_count||0),0)
  const totOvf = filtered.reduce((a,l) => a+(l.overfly_count||0),0)
  const totAll = totDep+totArr+totOvf

  // Per-branch breakdown
  const byBr = {}
  allTraffic.forEach(l => {
    if(!byBr[l.branch_code]) byBr[l.branch_code] = {dep:0,arr:0,ovf:0,tc:0,n:0,logs:[]}
    byBr[l.branch_code].dep += l.departure_count||0
    byBr[l.branch_code].arr += l.arrival_count||0
    byBr[l.branch_code].ovf += l.overfly_count||0
    byBr[l.branch_code].tc += tc(l)
    byBr[l.branch_code].n++
    byBr[l.branch_code].logs.push(l)
  })
  const brKeys = Object.keys(byBr).sort((a,b) => byBr[b].tc - byBr[a].tc)
  const brMax = Math.max(1,...brKeys.map(k => byBr[k].tc))

  // Per-sector breakdown (for selected branch or all)
  const bySector = {}
  filtered.forEach(l => {
    const sk = (br==="ALL" ? l.branch_code+" › " : "") + l.unit+" — "+l.sector
    if(!bySector[sk]) bySector[sk] = {dep:0,arr:0,ovf:0}
    bySector[sk].dep += l.departure_count||0
    bySector[sk].arr += l.arrival_count||0
    bySector[sk].ovf += l.overfly_count||0
  })
  const secKeys = Object.keys(bySector).sort((a,b) => {
    const ta = bySector[a].dep+bySector[a].arr+bySector[a].ovf
    const tb = bySector[b].dep+bySector[b].arr+bySector[b].ovf
    return tb-ta
  })
  const secMax = Math.max(1,...secKeys.map(k => bySector[k].dep+bySector[k].arr+bySector[k].ovf))

  // Daily trend (for selected or all)
  const byDate = {}
  filtered.forEach(l => {
    const dt = new Date(l.on_time).toISOString().slice(0,10)
    if(!byDate[dt]) byDate[dt] = {dep:0,arr:0,ovf:0}
    byDate[dt].dep += l.departure_count||0
    byDate[dt].arr += l.arrival_count||0
    byDate[dt].ovf += l.overfly_count||0
  })
  const dates = Object.keys(byDate).sort()
  const chartMax = Math.max(1,...dates.map(d => byDate[d].dep+byDate[d].arr+byDate[d].ovf))

  // Export CSV
  const exportCSV = () => {
    const head = ["Cabang","Tanggal","On","Off","Controller","Unit","Sektor","Shift","DEP","ARR","OVF","Total"]
    const rows = filtered.sort((a,b) => new Date(b.on_time)-new Date(a.on_time)).map(l => {
      const dt=new Date(l.on_time).toISOString().slice(0,10)
      return [l.branch_code,dt,fmtT(l.on_time),fmtT(l.off_time),l.atc_name||"",l.unit||"",l.sector||"",l.shift||"",l.departure_count||0,l.arrival_count||0,l.overfly_count||0,tc(l)]
    })
    const csv = [head.join(","),...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"})
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `monitoring_traffic_${br}_${period}_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  // Drill-down: detail for expanded branch
  const renderBranchDetail = (code) => {
    const d = byBr[code]
    if(!d) return null
    const b = ctx.branches.find(x => x.code===code)
    // Sector breakdown for this branch
    const brSec = {}
    d.logs.forEach(l => {
      const sk = l.unit+" — "+l.sector
      if(!brSec[sk]) brSec[sk] = {dep:0,arr:0,ovf:0,controllers:new Set()}
      brSec[sk].dep += l.departure_count||0
      brSec[sk].arr += l.arrival_count||0
      brSec[sk].ovf += l.overfly_count||0
      brSec[sk].controllers.add(l.atc_name)
    })
    const bsKeys = Object.keys(brSec).sort((a,b) => (brSec[b].dep+brSec[b].arr+brSec[b].ovf)-(brSec[a].dep+brSec[a].arr+brSec[a].ovf))
    const bsMax = Math.max(1,...bsKeys.map(k => brSec[k].dep+brSec[k].arr+brSec[k].ovf))

    return (
      <div style={{padding:"12px 0 4px",borderTop:"1px solid var(--border)",animation:"fadeIn .2s ease"}}>
        <div style={{display:"flex",gap:16,fontSize:12,color:"var(--fg-muted)",marginBottom:12,flexWrap:"wrap"}}>
          <span><strong>Bandara:</strong> {b?.name||code}</span>
          <span><strong>Kota:</strong> {b?.city||"-"}</span>
          <span><strong>Unit:</strong> {b?.units?.join(", ")||"-"}</span>
          <span><strong>Laporan:</strong> {d.n} controller off-mic</span>
        </div>

        {/* DEP/ARR/OVF summary cards */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          {[["DEP",d.dep,"#0284C7","#E0F2FE"],["ARR",d.arr,"#CA8A04","#FEF9C3"],["OVF",d.ovf,"#64748B","#F1F5F9"]].map(([lbl,val,clr,bg]) => (
            <div key={lbl} style={{background:bg,borderRadius:8,padding:"10px 8px",textAlign:"center",border:`1px solid ${clr}22`}}>
              <div style={{fontSize:22,fontWeight:800,color:clr,lineHeight:1}}>{val}</div>
              <div style={{fontSize:10,fontWeight:700,color:clr,marginTop:4}}>{lbl}</div>
            </div>
          ))}
        </div>

        {/* Per-sector bar chart */}
        {bsKeys.length>0 && <>
          <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Traffic Per Sektor</div>
          <div className="simple-chart" style={{marginBottom:16}}>{bsKeys.map(sk => {
            const t = brSec[sk].dep+brSec[sk].arr+brSec[sk].ovf
            return (
              <div key={sk} className="chart-bar-row">
                <span className="chart-label" style={{minWidth:120}}>{sk}</span>
                <div className="chart-bar-track">
                  <div style={{display:"flex",height:"100%",borderRadius:4,overflow:"hidden",width:(t/bsMax*100)+"%"}}>
                    {brSec[sk].dep>0 && <div style={{width:(brSec[sk].dep/t*100)+"%",background:"#0284C7",height:"100%"}}/>}
                    {brSec[sk].arr>0 && <div style={{width:(brSec[sk].arr/t*100)+"%",background:"#CA8A04",height:"100%"}}/>}
                    {brSec[sk].ovf>0 && <div style={{width:(brSec[sk].ovf/t*100)+"%",background:"#64748B",height:"100%"}}/>}
                  </div>
                  <span className="chart-bar-value">{t}</span>
                </div>
              </div>
            )
          })}</div>
          <div style={{display:"flex",gap:12,marginBottom:12,fontSize:10,color:"var(--fg-muted)"}}>
            {[["DEP","#0284C7"],["ARR","#CA8A04"],["OVF","#64748B"]].map(([l,c]) => <div key={l} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,borderRadius:2,background:c}}/>{l}</div>)}
          </div>
        </>}

        {/* Detail log table */}
        <div style={{fontSize:12,fontWeight:700,color:"var(--fg)",marginBottom:8}}>Log Detail</div>
        <div className="table-wrap"><table className="data-table" style={{fontSize:12}}><thead><tr>
          <th>Tanggal</th><th>On–Off</th><th>Controller</th><th>Unit</th><th>Sektor</th><th>Shift</th>
          <th style={{textAlign:"center",color:"#0284C7"}}>DEP</th>
          <th style={{textAlign:"center",color:"#CA8A04"}}>ARR</th>
          <th style={{textAlign:"center",color:"#64748B"}}>OVF</th>
          <th style={{textAlign:"center"}}>Total</th>
        </tr></thead>
        <tbody>{d.logs.sort((a,b) => new Date(b.on_time)-new Date(a.on_time)).map(l => (
          <tr key={l.id}>
            <td style={{whiteSpace:"nowrap"}}>{fmtD(l.on_time)}</td>
            <td style={{whiteSpace:"nowrap",color:"var(--fg-muted)"}}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
            <td><strong>{l.atc_name}</strong></td>
            <td><span className="unit-tag">{l.unit}</span></td>
            <td>{l.sector}</td>
            <td>{l.shift}</td>
            <td style={{textAlign:"center",color:"#0284C7",fontWeight:700}}>{l.departure_count||0}</td>
            <td style={{textAlign:"center",color:"#CA8A04",fontWeight:700}}>{l.arrival_count||0}</td>
            <td style={{textAlign:"center",color:"#64748B",fontWeight:700}}>{l.overfly_count||0}</td>
            <td style={{textAlign:"center",fontWeight:800}}>{tc(l)}</td>
          </tr>
        ))}</tbody>
        <tfoot><tr style={{fontWeight:700}}>
          <td colSpan={6} style={{textAlign:"right",color:"var(--fg-muted)"}}>TOTAL</td>
          <td style={{textAlign:"center",color:"#0284C7"}}>{d.dep}</td>
          <td style={{textAlign:"center",color:"#CA8A04"}}>{d.arr}</td>
          <td style={{textAlign:"center",color:"#64748B"}}>{d.ovf}</td>
          <td style={{textAlign:"center"}}>{d.tc}</td>
        </tr></tfoot>
        </table></div>
      </div>
    )
  }

  return (
    <div className="page-content">
      <Header title="Monitoring Rekap Traffic" sub="Detail traffic seluruh cabang"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => {setBr(e.target.value);setExpandBr(null)}}><option value="ALL">Semua Cabang</option>{ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}</select>
        <div className="filter-bar" style={{margin:0}}>{[["today","Hari Ini"],["week","Minggu"],["month","Bulan"]].map(([k,v]) => <button key={k} className={"filter-btn"+(period===k?" filter-btn-active":"")} onClick={() => setPeriod(k)}>{v}</button>)}</div>
      </div>

      {/* Global Stats */}
      <div className="stats-grid">
        <Stat icon="plane" label="Total Traffic" value={totAll} color="#10b981"/>
        <Stat icon="upload" label="Departure" value={totDep} color="#0284C7"/>
        <Stat icon="download" label="Arrival" value={totArr} color="#CA8A04"/>
        <Stat icon="radar" label="Overfly" value={totOvf} color="#64748B"/>
      </div>

      {/* Traffic per Cabang — expandable cards */}
      {br==="ALL" && brKeys.length>0 && <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="building" s={16}/> Traffic Per Cabang</h2><span className="panel-counter">{brKeys.length} cabang</span></div>
        <div className="panel-body">
          {brKeys.map(code => {
            const d = byBr[code], b = ctx.branches.find(x => x.code===code)
            const isExp = expandBr===code
            return (
              <div key={code} className={"handover-card handover-normal"} style={{cursor:"pointer",marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0"}} onClick={() => setExpandBr(isExp?null:code)}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                    <span style={{fontSize:14}}>{isExp?"▾":"▸"}</span>
                    <span className="unit-tag" style={{fontWeight:700}}>{code}</span>
                    <span style={{fontSize:13,color:"var(--fg)"}}>{b?.city||""}</span>
                    <span style={{fontSize:12,color:"var(--fg-muted)"}}>{d.n} laporan</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:12,fontSize:12,fontWeight:700}}>
                    <span style={{color:"#0284C7"}}>{d.dep} <span style={{fontWeight:400,fontSize:10}}>DEP</span></span>
                    <span style={{color:"#CA8A04"}}>{d.arr} <span style={{fontWeight:400,fontSize:10}}>ARR</span></span>
                    <span style={{color:"#64748B"}}>{d.ovf} <span style={{fontWeight:400,fontSize:10}}>OVF</span></span>
                    <span style={{color:"var(--fg)",fontSize:14,marginLeft:4}}>{d.tc}</span>
                  </div>
                </div>
                {/* Bar */}
                <div style={{height:4,borderRadius:2,overflow:"hidden",display:"flex",gap:1,marginBottom:isExp?0:0}}>
                  {d.dep>0 && <div style={{width:(d.dep/d.tc*100)+"%",background:"#0284C7",borderRadius:2}}/>}
                  {d.arr>0 && <div style={{width:(d.arr/d.tc*100)+"%",background:"#CA8A04",borderRadius:2}}/>}
                  {d.ovf>0 && <div style={{width:(d.ovf/d.tc*100)+"%",background:"#64748B",borderRadius:2}}/>}
                </div>
                {isExp && renderBranchDetail(code)}
              </div>
            )
          })}
        </div>
      </div>}

      {/* When specific branch is selected — show full detail directly */}
      {br!=="ALL" && <>
        {/* Sector breakdown */}
        {secKeys.length>0 && <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Traffic Per Sektor</h2></div>
          <div className="panel-body">
            <div className="simple-chart">{secKeys.map(sk => {
              const t = bySector[sk].dep+bySector[sk].arr+bySector[sk].ovf
              return (
                <div key={sk} className="chart-bar-row">
                  <span className="chart-label" style={{minWidth:120}}>{sk}</span>
                  <div className="chart-bar-track">
                    <div style={{display:"flex",height:"100%",borderRadius:4,overflow:"hidden",width:(t/secMax*100)+"%"}}>
                      {bySector[sk].dep>0 && <div style={{width:(bySector[sk].dep/t*100)+"%",background:"#0284C7",height:"100%"}}/>}
                      {bySector[sk].arr>0 && <div style={{width:(bySector[sk].arr/t*100)+"%",background:"#CA8A04",height:"100%"}}/>}
                      {bySector[sk].ovf>0 && <div style={{width:(bySector[sk].ovf/t*100)+"%",background:"#64748B",height:"100%"}}/>}
                    </div>
                    <span className="chart-bar-value">{t}</span>
                  </div>
                </div>
              )
            })}</div>
            <div style={{display:"flex",gap:12,marginTop:8,fontSize:10,color:"var(--fg-muted)"}}>
              {[["DEP","#0284C7"],["ARR","#CA8A04"],["OVF","#64748B"]].map(([l,c]) => <div key={l} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:8,height:8,borderRadius:2,background:c}}/>{l}</div>)}
            </div>
          </div>
        </div>}

        {/* Daily trend chart */}
        {dates.length>1 && <div className="panel">
          <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Trend Harian</h2></div>
          <div className="panel-body">
            <svg viewBox="0 0 680 200" width="100%" style={{display:"block"}}>
              {[0,.25,.5,.75,1].map(f => {const y=16+(1-f)*150;return <line key={f} x1="46" y1={y} x2="664" y2={y} stroke="var(--border)" strokeWidth=".5"/>})}
              {(() => {
                const pts=dates.map((d,i) => ({x:46+(dates.length===1?309:(i/(dates.length-1))*618),y:16+(1-(byDate[d].dep+byDate[d].arr+byDate[d].ovf)/chartMax)*150,v:byDate[d].dep+byDate[d].arr+byDate[d].ovf,d}))
                const pathD=pts.map((p,i) => `${i===0?"M":"L"}${p.x},${p.y}`).join(" ")
                return <>
                  <path d={`${pathD} L${pts[pts.length-1].x},166 L${pts[0].x},166 Z`} fill="#0284C7" opacity=".1"/>
                  <path d={pathD} fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  {pts.map((p,i) => <g key={i}><circle cx={p.x} cy={p.y} r="4" fill="var(--card)" stroke="#0284C7" strokeWidth="2"/><text x={p.x} y={p.y-10} textAnchor="middle" fontSize="10" fontWeight="600" fill="#0284C7">{p.v}</text><text x={p.x} y={185} textAnchor="middle" fontSize="9" fill="var(--fg-muted)">{p.d.slice(5)}</text></g>)}
                </>
              })()}
            </svg>
          </div>
        </div>}

        {/* Full data table */}
        <div className="panel">
          <div className="panel-header"><h2 className="panel-title">Log Detail</h2><span className="panel-counter">{filtered.length}</span></div>
          <div className="panel-body">
            {filtered.length===0 ? <div className="empty-state"><p>Tidak ada data</p></div> :
            <div className="table-wrap"><table className="data-table" style={{fontSize:12}}><thead><tr>
              <th>Tanggal</th><th>On–Off</th><th>Controller</th><th>Unit</th><th>Sektor</th><th>Shift</th>
              <th style={{textAlign:"center",color:"#0284C7"}}>DEP</th>
              <th style={{textAlign:"center",color:"#CA8A04"}}>ARR</th>
              <th style={{textAlign:"center",color:"#64748B"}}>OVF</th>
              <th style={{textAlign:"center"}}>Total</th>
            </tr></thead>
            <tbody>{filtered.sort((a,b) => new Date(b.on_time)-new Date(a.on_time)).map(l => (
              <tr key={l.id}>
                <td style={{whiteSpace:"nowrap"}}>{fmtD(l.on_time)}</td>
                <td style={{whiteSpace:"nowrap",color:"var(--fg-muted)"}}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
                <td><strong>{l.atc_name}</strong></td>
                <td><span className="unit-tag">{l.unit}</span></td>
                <td>{l.sector}</td>
                <td>{l.shift}</td>
                <td style={{textAlign:"center",color:"#0284C7",fontWeight:700}}>{l.departure_count||0}</td>
                <td style={{textAlign:"center",color:"#CA8A04",fontWeight:700}}>{l.arrival_count||0}</td>
                <td style={{textAlign:"center",color:"#64748B",fontWeight:700}}>{l.overfly_count||0}</td>
                <td style={{textAlign:"center",fontWeight:800}}>{tc(l)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr style={{fontWeight:700}}>
              <td colSpan={6} style={{textAlign:"right",color:"var(--fg-muted)"}}>TOTAL</td>
              <td style={{textAlign:"center",color:"#0284C7"}}>{totDep}</td>
              <td style={{textAlign:"center",color:"#CA8A04"}}>{totArr}</td>
              <td style={{textAlign:"center",color:"#64748B"}}>{totOvf}</td>
              <td style={{textAlign:"center"}}>{totAll}</td>
            </tr></tfoot>
            </table></div>}
          </div>
        </div>
      </>}

      {/* Export */}
      {filtered.length>0 && <button className="btn btn-primary" onClick={exportCSV} style={{marginTop:4}}><I n="download" s={16}/> Export CSV</button>}
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING REKAP PERSONEL
// ============================================================
const AdminMonPersonnel = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [period,setPeriod] = useState("month")
  const [search,setSearch] = useState("")
  const [expandedName,setExpandedName] = useState(null)
  const [sortBy,setSortBy] = useState("hours")

  const allDone = ctx.logs.filter(l => {
    if(!l.off_time) return false
    const brOk = br==="ALL" || l.branch_code===br
    const d = (new Date()-new Date(l.on_time))/864e5
    const pOk = period==="today" ? new Date(l.on_time).toDateString()===new Date().toDateString() : period==="week" ? d<=7 : d<=30
    return brOk && pOk
  })

  const filteredPersonnel = br==="ALL" ? ctx.personnel : ctx.personnel.filter(p => p.branch_code===br)

  // Build per-person stats
  const byPerson = {}
  allDone.forEach(l => {
    const k = l.atc_name+"||"+l.branch_code
    if(!byPerson[k]) byPerson[k] = {name:l.atc_name,branch:l.branch_code,count:0,totalMin:0,dep:0,arr:0,ovf:0,shifts:{Morning:0,Afternoon:0,Night:0},sectors:new Set(),logs:[]}
    const p = byPerson[k]
    p.count++; p.totalMin += durMin(l.on_time,l.off_time)
    p.dep += l.departure_count||0; p.arr += l.arrival_count||0; p.ovf += l.overfly_count||0
    if(l.shift) p.shifts[l.shift] = (p.shifts[l.shift]||0)+1
    if(l.sector) p.sectors.add(l.sector)
    p.logs.push(l)
  })

  // Include personnel with 0 activity
  filteredPersonnel.forEach(p => {
    const k = p.name+"||"+p.branch_code
    if(!byPerson[k]) byPerson[k] = {name:p.name,branch:p.branch_code,count:0,totalMin:0,dep:0,arr:0,ovf:0,shifts:{Morning:0,Afternoon:0,Night:0},sectors:new Set(),logs:[]}
  })

  let personList = Object.values(byPerson)
  if(search) personList = personList.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
  personList.sort((a,b) => sortBy==="hours"?b.totalMin-a.totalMin:sortBy==="count"?b.count-a.count:(b.dep+b.arr+b.ovf)-(a.dep+a.arr+a.ovf))

  const activeCount = Object.values(byPerson).filter(p=>p.count>0).length
  const totalHours = Math.round(Object.values(byPerson).reduce((a,p)=>a+p.totalMin,0)/60*10)/10
  const totalTraffic = Object.values(byPerson).reduce((a,p)=>a+p.dep+p.arr+p.ovf,0)
  const topMax = personList.length>0 && personList[0].totalMin>0 ? personList[0].totalMin : 1

  // Per-branch summary
  const byBranch = {}
  Object.values(byPerson).filter(p=>p.count>0).forEach(p => {
    if(!byBranch[p.branch]) byBranch[p.branch] = {personnel:0,hours:0,traffic:0}
    byBranch[p.branch].personnel++
    byBranch[p.branch].hours += p.totalMin
    byBranch[p.branch].traffic += p.dep+p.arr+p.ovf
  })
  const brKeys = Object.keys(byBranch).sort((a,b) => byBranch[b].hours-byBranch[a].hours)
  const brMax = brKeys.length>0 ? byBranch[brKeys[0]].hours : 1

  const getBrName = (code) => { const b=ctx.branches.find(x=>x.code===code); return b?code+" — "+b.city:code }

  return (
    <div className="page-content">
      <Header title="Monitoring Rekap Personel" sub="Statistik personel seluruh cabang"/>

      {/* Filters */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
        <div className="filter-bar" style={{margin:0}}>{[["today","Hari Ini"],["week","7 Hari"],["month","30 Hari"]].map(([k,v]) => <button key={k} className={"filter-btn"+(period===k?" filter-btn-active":"")} onClick={() => setPeriod(k)}>{v}</button>)}</div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama..." style={{flex:1,minWidth:120,padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}/>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}>
          <option value="hours">Jam Kerja</option>
          <option value="count">Frekuensi</option>
          <option value="traffic">Traffic</option>
        </select>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Stat icon="users" label="Personel" value={filteredPersonnel.length} sub={activeCount+" aktif"} color="#8b5cf6"/>
        <Stat icon="clock" label="Total Jam" value={totalHours+" jam"} color="#2563eb"/>
        <Stat icon="mic" label="Total On Mic" value={allDone.length} color="#10b981"/>
        <Stat icon="plane" label="Total Traffic" value={totalTraffic} color="#f59e0b"/>
      </div>

      {/* Per-Branch Summary (only when ALL) */}
      {br==="ALL" && brKeys.length>0 && <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="building" s={16}/> Jam Kerja Per Cabang</h2><span className="panel-counter">{brKeys.length} cabang</span></div>
        <div className="panel-body"><div className="simple-chart">{brKeys.map(code => {
          const d = byBranch[code], hrs = Math.round(d.hours/60*10)/10
          return <div key={code} className="chart-bar-row">
            <span className="chart-label" style={{minWidth:130,fontSize:11}}>{getBrName(code)}</span>
            <div className="chart-bar-track">
              <div className="chart-bar-fill" style={{width:(d.hours/brMax*100)+"%"}}>
                <span className="chart-bar-value">{hrs}h • {d.personnel} org • {d.traffic} traffic</span>
              </div>
            </div>
          </div>
        })}</div></div>
      </div>}

      {/* Top 10 */}
      {personList.filter(p=>p.count>0).length>0 && <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="chart" s={16}/> Top 10 Personel</h2></div>
        <div className="panel-body"><div className="simple-chart">{personList.filter(p=>p.count>0).slice(0,10).map(p => {
          const hrs = Math.round(p.totalMin/60*10)/10
          return <div key={p.name+p.branch} className="chart-bar-row">
            <span className="chart-label" style={{minWidth:140,fontSize:11}}>{p.name}{br==="ALL"?<span style={{color:"var(--fg-muted)",fontSize:9,marginLeft:4}}>({p.branch})</span>:""}</span>
            <div className="chart-bar-track">
              <div className="chart-bar-fill" style={{width:(p.totalMin/topMax*100)+"%"}}>
                <span className="chart-bar-value">{hrs}h ({p.count}x)</span>
              </div>
            </div>
          </div>
        })}</div></div>
      </div>}

      {/* Personnel Detail Table */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Detail Personel</h2><span className="panel-counter">{personList.length}</span></div>
        <div className="panel-body">
          {personList.length===0 ? <div className="empty-state"><I n="users" s={44}/><p>Tidak ada data</p></div> :
          personList.map(p => {
            const isExp = expandedName === p.name+p.branch
            const hrs = Math.round(p.totalMin/60*10)/10
            const avg = p.count ? Math.round(p.totalMin/p.count) : 0
            return (
              <div key={p.name+p.branch} className="handover-card handover-normal" style={{cursor:"pointer",opacity:p.count>0?1:0.45,marginBottom:4}} onClick={() => setExpandedName(isExp?null:p.name+p.branch)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:13}}>{isExp?"▾":"▸"}</span>
                    <strong style={{fontSize:13}}>{p.name}</strong>
                    {br==="ALL" && <span style={{fontSize:10,color:"var(--fg-muted)",background:"var(--bg)",padding:"1px 6px",borderRadius:6}}>{p.branch}</span>}
                    {p.count===0 && <span style={{fontSize:10,color:"var(--fg-muted)",fontStyle:"italic"}}>Belum on mic</span>}
                  </div>
                  {p.count>0 && <div style={{display:"flex",alignItems:"center",gap:10,fontSize:11,fontWeight:600}}>
                    <span style={{color:"#2563eb"}}>{hrs}h</span>
                    <span style={{color:"#10b981"}}>{p.count}x</span>
                    <span style={{color:"#0284C7"}}>{p.dep}<span style={{fontWeight:400,fontSize:9}}>D</span></span>
                    <span style={{color:"#CA8A04"}}>{p.arr}<span style={{fontWeight:400,fontSize:9}}>A</span></span>
                    <span style={{color:"#64748B"}}>{p.ovf}<span style={{fontWeight:400,fontSize:9}}>O</span></span>
                  </div>}
                </div>
                {isExp && p.count>0 && (
                  <div style={{padding:"10px 0 4px",borderTop:"1px solid var(--border)"}}>
                    <div style={{display:"flex",gap:12,marginBottom:10,fontSize:11}}>
                      <span>Rata-rata: <strong>{avg} mnt</strong></span>
                      <span>Pagi: <strong>{p.shifts.Morning||0}</strong></span>
                      <span>Siang: <strong>{p.shifts.Afternoon||0}</strong></span>
                      <span>Malam: <strong>{p.shifts.Night||0}</strong></span>
                      <span>Sektor: <strong>{[...p.sectors].join(", ")||"-"}</strong></span>
                    </div>
                    <div className="table-wrap"><table className="data-table" style={{fontSize:11}}>
                      <thead><tr><th>Tanggal</th><th>On–Off</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>Durasi</th><th style={{textAlign:"center",color:"#0284C7"}}>D</th><th style={{textAlign:"center",color:"#CA8A04"}}>A</th><th style={{textAlign:"center",color:"#64748B"}}>O</th></tr></thead>
                      <tbody>{p.logs.sort((a,b)=>new Date(b.on_time)-new Date(a.on_time)).slice(0,20).map(l => (
                        <tr key={l.id}>
                          <td style={{whiteSpace:"nowrap"}}>{fmtD(l.on_time)}</td>
                          <td style={{whiteSpace:"nowrap",color:"var(--fg-muted)"}}>{fmtT(l.on_time)}–{fmtT(l.off_time)}</td>
                          <td><span className="unit-tag">{l.unit}</span></td>
                          <td>{l.sector}</td><td>{l.cwp}</td>
                          <td>{durMin(l.on_time,l.off_time)}m</td>
                          <td style={{textAlign:"center",color:"#0284C7",fontWeight:600}}>{l.departure_count||0}</td>
                          <td style={{textAlign:"center",color:"#CA8A04",fontWeight:600}}>{l.arrival_count||0}</td>
                          <td style={{textAlign:"center",color:"#64748B",fontWeight:600}}>{l.overfly_count||0}</td>
                        </tr>
                      ))}</tbody>
                    </table></div>
                    {p.logs.length>20 && <div style={{fontSize:10,color:"var(--fg-muted)",marginTop:4}}>20 terbaru dari {p.logs.length}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING HANDOVER/TAKEOVER (Checklist + Notes)
// ============================================================
const AdminMonHandover = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [filterDate,setFilterDate] = useState("")
  const [expandedId,setExpandedId] = useState(null)

  // Checklist filter
  const clList = ctx.handoverChecklists.filter(c => {
    const brOk = br==="ALL" || c.branch_id===br
    const dOk = !filterDate || c.checklist_date===filterDate
    return brOk && dOk
  })

  // Notes filter
  const noteList = br==="ALL" ? ctx.handovers : ctx.handovers.filter(h => h.branch_code===br)

  const getAcctName = (bid) => {
    const found = ctx.branches.find(b => b.id === bid)
    return found ? found.code+" — "+found.city : bid?.slice(0,8)+"..."
  }

  return (
    <div className="page-content">
      <Header title="Monitoring Handover/Takeover" sub="Checklist & catatan dari seluruh cabang"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="br-select"/>
        {filterDate && <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate("")}>✕ Reset</button>}
      </div>

      <div className="stats-grid">
        <Stat icon="checklist" label="Total Checklist" value={clList.length} color="#8b5cf6"/>
        <Stat icon="shield" label="Not OK Items" value={clList.reduce((a,c) => a+CHECKLIST_ITEMS.filter(it => c[it.key+"_status"]==="Not OK").length,0)} color="#ef4444" sub="Perlu perhatian"/>
        <Stat icon="note" label="Handover Notes" value={noteList.length} color="#38bdf8"/>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 1: CHECKLISTS                       */}
      {/* ═══════════════════════════════════════════ */}
      <div style={{marginBottom:8,marginTop:8}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:8}}><I n="checklist" s={18}/> Handover/Takeover Checklists</h2>
      </div>

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Checklists</h2><span className="panel-counter">{clList.length}</span></div>
        <div className="panel-body">
          {clList.length===0 ? <div className="empty-state"><I n="checklist" s={44}/><p>Tidak ada checklist ditemukan</p></div> :
          clList.map(cl => {
            const notOk = CHECKLIST_ITEMS.filter(it => cl[it.key+"_status"]==="Not OK").length
            return (
              <div key={cl.id} className={"handover-card "+(notOk>0?"handover-high":"handover-normal")} style={{cursor:"pointer"}} onClick={() => setExpandedId(expandedId===cl.id?null:cl.id)}>
                <div className="handover-header">
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:14}}>{expandedId===cl.id?"▾":"▸"}</span>
                    <span style={{background:"#f5f3ff",color:"#6d28d9",padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:700}}>{getAcctName(cl.branch_id)}</span>
                    <strong>{fmtD(cl.checklist_date)}</strong>
                    {cl.shift && <span className="priority-tag priority-normal">{cl.shift}</span>}
                    {notOk>0 && <span className="priority-tag priority-high">⚠ {notOk} Not OK</span>}
                  </div>
                  <span style={{color:"var(--fg-muted)",fontSize:12}}>MOD: {cl.manager_on_duty}</span>
                </div>
                {expandedId===cl.id && (
                  <div style={{padding:"12px 0 4px",borderTop:"1px solid var(--border)"}}>
                    <div style={{display:"flex",gap:16,fontSize:12,color:"var(--fg-muted)",marginBottom:8}}>
                      <span><strong>Waktu:</strong> {cl.checklist_time}</span>
                      <span><strong>MOD:</strong> {cl.manager_on_duty}</span>
                      <span><strong>Shift:</strong> {cl.shift}</span>
                    </div>
                    <table className="data-table" style={{fontSize:12}}>
                      <thead><tr><th>Item</th><th>Status</th><th>Catatan</th></tr></thead>
                      <tbody>{CHECKLIST_ITEMS.map(it => (
                        <tr key={it.key}>
                          <td>{it.label}</td>
                          <td><span style={{display:"inline-block",padding:"2px 10px",borderRadius:12,fontSize:11,fontWeight:600,background:STATUS_CLR[cl[it.key+"_status"]]?.bg||"#f1f5f9",color:STATUS_CLR[cl[it.key+"_status"]]?.fg||"#6b7280"}}>{cl[it.key+"_status"]}</span></td>
                          <td style={{color:"var(--fg-muted)"}}>{cl[it.key+"_notes"]||"—"}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    <div style={{display:"flex",gap:24,marginTop:12,padding:12,background:"var(--bg)",borderRadius:8}}>
                      <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase",marginBottom:4}}>Incoming ({(cl.incoming_personnel||"").split(",").filter(n=>n.trim()).length})</div>{(cl.incoming_personnel||"").split(",").map((n,i) => n.trim() && <div key={i} style={{fontSize:13,fontWeight:600,color:"var(--fg)",padding:"2px 0"}}>• {n.trim()}</div>)}</div>
                      <div style={{flex:1}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase",marginBottom:4}}>Outgoing ({(cl.outgoing_personnel||"").split(",").filter(n=>n.trim()).length})</div>{(cl.outgoing_personnel||"").split(",").map((n,i) => n.trim() && <div key={i} style={{fontSize:13,fontWeight:600,color:"var(--fg)",padding:"2px 0"}}>• {n.trim()}</div>)}</div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION 2: HANDOVER NOTES                   */}
      {/* ═══════════════════════════════════════════ */}
      <div style={{marginTop:32,marginBottom:16}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:700,color:"var(--fg)",display:"flex",alignItems:"center",gap:8}}><I n="note" s={18}/> Handover Notes</h2>
      </div>

      <div className="panel"><div className="panel-header"><h2 className="panel-title">Notes</h2><span className="panel-counter">{noteList.length}</span></div>
        <div className="panel-body">{noteList.length===0 ? <div className="empty-state"><p>Belum ada catatan</p></div> : noteList.map(n => {
          const b = ctx.branches.find(a => a.code===n.branch_code)
          return (
            <div key={n.id} className={"handover-card handover-"+n.priority}>
              <div className="handover-header"><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><span className="handover-branch">{n.branch_code}{b?" — "+b.city:""}</span><span className={"priority-tag priority-"+n.priority}>{n.priority.toUpperCase()}</span><span className="handover-shift">Shift {n.from_shift} → {n.to_shift}</span></div><span className="handover-time">{fmtDT(n.created_at)}</span></div>
              <div className="handover-body">{n.content}</div>
              <div className="handover-author">— {n.author_name}</div>
            </div>
          )
        })}</div>
      </div>
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING HO/TO MO
// ============================================================
const AdminMonHoToMo = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [filterDate,setFilterDate] = useState("")
  const [activeTab,setActiveTab] = useState("pre_shift")
  const [data,setData] = useState([])
  const [loading,setLoading] = useState(true)
  const [expandedId,setExpandedId] = useState(null)

  const currentTab = MO_TABS.find(t => t.id === activeTab)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      let q = supabase.from("mo_checklists").select("*").eq("checklist_type",activeTab).order("created_at",{ascending:false}).limit(200)
      if (br !== "ALL") q = q.eq("branch_code",br)
      if (filterDate) q = q.eq("checklist_date",filterDate)
      const {data:d} = await q
      if (d) setData(d)
      setLoading(false)
    }
    load()
  }, [activeTab,br,filterDate])

  const branchName = (code) => {
    const b = ctx.branches.find(x => x.code === code)
    return b ? code+" — "+b.city : code
  }

  // Stats
  const totalChecklists = data.length
  const totalChecked = data.reduce((a,c) => a + (c.items||[]).filter(i => i.checked===true).length, 0)
  const totalUnchecked = data.reduce((a,c) => a + (c.items||[]).filter(i => i.checked===false).length, 0)
  const branchesWithData = [...new Set(data.map(d => d.branch_code))].length

  return (
    <div className="page-content">
      <Header title="Monitoring HO/TO MO" sub="Checklist PRKP Manager Operasi dari seluruh cabang"/>

      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="br-select"/>
        {filterDate && <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate("")}>✕ Reset</button>}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {MO_TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            padding:"10px 18px",borderRadius:8,border:"1px solid "+(activeTab===t.id?"#2563eb":"var(--border)"),
            background:activeTab===t.id?"rgba(37,99,235,0.12)":"transparent",
            color:activeTab===t.id?"#60a5fa":"var(--fg-muted)",fontSize:13,fontWeight:700,cursor:"pointer",transition:"all .2s",
            display:"flex",alignItems:"center",gap:6
          }}>{t.icon} {t.label}</button>
        ))}
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Stat icon="checklist" label="Total Checklist" value={totalChecklists} color="#8b5cf6"/>
        <Stat icon="check" label="Item ✓" value={totalChecked} color="#10b981"/>
        <Stat icon="shield" label="Item ✗" value={totalUnchecked} color="#ef4444" sub="Perlu perhatian"/>
        <Stat icon="users" label="Cabang Submit" value={branchesWithData} color="#38bdf8"/>
      </div>

      {/* Data */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">{currentTab.icon} {currentTab.label}</h2><span className="panel-counter">{data.length}</span></div>
        <div className="panel-body">
          {loading ? <div style={{textAlign:"center",padding:40,color:"var(--fg-muted)"}}>Memuat...</div>
          : data.length === 0 ? <div className="empty-state"><I n="checklist" s={44}/><p>Tidak ada data ditemukan</p></div>
          : <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {data.map(h => {
              const items = h.items || []
              const checked = items.filter(i => i.checked===true).length
              const unchecked = items.filter(i => i.checked===false).length
              const total = items.length
              const expanded = expandedId === h.id
              return (
                <div key={h.id} style={{padding:16,borderRadius:10,border:"1px solid "+(unchecked>0?"rgba(239,68,68,0.3)":"var(--border)"),background:unchecked>0?"rgba(239,68,68,0.03)":"rgba(255,255,255,0.01)",cursor:"pointer",transition:"all .2s"}} onClick={() => setExpandedId(expanded?null:h.id)}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:expanded?12:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                      <span style={{fontSize:14}}>{expanded?"▾":"▸"}</span>
                      <span style={{background:"#f5f3ff",color:"#6d28d9",padding:"3px 10px",borderRadius:12,fontSize:11,fontWeight:700}}>{branchName(h.branch_code)}</span>
                      <span style={{fontSize:13,fontWeight:700,color:"var(--fg)"}}>{new Date(h.checklist_date).toLocaleDateString("id-ID",{day:"numeric",month:"short",year:"numeric"})}</span>
                      <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:"rgba(37,99,235,0.12)",color:"#60a5fa"}}>{h.shift}</span>
                      {unchecked > 0 && <span style={{padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:"rgba(239,68,68,0.12)",color:"#ef4444"}}>✗ {unchecked}</span>}
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:11,color:"#10b981",fontWeight:700}}>✓ {checked}</span>
                      <span style={{fontSize:11,color:"var(--fg-muted)"}}>/ {total}</span>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{borderTop:"1px solid var(--border)",paddingTop:12}}>
                      <div style={{display:"flex",gap:16,fontSize:12,color:"var(--fg-muted)",marginBottom:12}}>
                        <span>MO: <strong style={{color:"var(--fg)"}}>{h.incoming_mo}</strong></span>
                        <span>Waktu: {new Date(h.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}</span>
                      </div>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead>
                          <tr style={{background:"rgba(37,99,235,0.06)"}}>
                            <th style={{padding:"8px",textAlign:"center",width:36,borderBottom:"1px solid var(--border)",color:"var(--fg-muted)",fontSize:11}}>NO</th>
                            <th style={{padding:"8px 12px",textAlign:"left",width:160,borderBottom:"1px solid var(--border)",color:"var(--fg-muted)",fontSize:11}}>ITEM</th>
                            <th style={{padding:"8px 12px",textAlign:"left",borderBottom:"1px solid var(--border)",color:"var(--fg-muted)",fontSize:11}}>STANDAR MINIMUM</th>
                            <th style={{padding:"8px",textAlign:"center",width:50,borderBottom:"1px solid var(--border)",color:"var(--fg-muted)",fontSize:11}}>CEK</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((it,idx) => {
                            const refItem = currentTab.items.find(r => r.no === it.no)
                            return (
                              <tr key={it.no} style={{borderBottom:"1px solid var(--border)"}}>
                                <td style={{padding:"8px",textAlign:"center",color:"var(--fg-muted)"}}>{it.no}</td>
                                <td style={{padding:"8px 12px",fontWeight:600,color:"var(--fg)"}}>{it.item}</td>
                                <td style={{padding:"8px 12px",color:"var(--fg-muted)",lineHeight:1.4}}>{refItem?.std||"—"}</td>
                                <td style={{padding:"8px",textAlign:"center"}}>
                                  {it.checked===true?<span style={{color:"#10b981",fontWeight:900,fontSize:16}}>✓</span>:it.checked===false?<span style={{color:"#ef4444",fontWeight:900,fontSize:16}}>✗</span>:<span style={{color:"var(--fg-muted)"}}>—</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {h.notes && <div style={{marginTop:12,padding:10,background:"var(--bg)",borderRadius:8,fontSize:12,color:"var(--fg-muted)",fontStyle:"italic"}}>📝 {h.notes}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ADMIN: EXPORT & AUDIT (placeholder)
// ============================================================
// ============================================================
// ADMIN: EXPORT LAPORAN (Excel + PDF)
// ============================================================
const AdminExport = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [dateFrom,setDateFrom] = useState(new Date().toISOString().slice(0,10))
  const [dateTo,setDateTo] = useState(new Date().toISOString().slice(0,10))
  const [filterMode,setFilterMode] = useState("period") // period | range
  const [period,setPeriod] = useState("today")
  const [shift,setShift] = useState("ALL")
  const [reportType,setReportType] = useState("log_position")
  const [exporting,setExporting] = useState(false)
  const [libsLoaded,setLibsLoaded] = useState(false)

  // Load libraries on mount
  useEffect(() => {
    const loadLibs = async () => {
      if (window.ExcelJS && window.jspdf) { setLibsLoaded(true); return }
      const scripts = [
        "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js"
      ]
      for (const src of scripts) {
        if (!document.querySelector(`script[src="${src}"]`)) {
          await new Promise((res,rej) => { const s=document.createElement("script");s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s) })
        }
      }
      setLibsLoaded(true)
    }
    loadLibs()
  },[])

  // ── Filter logic ──
  const inRange = (dateStr) => {
    if (filterMode === "period") {
      const d = (new Date() - new Date(dateStr)) / 864e5
      return period==="today" ? new Date(dateStr).toDateString()===new Date().toDateString() : period==="week" ? d<=7 : d<=30
    }
    return dateStr >= dateFrom && dateStr <= dateTo
  }
  const matchBr = (code) => br==="ALL" || code===br
  const matchShift = (s) => shift==="ALL" || s===shift

  const getBrName = (code) => { const b=ctx.branches.find(x=>x.code===code); return b ? b.name+" ("+code+")" : code }
  const brLabel = br==="ALL" ? "Semua Cabang" : getBrName(br)
  const periodLabel = filterMode==="period" ? (period==="today"?"Hari Ini":period==="week"?"7 Hari Terakhir":"30 Hari Terakhir") : dateFrom+" s/d "+dateTo

  // ── Report types ──
  const REPORTS = [
    {id:"log_position",label:"Log Position",icon:"mic",desc:"Siapa on/off mic, kapan, durasi"},
    {id:"rekap_traffic",label:"Rekap Traffic",icon:"plane",desc:"DEP/ARR/OVF per cabang & sektor"},
    {id:"handover_checklist",label:"Handover Checklists",icon:"checklist",desc:"Status checklist serah terima"},
    {id:"handover_notes",label:"Handover Notes",icon:"note",desc:"Catatan serah terima"},
    {id:"daily_summary",label:"Ringkasan Harian",icon:"dashboard",desc:"Rangkuman aktivitas per hari"},
    {id:"personnel_stats",label:"Statistik Personel",icon:"chart",desc:"Jam kerja & frekuensi on mic"},
    {id:"monthly_national",label:"Laporan Bulanan Nasional",icon:"shield",desc:"Ringkasan + 28 sheet per MO lokasi (West/East)"},
  ]

  // ── Data collectors ──
  const getLogData = () => ctx.logs.filter(l => {
    const dt = new Date(l.on_time).toISOString().slice(0,10)
    return matchBr(l.branch_code) && inRange(dt) && matchShift(l.shift)
  }).sort((a,b) => new Date(b.on_time)-new Date(a.on_time))

  const getTrafficData = () => ctx.logs.filter(l => {
    if(!l.off_time) return false
    const tc=(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)
    if(tc===0) return false
    const dt = new Date(l.on_time).toISOString().slice(0,10)
    return matchBr(l.branch_code) && inRange(dt) && matchShift(l.shift)
  }).sort((a,b) => new Date(b.on_time)-new Date(a.on_time))

  const getChecklistData = () => ctx.handoverChecklists.filter(c => {
    const brOk = br==="ALL" || c.branch_id===br
    return brOk && inRange(c.checklist_date) && matchShift(c.shift)
  })

  const getNotesData = () => ctx.handovers.filter(n => {
    const dt = new Date(n.created_at).toISOString().slice(0,10)
    return matchBr(n.branch_code) && inRange(dt)
  })

  // ── Excel Export ──
  const exportExcel = async () => {
    if(!window.ExcelJS) { alert("Library belum dimuat"); return }
    setExporting(true)
    try {
      const wb = new window.ExcelJS.Workbook()
      wb.creator = "ATC Log Position — Airnav Indonesia"
      wb.created = new Date()

      const headerStyle = {font:{bold:true,color:{argb:"FFFFFFFF"},size:11},fill:{type:"pattern",pattern:"solid",fgColor:{argb:"FF1e3a5f"}},alignment:{horizontal:"center",vertical:"middle"},border:{bottom:{style:"thin"}}}
      const addHeaders = (ws, headers) => {
        const row = ws.addRow(headers)
        row.eachCell(c => { c.font=headerStyle.font; c.fill=headerStyle.fill; c.alignment=headerStyle.alignment; c.border=headerStyle.border })
        return row
      }
      const addTitle = (ws, title) => {
        const r = ws.addRow([title]); r.font={bold:true,size:14,color:{argb:"FF1e3a5f"}}
        ws.addRow([brLabel+" — "+periodLabel+(shift!=="ALL"?" — Shift "+shift:"")]); ws.addRow([])
      }

      if (reportType==="log_position" || reportType==="daily_summary" || reportType==="personnel_stats") {
        const data = getLogData()
        if (reportType==="log_position") {
          const ws = wb.addWorksheet("Log Position")
          addTitle(ws, "Laporan Log Position")
          addHeaders(ws, ["Cabang","Tanggal","Nama ATC","Unit","Sektor","CWP","Shift","On","Off","Durasi (mnt)","DEP","ARR","OVF","Status"])
          data.forEach(l => ws.addRow([l.branch_code,fmtD(l.on_time),l.atc_name,l.unit,l.sector,l.cwp,l.shift,fmtT(l.on_time),l.off_time?fmtT(l.off_time):"-",l.off_time?durMin(l.on_time,l.off_time):"-",l.departure_count||0,l.arrival_count||0,l.overfly_count||0,l.off_time?"Off":"On Mic"]))
          ws.columns.forEach(c => { c.width = 14 })
        }
        if (reportType==="daily_summary") {
          const ws = wb.addWorksheet("Ringkasan Harian")
          addTitle(ws, "Ringkasan Harian")
          // Group by date
          const byDate = {}
          data.forEach(l => {
            const dt = new Date(l.on_time).toISOString().slice(0,10)
            if(!byDate[dt]) byDate[dt]={logs:0,onMic:0,offMic:0,dep:0,arr:0,ovf:0,branches:new Set(),personnel:new Set()}
            byDate[dt].logs++
            if(l.off_time) { byDate[dt].offMic++; byDate[dt].dep+=l.departure_count||0; byDate[dt].arr+=l.arrival_count||0; byDate[dt].ovf+=l.overfly_count||0 }
            else byDate[dt].onMic++
            byDate[dt].branches.add(l.branch_code)
            byDate[dt].personnel.add(l.atc_name)
          })
          addHeaders(ws, ["Tanggal","Total Log","Masih On","Sudah Off","Cabang Aktif","Personel Aktif","DEP","ARR","OVF","Total Traffic"])
          Object.keys(byDate).sort().reverse().forEach(dt => {
            const d=byDate[dt]; ws.addRow([dt,d.logs,d.onMic,d.offMic,d.branches.size,d.personnel.size,d.dep,d.arr,d.ovf,d.dep+d.arr+d.ovf])
          })
          ws.columns.forEach(c => { c.width = 15 })
        }
        if (reportType==="personnel_stats") {
          const ws = wb.addWorksheet("Statistik Personel")
          addTitle(ws, "Statistik Personel")
          const byPerson = {}
          data.filter(l=>l.off_time).forEach(l => {
            const k = l.atc_name+"||"+l.branch_code
            if(!byPerson[k]) byPerson[k]={name:l.atc_name,branch:l.branch_code,count:0,totalMin:0,dep:0,arr:0,ovf:0}
            byPerson[k].count++
            byPerson[k].totalMin += durMin(l.on_time,l.off_time)
            byPerson[k].dep += l.departure_count||0
            byPerson[k].arr += l.arrival_count||0
            byPerson[k].ovf += l.overfly_count||0
          })
          addHeaders(ws, ["Nama","Cabang","Jumlah On Mic","Total Jam Kerja","Rata-rata (mnt)","DEP","ARR","OVF","Total Traffic"])
          Object.values(byPerson).sort((a,b)=>b.totalMin-a.totalMin).forEach(p => {
            ws.addRow([p.name,p.branch,p.count,Math.round(p.totalMin/60*10)/10+" jam",p.count?Math.round(p.totalMin/p.count):0,p.dep,p.arr,p.ovf,p.dep+p.arr+p.ovf])
          })
          ws.columns.forEach(c => { c.width = 16 })
        }
      }
      if (reportType==="rekap_traffic") {
        const data = getTrafficData()
        const ws = wb.addWorksheet("Rekap Traffic")
        addTitle(ws, "Rekap Traffic")
        addHeaders(ws, ["Cabang","Tanggal","On","Off","Controller","Unit","Sektor","Shift","DEP","ARR","OVF","Total"])
        data.forEach(l => ws.addRow([l.branch_code,fmtD(l.on_time),fmtT(l.on_time),fmtT(l.off_time),l.atc_name,l.unit,l.sector,l.shift,l.departure_count||0,l.arrival_count||0,l.overfly_count||0,(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)]))
        // Summary sheet
        const ws2 = wb.addWorksheet("Summary Per Cabang")
        addTitle(ws2, "Summary Traffic Per Cabang")
        const byBr2 = {}
        data.forEach(l => { if(!byBr2[l.branch_code]) byBr2[l.branch_code]={dep:0,arr:0,ovf:0,n:0}; byBr2[l.branch_code].dep+=l.departure_count||0; byBr2[l.branch_code].arr+=l.arrival_count||0; byBr2[l.branch_code].ovf+=l.overfly_count||0; byBr2[l.branch_code].n++ })
        addHeaders(ws2, ["Cabang","Bandara","Laporan","DEP","ARR","OVF","Total"])
        Object.keys(byBr2).sort((a,b)=>(byBr2[b].dep+byBr2[b].arr+byBr2[b].ovf)-(byBr2[a].dep+byBr2[a].arr+byBr2[a].ovf)).forEach(code => {
          const d=byBr2[code]; ws2.addRow([code,getBrName(code),d.n,d.dep,d.arr,d.ovf,d.dep+d.arr+d.ovf])
        })
        ws.columns.forEach(c => { c.width = 14 }); ws2.columns.forEach(c => { c.width = 16 })
      }
      if (reportType==="handover_checklist") {
        const data = getChecklistData()
        const ws = wb.addWorksheet("Handover Checklists")
        addTitle(ws, "Laporan Handover Checklists")
        addHeaders(ws, ["Tanggal","Waktu","Shift","MOD","Traffic Situation","Conflict & Solution","Weather","Facilities","Coordination","Others","Incoming","Outgoing"])
        data.forEach(c => ws.addRow([c.checklist_date,c.checklist_time,c.shift,c.manager_on_duty,...CHECKLIST_ITEMS.map(it=>c[it.key+"_status"]+(c[it.key+"_notes"]?" ("+c[it.key+"_notes"]+")":"")),c.incoming_personnel,c.outgoing_personnel]))
        ws.columns.forEach(c => { c.width = 18 })
      }
      if (reportType==="handover_notes") {
        const data = getNotesData()
        const ws = wb.addWorksheet("Handover Notes")
        addTitle(ws, "Laporan Handover Notes")
        addHeaders(ws, ["Cabang","Tanggal","Shift","Prioritas","Catatan","Penulis"])
        data.forEach(n => ws.addRow([n.branch_code,fmtDT(n.created_at),n.from_shift+" → "+n.to_shift,n.priority,n.content,n.author_name]))
        ws.columns.forEach(c => { c.width = 20 })
      }

      if (reportType==="monthly_national") {
        // ── Helper styles ──
        const navy="FF1E3A5F",white="FFFFFFFF",lightBlue="FFE8F4FD",lightGray="FFF8FAFC"
        const westColor="FF1D4ED8",eastColor="FFDC2626",westBg="FFEFF6FF",eastBg="FFFEF2F2"
        const parentColor="FF1E40AF",parentBg="FFDBEAFE",childBg="FFF3F4F6"
        const summaryColor="FF065F46",summaryBg="FFD1FAE5",greenC="FF10B981",blueAcc="FF2563EB"
        const hFont={font:{bold:true,color:{argb:white},size:11},fill:{type:"pattern",pattern:"solid",fgColor:{argb:navy}},alignment:{horizontal:"center",vertical:"middle",wrapText:true}}
        const applyH=(cell)=>{cell.font=hFont.font;cell.fill=hFont.fill;cell.alignment=hFont.alignment;cell.border={bottom:{style:"thin"}}}
        const applyS=(cell,f,fill,a)=>{if(f)cell.font=f;if(fill)cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};if(a)cell.alignment=a;cell.border={bottom:{style:"thin",color:{argb:"FFD1D5DB"}},top:{style:"thin",color:{argb:"FFD1D5DB"}},left:{style:"thin",color:{argb:"FFD1D5DB"}},right:{style:"thin",color:{argb:"FFD1D5DB"}}}}
        const ctr={horizontal:"center",vertical:"middle",wrapText:true},rgt={horizontal:"right",vertical:"middle"},lft={horizontal:"left",vertical:"middle",wrapText:true}
        const bF={bold:true,size:10,name:"Arial"},nF={size:10,name:"Arial"}

        // ── Build hierarchy ──
        const moCodeSet = new Set()
        const {data:moAccs} = await supabase.from("accounts").select("branch_code").like("username","mo_%")
        if(moAccs) moAccs.forEach(a=>moCodeSet.add(a.branch_code))
        
        const allBr = ctx.branches.filter(b=>b.region)
        const westTop = allBr.filter(b=>b.region==="west"&&!b.parent_code)
        const eastTop = allBr.filter(b=>b.region==="east"&&!b.parent_code)
        
        const getChildren=(code)=>{
          const kids=allBr.filter(b=>b.parent_code===code)
          const result=[]
          for(const k of kids){
            if(moCodeSet.has(k.code)&&k.code!==code) continue
            result.push(k)
            result.push(...getChildren(k.code))
          }
          return result
        }
        const getAccessible=(code)=>[code,...getChildren(code).map(c=>c.code)]
        
        // ── Collect all log data ──
        const allLogs = ctx.logs.filter(l=>l.off_time&&inRange(new Date(l.on_time).toISOString().slice(0,10)))
        
        // ── Fetch equipment data from communication_systems ──
        const {data:dailyReps} = await supabase.from("daily_reports").select("id,branch_code,report_date").gte("report_date",dateFrom).lte("report_date",dateTo)
        const repIds = (dailyReps||[]).map(r=>r.id)
        let equipData = []
        if(repIds.length>0){
          // Fetch in batches of 100
          for(let i=0;i<repIds.length;i+=100){
            const batch=repIds.slice(i,i+100)
            const {data:eq} = await supabase.from("communication_systems").select("*").in("daily_report_id",batch)
            if(eq) equipData=equipData.concat(eq)
          }
        }
        // Map daily_report_id → branch_code
        const repMap={}; (dailyReps||[]).forEach(r=>{repMap[r.id]=r.branch_code})
        
        // Aggregate equipment per branch: {branch_code: {system_name: {normal:N, us:N, total_days:N}}}
        const equipByBranch={}
        equipData.forEach(e=>{
          const bc=repMap[e.daily_report_id]
          if(!bc) return
          if(!equipByBranch[bc]) equipByBranch[bc]={}
          const key=e.system_name||e.system_key||"Unknown"
          if(!equipByBranch[bc][key]) equipByBranch[bc][key]={normal:0,us:0,total:0}
          equipByBranch[bc][key].total++
          if(e.status==="Normal"||e.status==="Operational") equipByBranch[bc][key].normal++
          else equipByBranch[bc][key].us++
        })
        
        // Helper to render equipment section
        const renderEquipSection=(ws,branchCode,locName,isParent)=>{
          const bc2=isParent?parentColor:("FF6B7280")
          const bb2=isParent?parentBg.replace("FF",""):childBg.replace("FF","")
          const prefix=isParent?"■":"└"
          
          const eqRow=ws.addRow([`  ${prefix} Status Peralatan — ${locName}`])
          ws.mergeCells(eqRow.number,1,eqRow.number,10)
          eqRow.eachCell(c=>{applyS(c,{bold:true,size:10,color:{argb:bc2},name:"Arial"},bb2,lft)})
          eqRow.height=22
          
          const eH=ws.addRow(["No","Nama Peralatan","","Status","Hari Normal","Hari U/S","% Availability","Gangguan","Keterangan",""])
          eH.eachCell(c=>applyH(c))
          
          const branchEquip=equipByBranch[branchCode]||{}
          const equipList=Object.entries(branchEquip)
          
          if(equipList.length===0){
            const noRow=ws.addRow(["","Belum ada data peralatan untuk periode ini","","","","","","","",""])
            noRow.eachCell(c=>{applyS(c,{size:10,color:{argb:"FF94A3B8"},name:"Arial",italic:true},null,lft)})
            ws.addRow([])
            return {total:0,normal:0,us:0,perhatian:0,avgAvail:0}
          }
          
          let totalEq=0,normalEq=0,usEq=0
          equipList.forEach(([eName,eStats],ei)=>{
            const fill=ei%2===0?lightGray.replace("FF",""):null
            const avail=eStats.total>0?(eStats.normal/eStats.total*100):100
            const status=eStats.us===0?"Normal":(eStats.us>eStats.total*0.2?"U/S":"Perlu Perhatian")
            const statusColor=status==="Normal"?"FF10B981":(status==="U/S"?"FFEF4444":"FFF59E0B")
            const statusBg=status==="Normal"?"ECFDF5":(status==="U/S"?"FEF2F2":"FFFBEB")
            const availColor=avail>=95?"FF10B981":(avail>=80?"FFF59E0B":"FFEF4444")
            
            totalEq++;if(status==="Normal")normalEq++;else if(status==="U/S")usEq++
            
            const row=ws.addRow([ei+1,eName,"",status,eStats.normal,eStats.us,avail.toFixed(1)+"%",eStats.us>0?1:0,eStats.us>0?"Gangguan tercatat":"Operasional penuh",""])
            row.eachCell((c,ci)=>{
              if(ci===4) applyS(c,{bold:true,size:10,color:{argb:statusColor},name:"Arial"},statusBg,ctr)
              else if(ci===7) applyS(c,{bold:true,color:{argb:availColor},size:10,name:"Arial"},fill,ctr)
              else if(ci===6) applyS(c,{bold:true,color:{argb:"FFEF4444"},size:10,name:"Arial"},fill,ctr)
              else if(ci===2) applyS(c,bF,fill,lft)
              else applyS(c,nF,fill,ci<=1?ctr:ci>=8?lft:ctr)
            })
          })
          
          const perhatianEq=totalEq-normalEq-usEq
          const avgAvail=equipList.length>0?equipList.reduce((a,[_,e])=>a+(e.total>0?e.normal/e.total*100:100),0)/equipList.length:100
          
          // Summary row
          const sRow=ws.addRow(["","RINGKASAN","",`${normalEq} Normal, ${perhatianEq} Perhatian, ${usEq} U/S`,"","",avgAvail.toFixed(1)+"%","","",""])
          sRow.eachCell(c=>{applyS(c,{bold:true,size:10,color:{argb:navy},name:"Arial"},lightBlue.replace("FF",""),ctr)})
          ws.addRow([])
          
          return {total:totalEq,normal:normalEq,us:usEq,perhatian:perhatianEq,avgAvail}
        }
        const logsBy=(codes)=>allLogs.filter(l=>codes.includes(l.branch_code))
        const trafficBy=(codes)=>{const ls=logsBy(codes);return{dep:ls.reduce((a,l)=>a+(l.departure_count||0),0),arr:ls.reduce((a,l)=>a+(l.arrival_count||0),0),ovf:ls.reduce((a,l)=>a+(l.overfly_count||0),0),onMic:ls.length}}
        const persBy=(codes)=>ctx.personnel.filter(p=>codes.includes(p.branch_code))
        
        // ── Collect per-date traffic ──
        const dailyBy=(code)=>{
          const byDate={}
          allLogs.filter(l=>l.branch_code===code).forEach(l=>{
            const dt=new Date(l.on_time).toISOString().slice(0,10)
            if(!byDate[dt])byDate[dt]={dep:0,arr:0,ovf:0,n:0}
            byDate[dt].dep+=l.departure_count||0;byDate[dt].arr+=l.arrival_count||0;byDate[dt].ovf+=l.overfly_count||0;byDate[dt].n++
          })
          return Object.entries(byDate).sort((a,b)=>a[0].localeCompare(b[0]))
        }
        
        // ── Personnel stats ──
        const persStats=(codes)=>{
          const byP={}
          allLogs.filter(l=>codes.includes(l.branch_code)).forEach(l=>{
            const k=l.atc_name+"||"+l.branch_code
            if(!byP[k])byP[k]={name:l.atc_name,branch:l.branch_code,count:0,totalMin:0,dep:0,arr:0,ovf:0}
            byP[k].count++;byP[k].totalMin+=durMin(l.on_time,l.off_time);byP[k].dep+=l.departure_count||0;byP[k].arr+=l.arrival_count||0;byP[k].ovf+=l.overfly_count||0
          })
          return Object.values(byP).sort((a,b)=>b.totalMin-a.totalMin)
        }
        
        // ── SHEET 1: Ringkasan Nasional ──
        const ws1=wb.addWorksheet("Ringkasan Nasional")
        ws1.properties.tabColor={argb:navy.replace("FF","")}
        const r1=ws1.addRow(["AIRNAV INDONESIA"]);r1.font={bold:true,size:9,color:{argb:blueAcc},name:"Arial"}
        const r2=ws1.addRow(["LAPORAN BULANAN OPERASIONAL ATC — NASIONAL"]);r2.font={bold:true,size:16,color:{argb:navy},name:"Arial"}
        ws1.addRow(["Periode: "+periodLabel+"  |  Seluruh Wilayah FIR Indonesia"]).font={size:10,color:{argb:"FF64748B"},name:"Arial"}
        ws1.addRow([])
        
        const allCodes=allBr.map(b=>b.code)
        const natT=trafficBy(allCodes),westT=trafficBy(allBr.filter(b=>b.region==="west").map(b=>b.code)),eastT=trafficBy(allBr.filter(b=>b.region==="east").map(b=>b.code))
        
        const rH=ws1.addRow(["","Total Traffic","","Total Personel","","West Traffic","","East Traffic",""])
        rH.eachCell(c=>{applyS(c,{bold:true,size:9,color:{argb:"FF64748B"},name:"Arial"},lightBlue.replace("FF",""),ctr)})
        const natTotal=natT.dep+natT.arr+natT.ovf
        const rV=ws1.addRow(["",(natTotal).toLocaleString(),"",ctx.personnel.length.toLocaleString(),"",(westT.dep+westT.arr+westT.ovf).toLocaleString(),"",(eastT.dep+eastT.arr+eastT.ovf).toLocaleString(),""])
        rV.eachCell(c=>{applyS(c,{bold:true,size:16,color:{argb:navy},name:"Arial"},lightBlue.replace("FF",""),ctr)})
        ws1.addRow([])
        
        // Top 15 branches
        const topRow=ws1.addRow(["TOP 15 LOKASI — TRAFFIC TERTINGGI"])
        topRow.font={bold:true,size:12,color:{argb:navy},name:"Arial"}
        const hdr=ws1.addRow(["No","Code","Nama","Kota","Region","Traffic","Personel","MO","Parent"])
        hdr.eachCell(c=>applyH(c))
        
        const brTraffic=allBr.map(b=>{const t=trafficBy([b.code]);return{...b,traffic:t.dep+t.arr+t.ovf,pers:persBy([b.code]).length}}).sort((a,b)=>b.traffic-a.traffic)
        brTraffic.slice(0,15).forEach((b,i)=>{
          const row=ws1.addRow([i+1,b.code,b.name,b.city,b.region,(b.traffic).toLocaleString(),b.pers,moCodeSet.has(b.code)?"✓":"—",b.parent_code||"—"])
          row.eachCell((c,ci)=>{
            const isW=b.region==="west"
            if(ci===5)applyS(c,{bold:true,size:9,color:{argb:isW?westColor:eastColor},name:"Arial"},isW?westBg.replace("FF",""):eastBg.replace("FF",""),ctr)
            else if(ci===6)applyS(c,{bold:true,size:10,name:"Arial"},i%2===0?lightGray.replace("FF",""):null,rgt)
            else applyS(c,nF,i%2===0?lightGray.replace("FF",""):null,ci<=1?ctr:ci>=7?ctr:lft)
          })
        })
        ws1.columns=[{width:5},{width:8},{width:24},{width:16},{width:10},{width:14},{width:10},{width:8},{width:10}]
        
        // ── Equipment Summary Nasional ──
        ws1.addRow([])
        const eqBannerRow=ws1.addRow(["STATUS PERALATAN — RINGKASAN NASIONAL"])
        eqBannerRow.eachCell(c=>{applyS(c,{bold:true,size:12,color:{argb:white},name:"Arial"},"D97706",lft)})
        ws1.mergeCells(eqBannerRow.number,1,eqBannerRow.number,9)
        eqBannerRow.height=28
        
        const eqH=ws1.addRow(["No","Lokasi","Code","Region","Total","Normal","Perhatian","U/S","% Availability"])
        eqH.eachCell(c=>applyH(c))
        
        const natEquipSummary=[]
        const allMoCodesArr=[...moCodeSet]
        allMoCodesArr.sort()
        allMoCodesArr.forEach(mc=>{
          const br3=allBr.find(b=>b.code===mc)
          if(!br3) return
          const brEq=equipByBranch[mc]||{}
          const eqList=Object.entries(brEq)
          const total=eqList.length
          const normal=eqList.filter(([_,e])=>e.us===0).length
          const us=eqList.filter(([_,e])=>e.us>e.total*0.2).length
          const perhatian=total-normal-us
          const avgA=total>0?eqList.reduce((a,[_,e])=>a+(e.total>0?e.normal/e.total*100:100),0)/total:100
          natEquipSummary.push({code:mc,name:br3.name,city:br3.city,region:br3.region,total,normal,us,perhatian,avgA})
        })
        natEquipSummary.sort((a,b)=>a.avgA-b.avgA)
        
        natEquipSummary.forEach((eq,i)=>{
          const fill=i%2===0?lightGray.replace("FF",""):null
          const isW=eq.region==="west"
          const statusLabel=eq.avgA>=95?"Baik":(eq.avgA>=85?"Cukup":"Kritis")
          const statusColor=statusLabel==="Baik"?"FF10B981":(statusLabel==="Cukup"?"FFF59E0B":"FFEF4444")
          
          const row=ws1.addRow([i+1,eq.name,eq.code,eq.region?eq.region.charAt(0).toUpperCase()+eq.region.slice(1):"—",eq.total||"—",eq.normal||"—",eq.perhatian||0,eq.us||0,eq.total>0?eq.avgA.toFixed(1)+"%":"—"])
          row.eachCell((c,ci)=>{
            if(ci===4) applyS(c,{bold:true,size:9,color:{argb:isW?westColor:eastColor},name:"Arial"},isW?westBg.replace("FF",""):eastBg.replace("FF",""),ctr)
            else if(ci===9) applyS(c,{bold:true,color:{argb:statusColor},size:10,name:"Arial"},fill,ctr)
            else if(ci===8) applyS(c,{bold:true,color:{argb:"FFEF4444"},size:10,name:"Arial"},fill,ctr)
            else applyS(c,ci<=1?nF:ci===2?bF:nF,fill,ci<=1?ctr:ci>=5?ctr:lft)
          })
        })
        
        // ── SHEET 2 & 3: West/East Region ──
        const makeRegionSheet=(sheetName,tabColor,regionBranches,regionName,regionColor,regionBg)=>{
          const ws=wb.addWorksheet(sheetName)
          ws.properties.tabColor={argb:tabColor.replace("FF","")}
          ws.addRow(["AIRNAV INDONESIA"]).font={bold:true,size:9,color:{argb:blueAcc},name:"Arial"}
          ws.addRow([regionName.toUpperCase()+" — DETAIL PER CABANG"]).font={bold:true,size:16,color:{argb:navy},name:"Arial"}
          ws.addRow(["Periode: "+periodLabel]).font={size:10,color:{argb:"FF64748B"},name:"Arial"}
          ws.addRow([])
          const hdr=ws.addRow(["No","Code","Cabang/Unit","Kota","Tipe","Traffic","Personel","MO","% Region"])
          hdr.eachCell(c=>applyH(c))
          let no=1
          const regTotal=regionBranches.reduce((a,b)=>{const acc=getAccessible(b.code);return a+logsBy(acc).reduce((s,l)=>s+(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0),0)},0)
          regionBranches.forEach(parent=>{
            const bannerRow=ws.addRow(["",parent.code,parent.name+" ("+parent.city+")","","Cabang Induk","","","",""])
            bannerRow.eachCell(c=>{applyS(c,{bold:true,size:11,color:{argb:white},name:"Arial"},regionColor.replace("FF",""),lft)})
            const accessible=getAccessible(parent.code)
            const pT=trafficBy(accessible);const pTotal=pT.dep+pT.arr+pT.ovf
            const row=ws.addRow([no,parent.code,parent.name,parent.city,"Cabang Induk",(trafficBy([parent.code]).dep+trafficBy([parent.code]).arr+trafficBy([parent.code]).ovf).toLocaleString(),persBy([parent.code]).length,"✓",regTotal>0?(pTotal/regTotal*100).toFixed(1)+"%":"—"])
            row.eachCell((c,ci)=>{applyS(c,ci<=2?{...bF,color:{argb:regionColor}}:nF,regionBg.replace("FF",""),ci===1?ctr:ci>=5?rgt:lft)})
            no++
            const kids=allBr.filter(b=>b.parent_code===parent.code)
            kids.forEach(kid=>{
              const kT=trafficBy([kid.code])
              const fill=no%2===0?lightGray.replace("FF",""):null
              const row=ws.addRow([no,kid.code,"  └ "+kid.name,kid.city,moCodeSet.has(kid.code)?"CB. Pembantu":"Unit",(kT.dep+kT.arr+kT.ovf).toLocaleString(),persBy([kid.code]).length,moCodeSet.has(kid.code)?"✓":"—",""])
              row.eachCell((c,ci)=>{applyS(c,ci===2?{...nF,color:{argb:"FF64748B"}}:nF,fill,ci===1?ctr:ci>=5?rgt:lft)})
              no++
              // grandchildren
              allBr.filter(b=>b.parent_code===kid.code).forEach(gk=>{
                const gT=trafficBy([gk.code])
                const fill2=no%2===0?lightGray.replace("FF",""):null
                const row2=ws.addRow([no,gk.code,"      └ "+gk.name,gk.city,"Unit",(gT.dep+gT.arr+gT.ovf).toLocaleString(),persBy([gk.code]).length,"—",""])
                row2.eachCell((c,ci)=>{applyS(c,nF,fill2,ci===1?ctr:ci>=5?rgt:lft)})
                no++
              })
            })
          })
          ws.columns=[{width:5},{width:8},{width:28},{width:16},{width:14},{width:14},{width:10},{width:8},{width:10}]
        }
        makeRegionSheet("West Region",westColor,westTop,"West Region",westColor,westBg)
        makeRegionSheet("East Region",eastColor,eastTop,"East Region",eastColor,eastBg)
        
        // ── SHEET 4: Top Personel ──
        const ws4=wb.addWorksheet("Top Personel")
        ws4.properties.tabColor={argb:"10B981"}
        ws4.addRow(["TOP PERSONEL NASIONAL — JAM KERJA"]).font={bold:true,size:16,color:{argb:navy},name:"Arial"}
        ws4.addRow(["Periode: "+periodLabel]).font={size:10,color:{argb:"FF64748B"},name:"Arial"}
        ws4.addRow([])
        const h4=ws4.addRow(["Rank","Nama","Lokasi","Region","On Mic","Total Jam","DEP","ARR","OVF"])
        h4.eachCell(c=>applyH(c))
        const allPersStats=persStats(allCodes)
        allPersStats.slice(0,30).forEach((p,i)=>{
          const br2=allBr.find(b=>b.code===p.branch)
          const isW=br2&&br2.region==="west"
          const row=ws4.addRow(["#"+(i+1),p.name,p.branch,br2?br2.region:"—",p.count+"x",Math.round(p.totalMin/60*10)/10,p.dep,p.arr,p.ovf])
          row.eachCell((c,ci)=>{
            const fill=i%2===0?lightGray.replace("FF",""):null
            if(ci===4)applyS(c,{bold:true,size:9,color:{argb:isW?westColor:eastColor},name:"Arial"},isW?westBg.replace("FF",""):eastBg.replace("FF",""),ctr)
            else if(ci===6)applyS(c,{...bF,color:{argb:blueAcc}},fill,rgt)
            else applyS(c,nF,fill,ci<=1?ctr:ci>=5?rgt:lft)
          })
        })
        ws4.columns=[{width:6},{width:28},{width:8},{width:8},{width:10},{width:12},{width:10},{width:10},{width:10}]
        
        // ── SHEET 5: Insiden ──
        const ws5=wb.addWorksheet("Insiden Nasional")
        ws5.properties.tabColor={argb:"EF4444"}
        ws5.addRow(["LAPORAN INSIDEN NASIONAL"]).font={bold:true,size:16,color:{argb:navy},name:"Arial"}
        ws5.addRow(["Periode: "+periodLabel]).font={size:10,color:{argb:"FF64748B"},name:"Arial"}
        ws5.addRow([])
        const h5=ws5.addRow(["No","Tanggal","Lokasi","Kota","Region","Jenis","Durasi","Tindak Lanjut"])
        h5.eachCell(c=>applyH(c))
        // Note: incidents would come from daily_reports/incident_reports table
        // For now placeholder
        ws5.addRow(["","Belum ada data insiden untuk periode ini"])
        ws5.columns=[{width:5},{width:16},{width:8},{width:14},{width:8},{width:28},{width:10},{width:35}]
        
        // ── SHEET 6-33: Per MO Location ──
        const moLocations=[...westTop,...eastTop]
        // Also add MO locations that are children (Halim, Batam, Padang, Semarang, etc)
        const allMoLocs=allBr.filter(b=>moCodeSet.has(b.code)).sort((a,b)=>{
          if(a.region!==b.region) return a.region==="west"?-1:1
          return a.code.localeCompare(b.code)
        })
        
        allMoLocs.forEach(moLoc=>{
          const accessible=getAccessible(moLoc.code)
          const accessibleBranches=allBr.filter(b=>accessible.includes(b.code))
          const isWest=moLoc.region==="west"
          const tabCol=isWest?westColor:eastColor
          const sheetName=(moLoc.code+" "+moLoc.city).substring(0,31)
          const ws=wb.addWorksheet(sheetName)
          ws.properties.tabColor={argb:tabCol.replace("FF","")}
          
          // Title
          ws.addRow(["AIRNAV INDONESIA"]).font={bold:true,size:9,color:{argb:blueAcc},name:"Arial"}
          ws.addRow(["LAPORAN BULANAN — "+moLoc.name.toUpperCase()+" ("+moLoc.code+")"]).font={bold:true,size:16,color:{argb:navy},name:"Arial"}
          const childNames=accessibleBranches.filter(b=>b.code!==moLoc.code).map(b=>b.name+" ("+b.code+")")
          const subLine=(isWest?"West":"East")+" Region  |  Periode: "+periodLabel+(childNames.length?"  |  Membawahi: "+childNames.join(", "):"")
          ws.addRow([subLine]).font={size:10,color:{argb:"FF64748B"},name:"Arial"}
          ws.addRow([])
          
          // Per location sections
          accessibleBranches.forEach((loc,li)=>{
            const isParent=loc.code===moLoc.code
            const bannerText=isParent?("■  "+loc.code+" — "+loc.name+"  ("+loc.city+")"):("└  "+loc.code+" — "+loc.name+"  ("+loc.city+")  —  dibawahi "+moLoc.name)
            const bannerColor=isParent?parentColor:(li%2===0?"FF6B7280":"FF6B7280")
            const bannerRow=ws.addRow([bannerText])
            ws.mergeCells(bannerRow.number,1,bannerRow.number,10)
            bannerRow.eachCell(c=>{applyS(c,{bold:true,size:12,color:{argb:white},name:"Arial"},isParent?parentColor.replace("FF",""):"6B7280",lft)})
            bannerRow.height=26
            
            // Traffic summary
            const locT=trafficBy([loc.code])
            const locTotal=locT.dep+locT.arr+locT.ovf
            const daily=dailyBy(loc.code)
            const avg=daily.length>0?Math.round(locTotal/daily.length):0
            
            const mRow=ws.addRow(["","Total DEP","","Total ARR","","Total OVF","","Total Traffic","","Avg/Hari"])
            mRow.eachCell(c=>{applyS(c,{size:9,color:{argb:"FF64748B"},name:"Arial"},lightBlue.replace("FF",""),ctr)})
            const vRow=ws.addRow(["",(locT.dep).toLocaleString(),"",(locT.arr).toLocaleString(),"",(locT.ovf).toLocaleString(),"",(locTotal).toLocaleString(),"",avg.toLocaleString()])
            vRow.eachCell(c=>{applyS(c,{bold:true,size:14,color:{argb:navy},name:"Arial"},lightBlue.replace("FF",""),ctr)})
            vRow.height=24
            
            // Traffic harian
            const subRow=ws.addRow(["Traffic Harian — "+loc.name])
            ws.mergeCells(subRow.number,1,subRow.number,10)
            subRow.eachCell(c=>{applyS(c,{bold:true,size:10,color:{argb:isParent?parentColor:("FF6B7280")},name:"Arial"},isParent?parentBg.replace("FF",""):childBg.replace("FF",""),lft)})
            
            const dH=ws.addRow(["Tanggal","","DEP","ARR","OVF","Total","","","",""])
            dH.eachCell(c=>applyH(c))
            
            daily.forEach((d,di)=>{
              const dt=d[0],v=d[1],tot=v.dep+v.arr+v.ovf
              const fill=di%2===0?lightGray.replace("FF",""):null
              const row=ws.addRow([dt,"",v.dep,v.arr,v.ovf,tot,"","","",""])
              row.eachCell((c,ci)=>{applyS(c,ci===6?bF:nF,fill,ci<=2?ctr:rgt)})
            })
            
            // Personel
            const locPers=persStats([loc.code])
            const pSubRow=ws.addRow(["Rekap Personel — "+loc.name+"  ("+persBy([loc.code]).length+" orang)"])
            ws.mergeCells(pSubRow.number,1,pSubRow.number,10)
            pSubRow.eachCell(c=>{applyS(c,{bold:true,size:10,color:{argb:isParent?parentColor:("FF6B7280")},name:"Arial"},isParent?parentBg.replace("FF",""):childBg.replace("FF",""),lft)})
            
            const pH=ws.addRow(["No","Nama","","On Mic","Total Jam","DEP","ARR","OVF","Total Traffic","Avg mnt/Sesi"])
            pH.eachCell(c=>applyH(c))
            
            locPers.forEach((p,pi)=>{
              const fill=pi%2===0?lightGray.replace("FF",""):null
              const jam=Math.round(p.totalMin/60*10)/10
              const avgM=p.count>0?Math.round(p.totalMin/p.count):0
              const row=ws.addRow([pi+1,p.name,"",p.count+"x",jam,p.dep,p.arr,p.ovf,p.dep+p.arr+p.ovf,avgM+" mnt"])
              row.eachCell((c,ci)=>{applyS(c,ci===2?bF:ci===5?{...bF,color:{argb:blueAcc}}:nF,fill,ci<=1?ctr:ci>=4?rgt:lft)})
            })
            
            // Equipment section
            renderEquipSection(ws,loc.code,loc.name,isParent)
            
            ws.addRow([]) // gap
          })
          
          // ── Summary gabungan ──
          if(accessibleBranches.length>1){
            const sumRow=ws.addRow(["★  TOTAL GABUNGAN — "+moLoc.name+" + Bawahan"])
            ws.mergeCells(sumRow.number,1,sumRow.number,10)
            sumRow.eachCell(c=>{applyS(c,{bold:true,size:12,color:{argb:white},name:"Arial"},summaryColor.replace("FF",""),lft)})
            sumRow.height=26
            
            const sH=ws.addRow(["Lokasi","Code","Tipe","Personel","Total DEP","Total ARR","Total OVF","Total Traffic","% Share","On Mic"])
            sH.eachCell(c=>applyH(c))
            
            let grandTotal=0
            const locSums=accessibleBranches.map(b=>{const t=trafficBy([b.code]);const tot=t.dep+t.arr+t.ovf;grandTotal+=tot;return{...b,dep:t.dep,arr:t.arr,ovf:t.ovf,total:tot,onMic:t.onMic,pers:persBy([b.code]).length}})
            
            locSums.forEach((ls,i)=>{
              const isP=ls.code===moLoc.code
              const fill=isP?parentBg.replace("FF",""):(i%2===0?lightGray.replace("FF",""):null)
              const prefix=isP?"■ ":"└ "
              const row=ws.addRow([prefix+ls.name,ls.code,isP?"Cabang Induk":"Bawahan",ls.pers,ls.dep.toLocaleString(),ls.arr.toLocaleString(),ls.ovf.toLocaleString(),ls.total.toLocaleString(),grandTotal>0?(ls.total/grandTotal*100).toFixed(1)+"%":"—",ls.onMic+"x"])
              row.eachCell((c,ci)=>{applyS(c,isP&&ci<=3?bF:nF,fill,ci<=1?lft:ci>=4?rgt:ctr)})
            })
            
            // Grand total
            const gRow=ws.addRow(["TOTAL GABUNGAN","",locSums.length+" lokasi",locSums.reduce((a,l)=>a+l.pers,0),locSums.reduce((a,l)=>a+l.dep,0).toLocaleString(),locSums.reduce((a,l)=>a+l.arr,0).toLocaleString(),locSums.reduce((a,l)=>a+l.ovf,0).toLocaleString(),grandTotal.toLocaleString(),"100%",locSums.reduce((a,l)=>a+l.onMic,0)+"x"])
            gRow.eachCell(c=>{applyS(c,{bold:true,size:10,color:{argb:white},name:"Arial"},navy.replace("FF",""),ctr)})
          }
          
          ws.columns=[{width:16},{width:26},{width:2},{width:10},{width:12},{width:10},{width:10},{width:10},{width:12},{width:12}]
        })
      }

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
      const a = document.createElement("a"); a.href=URL.createObjectURL(blob)
      a.download = `${reportType}_${br}_${new Date().toISOString().slice(0,10)}.xlsx`
      a.click(); URL.revokeObjectURL(a.href)
      logAudit("EXPORT_EXCEL",reportType+" — "+brLabel+" — "+periodLabel,ctx.user)
    } catch(e) { alert("Error export Excel: "+e.message) }
    setExporting(false)
  }

  // ── PDF Export ──
  const exportPDF = async () => {
    if(!window.jspdf) { alert("Library belum dimuat"); return }
    setExporting(true)
    try {
      const { jsPDF } = window.jspdf
      const doc = new jsPDF({orientation:"landscape",unit:"mm",format:"a4"})
      const pageW = doc.internal.pageSize.getWidth()
      
      // Header
      doc.setFontSize(16); doc.setFont(undefined,"bold"); doc.setTextColor(30,58,95)
      doc.text("ATC LOG POSITION — AIRNAV INDONESIA", pageW/2, 15, {align:"center"})
      doc.setFontSize(12); doc.setFont(undefined,"normal"); doc.setTextColor(80,80,80)
      const reportLabel = REPORTS.find(r=>r.id===reportType)?.label || reportType
      doc.text(reportLabel+" — "+brLabel, pageW/2, 22, {align:"center"})
      doc.text(periodLabel+(shift!=="ALL"?" — Shift "+shift:""), pageW/2, 28, {align:"center"})
      doc.setDrawColor(30,58,95); doc.setLineWidth(0.5); doc.line(14, 31, pageW-14, 31)

      if (reportType==="log_position") {
        const data = getLogData()
        doc.autoTable({
          startY:35, head:[["Cabang","Tanggal","Nama","Unit","Sektor","CWP","Shift","On","Off","Durasi","DEP","ARR","OVF"]],
          body: data.map(l => [l.branch_code,fmtD(l.on_time),l.atc_name,l.unit,l.sector,l.cwp,l.shift,fmtT(l.on_time),l.off_time?fmtT(l.off_time):"-",l.off_time?durMin(l.on_time,l.off_time)+"m":"-",l.departure_count||0,l.arrival_count||0,l.overfly_count||0]),
          styles:{fontSize:7,cellPadding:1.5},headStyles:{fillColor:[30,58,95],textColor:255,fontSize:7},alternateRowStyles:{fillColor:[245,247,250]},
        })
      }
      if (reportType==="rekap_traffic") {
        const data = getTrafficData()
        doc.autoTable({
          startY:35, head:[["Cabang","Tanggal","On–Off","Controller","Unit","Sektor","Shift","DEP","ARR","OVF","Total"]],
          body: data.map(l => [l.branch_code,fmtD(l.on_time),fmtT(l.on_time)+"–"+fmtT(l.off_time),l.atc_name,l.unit,l.sector,l.shift,l.departure_count||0,l.arrival_count||0,l.overfly_count||0,(l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)]),
          styles:{fontSize:7,cellPadding:1.5},headStyles:{fillColor:[30,58,95],textColor:255,fontSize:7},alternateRowStyles:{fillColor:[245,247,250]},
        })
      }
      if (reportType==="handover_checklist") {
        const data = getChecklistData()
        doc.autoTable({
          startY:35, head:[["Tanggal","Waktu","Shift","MOD","Traffic","Conflict","Weather","Facilities","Coord","Others","In","Out"]],
          body: data.map(c => [c.checklist_date,c.checklist_time,c.shift,c.manager_on_duty,...CHECKLIST_ITEMS.map(it=>c[it.key+"_status"]),c.incoming_personnel,c.outgoing_personnel]),
          styles:{fontSize:7,cellPadding:1.5},headStyles:{fillColor:[30,58,95],textColor:255,fontSize:7},alternateRowStyles:{fillColor:[245,247,250]},
        })
      }
      if (reportType==="handover_notes") {
        const data = getNotesData()
        doc.autoTable({
          startY:35, head:[["Cabang","Tanggal","Shift","Prioritas","Catatan","Penulis"]],
          body: data.map(n => [n.branch_code,fmtDT(n.created_at),n.from_shift+"→"+n.to_shift,n.priority,n.content,n.author_name]),
          styles:{fontSize:7,cellPadding:1.5},headStyles:{fillColor:[30,58,95],textColor:255,fontSize:7},alternateRowStyles:{fillColor:[245,247,250]},
          columnStyles:{4:{cellWidth:80}},
        })
      }
      if (reportType==="daily_summary") {
        const data = getLogData()
        const byDate = {}
        data.forEach(l => {
          const dt=new Date(l.on_time).toISOString().slice(0,10)
          if(!byDate[dt]) byDate[dt]={logs:0,on:0,off:0,dep:0,arr:0,ovf:0,br:new Set(),ppl:new Set()}
          byDate[dt].logs++;if(l.off_time){byDate[dt].off++;byDate[dt].dep+=l.departure_count||0;byDate[dt].arr+=l.arrival_count||0;byDate[dt].ovf+=l.overfly_count||0}else byDate[dt].on++
          byDate[dt].br.add(l.branch_code);byDate[dt].ppl.add(l.atc_name)
        })
        doc.autoTable({
          startY:35, head:[["Tanggal","Log","On","Off","Cabang","Personel","DEP","ARR","OVF","Traffic"]],
          body: Object.keys(byDate).sort().reverse().map(dt=>{const d=byDate[dt];return[dt,d.logs,d.on,d.off,d.br.size,d.ppl.size,d.dep,d.arr,d.ovf,d.dep+d.arr+d.ovf]}),
          styles:{fontSize:8,cellPadding:2},headStyles:{fillColor:[30,58,95],textColor:255,fontSize:8},alternateRowStyles:{fillColor:[245,247,250]},
        })
      }
      if (reportType==="personnel_stats") {
        const data = getLogData().filter(l=>l.off_time)
        const byP = {}
        data.forEach(l => {
          const k=l.atc_name+"||"+l.branch_code
          if(!byP[k]) byP[k]={name:l.atc_name,br:l.branch_code,n:0,min:0,dep:0,arr:0,ovf:0}
          byP[k].n++;byP[k].min+=durMin(l.on_time,l.off_time);byP[k].dep+=l.departure_count||0;byP[k].arr+=l.arrival_count||0;byP[k].ovf+=l.overfly_count||0
        })
        doc.autoTable({
          startY:35, head:[["Nama","Cabang","On Mic","Total Jam","Rata² (mnt)","DEP","ARR","OVF","Traffic"]],
          body: Object.values(byP).sort((a,b)=>b.min-a.min).map(p=>[p.name,p.br,p.n,(p.min/60).toFixed(1)+" jam",p.n?Math.round(p.min/p.n):0,p.dep,p.arr,p.ovf,p.dep+p.arr+p.ovf]),
          styles:{fontSize:7,cellPadding:1.5},headStyles:{fillColor:[30,58,95],textColor:255,fontSize:7},alternateRowStyles:{fillColor:[245,247,250]},
        })
      }

      // Footer
      const pageCount = doc.internal.getNumberOfPages()
      for(let i=1;i<=pageCount;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(150);doc.text("Dicetak: "+new Date().toLocaleString("id-ID")+" — ATC Log Position Airnav Indonesia",14,doc.internal.pageSize.getHeight()-8);doc.text("Hal "+i+"/"+pageCount,pageW-14,doc.internal.pageSize.getHeight()-8,{align:"right"})}

      doc.save(`${reportType}_${br}_${new Date().toISOString().slice(0,10)}.pdf`)
      logAudit("EXPORT_PDF",reportType+" — "+brLabel+" — "+periodLabel,ctx.user)
    } catch(e) { alert("Error export PDF: "+e.message) }
    setExporting(false)
  }

  // ── Count preview ──
  const previewCount = () => {
    if(reportType==="log_position"||reportType==="daily_summary"||reportType==="personnel_stats") return getLogData().length+" log"
    if(reportType==="rekap_traffic") return getTrafficData().length+" laporan traffic"
    if(reportType==="handover_checklist") return getChecklistData().length+" checklist"
    if(reportType==="handover_notes") return getNotesData().length+" catatan"
    return ""
  }

  return (
    <div className="page-content">
      <Header title="Export Laporan" sub="Download Excel atau PDF"/>

      {/* Report Type Selection */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="log" s={16}/> Pilih Jenis Laporan</h2></div>
        <div className="panel-body">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
            {REPORTS.map(r => (
              <div key={r.id} onClick={() => setReportType(r.id)} style={{
                padding:"14px 16px",borderRadius:10,cursor:"pointer",transition:"all .2s",
                border:reportType===r.id?"2px solid #2563eb":"1.5px solid var(--border)",
                background:reportType===r.id?"rgba(37,99,235,0.06)":"var(--card)",
              }}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <I n={r.icon} s={16}/>
                  <span style={{fontWeight:700,fontSize:13,color:reportType===r.id?"#2563eb":"var(--fg)"}}>{r.label}</span>
                </div>
                <div style={{fontSize:11,color:"var(--fg-muted)"}}>{r.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="eye" s={16}/> Filter</h2></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field">
              <label>Cabang</label>
              <select value={br} onChange={e => setBr(e.target.value)}>
                <option value="ALL">Semua Cabang</option>
                {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Mode Filter</label>
              <select value={filterMode} onChange={e => setFilterMode(e.target.value)}>
                <option value="period">Periode</option>
                <option value="range">Rentang Tanggal</option>
              </select>
            </div>
            {filterMode==="period" ? (
              <div className="field">
                <label>Periode</label>
                <select value={period} onChange={e => setPeriod(e.target.value)}>
                  <option value="today">Hari Ini</option>
                  <option value="week">7 Hari Terakhir</option>
                  <option value="month">30 Hari Terakhir</option>
                </select>
              </div>
            ) : (<>
              <div className="field"><label>Dari Tanggal</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/></div>
              <div className="field"><label>Sampai Tanggal</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/></div>
            </>)}
            <div className="field">
              <label>Shift</label>
              <select value={shift} onChange={e => setShift(e.target.value)}>
                <option value="ALL">Semua Shift</option>
                {SHIFTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Preview count */}
          <div style={{marginTop:16,padding:"12px 16px",background:"var(--bg)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div>
              <span style={{fontSize:12,color:"var(--fg-muted)"}}>Data ditemukan: </span>
              <strong style={{color:"var(--fg)"}}>{previewCount()}</strong>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button className="btn btn-primary" onClick={exportExcel} disabled={exporting||!libsLoaded} style={{display:"flex",alignItems:"center",gap:6}}>
                <I n="download" s={14}/> {exporting?"Mengexport...":"Export Excel"}
              </button>
              <button className="btn btn-primary" onClick={exportPDF} disabled={exporting||!libsLoaded} style={{display:"flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#dc2626,#b91c1c)"}}>
                <I n="download" s={14}/> {exporting?"Mengexport...":"Export PDF"}
              </button>
            </div>
          </div>
          {!libsLoaded && <div style={{fontSize:11,color:"var(--fg-muted)",marginTop:8}}>Memuat library export...</div>}
        </div>
      </div>
    </div>
  )
}
const AdminAudit = () => {
  const ctx = useApp()
  const [auditLogs,setAuditLogs] = useState([])
  const [loading,setLoading] = useState(true)
  const [br,setBr] = useState("ALL")
  const [actionFilter,setActionFilter] = useState("ALL")
  const [dateFilter,setDateFilter] = useState("")
  const [search,setSearch] = useState("")
  const [limit,setLimit] = useState(100)

  const fetchLogs = async () => {
    setLoading(true)
    let q = supabase.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(limit)
    if(br!=="ALL") q = q.eq("branch_code",br)
    if(actionFilter!=="ALL") q = q.eq("action",actionFilter)
    if(dateFilter) q = q.gte("created_at",dateFilter+"T00:00:00").lte("created_at",dateFilter+"T23:59:59")
    const {data} = await q
    if(data) setAuditLogs(data)
    setLoading(false)
  }

  useEffect(() => { fetchLogs() },[br,actionFilter,dateFilter,limit])

  const filtered = auditLogs.filter(l => {
    if(!search) return true
    const s = search.toLowerCase()
    return (l.user_name||"").toLowerCase().includes(s) || (l.detail||"").toLowerCase().includes(s) || (l.action||"").toLowerCase().includes(s)
  })

  const ACTION_COLORS = {
    LOGIN:{bg:"#dcfce7",fg:"#166534",icon:"🔓"},
    LOGOUT:{bg:"#f1f5f9",fg:"#475569",icon:"🔒"},
    ON_MIC:{bg:"#dbeafe",fg:"#1e40af",icon:"🎙️"},
    OFF_MIC:{bg:"#fef3c7",fg:"#92400e",icon:"🔇"},
    CHECKLIST_CREATE:{bg:"#f0fdf4",fg:"#166534",icon:"📋"},
    CHECKLIST_DELETE:{bg:"#fef2f2",fg:"#991b1b",icon:"🗑️"},
    NOTE_CREATE:{bg:"#eff6ff",fg:"#1d4ed8",icon:"📝"},
    MO_CHECKLIST:{bg:"#f5f3ff",fg:"#5b21b6",icon:"🛡️"},
    DAILY_REPORT_SUBMIT:{bg:"#ecfdf5",fg:"#065f46",icon:"📑"},
    EXPORT_EXCEL:{bg:"#f0fdf4",fg:"#166534",icon:"📊"},
    EXPORT_PDF:{bg:"#fef2f2",fg:"#991b1b",icon:"📄"},
  }

  const ALL_ACTIONS = ["LOGIN","LOGOUT","ON_MIC","OFF_MIC","CHECKLIST_CREATE","CHECKLIST_DELETE","NOTE_CREATE","MO_CHECKLIST","DAILY_REPORT_SUBMIT","EXPORT_EXCEL","EXPORT_PDF"]

  return (
    <div className="page-content">
      <Header title="Audit Log" sub="Aktivitas seluruh sistem"/>

      {/* Filters */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="shield" s={12}/> AUDIT</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          <option value="ADMIN">Admin</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
        <select className="br-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
          <option value="ALL">Semua Aktivitas</option>
          {ALL_ACTIONS.map(a => <option key={a} value={a}>{(ACTION_COLORS[a]?.icon||"📌")+" "+a}</option>)}
        </select>
        <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="br-select"/>
        {dateFilter && <button className="btn btn-ghost btn-sm" onClick={() => setDateFilter("")}>✕</button>}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama/detail..." style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12,minWidth:140}}/>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <Stat icon="shield" label="Total Log" value={filtered.length} color="#8b5cf6"/>
        <Stat icon="log" label="Login" value={filtered.filter(l=>l.action==="LOGIN").length} color="#10b981"/>
        <Stat icon="mic" label="On Mic" value={filtered.filter(l=>l.action==="ON_MIC").length} color="#2563eb"/>
        <Stat icon="checklist" label="Checklist" value={filtered.filter(l=>l.action==="CHECKLIST_CREATE"||l.action==="MO_CHECKLIST").length} color="#f59e0b"/>
        <Stat icon="note" label="Daily Report" value={filtered.filter(l=>l.action==="DAILY_REPORT_SUBMIT").length} color="#059669"/>
        <Stat icon="download" label="Export" value={filtered.filter(l=>l.action==="EXPORT_EXCEL"||l.action==="EXPORT_PDF").length} color="#dc2626"/>
      </div>

      {/* Log list */}
      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">Riwayat Aktivitas</h2>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span className="panel-counter">{filtered.length}</span>
            <select value={limit} onChange={e => setLimit(+e.target.value)} style={{padding:"4px 8px",borderRadius:6,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:11}}>
              <option value={50}>50</option><option value={100}>100</option><option value={200}>200</option><option value={500}>500</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={fetchLogs} style={{fontSize:11}}>↻ Refresh</button>
          </div>
        </div>
        <div className="panel-body">
          {loading ? <div className="empty-state"><span className="login-spinner"/></div> :
          filtered.length===0 ? <div className="empty-state"><I n="shield" s={44}/><p>Belum ada log aktivitas</p></div> :
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {filtered.map(l => {
              const ac = ACTION_COLORS[l.action] || {bg:"#f1f5f9",fg:"#475569",icon:"📌"}
              return (
                <div key={l.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",borderRadius:8,background:"var(--card)",borderBottom:"1px solid var(--border)"}}>
                  <span style={{fontSize:16,lineHeight:1,marginTop:2}}>{ac.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:2}}>
                      <span style={{display:"inline-block",padding:"1px 8px",borderRadius:8,fontSize:10,fontWeight:700,background:ac.bg,color:ac.fg}}>{l.action}</span>
                      <span style={{fontSize:12,fontWeight:600,color:"var(--fg)"}}>{l.user_name}</span>
                      {l.branch_code && l.branch_code!=="-" && <span style={{fontSize:10,color:"var(--fg-muted)",background:"var(--bg)",padding:"1px 6px",borderRadius:6}}>{l.branch_code}</span>}
                    </div>
                    {l.detail && <div style={{fontSize:11,color:"var(--fg-muted)",whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{l.detail}</div>}
                  </div>
                  <div style={{fontSize:10,color:"var(--fg-muted)",whiteSpace:"nowrap",textAlign:"right"}}>
                    <div>{new Date(l.created_at).toLocaleDateString("id-ID",{day:"2-digit",month:"short"})}</div>
                    <div>{new Date(l.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}</div>
                  </div>
                </div>
              )
            })}
          </div>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [session,setSession] = useState(null)
  const [user,setUser] = useState(null)
  const [page,setPage] = useState("dashboard")
  const [col,setCol] = useState(false)
  const [loading,setLoading] = useState(true)
  const [navBranch,setNavBranch] = useState(null) // for dashboard→mon_log navigation

  const [branches,setBranches] = useState([])
  const [sectors,setSectors] = useState([])
  const [logs,setLogs] = useState([])
  const [handovers,setHandovers] = useState([])
  const [handoverChecklists,setHandoverChecklists] = useState([])
  const [personnel,setPersonnel] = useState([])
  const [moBranchCodes,setMoBranchCodes] = useState([])

  // Check existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) { setSession(s); loadProfile(s) }
      else setLoading(false)
    })
  }, [])

  const loadProfile = async (s) => {
    const { data, error } = await supabase.from("accounts").select("*").eq("id", s.user.id).single()
    if (data) { setUser(data); setSession(s); logAudit("LOGIN","Masuk ke sistem",data) }
    else { alert("Akun tidak ditemukan di tabel accounts"); await supabase.auth.signOut() }
    setLoading(false)
  }

  const fetchAllPersonnel = async () => {
    let all = [], from = 0, batchSize = 1000
    while (true) {
      const { data } = await supabase.from("personnel").select("id,name,branch_code").eq("is_active",true).order("name").range(from, from + batchSize - 1)
      if (!data || data.length === 0) break
      all = all.concat(data)
      if (data.length < batchSize) break
      from += batchSize
    }
    return all
  }

  const loadData = async () => {
    const [brRes, secRes, logRes, hoRes, hcRes] = await Promise.all([
      supabase.from("branches").select("*").order("code"),
      supabase.from("sectors").select("*").order("sort_order"),
      supabase.from("position_logs").select("*").order("on_time",{ascending:false}).limit(500),
      supabase.from("handover_notes").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("handover_checklists").select("*").order("created_at",{ascending:false}).limit(200),
    ])
    const allPersonnel = await fetchAllPersonnel()
    // Fetch unique branch_codes that have MO accounts
    const {data: moData} = await supabase.from("accounts").select("branch_code").like("username","mo_%")
    const uniqueMoCodes = [...new Set((moData||[]).map(a => a.branch_code))]
    setMoBranchCodes(uniqueMoCodes)
    if (brRes.data) setBranches(brRes.data)
    if (secRes.data) setSectors(secRes.data)
    if (logRes.data) setLogs(logRes.data)
    if (hoRes.data) setHandovers(hoRes.data)
    if (hcRes.data) setHandoverChecklists(hcRes.data)
    if (allPersonnel.length) setPersonnel(allPersonnel)
  }

  // Load data + auto refresh
  useEffect(() => {
    if (!user) return
    loadData()
    const i = setInterval(loadData, 30000)
    return () => clearInterval(i)
  }, [user])

  const handleLogin = async (s) => {
    setSession(s)
    setLoading(true)
    await loadProfile(s)
  }

  const handleLogout = async () => {
    logAudit("LOGOUT","Keluar dari sistem",user)
    await supabase.auth.signOut()
    setSession(null); setUser(null); setPage("dashboard")
    setBranches([]); setSectors([]); setLogs([]); setHandovers([]); setHandoverChecklists([]); setPersonnel([])
  }

  if (loading) return <div className="loading-screen"><RadarLogo size={56}/><p>Memuat...</p><span className="login-spinner"/></div>
  if (!session) return <Login onLogin={handleLogin}/>
  if (!user) return <div className="loading-screen"><RadarLogo size={56}/><p>Memuat profil...</p><span className="login-spinner"/></div>

  const pageMap = user.role === "admin"
    ? {dashboard:AdminDash,mon_log:AdminMonLog,mon_recap:AdminMonRecap,mon_personnel:AdminMonPersonnel,mon_handover:AdminMonHandover,mon_ho_to_mo:AdminMonHoToMo,mon_reports:AdminReportMonitoring,export:AdminExport,audit:AdminAudit}
    : {dashboard:CabangDash,log:CabangLog,rekap_personnel:CabangRekapPersonnel,rekap:CabangRekap,handover:CabangHandover,ho_to_mo:CabangHoToMo,reports:Reports}
  const CurrentPage = pageMap[page] || pageMap.dashboard

  return (
    <AppContext.Provider value={{user,branches,sectors,logs,handovers,handoverChecklists,personnel,moBranchCodes,navBranch,setNavBranch,goPage:setPage,reload:loadData}}>
      <div className="app-layout">
        <Sidebar page={page} go={setPage} user={user} logout={handleLogout} col={col} toggle={() => setCol(!col)}/>
        <main className="main-area"><CurrentPage/></main>
      </div>
    </AppContext.Provider>
  )
}
