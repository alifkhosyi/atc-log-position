import { useState, useEffect, useRef, createContext, useContext } from "react"
import { supabase } from "./supabase.js"

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

// Audit log helper — fire and forget, never blocks UI
const logAudit = (action, detail="", user=null) => {
  try {
    supabase.from("audit_logs").insert({
      user_id: user?.id || null,
      username: user?.display_name || user?.username || "-",
      branch_code: user?.branch_code || (user?.role==="admin"?"ADMIN":"-"),
      action,
      detail: typeof detail === "object" ? JSON.stringify(detail) : String(detail),
    }).then()
  } catch(e) { /* silent */ }
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
  calendar:"M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z",
  swap:"M7 16V4m0 0L3 8m4-4 4 4M17 8v12m0 0 4-4m-4 4-4-4",
  magic:"M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6L12 2z",
  refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  warn:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01",
  copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2ZM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1",
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
  const [monOpen,setMonOpen] = useState(true)
  const MON_SUB = ["mon_roster","mon_log","mon_today"]
  const adminItems = [
    {id:"dashboard",label:"Dashboard",icon:"dashboard"},
    {id:"mon_branch",label:"Monitoring Cabang",icon:"monitor",sub:[
      {id:"mon_roster",label:"Roster",icon:"calendar"},
      {id:"mon_log",label:"Log Position",icon:"mic"},
      {id:"mon_today",label:"Log Hari Ini",icon:"log"},
    ]},
    {id:"roster_gen",label:"Generate Roster",icon:"magic"},
    {id:"mon_recap",label:"Monitoring Rekap Traffic",icon:"chart"},
    {id:"mon_handover",label:"Monitoring Handover/Takeover",icon:"checklist"},
    {id:"export",label:"Export Laporan",icon:"download"},
    {id:"audit",label:"Audit Log",icon:"shield"},
  ]
  const cabangItems = [
    {id:"dashboard",label:"Dashboard",icon:"dashboard"},
    {id:"roster",label:"Roster",icon:"calendar"},
    {id:"roster_gen",label:"Generate Roster",icon:"magic"},
    {id:"log",label:"Log Position",icon:"mic"},
    {id:"rekap",label:"Rekap Traffic",icon:"chart"},
    {id:"handover",label:"Handover/Takeover",icon:"checklist"},
  ]
  const items = user.role === "admin" ? adminItems : cabangItems
  const isMonSub = MON_SUB.includes(page)

  return (
    <aside className={"sidebar"+(col?" sidebar-collapsed":"")}>
      <div className="sidebar-header">
        {!col && <div className="sidebar-brand"><RadarLogo size={28}/><div><div className="sidebar-brand-title">ATC LOG</div><div className="sidebar-brand-sub">AIRNAV INDONESIA</div></div></div>}
        <button className="sidebar-toggle" onClick={toggle}><I n="menu" s={18}/></button>
      </div>
      <nav className="sidebar-nav">
        {!col && <div className="sidebar-section">{user.role==="admin"?"Admin Pusat":"Cabang "+user.branch_code}</div>}
        {items.map(it => {
          if (it.sub) {
            const parentActive = isMonSub
            return (
              <div key={it.id}>
                <button
                  className={"sidebar-item"+(parentActive?" sidebar-item-active":"")}
                  onClick={() => { if(col){ go(it.sub[0].id) } else { setMonOpen(o=>!o); if(!isMonSub) go(it.sub[0].id) } }}
                  title={col?it.label:undefined}
                >
                  <I n={it.icon} s={17}/>
                  {!col && <><span style={{flex:1,textAlign:"left"}}>{it.label}</span><span style={{fontSize:9,opacity:.5,display:"inline-block",transform:monOpen?"rotate(90deg)":"rotate(0deg)",transition:"transform .2s"}}>▶</span></>}
                </button>
                {!col && monOpen && it.sub.map(sub => (
                  <button key={sub.id} className={"sidebar-item"+(page===sub.id?" sidebar-item-active":"")} onClick={() => go(sub.id)} style={{paddingLeft:34,fontSize:12}}>
                    <I n={sub.icon} s={14}/><span>{sub.label}</span>
                  </button>
                ))}
              </div>
            )
          }
          return <button key={it.id} className={"sidebar-item"+(page===it.id?" sidebar-item-active":"")} onClick={() => go(it.id)} title={col?it.label:undefined}><I n={it.icon} s={17}/>{!col && <span>{it.label}</span>}</button>
        })}
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
  const active = ctx.logs.filter(l => !l.off_time)
  const today = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
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
// SHIFT CONFIG
// ============================================================
const SHIFT_CONFIG = {
  Pagi:   {start:7,  end:15, label:"Pagi",   color:"#f59e0b", bg:"#fffbeb", hours:"07:00–15:00"},
  Siang:  {start:15, end:23, label:"Siang",  color:"#0284C7", bg:"#eff6ff", hours:"15:00–23:00"},
  Malam:  {start:23, end:7,  label:"Malam",  color:"#8b5cf6", bg:"#f5f3ff", hours:"23:00–07:00"},
}
const SHIFT_NAMES = ["Pagi","Siang","Malam"]

const getShiftNow = () => {
  const h = new Date().getHours()
  if (h >= 7 && h < 15) return "Pagi"
  if (h >= 15 && h < 23) return "Siang"
  return "Malam"
}

const ShiftBadge = ({shift,small}) => {
  const c = SHIFT_CONFIG[shift]||{color:"#64748b",bg:"#f1f5f9",label:shift,hours:""}
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:small?"2px 8px":"3px 10px",borderRadius:20,fontSize:small?10:11,fontWeight:700,background:c.bg,color:c.color,border:`1px solid ${c.color}33`}}>{c.label}{!small&&<span style={{fontWeight:400,fontSize:9,opacity:.7}}>{c.hours}</span>}</span>
}

// ============================================================
// CABANG: ROSTER
// ============================================================
const CabangRoster = () => {
  const ctx = useApp()
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || {units:["TWR"]}
  const mySectors = ctx.sectors.filter(s => s.branch_code === ctx.user.branch_code)
  const myPersonnel = ctx.personnel.filter(p => p.branch_code === ctx.user.branch_code)

  const [rosters,setRosters] = useState([])
  const [loading,setLoading] = useState(true)
  const [selDate,setSelDate] = useState(new Date().toISOString().slice(0,10))
  const [showForm,setShowForm] = useState(false)
  const [editItem,setEditItem] = useState(null)
  const [saving,setSaving] = useState(false)
  // Override modal
  const [overrideItem,setOverrideItem] = useState(null) // {roster, slot: 1|2}
  const [overrideForm,setOverrideForm] = useState({name:"",unit:"",sector:"",cwp:"",reason:""})
  const [savingOvr,setSavingOvr] = useState(false)

  const initSlot = () => ({name:"",unit:br.units[0]||"TWR",sector:"",cwp:""})
  const [form,setForm] = useState({shift:"Pagi",slot1:initSlot(),slot2:initSlot()})

  const fetchRosters = async () => {
    setLoading(true)
    const {data} = await supabase.from("rosters").select("*")
      .eq("branch_code",ctx.user.branch_code)
      .gte("roster_date",selDate).lte("roster_date",selDate)
      .order("shift")
    setRosters(data||[])
    setLoading(false)
  }
  useEffect(() => { fetchRosters() },[selDate])

  const getSectorList = (unit) => mySectors.filter(s => s.unit===unit)
  const getCwpList = (unit,sectorName) => {
    const sec = mySectors.find(s => s.unit===unit && s.name===sectorName)
    return sec ? sec.cwps : ["Controller","Assistant"]
  }

  const setSlot = (slot,key,val) => {
    setForm(f => ({...f,[slot]:{...f[slot],[key]:val, ...(key==="unit"?{sector:"",cwp:""}:{}), ...(key==="sector"?{cwp:""}:{})}}))
  }

  const saveRoster = async () => {
    if (saving) return
    setSaving(true)
    const payload = {
      branch_code: ctx.user.branch_code,
      roster_date: selDate,
      shift: form.shift,
      atc1_name: form.slot1.name||null,
      atc1_unit: form.slot1.unit||null,
      atc1_sector: form.slot1.sector||null,
      atc1_cwp: form.slot1.cwp||null,
      atc2_name: form.slot2.name||null,
      atc2_unit: form.slot2.unit||null,
      atc2_sector: form.slot2.sector||null,
      atc2_cwp: form.slot2.cwp||null,
      created_by: ctx.user.id,
    }
    let error
    if (editItem) {
      ;({error} = await supabase.from("rosters").update({...payload,updated_at:new Date().toISOString()}).eq("id",editItem.id))
    } else {
      ;({error} = await supabase.from("rosters").insert(payload))
    }
    if (error) alert("Error: "+error.message)
    else {
      logAudit(editItem?"ROSTER_UPDATE":"ROSTER_CREATE", `${selDate} ${form.shift}`, ctx.user)
      setShowForm(false); setEditItem(null); setForm({shift:"Pagi",slot1:initSlot(),slot2:initSlot()}); await fetchRosters()
    }
    setSaving(false)
  }

  const editRoster = (r) => {
    setEditItem(r)
    setForm({
      shift: r.shift,
      slot1:{name:r.atc1_name||"",unit:r.atc1_unit||br.units[0]||"TWR",sector:r.atc1_sector||"",cwp:r.atc1_cwp||""},
      slot2:{name:r.atc2_name||"",unit:r.atc2_unit||br.units[0]||"TWR",sector:r.atc2_sector||"",cwp:r.atc2_cwp||""},
    })
    setShowForm(true)
  }

  const deleteRoster = async (id) => {
    if (!confirm("Hapus roster ini?")) return
    await supabase.from("rosters").delete().eq("id",id)
    logAudit("ROSTER_DELETE","ID:"+id.slice(0,8),ctx.user)
    await fetchRosters()
  }

  const openOverride = (roster,slot) => {
    const name = slot===1 ? roster.atc1_name : roster.atc2_name
    const unit = slot===1 ? roster.atc1_unit : roster.atc2_unit
    const sector = slot===1 ? roster.atc1_sector : roster.atc2_sector
    const cwp = slot===1 ? roster.atc1_cwp : roster.atc2_cwp
    setOverrideItem({roster,slot})
    setOverrideForm({name:name||"",unit:unit||br.units[0]||"TWR",sector:sector||"",cwp:cwp||"",reason:""})
  }

  const saveOverride = async () => {
    if (!overrideForm.reason.trim()) { alert("Alasan override wajib diisi"); return }
    setSavingOvr(true)
    const {roster,slot} = overrideItem
    const patch = slot===1
      ? {atc1_name:overrideForm.name,atc1_unit:overrideForm.unit,atc1_sector:overrideForm.sector,atc1_cwp:overrideForm.cwp}
      : {atc2_name:overrideForm.name,atc2_unit:overrideForm.unit,atc2_sector:overrideForm.sector,atc2_cwp:overrideForm.cwp}
    const {error} = await supabase.from("rosters").update({
      ...patch,
      is_overridden:true,
      override_reason:overrideForm.reason,
      overridden_by:ctx.user.display_name,
      overridden_at:new Date().toISOString(),
      updated_at:new Date().toISOString(),
    }).eq("id",roster.id)
    if (error) alert("Error: "+error.message)
    else {
      logAudit("ROSTER_OVERRIDE",`Slot ${slot} ${roster.shift} — Alasan: ${overrideForm.reason}`,ctx.user)
      setOverrideItem(null); await fetchRosters()
    }
    setSavingOvr(false)
  }

  const SlotForm = ({slotKey,label}) => {
    const s = form[slotKey]
    const sectors = getSectorList(s.unit)
    const cwps = getCwpList(s.unit,s.sector)
    return (
      <div style={{background:"var(--bg)",borderRadius:10,padding:14,border:"1px solid var(--border)"}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--fg-muted)",marginBottom:10,textTransform:"uppercase",letterSpacing:".5px"}}>{label}</div>
        <div className="form-grid" style={{gridTemplateColumns:"1fr 1fr"}}>
          <div className="field"><label>Nama ATC</label>
            <select value={s.name} onChange={e => setSlot(slotKey,"name",e.target.value)}>
              <option value="">— Kosong —</option>
              {myPersonnel.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="field"><label>Unit</label>
            <select value={s.unit} onChange={e => setSlot(slotKey,"unit",e.target.value)}>
              {br.units.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div className="field"><label>Sektor</label>
            <select value={s.sector} onChange={e => setSlot(slotKey,"sector",e.target.value)}>
              <option value="">— Pilih —</option>
              {sectors.map(s2 => <option key={s2.id} value={s2.name}>{s2.name}</option>)}
            </select>
          </div>
          <div className="field"><label>CWP</label>
            <select value={s.cwp} onChange={e => setSlot(slotKey,"cwp",e.target.value)}>
              <option value="">— Pilih —</option>
              {cwps.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
    )
  }

  const existingShifts = rosters.map(r => r.shift)
  const currentShift = getShiftNow()

  return (
    <div className="page-content">
      <Header title="Roster" sub={"Jadwal dinas ATC — "+ctx.user.branch_code}/>

      {/* Date nav */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <button className="btn btn-ghost btn-sm" onClick={() => { const d=new Date(selDate); d.setDate(d.getDate()-1); setSelDate(d.toISOString().slice(0,10)) }}>‹ Prev</button>
        <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}/>
        <button className="btn btn-ghost btn-sm" onClick={() => { const d=new Date(selDate); d.setDate(d.getDate()+1); setSelDate(d.toISOString().slice(0,10)) }}>Next ›</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelDate(new Date().toISOString().slice(0,10))}>Hari Ini</button>
        {!showForm && <button className="btn btn-primary btn-sm" onClick={() => {setEditItem(null);setForm({shift:"Pagi",slot1:initSlot(),slot2:initSlot()});setShowForm(true)}} style={{marginLeft:"auto"}}><I n="plus" s={14}/> Tambah Roster</button>}
      </div>

      {/* Form */}
      {showForm && <div className="panel" style={{animation:"fadeIn .3s ease",marginBottom:20}}>
        <div className="panel-header"><h2 className="panel-title"><I n="calendar" s={16}/> {editItem?"Edit":"Buat"} Roster — {selDate}</h2></div>
        <div className="panel-body">
          <div className="field" style={{marginBottom:16,maxWidth:200}}>
            <label>Shift</label>
            <select value={form.shift} onChange={e => setForm(f => ({...f,shift:e.target.value}))}>
              {SHIFT_NAMES.filter(s => editItem || !existingShifts.includes(s)).map(s => <option key={s} value={s}>{s} ({SHIFT_CONFIG[s].hours})</option>)}
            </select>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <SlotForm slotKey="slot1" label="ATC Slot 1"/>
            <SlotForm slotKey="slot2" label="ATC Slot 2"/>
          </div>
          <div style={{display:"flex",gap:10}}>
            <button className="btn btn-ghost" onClick={() => {setShowForm(false);setEditItem(null)}}>Batal</button>
            <button className="btn btn-primary" onClick={saveRoster} disabled={saving}><I n="calendar" s={15}/> {saving?"Menyimpan...":editItem?"Update Roster":"Simpan Roster"}</button>
          </div>
        </div>
      </div>}

      {/* Roster cards */}
      {loading ? <div className="empty-state"><span className="login-spinner"/></div> :
      rosters.length===0 ? <div className="panel"><div className="panel-body"><div className="empty-state"><I n="calendar" s={44}/><p>Belum ada roster untuk tanggal ini</p></div></div></div> :
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {SHIFT_NAMES.map(shiftName => {
          const r = rosters.find(x => x.shift===shiftName)
          if (!r) return null
          const isNow = shiftName === currentShift && selDate === new Date().toISOString().slice(0,10)
          const sc = SHIFT_CONFIG[shiftName]
          return (
            <div key={r.id} className="panel" style={{border:isNow?`2px solid ${sc.color}`:"1px solid var(--border)",boxShadow:isNow?`0 0 16px ${sc.color}22`:"none"}}>
              <div className="panel-header" style={{background:isNow?sc.bg:"transparent"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {isNow && <Pulse s={8}/>}
                  <ShiftBadge shift={shiftName}/>
                  {isNow && <span style={{fontSize:11,fontWeight:600,color:sc.color}}>SHIFT AKTIF</span>}
                  {r.is_overridden && <span style={{fontSize:10,background:"#fef2f2",color:"#dc2626",padding:"2px 8px",borderRadius:10,fontWeight:700}}>⚠ Override</span>}
                </div>
                <div style={{display:"flex",gap:6}}>
                  <button className="btn btn-ghost btn-sm" onClick={() => editRoster(r)}><I n="edit" s={13}/></button>
                  <button className="btn btn-ghost btn-sm" style={{color:"#ef4444"}} onClick={() => deleteRoster(r.id)}><I n="x" s={13}/></button>
                </div>
              </div>
              <div className="panel-body">
                {r.is_overridden && <div style={{fontSize:11,color:"#dc2626",background:"#fef2f2",padding:"6px 12px",borderRadius:8,marginBottom:12}}>Override oleh {r.overridden_by}: {r.override_reason}</div>}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                  {[{slot:1,name:r.atc1_name,unit:r.atc1_unit,sector:r.atc1_sector,cwp:r.atc1_cwp},
                    {slot:2,name:r.atc2_name,unit:r.atc2_unit,sector:r.atc2_sector,cwp:r.atc2_cwp}].map(s => (
                    <div key={s.slot} style={{background:"var(--bg)",borderRadius:10,padding:12,border:"1px solid var(--border)"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"var(--fg-muted)",marginBottom:6,textTransform:"uppercase"}}>Slot {s.slot}</div>
                      {s.name ? <>
                        <div style={{fontSize:15,fontWeight:700,color:"var(--fg)",marginBottom:4}}>{s.name}</div>
                        <div style={{fontSize:12,color:"var(--fg-muted)"}}><span className="unit-tag" style={{fontSize:10}}>{s.unit}</span> {s.sector} — {s.cwp}</div>
                        <button className="btn btn-ghost btn-sm" style={{marginTop:8,fontSize:11}} onClick={() => openOverride(r,s.slot)}><I n="swap" s={12}/> Override</button>
                      </> : <div style={{fontSize:12,color:"var(--fg-muted)",fontStyle:"italic"}}>Kosong</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>}

      {/* Override Modal */}
      {overrideItem && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"var(--card)",borderRadius:16,padding:24,maxWidth:400,width:"100%",boxShadow:"0 24px 48px rgba(0,0,0,.3)"}}>
            <h3 style={{margin:"0 0 4px",fontSize:16,fontWeight:700}}>Override Manual</h3>
            <p style={{margin:"0 0 16px",fontSize:12,color:"var(--fg-muted)"}}>Slot {overrideItem.slot} — Shift {overrideItem.roster.shift}</p>
            <div className="field"><label>Nama ATC Pengganti</label>
              <select value={overrideForm.name} onChange={e => setOverrideForm(f=>({...f,name:e.target.value}))}>
                <option value="">— Pilih —</option>
                {myPersonnel.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="form-grid" style={{gridTemplateColumns:"1fr 1fr"}}>
              <div className="field"><label>Unit</label>
                <select value={overrideForm.unit} onChange={e => setOverrideForm(f=>({...f,unit:e.target.value,sector:"",cwp:""}))}>
                  {br.units.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="field"><label>Sektor</label>
                <select value={overrideForm.sector} onChange={e => setOverrideForm(f=>({...f,sector:e.target.value,cwp:""}))}>
                  <option value="">— Pilih —</option>
                  {getSectorList(overrideForm.unit).map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>CWP</label>
              <select value={overrideForm.cwp} onChange={e => setOverrideForm(f=>({...f,cwp:e.target.value}))}>
                <option value="">— Pilih —</option>
                {getCwpList(overrideForm.unit,overrideForm.sector).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="field"><label>Alasan Override <span style={{color:"#ef4444"}}>*</span></label>
              <input value={overrideForm.reason} onChange={e => setOverrideForm(f=>({...f,reason:e.target.value}))} placeholder="Contoh: Sakit, Tukar shift, Cuti mendadak..."/>
            </div>
            <div style={{display:"flex",gap:10,marginTop:16}}>
              <button className="btn btn-ghost" onClick={() => setOverrideItem(null)}>Batal</button>
              <button className="btn btn-primary" onClick={saveOverride} disabled={savingOvr||!overrideForm.reason.trim()}>{savingOvr?"Menyimpan...":"Simpan Override"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// CABANG: LOG POSITION (with roster auto-fill)
// ============================================================
const CabangLog = () => {
  const ctx = useApp()
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || {units:["TWR"]}
  const mySectors = ctx.sectors.filter(s => s.branch_code === ctx.user.branch_code)
  const myPersonnel = ctx.personnel.filter(p => p.branch_code === ctx.user.branch_code)

  const [unit,setUnit] = useState(br.units[0]||"TWR")
  const [nm,setNm] = useState("")
  const [show,setShow] = useState(false)
  const [offId,setOffId] = useState(null)
  const [dep,setDep] = useState("")
  const [arr,setArr] = useState("")
  const [ovf,setOvf] = useState("")
  const [saving,setSaving] = useState(false)

  // Roster state
  const [todayRoster,setTodayRoster] = useState(null)
  const [rosterLoading,setRosterLoading] = useState(true)

  const unitSectors = mySectors.filter(s => s.unit === unit)
  const [si,setSi] = useState(0)
  const cwps = unitSectors[si] ? unitSectors[si].cwps : ["Controller","Assistant"]
  const [ci,setCi] = useState(0)

  const active = ctx.logs.filter(l => !l.off_time)
  const today = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const currentShift = getShiftNow()

  // Fetch today's roster for current shift
  const fetchTodayRoster = async () => {
    setRosterLoading(true)
    const todayStr = new Date().toISOString().slice(0,10)
    const {data} = await supabase.from("rosters").select("*")
      .eq("branch_code",ctx.user.branch_code)
      .eq("roster_date",todayStr)
      .eq("shift",currentShift)
      .single()
    setTodayRoster(data||null)
    setRosterLoading(false)
  }
  useEffect(() => { fetchTodayRoster() },[])

  // Get roster slots for current shift
  const rosterSlots = todayRoster ? [
    {name:todayRoster.atc1_name,unit:todayRoster.atc1_unit,sector:todayRoster.atc1_sector,cwp:todayRoster.atc1_cwp},
    {name:todayRoster.atc2_name,unit:todayRoster.atc2_unit,sector:todayRoster.atc2_sector,cwp:todayRoster.atc2_cwp},
  ].filter(s => s.name) : []

  // Check if a roster slot is already on mic
  const isOnMic = (atcName) => active.some(l => l.atc_name === atcName && l.branch_code === ctx.user.branch_code)

  const onMicFromRoster = async (slot) => {
    if (saving) return
    setSaving(true)
    const { error } = await supabase.from("position_logs").insert({
      branch_code: ctx.user.branch_code,
      atc_name: slot.name,
      unit: slot.unit,
      sector: slot.sector || "Sector 1",
      cwp: slot.cwp || "Controller",
      shift: currentShift,
      on_time: new Date().toISOString(),
      logged_by: ctx.user.id
    })
    if (error) alert("Error: " + error.message)
    else { logAudit("ON_MIC",slot.name+" — "+slot.unit+" "+slot.sector+" ("+slot.cwp+") [dari roster]",ctx.user); await ctx.reload() }
    setSaving(false)
  }

  const onMic = async () => {
    if (!nm.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from("position_logs").insert({
      branch_code: ctx.user.branch_code,
      atc_name: nm.trim(),
      unit,
      sector: unitSectors[si]?.name || "Sector 1",
      cwp: cwps[ci] || "Controller",
      shift: currentShift,
      on_time: new Date().toISOString(),
      logged_by: ctx.user.id
    })
    if (error) alert("Error: " + error.message)
    else { logAudit("ON_MIC",nm.trim()+" — "+unit+" "+unitSectors[si]?.name+" ("+cwps[ci]+")",ctx.user); await ctx.reload(); setNm(""); setShow(false) }
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

      {/* ── Roster Shift Aktif ── */}
      <div className="panel" style={{marginBottom:16,border:"1.5px solid "+SHIFT_CONFIG[currentShift].color+"55",background:SHIFT_CONFIG[currentShift].bg}}>
        <div className="panel-header" style={{background:"transparent"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <I n="calendar" s={16}/>
            <h2 className="panel-title" style={{color:SHIFT_CONFIG[currentShift].color}}>Roster Shift Aktif</h2>
            <ShiftBadge shift={currentShift}/>
          </div>
          <span className="panel-badge">AUTO</span>
        </div>
        <div className="panel-body">
          {rosterLoading ? <div style={{padding:8}}><span className="login-spinner"/></div> :
          !todayRoster ? (
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0"}}>
              <span style={{fontSize:13,color:"var(--fg-muted)"}}>Belum ada roster untuk shift ini.</span>
              <button className="btn btn-ghost btn-sm" onClick={() => ctx.goPage("roster")}><I n="calendar" s={13}/> Buat Roster</button>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {rosterSlots.map((slot,i) => {
                const already = isOnMic(slot.name)
                return (
                  <div key={i} style={{background:"var(--card)",borderRadius:10,padding:12,border:`1px solid ${already?"#10b981":"var(--border)"}`,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"var(--fg)"}}>{slot.name}</div>
                      <div style={{fontSize:11,color:"var(--fg-muted)",marginTop:2}}><span className="unit-tag" style={{fontSize:10}}>{slot.unit}</span> {slot.sector} — {slot.cwp}</div>
                    </div>
                    {already
                      ? <span style={{fontSize:11,color:"#10b981",fontWeight:600,display:"flex",alignItems:"center",gap:4}}><Pulse s={7}/> On Mic</span>
                      : <button className="btn btn-primary btn-sm" onClick={() => onMicFromRoster(slot)} disabled={saving}><I n="mic" s={13}/> On Mic</button>
                    }
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Active Positions ── */}
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

      {/* ── Manual On Mic (override) ── */}
      <button className="btn btn-ghost btn-lg" onClick={() => setShow(!show)} style={{marginBottom:20}}><I n={show?"x":"swap"} s={16}/> {show?"Tutup":"Input Manual / Override"}</button>

      {show && <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Form On Mic Manual</h2><span style={{fontSize:11,color:"var(--fg-muted)"}}>Di luar roster</span></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field"><label>Nama ATC</label><select value={nm} onChange={e => setNm(e.target.value)}><option value="">— Pilih personel —</option>{myPersonnel.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
            <div className="field"><label>Unit</label><select value={unit} onChange={e => {setUnit(e.target.value);setSi(0);setCi(0)}}>{br.units.map(u => <option key={u}>{u}</option>)}</select></div>
            <div className="field"><label>Sektor</label><select value={si} onChange={e => {setSi(+e.target.value);setCi(0)}}>{unitSectors.map((s,i) => <option key={i} value={i}>{s.name}</option>)}</select></div>
            <div className="field"><label>CWP</label><select value={ci} onChange={e => setCi(+e.target.value)}>{cwps.map((c,i) => <option key={i} value={i}>{c}</option>)}</select></div>
            <div className="field"><label>Shift</label><input value={currentShift} disabled/></div>
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
  const myPersonnel = ctx.personnel.filter(p => p.branch_code === ctx.user.branch_code)

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
    incoming_personnel:"",outgoing_personnel:"",
  })
  const [f,setF] = useState(initForm())
  const set = (k,v) => setF(p => ({...p,[k]:v}))
  const myChecklists = ctx.handoverChecklists.filter(c => c.branch_id === ctx.user.id)

  const submitCL = async () => {
    if(!f.manager_on_duty.trim()||!f.incoming_personnel.trim()||!f.outgoing_personnel.trim()){alert("Mohon isi Manager on Duty, Incoming & Outgoing Personnel");return}
    setSavingCL(true)
    const {error} = await supabase.from("handover_checklists").insert({...f, branch_id:ctx.user.id, created_by:ctx.user.id})
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
            <div className="field"><label>Manager on Duty</label><select value={f.manager_on_duty} onChange={e => set("manager_on_duty",e.target.value)}><option value="">— Pilih MOD —</option>{myPersonnel.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select></div>
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
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--fg-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Incoming Personnel</div>
              <select value={f.incoming_personnel} onChange={e => set("incoming_personnel",e.target.value)} style={{padding:"10px",borderRadius:4,border:"1px solid var(--border)",borderBottom:"2px solid var(--fg)",fontSize:14,fontWeight:600,textAlign:"center",width:"100%",background:"var(--card)",color:"var(--fg)"}}><option value="">— Pilih —</option>{myPersonnel.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--fg-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Outgoing Personnel</div>
              <select value={f.outgoing_personnel} onChange={e => set("outgoing_personnel",e.target.value)} style={{padding:"10px",borderRadius:4,border:"1px solid var(--border)",borderBottom:"2px solid var(--fg)",fontSize:14,fontWeight:600,textAlign:"center",width:"100%",background:"var(--card)",color:"var(--fg)"}}><option value="">— Pilih —</option>{myPersonnel.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}</select>
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
                    <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase"}}>Incoming</div><div style={{fontSize:14,fontWeight:700,marginTop:4,paddingTop:4,borderTop:"1.5px solid var(--fg)",display:"inline-block",minWidth:100}}>{cl.incoming_personnel}</div></div>
                    <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase"}}>Outgoing</div><div style={{fontSize:14,fontWeight:700,marginTop:4,paddingTop:4,borderTop:"1.5px solid var(--fg)",display:"inline-block",minWidth:100}}>{cl.outgoing_personnel}</div></div>
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
      <div className="panel"><div className="panel-header"><h2 className="panel-title">Riwayat Notes</h2><span className="panel-counter">{ctx.handovers.length}</span></div>
        <div className="panel-body">
          {ctx.handovers.length===0 ? <div className="empty-state"><p>Belum ada catatan</p></div> :
          ctx.handovers.map(n => (
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
  // Only logs with traffic data (controller off-mic reports)
  const myLogs = ctx.logs.filter(l => l.branch_code === ctx.user.branch_code && l.off_time && ((l.departure_count||0)+(l.arrival_count||0)+(l.overfly_count||0)) > 0)
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
// ADMIN: MONITORING ROSTER
// ============================================================
const AdminMonRoster = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [selDate,setSelDate] = useState(new Date().toISOString().slice(0,10))
  const [rosters,setRosters] = useState([])
  const [loading,setLoading] = useState(true)

  const fetchRosters = async () => {
    setLoading(true)
    let q = supabase.from("rosters").select("*").eq("roster_date",selDate).order("branch_code").order("shift")
    if (br !== "ALL") q = q.eq("branch_code",br)
    const {data} = await q
    setRosters(data||[])
    setLoading(false)
  }
  useEffect(() => { fetchRosters() },[selDate,br])

  const currentShift = getShiftNow()
  const overrideCount = rosters.filter(r => r.is_overridden).length

  // Group by branch
  const byBranch = {}
  rosters.forEach(r => {
    if (!byBranch[r.branch_code]) byBranch[r.branch_code] = []
    byBranch[r.branch_code].push(r)
  })

  return (
    <div className="page-content">
      <Header title="Monitoring Roster" sub="Jadwal dinas ATC seluruh cabang"/>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => { const d=new Date(selDate); d.setDate(d.getDate()-1); setSelDate(d.toISOString().slice(0,10)) }}>‹</button>
        <input type="date" value={selDate} onChange={e => setSelDate(e.target.value)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}/>
        <button className="btn btn-ghost btn-sm" onClick={() => { const d=new Date(selDate); d.setDate(d.getDate()+1); setSelDate(d.toISOString().slice(0,10)) }}>›</button>
        <button className="btn btn-ghost btn-sm" onClick={() => setSelDate(new Date().toISOString().slice(0,10))}>Hari Ini</button>
      </div>

      <div className="stats-grid">
        <Stat icon="calendar" label="Total Roster" value={rosters.length} sub={`${selDate}`} color="#38bdf8"/>
        <Stat icon="building" label="Cabang" value={Object.keys(byBranch).length} sub="Sudah input roster" color="#10b981"/>
        <Stat icon="swap" label="Override" value={overrideCount} sub="Perubahan manual" color="#f59e0b"/>
        <Stat icon="clock" label="Shift Aktif" value={currentShift} sub={SHIFT_CONFIG[currentShift].hours} color={SHIFT_CONFIG[currentShift].color}/>
      </div>

      {loading ? <div className="panel"><div className="panel-body"><div className="empty-state"><span className="login-spinner"/></div></div></div> :
      rosters.length===0 ? <div className="panel"><div className="panel-body"><div className="empty-state"><I n="calendar" s={44}/><p>Belum ada roster untuk filter ini</p></div></div></div> :
      <div style={{display:"flex",flexDirection:"column",gap:20}}>
        {Object.keys(byBranch).sort().map(code => {
          const b = ctx.branches.find(x => x.code===code)
          const bRosters = byBranch[code]
          return (
            <div key={code} className="panel">
              <div className="panel-header">
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span className="unit-tag" style={{fontWeight:700,fontSize:13}}>{code}</span>
                  <span style={{fontSize:13,color:"var(--fg)"}}>{b?.name||""}</span>
                  <span style={{fontSize:11,color:"var(--fg-muted)"}}>{b?.city||""}</span>
                </div>
                <span className="panel-counter">{bRosters.length} shift</span>
              </div>
              <div className="panel-body">
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {SHIFT_NAMES.map(shiftName => {
                    const r = bRosters.find(x => x.shift===shiftName)
                    const sc = SHIFT_CONFIG[shiftName]
                    const isNow = shiftName===currentShift && selDate===new Date().toISOString().slice(0,10)
                    if (!r) return (
                      <div key={shiftName} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,border:"1px dashed var(--border)",opacity:.5}}>
                        <ShiftBadge shift={shiftName} small/>
                        <span style={{fontSize:12,color:"var(--fg-muted)",fontStyle:"italic"}}>Belum ada roster</span>
                      </div>
                    )
                    return (
                      <div key={r.id} style={{padding:"10px 14px",borderRadius:10,border:isNow?`1.5px solid ${sc.color}`:  "1px solid var(--border)",background:isNow?sc.bg:"var(--bg)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          {isNow && <Pulse s={7}/>}
                          <ShiftBadge shift={shiftName} small/>
                          {isNow && <span style={{fontSize:10,fontWeight:600,color:sc.color}}>AKTIF</span>}
                          {r.is_overridden && <span style={{fontSize:10,background:"#fef2f2",color:"#dc2626",padding:"1px 8px",borderRadius:10,fontWeight:700}}>⚠ Override</span>}
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          {[{slot:1,name:r.atc1_name,unit:r.atc1_unit,sector:r.atc1_sector,cwp:r.atc1_cwp},
                            {slot:2,name:r.atc2_name,unit:r.atc2_unit,sector:r.atc2_sector,cwp:r.atc2_cwp}].map(s => (
                            <div key={s.slot} style={{background:"var(--card)",borderRadius:8,padding:"8px 10px",border:"1px solid var(--border)"}}>
                              <div style={{fontSize:9,fontWeight:700,color:"var(--fg-muted)",textTransform:"uppercase",marginBottom:3}}>Slot {s.slot}</div>
                              {s.name
                                ? <><div style={{fontSize:13,fontWeight:700}}>{s.name}</div><div style={{fontSize:11,color:"var(--fg-muted)",marginTop:2}}><span className="unit-tag" style={{fontSize:9}}>{s.unit}</span> {s.sector} — {s.cwp}</div></>
                                : <div style={{fontSize:11,color:"var(--fg-muted)",fontStyle:"italic"}}>Kosong</div>}
                            </div>
                          ))}
                        </div>
                        {r.is_overridden && <div style={{fontSize:11,color:"#dc2626",marginTop:8,padding:"4px 8px",background:"#fef2f2",borderRadius:6}}>Diubah oleh {r.overridden_by}: {r.override_reason}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>}
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING LOG (ON MIC)
// ============================================================
const AdminMonLog = () => {
  const ctx = useApp()
  const [br,setBr] = useState(ctx.navBranch || "ALL")

  useEffect(() => {
    if (ctx.navBranch) { setBr(ctx.navBranch); ctx.setNavBranch(null) }
  }, [ctx.navBranch])

  const allActive = ctx.logs.filter(l => !l.off_time)
  const fa = br==="ALL" ? allActive : allActive.filter(l => l.branch_code===br)

  return (
    <div className="page-content">
      <Header title="Monitoring Log Position" sub="ATC on mic real-time seluruh cabang"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> LIVE</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
      </div>
      <div className="stats-grid">
        <Stat icon="mic" label="On Mic" value={fa.length} sub={br==="ALL"?"Seluruh cabang":br} color="#10b981"/>
        <Stat icon="building" label="Cabang Aktif" value={[...new Set(fa.map(l=>l.branch_code))].length} color="#38bdf8"/>
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
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING LOG HARI INI
// ============================================================
const AdminMonToday = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")

  const todayAll = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const ft = br==="ALL" ? todayAll : todayAll.filter(l => l.branch_code===br)

  return (
    <div className="page-content">
      <Header title="Log Hari Ini" sub="Semua aktivitas log position hari ini"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}
        </select>
      </div>
      <div className="stats-grid">
        <Stat icon="log" label="Log Hari Ini" value={ft.length} color="#38bdf8"/>
        <Stat icon="mic" label="Masih On Mic" value={ft.filter(l=>!l.off_time).length} color="#10b981"/>
        <Stat icon="micOff" label="Sudah Off" value={ft.filter(l=>l.off_time).length} color="#64748b"/>
      </div>
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Log Hari Ini</h2><span className="panel-counter">{ft.length}</span></div>
        <div className="panel-body">{ft.length===0 ? <div className="empty-state"><I n="log" s={44}/><p>Belum ada log hari ini</p></div> :
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Cabang</th><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>Shift</th><th>On</th><th>Off</th><th>Status</th></tr></thead>
          <tbody>{ft.map(l => <tr key={l.id}><td><span className="unit-tag">{l.branch_code}</span></td><td><strong>{l.atc_name}</strong></td><td>{l.unit}</td><td>{l.sector}</td><td>{l.cwp}</td><td>{l.shift}</td><td>{fmtT(l.on_time)}</td><td>{l.off_time?fmtT(l.off_time):"-"}</td><td>{l.off_time?<span className="status-badge status-off">Off</span>:<span className="status-badge status-on"><Pulse s={6}/> On</span>}</td></tr>)}</tbody></table></div>}
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
                      <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase"}}>Incoming</div><div style={{fontSize:14,fontWeight:700,marginTop:4,paddingTop:4,borderTop:"1.5px solid var(--fg)",display:"inline-block",minWidth:100}}>{cl.incoming_personnel}</div></div>
                      <div style={{flex:1,textAlign:"center"}}><div style={{fontSize:10,fontWeight:600,color:"var(--fg-muted)",textTransform:"uppercase"}}>Outgoing</div><div style={{fontSize:14,fontWeight:700,marginTop:4,paddingTop:4,borderTop:"1.5px solid var(--fg)",display:"inline-block",minWidth:100}}>{cl.outgoing_personnel}</div></div>
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
    return (l.username||"").toLowerCase().includes(s) || (l.detail||"").toLowerCase().includes(s) || (l.action||"").toLowerCase().includes(s)
  })

  const ACTION_COLORS = {
    LOGIN:{bg:"#dcfce7",fg:"#166534",icon:"🔓"},
    LOGOUT:{bg:"#f1f5f9",fg:"#475569",icon:"🔒"},
    ON_MIC:{bg:"#dbeafe",fg:"#1e40af",icon:"🎙️"},
    OFF_MIC:{bg:"#fef3c7",fg:"#92400e",icon:"🔇"},
    CHECKLIST_CREATE:{bg:"#f0fdf4",fg:"#166534",icon:"📋"},
    CHECKLIST_DELETE:{bg:"#fef2f2",fg:"#991b1b",icon:"🗑️"},
    NOTE_CREATE:{bg:"#eff6ff",fg:"#1d4ed8",icon:"📝"},
    EXPORT_EXCEL:{bg:"#f0fdf4",fg:"#166534",icon:"📊"},
    EXPORT_PDF:{bg:"#fef2f2",fg:"#991b1b",icon:"📄"},
  }

  const uniqueActions = [...new Set(auditLogs.map(l => l.action))]

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
          {["LOGIN","LOGOUT","ON_MIC","OFF_MIC","CHECKLIST_CREATE","CHECKLIST_DELETE","NOTE_CREATE","EXPORT_EXCEL","EXPORT_PDF"].map(a => <option key={a} value={a}>{a}</option>)}
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
        <Stat icon="micOff" label="Off Mic" value={filtered.filter(l=>l.action==="OFF_MIC").length} color="#f59e0b"/>
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
                      <span style={{fontSize:12,fontWeight:600,color:"var(--fg)"}}>{l.username}</span>
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
// ROSTER GENERATOR — AI-assisted, rule-based schedule engine
// ============================================================

// ── Surabaya shift rotation rules ──────────────────────────
// Pattern: 2 work days + 2 rest days, rotating I→V→IV→III→II
// 10 groups for APP (4 per group), ~21 patterns for TWR
// CUTI: personel cuti ditandai, slot-nya diisi otomatis

const SHIFT_ROTATION = ["I","V","IV","III","II"]
const SHIFT_HOURS = { I:"06:00–12:00", II:"08:00–14:00", III:"14:00–20:00", IV:"16:00–22:00", V:"22:00–06:00" }

// Map shift roman → app shift label
const SHIFT_MAP = { I:"Pagi", II:"Pagi", III:"Siang", IV:"Siang", V:"Malam" }

// Generate 30-day pattern starting from a given shift index & day offset
// offset: 0=start on day1, 2=start on day3, 4=start on day5...
const genPattern = (startShiftIdx, dayOffset=0) => {
  const result = []
  let si = startShiftIdx
  // build enough blocks to cover offset + 30 days
  const blocks = []
  for (let b=0; b<20; b++) {
    const sh = SHIFT_ROTATION[si % SHIFT_ROTATION.length]
    blocks.push(sh, sh, "-", "-")
    si++
  }
  return blocks.slice(dayOffset, dayOffset + 30)
}

// Pre-defined Surabaya APP groups (10 groups, 4 personel each)
// groupId 0-4: start day1 with shift I,II,III,IV,V
// groupId 5-9: start day3 with shift I,II,III,IV,V
const APP_GROUPS = [
  {id:0,offset:0,startShift:0}, // Grup 1: start day1 Shift I  → BM,AX,WW,LX
  {id:1,offset:0,startShift:1}, // Grup 2: start day1 Shift II → RI,JI,BG,HH
  {id:2,offset:0,startShift:2}, // Grup 3: start day1 Shift III→ FHA,GK,GP,HU
  {id:3,offset:0,startShift:3}, // Grup 4: start day1 Shift IV → IJ,IG,JX,MW
  {id:4,offset:0,startShift:4}, // Grup 5: start day1 Shift V  → MP,VT,YI,ZR
  {id:5,offset:2,startShift:0}, // Grup 6: start day3 Shift I  → SA,SE,YM,UL
  {id:6,offset:2,startShift:1}, // Grup 7: start day3 Shift II → VC,NE,GA,FD
  {id:7,offset:2,startShift:2}, // Grup 8: start day3 Shift III→ RP,AB,LR,DJ
  {id:8,offset:2,startShift:3}, // Grup 9: start day3 Shift IV → IC,FV,II,ON
  {id:9,offset:2,startShift:4}, // Grup10: start day3 Shift V  → SD,QZ,BI,TB
]

// Get shift for a personel on a specific day (1-indexed)
const getShiftForDay = (groupId, day, cutiDays=[]) => {
  if (cutiDays.includes(day)) return "CUTI"
  const g = APP_GROUPS[groupId] || APP_GROUPS[0]
  const pattern = genPattern(g.startShift, g.offset)
  return pattern[day-1] || "-"
}

// Determine app shift (Pagi/Siang/Malam) from roman numeral
const romanToAppShift = (roman) => {
  if (!roman || roman === "-" || roman === "CUTI") return null
  return SHIFT_MAP[roman] || null
}

// Build full month roster for all personel
const buildMonthRoster = (year, month, personnelList, cutiMap) => {
  const daysInMonth = new Date(year, month, 0).getDate()
  const result = {} // date -> { Pagi: [{name,unit,sector,cwp,shift}], Siang: [...], Malam: [...] }

  for (let d=1; d<=daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`
    result[dateStr] = { Pagi:[], Siang:[], Malam:[] }
  }

  personnelList.forEach(p => {
    const cutiDays = cutiMap[p.id] || []
    const groupId = p.roster_group ?? 0

    for (let d=1; d<=daysInMonth; d++) {
      const shift = getShiftForDay(groupId, d, cutiDays)
      const appShift = romanToAppShift(shift)
      if (!appShift) continue

      const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      result[dateStr][appShift].push({
        name: p.name,
        unit: p.unit || "APP",
        sector: p.default_sector || "Sector 1",
        cwp: p.default_cwp || "Controller",
        roman_shift: shift,
      })
    }
  })
  return result
}

// Convert month roster to array of rosters records (matching Supabase schema)
const rosterToRecords = (monthRoster, branchCode, userId) => {
  const records = []
  Object.entries(monthRoster).forEach(([date, shifts]) => {
    Object.entries(shifts).forEach(([shiftName, people]) => {
      if (people.length === 0) return
      records.push({
        branch_code: branchCode,
        roster_date: date,
        shift: shiftName,
        atc1_name: people[0]?.name || null,
        atc1_unit: people[0]?.unit || null,
        atc1_sector: people[0]?.sector || null,
        atc1_cwp: people[0]?.cwp || null,
        atc2_name: people[1]?.name || null,
        atc2_unit: people[1]?.unit || null,
        atc2_sector: people[1]?.sector || null,
        atc2_cwp: people[1]?.cwp || null,
        created_by: userId,
      })
    })
  })
  return records
}

const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
const DAY_NAMES = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"]
const ROMAN_COLORS = {
  "I":  {bg:"#dbeafe",fg:"#1d4ed8"},
  "II": {bg:"#dcfce7",fg:"#15803d"},
  "III":{bg:"#fef9c3",fg:"#a16207"},
  "IV": {bg:"#ffedd5",fg:"#c2410c"},
  "V":  {bg:"#ede9fe",fg:"#6d28d9"},
  "-":  {bg:"transparent",fg:"#94a3b8"},
  "CUTI":{bg:"#fee2e2",fg:"#dc2626"},
}

const RosterGenerator = () => {
  const ctx = useApp()
  const isAdmin = ctx.user.role === "admin"

  // For admin: pick branch; for cabang: use own branch
  const [selectedBranch, setSelectedBranch] = useState(isAdmin ? (ctx.branches[0]?.code||"") : ctx.user.branch_code)
  const br = ctx.branches.find(b => b.code === selectedBranch) || {units:["APP","TWR"],name:""}
  const brPersonnel = ctx.personnel.filter(p => p.branch_code === selectedBranch)

  const now = new Date()
  const [selMonth, setSelMonth] = useState(now.getMonth()+1)
  const [selYear, setSelYear] = useState(now.getFullYear())

  // Personnel with group assignments
  const [personnelConfig, setPersonnelConfig] = useState([])
  const [cutiMap, setCutiMap] = useState({}) // { personnel_id: [day1, day2, ...] }
  const [cutiInput, setCutiInput] = useState({}) // { personnel_id: "1,5,10" }

  // Generation state
  const [generated, setGenerated] = useState(null) // { monthRoster, records }
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState(null) // {ok, count, skipped}
  const [activeTab, setActiveTab] = useState("config") // config | preview | save
  const [previewDate, setPreviewDate] = useState(null)
  const [conflict, setConflict] = useState([]) // existing roster dates in selected month

  // Init personnel config when branch/personnel changes
  useEffect(() => {
    if (!brPersonnel.length) return
    setPersonnelConfig(brPersonnel.map((p,i) => ({
      ...p,
      roster_group: i % 10,
      unit: p.unit || br.units?.[0] || "APP",
      default_sector: "",
      default_cwp: "Controller",
      include: true,
    })))
    setCutiMap({})
    setCutiInput({})
    setGenerated(null)
    setSaveResult(null)
    setActiveTab("config")
  }, [selectedBranch, selMonth, selYear])

  // Check existing rosters for conflict
  useEffect(() => {
    const fetchConflict = async () => {
      const firstDay = `${selYear}-${String(selMonth).padStart(2,"0")}-01`
      const lastDay = `${selYear}-${String(selMonth).padStart(2,"0")}-${new Date(selYear,selMonth,0).getDate()}`
      const {data} = await supabase.from("rosters").select("roster_date").eq("branch_code",selectedBranch).gte("roster_date",firstDay).lte("roster_date",lastDay)
      if (data) setConflict([...new Set(data.map(r=>r.roster_date))])
    }
    if (selectedBranch) fetchConflict()
  }, [selectedBranch, selMonth, selYear])

  const daysInMonth = new Date(selYear, selMonth, 0).getDate()

  const updatePersonnel = (id, key, val) => {
    setPersonnelConfig(prev => prev.map(p => p.id===id ? {...p,[key]:val} : p))
  }

  const parseCutiDays = (str) => {
    if (!str?.trim()) return []
    return str.split(/[,\s]+/).map(s=>parseInt(s)).filter(n => !isNaN(n) && n>=1 && n<=daysInMonth)
  }

  const updateCuti = (id, val) => {
    setCutiInput(prev => ({...prev,[id]:val}))
    setCutiMap(prev => ({...prev,[id]:parseCutiDays(val)}))
  }

  const generate = () => {
    setGenerating(true)
    setTimeout(() => {
      try {
        const activePersonnel = personnelConfig.filter(p => p.include)
        const monthRoster = buildMonthRoster(selYear, selMonth, activePersonnel, cutiMap)
        const records = rosterToRecords(monthRoster, selectedBranch, ctx.user.id)
        setGenerated({monthRoster, records})
        setActiveTab("preview")
        // Set preview to first day
        const firstDate = `${selYear}-${String(selMonth).padStart(2,"0")}-01`
        setPreviewDate(firstDate)
      } catch(e) { alert("Error: "+e.message) }
      setGenerating(false)
    }, 400)
  }

  const saveToSupabase = async (overwrite=false) => {
    if (!generated) return
    setSaving(true)
    setSaveResult(null)
    try {
      const {records} = generated
      let skipped = 0, saved = 0

      if (overwrite) {
        // Delete existing for this month/branch first
        const firstDay = `${selYear}-${String(selMonth).padStart(2,"0")}-01`
        const lastDay = `${selYear}-${String(selMonth).padStart(2,"0")}-${daysInMonth}`
        await supabase.from("rosters").delete().eq("branch_code",selectedBranch).gte("roster_date",firstDay).lte("roster_date",lastDay)
      }

      // Batch insert in chunks of 50
      for (let i=0; i<records.length; i+=50) {
        const chunk = records.slice(i, i+50)
        const {error} = await supabase.from("rosters").insert(chunk)
        if (error) { skipped += chunk.length } else { saved += chunk.length }
      }

      logAudit("ROSTER_GENERATE", `${MONTH_NAMES[selMonth-1]} ${selYear} — ${selectedBranch} — ${saved} records`, ctx.user)
      setSaveResult({ok:true, count:saved, skipped})
      setActiveTab("save")
      // Refresh conflict list
      const firstDay = `${selYear}-${String(selMonth).padStart(2,"0")}-01`
      const lastDay = `${selYear}-${String(selMonth).padStart(2,"0")}-${daysInMonth}`
      const {data} = await supabase.from("rosters").select("roster_date").eq("branch_code",selectedBranch).gte("roster_date",firstDay).lte("roster_date",lastDay)
      if (data) setConflict([...new Set(data.map(r=>r.roster_date))])
      await ctx.reload()
    } catch(e) { setSaveResult({ok:false, msg:e.message}) }
    setSaving(false)
  }

  // Compute stats per personel
  const computeStats = (personId) => {
    if (!generated) return null
    const counts = {I:0,II:0,III:0,IV:0,V:0,CUTI:0,total:0}
    const p = personnelConfig.find(x=>x.id===personId)
    if (!p) return counts
    const cutiDays = cutiMap[personId] || []
    for (let d=1; d<=daysInMonth; d++) {
      const sh = getShiftForDay(p.roster_group, d, cutiDays)
      if (sh === "CUTI") { counts.CUTI++; continue }
      if (sh !== "-") { counts[sh] = (counts[sh]||0)+1; counts.total++ }
    }
    return counts
  }

  const Tab = ({id,label,icon}) => (
    <button onClick={()=>setActiveTab(id)} style={{
      padding:"8px 16px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:600,
      display:"flex",alignItems:"center",gap:6,
      background:activeTab===id?"var(--accent)":"transparent",
      color:activeTab===id?"#fff":"var(--fg-muted)",
    }}>
      <I n={icon} s={14}/>{label}
    </button>
  )

  // Preview calendar grid for a specific date
  const CalendarPreview = () => {
    const weeks = []
    const firstDow = new Date(selYear, selMonth-1, 1).getDay()
    let cells = Array(firstDow).fill(null)
    for (let d=1; d<=daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    for (let i=0; i<cells.length; i+=7) weeks.push(cells.slice(i,i+7))

    return (
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
          <thead>
            <tr>{DAY_NAMES.map(d=><th key={d} style={{padding:"4px 2px",textAlign:"center",color:"var(--fg-muted)",fontWeight:600,fontSize:10}}>{d}</th>)}</tr>
          </thead>
          <tbody>
            {weeks.map((wk,wi)=>(
              <tr key={wi}>
                {wk.map((day,di)=>{
                  if (!day) return <td key={di}/>
                  const dateStr = `${selYear}-${String(selMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`
                  const shifts = generated?.monthRoster[dateStr]
                  const hasPagi = shifts?.Pagi?.length>0
                  const hasSiang = shifts?.Siang?.length>0
                  const hasMalam = shifts?.Malam?.length>0
                  const isConflict = conflict.includes(dateStr)
                  const isSelected = previewDate===dateStr
                  return (
                    <td key={di} onClick={()=>setPreviewDate(dateStr)} style={{
                      padding:"4px 2px",textAlign:"center",cursor:"pointer",
                      background:isSelected?"var(--accent)33":"transparent",
                      borderRadius:6,
                    }}>
                      <div style={{fontWeight:700,fontSize:12,color:isSelected?"var(--accent)":"var(--fg)",marginBottom:2}}>{day}</div>
                      <div style={{display:"flex",gap:2,justifyContent:"center",flexWrap:"wrap"}}>
                        {hasPagi && <span style={{fontSize:8,background:"#dbeafe",color:"#1d4ed8",borderRadius:3,padding:"0 3px"}}>P</span>}
                        {hasSiang && <span style={{fontSize:8,background:"#fef9c3",color:"#a16207",borderRadius:3,padding:"0 3px"}}>S</span>}
                        {hasMalam && <span style={{fontSize:8,background:"#ede9fe",color:"#6d28d9",borderRadius:3,padding:"0 3px"}}>M</span>}
                        {isConflict && !generated && <span style={{fontSize:8,background:"#fee2e2",color:"#dc2626",borderRadius:3,padding:"0 3px"}}>!</span>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // Detail view for selected date
  const DayDetail = () => {
    if (!previewDate || !generated) return <div style={{color:"var(--fg-muted)",fontSize:13,padding:16}}>Klik tanggal untuk melihat detail</div>
    const shifts = generated.monthRoster[previewDate]
    const dayNum = parseInt(previewDate.split("-")[2])
    const dow = DAY_NAMES[new Date(previewDate).getDay()]
    return (
      <div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12,color:"var(--fg)"}}>{dow}, {dayNum} {MONTH_NAMES[selMonth-1]} {selYear}</div>
        {["Pagi","Siang","Malam"].map(sh => {
          const sc = SHIFT_CONFIG[sh]
          const people = shifts[sh]||[]
          return (
            <div key={sh} style={{marginBottom:12,padding:"10px 12px",borderRadius:8,border:`1px solid ${sc.color}44`,background:sc.bg}}>
              <div style={{fontSize:11,fontWeight:700,color:sc.color,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                <ShiftBadge shift={sh} small/>
                <span style={{fontSize:10,opacity:.7}}>{sc.hours}</span>
                <span style={{marginLeft:"auto",fontSize:10,background:sc.color+"22",padding:"1px 8px",borderRadius:10}}>{people.length} ATC</span>
              </div>
              {people.length===0 ? <div style={{fontSize:12,color:"var(--fg-muted)",fontStyle:"italic"}}>Tidak ada personel</div> :
              people.map((p,i) => (
                <div key={i} style={{fontSize:12,display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{fontWeight:600,color:"var(--fg)"}}>{p.name}</span>
                  <span style={{fontSize:10,background:"var(--bg)",padding:"1px 6px",borderRadius:4,color:"var(--fg-muted)"}}>{p.unit}</span>
                  <span style={{fontSize:10,color:"var(--fg-muted)"}}>{p.sector}</span>
                  <span style={{fontSize:10,background:ROMAN_COLORS[p.roman_shift]?.bg,color:ROMAN_COLORS[p.roman_shift]?.fg,padding:"1px 6px",borderRadius:4,marginLeft:"auto"}}>{p.roman_shift}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="page-content">
      <Header title="Generate Roster" sub="Buat jadwal dinas otomatis berbasis pola shift"/>

      {/* Branch selector for admin */}
      {isAdmin && (
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
          <span className="monitor-label"><I n="building" s={12}/> CABANG</span>
          <select className="br-select" value={selectedBranch} onChange={e=>setSelectedBranch(e.target.value)}>
            <option value="">— Pilih Cabang —</option>
            {ctx.branches.map(b=><option key={b.code} value={b.code}>{b.code} — {b.city}</option>)}
          </select>
        </div>
      )}

      {/* Month/Year picker */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,flexWrap:"wrap"}}>
        <I n="calendar" s={16}/>
        <select value={selMonth} onChange={e=>{setSelMonth(+e.target.value);setGenerated(null)}} style={{padding:"6px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}>
          {MONTH_NAMES.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
        </select>
        <input type="number" value={selYear} min={2024} max={2030} onChange={e=>{setSelYear(+e.target.value);setGenerated(null)}} style={{width:80,padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13}}/>
        {conflict.length>0 && (
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#f59e0b",background:"#fef3c7",padding:"4px 10px",borderRadius:8}}>
            <I n="warn" s={13}/> {conflict.length} hari sudah ada roster — akan di-overwrite jika disimpan
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,padding:"4px",background:"var(--bg)",borderRadius:10,width:"fit-content"}}>
        <Tab id="config" label="Konfigurasi" icon="checklist"/>
        <Tab id="preview" label={`Preview${generated?` (${generated.records.length} records)`:""}`} icon="eye"/>
        <Tab id="save" label="Simpan" icon="download"/>
      </div>

      {/* ═══ TAB: KONFIGURASI ═══ */}
      {activeTab==="config" && (
        <div>
          <div className="stats-grid" style={{marginBottom:20}}>
            <Stat icon="building" label="Cabang" value={selectedBranch||"—"} sub={br.name} color="#38bdf8"/>
            <Stat icon="calendar" label="Bulan" value={`${MONTH_NAMES[selMonth-1]} ${selYear}`} sub={`${daysInMonth} hari`} color="#8b5cf6"/>
            <Stat icon="mic" label="Personel Aktif" value={personnelConfig.filter(p=>p.include).length} sub={`dari ${personnelConfig.length}`} color="#10b981"/>
            <Stat icon="plane" label="Estimasi Records" value={personnelConfig.filter(p=>p.include).length > 0 ? daysInMonth * 3 : 0} sub="roster entries" color="#f59e0b"/>
          </div>

          {brPersonnel.length===0 ? (
            <div className="panel"><div className="panel-body"><div className="empty-state"><I n="building" s={44}/><p>Pilih cabang yang memiliki data personel</p></div></div></div>
          ) : (
            <div className="panel">
              <div className="panel-header">
                <h2 className="panel-title"><I n="checklist" s={16}/> Konfigurasi Personel & Grup Rotasi</h2>
                <span className="panel-counter">{personnelConfig.filter(p=>p.include).length} aktif</span>
              </div>
              <div className="panel-body">
                <div style={{fontSize:12,color:"var(--fg-muted)",marginBottom:12,padding:"8px 12px",background:"var(--bg)",borderRadius:8,display:"flex",alignItems:"flex-start",gap:8}}>
                  <I n="warn" s={14}/>
                  <div>Sistem menggunakan pola rotasi 5-shift Surabaya: <strong>2 hari kerja + 2 hari libur</strong>, rotasi I→V→IV→III→II. Assign tiap personel ke grup (0–9) sesuai pola yang berlaku.</div>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table className="data-table">
                    <thead><tr>
                      <th style={{width:32}}>✓</th>
                      <th>Nama</th>
                      <th>Unit</th>
                      <th style={{width:80}}>Grup</th>
                      <th>Pola Shift (5 hari)</th>
                      <th>Sektor Default</th>
                      <th>Hari Cuti</th>
                    </tr></thead>
                    <tbody>
                      {personnelConfig.map(p => {
                        const preview5 = genPattern(APP_GROUPS[p.roster_group]?.startShift||0, APP_GROUPS[p.roster_group]?.offset||0).slice(0,10)
                        return (
                          <tr key={p.id} style={{opacity:p.include?1:.4}}>
                            <td><input type="checkbox" checked={p.include} onChange={e=>updatePersonnel(p.id,"include",e.target.checked)}/></td>
                            <td><strong style={{fontSize:13}}>{p.name}</strong></td>
                            <td>
                              <select value={p.unit} onChange={e=>updatePersonnel(p.id,"unit",e.target.value)} style={{padding:"3px 6px",borderRadius:5,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:11}}>
                                {(br.units||["APP","TWR"]).map(u=><option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td>
                              <select value={p.roster_group} onChange={e=>updatePersonnel(p.id,"roster_group",+e.target.value)} style={{padding:"3px 6px",borderRadius:5,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:11,width:56}}>
                                {APP_GROUPS.map(g=><option key={g.id} value={g.id}>{g.id}</option>)}
                              </select>
                            </td>
                            <td>
                              <div style={{display:"flex",gap:2}}>
                                {preview5.map((sh,i)=>(
                                  <span key={i} style={{
                                    fontSize:10,fontWeight:600,padding:"1px 5px",borderRadius:4,
                                    background:ROMAN_COLORS[sh]?.bg||"transparent",
                                    color:ROMAN_COLORS[sh]?.fg||"#94a3b8",
                                  }}>{sh}</span>
                                ))}
                              </div>
                            </td>
                            <td>
                              <input value={p.default_sector} onChange={e=>updatePersonnel(p.id,"default_sector",e.target.value)} placeholder="Sector 1" style={{padding:"3px 8px",borderRadius:5,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:11,width:90}}/>
                            </td>
                            <td>
                              <div style={{display:"flex",alignItems:"center",gap:6}}>
                                <input
                                  value={cutiInput[p.id]||""}
                                  onChange={e=>updateCuti(p.id,e.target.value)}
                                  placeholder="1,5,15..."
                                  style={{padding:"3px 8px",borderRadius:5,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:11,width:80}}
                                />
                                {(cutiMap[p.id]?.length>0) && (
                                  <span style={{fontSize:10,color:"#dc2626",background:"#fee2e2",padding:"1px 6px",borderRadius:4}}>{cutiMap[p.id].length}H</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{marginTop:20,display:"flex",gap:10,alignItems:"center"}}>
                  <button className="btn btn-primary" onClick={generate} disabled={generating||personnelConfig.filter(p=>p.include).length===0} style={{gap:6,display:"flex",alignItems:"center"}}>
                    <I n="magic" s={15}/> {generating?"Generating...":"Generate Jadwal"}
                  </button>
                  <span style={{fontSize:12,color:"var(--fg-muted)"}}>
                    {personnelConfig.filter(p=>p.include).length} personel × {daysInMonth} hari
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: PREVIEW ═══ */}
      {activeTab==="preview" && (
        <div>
          {!generated ? (
            <div className="panel"><div className="panel-body"><div className="empty-state"><I n="calendar" s={44}/><p>Generate jadwal terlebih dahulu di tab Konfigurasi</p></div></div></div>
          ) : (
            <div>
              {/* Stats */}
              <div className="stats-grid" style={{marginBottom:20}}>
                <Stat icon="calendar" label="Total Records" value={generated.records.length} sub="roster entries" color="#38bdf8"/>
                <Stat icon="mic" label="Personel" value={personnelConfig.filter(p=>p.include).length} color="#10b981"/>
                <Stat icon="plane" label="Hari Kerja" value={`${daysInMonth} hari`} sub={`${MONTH_NAMES[selMonth-1]} ${selYear}`} color="#f59e0b"/>
                <Stat icon="warn" label="Hari Konflik" value={conflict.length} sub="sudah ada roster" color={conflict.length>0?"#ef4444":"#10b981"}/>
              </div>

              {/* Calendar + day detail */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                <div className="panel">
                  <div className="panel-header"><h2 className="panel-title"><I n="calendar" s={15}/> Kalender {MONTH_NAMES[selMonth-1]} {selYear}</h2></div>
                  <div className="panel-body"><CalendarPreview/></div>
                </div>
                <div className="panel">
                  <div className="panel-header"><h2 className="panel-title"><I n="log" s={15}/> Detail Hari</h2></div>
                  <div className="panel-body"><DayDetail/></div>
                </div>
              </div>

              {/* Per-personel stats */}
              <div className="panel">
                <div className="panel-header"><h2 className="panel-title"><I n="chart" s={15}/> Rekap Shift Per Personel</h2></div>
                <div className="panel-body">
                  <div style={{overflowX:"auto"}}>
                    <table className="data-table">
                      <thead><tr>
                        <th>Nama</th><th>Unit</th><th>Grup</th>
                        {["I","II","III","IV","V"].map(s=><th key={s} style={{textAlign:"center"}}><span style={{padding:"1px 6px",borderRadius:4,background:ROMAN_COLORS[s]?.bg,color:ROMAN_COLORS[s]?.fg,fontSize:11}}>{s}</span></th>)}
                        <th style={{textAlign:"center"}}>Cuti</th>
                        <th style={{textAlign:"center"}}>Total HK</th>
                        <th style={{textAlign:"center"}}>Jam</th>
                      </tr></thead>
                      <tbody>
                        {personnelConfig.filter(p=>p.include).map(p=>{
                          const stats = computeStats(p.id)
                          return (
                            <tr key={p.id}>
                              <td><strong>{p.name}</strong></td>
                              <td><span className="unit-tag">{p.unit}</span></td>
                              <td style={{textAlign:"center",fontSize:12,color:"var(--fg-muted)"}}>{p.roster_group}</td>
                              {["I","II","III","IV","V"].map(s=><td key={s} style={{textAlign:"center",fontSize:12}}>{stats?.[s]||0}</td>)}
                              <td style={{textAlign:"center",fontSize:12,color:"#dc2626"}}>{stats?.CUTI||0}</td>
                              <td style={{textAlign:"center",fontWeight:700}}>{stats?.total||0}</td>
                              <td style={{textAlign:"center",fontSize:12,color:"var(--fg-muted)"}}>{(stats?.total||0)*4}h</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div style={{marginTop:16,display:"flex",gap:10}}>
                <button className="btn btn-ghost" onClick={()=>setActiveTab("config")}><I n="edit" s={14}/> Ubah Konfigurasi</button>
                <button className="btn btn-primary" onClick={()=>setActiveTab("save")} style={{display:"flex",alignItems:"center",gap:6}}>
                  <I n="download" s={14}/> Lanjut Simpan
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: SIMPAN ═══ */}
      {activeTab==="save" && (
        <div>
          {!generated ? (
            <div className="panel"><div className="panel-body"><div className="empty-state"><I n="download" s={44}/><p>Generate jadwal terlebih dahulu</p></div></div></div>
          ) : saveResult?.ok ? (
            <div className="panel" style={{border:"2px solid #10b981"}}>
              <div className="panel-body">
                <div style={{textAlign:"center",padding:"24px 0"}}>
                  <div style={{fontSize:48,marginBottom:12}}>✅</div>
                  <div style={{fontSize:18,fontWeight:700,color:"#10b981",marginBottom:6}}>Roster Berhasil Disimpan!</div>
                  <div style={{fontSize:14,color:"var(--fg-muted)",marginBottom:20}}>{saveResult.count} records disimpan ke database{saveResult.skipped>0?` (${saveResult.skipped} gagal)`:""}</div>
                  <div style={{display:"flex",gap:10,justifyContent:"center"}}>
                    <button className="btn btn-ghost" onClick={()=>{setGenerated(null);setActiveTab("config");setSaveResult(null)}}><I n="refresh" s={14}/> Generate Bulan Lain</button>
                    <button className="btn btn-primary" onClick={()=>ctx.goPage("roster")}><I n="calendar" s={14}/> Lihat Roster</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="panel" style={{marginBottom:16}}>
                <div className="panel-header"><h2 className="panel-title"><I n="warn" s={15}/> Konfirmasi Simpan</h2></div>
                <div className="panel-body">
                  <div style={{fontSize:14,marginBottom:16}}>
                    Roster <strong>{MONTH_NAMES[selMonth-1]} {selYear}</strong> untuk cabang <strong>{selectedBranch}</strong> akan disimpan:
                  </div>
                  <div className="stats-grid">
                    <Stat icon="calendar" label="Total Records" value={generated.records.length} color="#38bdf8"/>
                    <Stat icon="mic" label="Personel" value={personnelConfig.filter(p=>p.include).length} color="#10b981"/>
                    <Stat icon="warn" label="Konflik" value={conflict.length} sub={conflict.length>0?"akan di-overwrite":""} color={conflict.length>0?"#ef4444":"#10b981"}/>
                  </div>

                  {conflict.length>0 && (
                    <div style={{marginTop:16,padding:"12px 16px",background:"#fef2f2",borderRadius:8,fontSize:13,color:"#dc2626",display:"flex",alignItems:"flex-start",gap:8}}>
                      <I n="warn" s={16}/>
                      <div>
                        <strong>Peringatan:</strong> Sudah ada {conflict.length} hari dengan roster di bulan ini. Jika klik <strong>"Simpan & Overwrite"</strong>, semua roster lama di bulan ini akan dihapus dan diganti dengan yang baru.
                      </div>
                    </div>
                  )}

                  {saveResult?.ok===false && (
                    <div style={{marginTop:12,padding:"10px 14px",background:"#fef2f2",borderRadius:8,fontSize:13,color:"#dc2626"}}>
                      Error: {saveResult.msg}
                    </div>
                  )}

                  <div style={{marginTop:20,display:"flex",gap:10,flexWrap:"wrap"}}>
                    <button className="btn btn-ghost" onClick={()=>setActiveTab("preview")}><I n="eye" s={14}/> Kembali ke Preview</button>
                    {conflict.length===0 ? (
                      <button className="btn btn-primary" onClick={()=>saveToSupabase(false)} disabled={saving} style={{display:"flex",alignItems:"center",gap:6}}>
                        <I n="download" s={14}/> {saving?"Menyimpan...":"Simpan ke Database"}
                      </button>
                    ) : (
                      <>
                        <button className="btn btn-primary" onClick={()=>saveToSupabase(false)} disabled={saving} style={{display:"flex",alignItems:"center",gap:6}}>
                          <I n="plus" s={14}/> {saving?"Menyimpan...":"Tambahkan Saja"}
                        </button>
                        <button className="btn btn-primary" onClick={()=>saveToSupabase(true)} disabled={saving} style={{background:"#ef4444",display:"flex",alignItems:"center",gap:6}}>
                          <I n="warn" s={14}/> {saving?"Menyimpan...":"Simpan & Overwrite"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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

  const loadData = async () => {
    const [brRes, secRes, logRes, hoRes, hcRes, pRes] = await Promise.all([
      supabase.from("branches").select("*").order("code"),
      supabase.from("sectors").select("*").order("sort_order"),
      supabase.from("position_logs").select("*").order("on_time",{ascending:false}).limit(500),
      supabase.from("handover_notes").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("handover_checklists").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("personnel").select("id,name,branch_code").eq("is_active",true).order("name"),
    ])
    if (brRes.data) setBranches(brRes.data)
    if (secRes.data) setSectors(secRes.data)
    if (logRes.data) setLogs(logRes.data)
    if (hoRes.data) setHandovers(hoRes.data)
    if (hcRes.data) setHandoverChecklists(hcRes.data)
    if (pRes.data) setPersonnel(pRes.data)
  }

  // Load data + auto refresh
  useEffect(() => {
    if (!user) return
    loadData()
    const i = setInterval(loadData, 15000)
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
    ? {dashboard:AdminDash,mon_roster:AdminMonRoster,mon_log:AdminMonLog,mon_today:AdminMonToday,mon_recap:AdminMonRecap,mon_handover:AdminMonHandover,export:AdminExport,audit:AdminAudit,roster_gen:RosterGenerator}
    : {dashboard:CabangDash,roster:CabangRoster,roster_gen:RosterGenerator,log:CabangLog,rekap:CabangRekap,handover:CabangHandover}
  const CurrentPage = pageMap[page] || pageMap.dashboard

  return (
    <AppContext.Provider value={{user,branches,sectors,logs,handovers,handoverChecklists,personnel,navBranch,setNavBranch,goPage:setPage,reload:loadData}}>
      <div className="app-layout">
        <Sidebar page={page} go={setPage} user={user} logout={handleLogout} col={col} toggle={() => setCol(!col)}/>
        <main className="main-area"><CurrentPage/></main>
      </div>
    </AppContext.Provider>
  )
}
