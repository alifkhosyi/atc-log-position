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
    {id:"mon_checklist",label:"Monitoring Checklist",icon:"checklist"},
    {id:"mon_handover",label:"Monitoring Handover Notes",icon:"handover"},
    {id:"export",label:"Export Laporan",icon:"download"},
    {id:"audit",label:"Audit Log",icon:"shield"},
  ] : [
    {id:"dashboard",label:"Dashboard",icon:"dashboard"},
    {id:"log",label:"Log Position",icon:"mic"},
    {id:"strips",label:"Flight Strips",icon:"upload"},
    {id:"rekap",label:"Rekap Strips",icon:"chart"},
    {id:"handover",label:"Handover Checklist",icon:"checklist"},
    {id:"handover_notes",label:"Handover Notes",icon:"note"},
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
  const active = ctx.logs.filter(l => !l.off_time)
  const today = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const todayTC = ctx.strips.filter(s => new Date(s.strip_date).toDateString() === new Date().toDateString()).reduce((a,s) => a+s.traffic_count, 0)
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
  const mySectors = ctx.sectors.filter(s => s.branch_code === ctx.user.branch_code)

  const [unit,setUnit] = useState(br.units[0]||"TWR")
  const [nm,setNm] = useState("")
  const [show,setShow] = useState(false)
  const [offId,setOffId] = useState(null)
  const [tc,setTc] = useState("")
  const [saving,setSaving] = useState(false)

  const unitSectors = mySectors.filter(s => s.unit === unit)
  const [si,setSi] = useState(0)
  const cwps = unitSectors[si] ? unitSectors[si].cwps : ["Controller","Assistant"]
  const [ci,setCi] = useState(0)

  const active = ctx.logs.filter(l => !l.off_time)
  const today = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())

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
    else { await ctx.reload(); setNm(""); setShow(false) }
    setSaving(false)
  }

  const offMic = async (id) => {
    setSaving(true)
    const { error } = await supabase.from("position_logs").update({
      off_time: new Date().toISOString(),
      traffic_count: parseInt(tc) || 0
    }).eq("id", id)
    if (error) alert("Error: " + error.message)
    else { await ctx.reload(); setOffId(null); setTc("") }
    setSaving(false)
  }

  return (
    <div className="page-content">
      <Header title="Log Position" sub={"Input posisi ATC — "+ctx.user.branch_code}/>
      {active.length > 0 && <div className="panel panel-glow">
        <div className="panel-header"><h2 className="panel-title"><Pulse s={10}/> ATC On Mic ({active.length})</h2></div>
        <div className="panel-body">{active.map(l => (
          <div key={l.id} className="active-position">
            <div className="active-position-info">
              {[["Nama",l.atc_name],["Unit",l.unit],["Sektor",l.sector],["CWP",l.cwp],["On",fmtT(l.on_time)],["Durasi",durMin(l.on_time,new Date().toISOString())+"m"]].map(([k,v]) => <div key={k} className="active-pos-row"><span className="active-pos-label">{k}</span><span className="active-pos-value">{v}</span></div>)}
            </div>
            {offId===l.id ? (
              <div className="off-mic-form">
                <div className="field" style={{marginBottom:0,minWidth:120}}><label>Traffic</label><input type="number" value={tc} onChange={e => setTc(e.target.value)} placeholder="0"/></div>
                <div className="off-mic-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => offMic(l.id)} disabled={saving}><I n="micOff" s={14}/> Off</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setOffId(null)}>Batal</button>
                </div>
              </div>
            ) : <button className="btn btn-danger btn-sm" onClick={() => setOffId(l.id)}><I n="micOff" s={14}/> Off Mic</button>}
          </div>
        ))}</div>
      </div>}

      <button className="btn btn-primary btn-lg" onClick={() => setShow(!show)} style={{marginBottom:20}}><I n={show?"x":"mic"} s={18}/> {show?"Tutup Form":"Input ATC On Mic"}</button>

      {show && <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Form On Mic</h2></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field"><label>Nama ATC</label><input value={nm} onChange={e => setNm(e.target.value)} placeholder="Nama lengkap ATC"/></div>
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
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Nama</th><th>Unit</th><th>Sektor</th><th>CWP</th><th>Shift</th><th>On</th><th>Off</th><th>Durasi</th><th>Traffic</th><th>Status</th></tr></thead>
          <tbody>{today.map(l => <tr key={l.id}><td><strong>{l.atc_name}</strong></td><td><span className="unit-tag">{l.unit}</span></td><td>{l.sector}</td><td>{l.cwp}</td><td>{l.shift}</td><td>{fmtT(l.on_time)}</td><td>{l.off_time?fmtT(l.off_time):"-"}</td><td>{l.off_time?durMin(l.on_time,l.off_time)+"m":"..."}</td><td>{l.traffic_count||"-"}</td><td>{l.off_time?<span className="status-badge status-off">Off</span>:<span className="status-badge status-on"><Pulse s={6}/> On</span>}</td></tr>)}</tbody></table></div>}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// FPS COLOR DETECTION ENGINE
// ============================================================
const _rgbToHsl = (r,g,b) => {
  r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2
  if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6}
  return[h*360,s*100,l*100]
}
const _classifyPx = (r,g,b) => {
  const[h,s,l]=_rgbToHsl(r,g,b)
  if(l<25)return"dark"
  if(h>=175&&h<=220&&s>=30&&l>=45&&l<=85)return"departure"
  if(h>=38&&h<=72&&s>=40&&l>=55&&l<=92)return"arrival"
  if(s<=12&&l>=80)return"white_cand"
  return"other"
}
const _analyzeRow = (d,y,w) => {
  const c={departure:0,arrival:0,white_cand:0,dark:0,other:0}
  for(let x=0;x<w;x+=2){const i=(y*w+x)*4;const cls=_classifyPx(d[i],d[i+1],d[i+2]);c[cls]=(c[cls]||0)+1}
  const t=Math.ceil(w/2),nd=t-(c.dark||0);if(nd<t*.3)return null
  const best=[{k:"departure",n:c.departure},{k:"arrival",n:c.arrival},{k:"white_cand",n:c.white_cand}].sort((a,b)=>b.n-a.n)[0]
  return(best.n/nd>=.30&&best.n>=10)?best.k:null
}
const _hasGrid = (d,sy,ey,w) => {
  const mid=Math.floor((sy+ey)/2)
  for(const y of[mid-2,mid,mid+2].filter(v=>v>=sy&&v<=ey)){
    let trans=0,prev=false
    for(let x=0;x<w;x++){const i=(y*w+x)*4;const dk=_rgbToHsl(d[i],d[i+1],d[i+2])[2]<40;if(dk&&!prev)trans++;prev=dk}
    if(trans>=3)return true
  }
  return false
}
const _detectFPS = (imgData,w,h) => {
  const d=imgData.data,rows=[]
  for(let y=0;y<h;y++)rows.push(_analyzeRow(d,y,w))
  const bands=[];let cur=null,start=0
  for(let i=0;i<rows.length;i++){
    if(rows[i]===cur)continue
    if(cur)bands.push({color:cur,sy:start,ey:i-1,h:i-start})
    cur=rows[i];start=i
  }
  if(cur)bands.push({color:cur,sy:start,ey:rows.length-1,h:rows.length-start})
  const minH=h*.02,maxH=h*.35,strips={departure:0,arrival:0,overfly:0}
  for(const b of bands){
    if(b.h<minH||b.h>maxH)continue
    if(b.color==="departure"||b.color==="arrival")strips[b.color]++
    else if(b.color==="white_cand"&&_hasGrid(d,b.sy,b.ey,w))strips.overfly++
  }
  return strips
}

const FPS_HOURS = (()=>{const a=[];for(let h=0;h<24;h++)for(let m=0;m<60;m+=30)a.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);return a})()
const FPS_TYPES = [
  {key:"departure",label:"DEP",full:"Departure",sub:"Biru",color:"#0284C7",bg:"#E0F2FE",ring:"#7DD3FC",text:"#0C4A6E"},
  {key:"arrival",label:"ARR",full:"Arrival",sub:"Kuning",color:"#CA8A04",bg:"#FEF9C3",ring:"#FDE68A",text:"#854D0E"},
  {key:"overfly",label:"OVF",full:"Overfly",sub:"Putih",color:"#64748B",bg:"#F1F5F9",ring:"#CBD5E1",text:"#334155"},
]

// ============================================================
// CABANG: FLIGHT STRIPS (with FPS Detection)
// ============================================================
const CabangStrips = () => {
  const ctx = useApp()
  const br = ctx.branches.find(b => b.code === ctx.user.branch_code) || {units:["TWR"]}
  const mySectors = ctx.sectors.filter(s => s.branch_code === ctx.user.branch_code)
  const my = [...ctx.strips].reverse()

  const [preview,setPreview] = useState(null)
  const [counts,setCounts] = useState(null)
  const [analyzing,setAnalyzing] = useState(false)
  const [saving,setSaving] = useState(false)
  const [saved,setSaved] = useState(false)

  const [unit,setUnit] = useState(br.units?.[0]||"TWR")
  const unitSectors = mySectors.filter(s => s.unit === unit)
  const [sectorIdx,setSectorIdx] = useState(0)
  const [petugas,setPetugas] = useState(ctx.user.display_name||"")
  const [stripDate,setStripDate] = useState(new Date().toISOString().slice(0,10))
  const [jamMulai,setJamMulai] = useState("07:00")
  const [jamSelesai,setJamSelesai] = useState("14:00")
  const [notes,setNotes] = useState("")

  const cvRef = useRef(null)
  const fileRef = useRef(null)
  const total = counts ? counts.departure + counts.arrival + counts.overfly : 0

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if(!file) return
    setSaved(false); setCounts(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPreview(ev.target.result)
      const img = new Image()
      img.onload = () => {
        setAnalyzing(true)
        setTimeout(() => {
          const cv = cvRef.current; if(!cv) return
          const sc = Math.min(1, 800/Math.max(img.width,img.height))
          cv.width = Math.round(img.width*sc); cv.height = Math.round(img.height*sc)
          const ctx2 = cv.getContext("2d",{willReadFrequently:true})
          ctx2.drawImage(img,0,0,cv.width,cv.height)
          setCounts(_detectFPS(ctx2.getImageData(0,0,cv.width,cv.height),cv.width,cv.height))
          setAnalyzing(false)
        },100)
      }
      img.src = ev.target.result
    }
    reader.readAsDataURL(file)
  }

  const resetForm = () => {
    setPreview(null); setCounts(null); setAnalyzing(false); setSaved(false); setNotes("")
    if(fileRef.current) fileRef.current.value=""
  }

  const handleSave = async () => {
    if(saving) return
    setSaving(true)
    const row = {
      branch_code: ctx.user.branch_code,
      unit,
      sector: unitSectors[sectorIdx]?.name || "Sector 1",
      shift: getShift(),
      strip_date: stripDate,
      file_name: fileRef.current?.files?.[0]?.name || "strip_foto",
      traffic_count: total,
      departure_count: counts?.departure || 0,
      arrival_count: counts?.arrival || 0,
      overfly_count: counts?.overfly || 0,
      petugas,
      jam_mulai: jamMulai,
      jam_selesai: jamSelesai,
      notes,
      ocr_status: "processed",
      uploaded_by: ctx.user.id
    }
    const { error } = await supabase.from("flight_strips").insert(row)
    if(error) alert("Error: "+error.message)
    else { await ctx.reload(); setSaved(true) }
    setSaving(false)
  }

  const selSt = {width:"100%",padding:"9px 12px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:13,outline:"none"}

  return (
    <div className="page-content">
      <Header title="Flight Strips" sub={"Upload & deteksi FPS — "+ctx.user.branch_code}/>
      <canvas ref={cvRef} style={{display:"none"}}/>

      {/* Upload Panel */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title"><I n="upload" s={16}/> Upload Foto Strip</h2></div>
        <div className="panel-body">
          {!preview ? (
            <div className="drop-zone" onClick={() => fileRef.current?.click()}>
              <I n="upload" s={40}/>
              <p className="drop-title">Klik atau tap untuk upload foto FPS</p>
              <p className="drop-hint">Otomatis deteksi strip biru (DEP), kuning (ARR), putih (OVF)</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handleUpload}/>
            </div>
          ) : (
            <div style={{position:"relative"}}>
              <img src={preview} alt="FPS" style={{width:"100%",borderRadius:10,maxHeight:260,objectFit:"cover",display:"block",border:"1px solid var(--border)"}}/>
              {analyzing && (
                <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.7)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
                  <span className="login-spinner"/><p style={{color:"#fff",marginTop:12,fontSize:13}}>Mendeteksi flight strips...</p>
                </div>
              )}
              <button onClick={resetForm} style={{position:"absolute",top:8,right:8,width:28,height:28,borderRadius:"50%",background:"rgba(0,0,0,.5)",border:"none",color:"#fff",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
          )}
        </div>
      </div>

      {/* Detection Result + Form */}
      {counts && !analyzing && (
        <div className="panel" style={{animation:"fadeIn .3s ease"}}>
          <div className="panel-header"><h2 className="panel-title"><I n="plane" s={16}/> Hasil Deteksi</h2><span className="panel-counter">Total: {total}</span></div>
          <div className="panel-body">

            {/* Result cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
              {FPS_TYPES.map(t => (
                <div key={t.key} style={{background:t.bg,borderRadius:10,padding:"14px 8px",textAlign:"center",border:`1.5px solid ${t.ring}`}}>
                  <div style={{fontSize:28,fontWeight:800,color:t.color,lineHeight:1}}>{counts[t.key]}</div>
                  <div style={{fontSize:11,fontWeight:700,color:t.text,marginTop:6}}>{t.full}</div>
                  <div style={{fontSize:9,color:t.text+"88"}}>{t.sub}</div>
                </div>
              ))}
            </div>

            {/* Ratio bar */}
            {total>0 && <div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",gap:2,marginBottom:20}}>
              {FPS_TYPES.map(t => {const p=(counts[t.key]/total)*100;return p>0?<div key={t.key} style={{width:p+"%",background:t.color,borderRadius:3,transition:"width .5s"}}/>:null})}
            </div>}

            {total===0 && <div className="empty-state" style={{padding:"12px 0"}}><p style={{color:"#f59e0b"}}>Tidak ada FPS terdeteksi — pastikan foto menampilkan strip berwarna dengan jelas.</p></div>}

            {/* Form fields */}
            <div className="form-grid">
              <div className="field"><label>Petugas / Controller</label><input value={petugas} onChange={e => setPetugas(e.target.value)} placeholder="Nama lengkap"/></div>
              <div className="field"><label>Unit</label><select value={unit} onChange={e => {setUnit(e.target.value);setSectorIdx(0)}} style={selSt}>{(br.units||["TWR"]).map(u => <option key={u}>{u}</option>)}</select></div>
              <div className="field"><label>Sektor</label><select value={sectorIdx} onChange={e => setSectorIdx(+e.target.value)} style={selSt}>{unitSectors.length>0?unitSectors.map((s,i) => <option key={i} value={i}>{s.name}</option>):<option>-</option>}</select></div>
              <div className="field"><label>Tanggal</label><input type="date" value={stripDate} onChange={e => setStripDate(e.target.value)}/></div>
              <div className="field"><label>Jam Mulai</label><select value={jamMulai} onChange={e => setJamMulai(e.target.value)} style={selSt}>{FPS_HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
              <div className="field"><label>Jam Selesai</label><select value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} style={selSt}>{FPS_HOURS.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
            </div>
            <div className="field" style={{marginTop:8}}><label>Catatan (opsional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Cuaca, traffic, koordinasi khusus..."/></div>

            <button className={"btn "+(saved?"btn-success":"btn-primary")} onClick={handleSave} disabled={saving||saved||!petugas.trim()} style={{marginTop:16,width:"100%"}}>
              <I n={saved?"shield":"upload"} s={16}/> {saving?"Menyimpan...":saved?"✓ Tersimpan":"Simpan Data Strip"}
            </button>
          </div>
        </div>
      )}

      {/* History table */}
      {my.length > 0 && <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Riwayat Upload</h2><span className="panel-counter">{my.length}</span></div>
        <div className="panel-body"><div className="table-wrap"><table className="data-table"><thead><tr><th>Tanggal</th><th>Jam</th><th>Petugas</th><th>Unit</th><th>Sektor</th><th style={{textAlign:"center",color:"#0284C7"}}>DEP</th><th style={{textAlign:"center",color:"#CA8A04"}}>ARR</th><th style={{textAlign:"center",color:"#64748B"}}>OVF</th><th style={{textAlign:"center"}}>Total</th></tr></thead>
        <tbody>{my.map(s => <tr key={s.id}>
          <td>{fmtD(s.strip_date)}</td>
          <td style={{color:"var(--fg-muted)"}}>{s.jam_mulai||"-"}{s.jam_selesai?("–"+s.jam_selesai):""}</td>
          <td><strong>{s.petugas||"-"}</strong></td>
          <td><span className="unit-tag">{s.unit}</span></td>
          <td>{s.sector||"-"}</td>
          <td style={{textAlign:"center",color:"#0284C7",fontWeight:700}}>{s.departure_count||0}</td>
          <td style={{textAlign:"center",color:"#CA8A04",fontWeight:700}}>{s.arrival_count||0}</td>
          <td style={{textAlign:"center",color:"#64748B",fontWeight:700}}>{s.overfly_count||0}</td>
          <td style={{textAlign:"center",fontWeight:800}}>{s.traffic_count}</td>
        </tr>)}</tbody></table></div></div>
      </div>}
    </div>
  )
}

// ============================================================
// CABANG: HANDOVER CHECKLIST (NEW)
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
  const [showForm,setShowForm] = useState(false)
  const [saving,setSaving] = useState(false)
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

  const submit = async () => {
    if(!f.manager_on_duty.trim()||!f.incoming_personnel.trim()||!f.outgoing_personnel.trim()){alert("Mohon isi Manager on Duty, Incoming & Outgoing Personnel");return}
    setSaving(true)
    const {error} = await supabase.from("handover_checklists").insert({...f, branch_id:ctx.user.id, created_by:ctx.user.id})
    if(error) alert("Error: "+error.message)
    else {setF(initForm());setShowForm(false);await ctx.reload()}
    setSaving(false)
  }

  const del = async (id) => {
    if(!confirm("Hapus checklist ini?"))return
    await supabase.from("handover_checklists").delete().eq("id",id)
    await ctx.reload()
  }

  return (
    <div className="page-content">
      <Header title="Handover/Takeover Checklist" sub={"Format resmi serah terima — "+ctx.user.branch_code}/>

      {!showForm && <button className="btn btn-primary btn-lg" onClick={() => setShowForm(true)} style={{marginBottom:20}}><I n="plus" s={16}/> Buat Checklist Baru</button>}

      {showForm && <div className="panel" style={{animation:"fadeIn .3s ease"}}>
        <div className="panel-header"><h2 className="panel-title"><I n="checklist" s={16}/> Handover/Takeover Checklist</h2></div>
        <div className="panel-body">
          {/* Header fields */}
          <div className="form-grid">
            <div className="field"><label>Date</label><input type="date" value={f.checklist_date} onChange={e => set("checklist_date",e.target.value)}/></div>
            <div className="field"><label>Time</label><input type="time" value={f.checklist_time} onChange={e => set("checklist_time",e.target.value)}/></div>
            <div className="field"><label>Manager on Duty</label><input value={f.manager_on_duty} onChange={e => set("manager_on_duty",e.target.value)} placeholder="Nama MOD..."/></div>
            <div className="field"><label>Shift</label><select value={f.shift} onChange={e => set("shift",e.target.value)}><option value="">Pilih...</option><option value="Pagi">Pagi</option><option value="Siang">Siang</option><option value="Malam">Malam</option></select></div>
          </div>

          {/* Checklist table */}
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

          {/* Signatures */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,padding:"20px 0",borderTop:"2px solid var(--border)"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--fg-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Incoming Personnel</div>
              <input value={f.incoming_personnel} onChange={e => set("incoming_personnel",e.target.value)} placeholder="Nama incoming..." style={{padding:"10px",borderRadius:4,border:"1px solid var(--border)",borderBottom:"2px solid var(--fg)",fontSize:14,fontWeight:600,textAlign:"center",width:"100%",background:"var(--card)",color:"var(--fg)"}}/>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:11,fontWeight:700,color:"var(--fg-muted)",textTransform:"uppercase",letterSpacing:".5px",marginBottom:8}}>Outgoing Personnel</div>
              <input value={f.outgoing_personnel} onChange={e => set("outgoing_personnel",e.target.value)} placeholder="Nama outgoing..." style={{padding:"10px",borderRadius:4,border:"1px solid var(--border)",borderBottom:"2px solid var(--fg)",fontSize:14,fontWeight:600,textAlign:"center",width:"100%",background:"var(--card)",color:"var(--fg)"}}/>
            </div>
          </div>

          {/* Buttons */}
          <div style={{display:"flex",gap:10,justifyContent:"flex-end",marginTop:12}}>
            <button className="btn btn-ghost" onClick={() => {setShowForm(false);setF(initForm())}}>Batal</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}><I n="checklist" s={16}/> {saving?"Menyimpan...":"Simpan Checklist"}</button>
          </div>
        </div>
      </div>}

      {/* List */}
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
                  <button className="btn btn-ghost btn-sm" onClick={e => {e.stopPropagation();del(cl.id)}} style={{color:"#ef4444",fontSize:11,padding:"2px 8px"}}>Hapus</button>
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
    </div>
  )
}

// ============================================================
// CABANG: HANDOVER NOTES (existing, preserved)
// ============================================================
const CabangHandoverNotes = () => {
  const ctx = useApp()
  const [txt,setTxt] = useState("")
  const [pri,setPri] = useState("normal")
  const [saving,setSaving] = useState(false)

  const add = async () => {
    if (!txt.trim()||saving) return
    setSaving(true)
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
    else { await ctx.reload(); setTxt(""); setPri("normal") }
    setSaving(false)
  }

  return (
    <div className="page-content">
      <Header title="Handover Notes" sub="Catatan serah terima"/>
      <div className="panel"><div className="panel-header"><h2 className="panel-title">Buat Catatan</h2></div>
        <div className="panel-body">
          <div className="form-grid">
            <div className="field"><label>Prioritas</label><select value={pri} onChange={e => setPri(e.target.value)}><option value="normal">Normal</option><option value="medium">Medium</option><option value="high">Urgent</option></select></div>
            <div className="field"><label>Shift</label><input value={"Shift "+getShift()+" → "+SHIFTS[(SHIFTS.indexOf(getShift())+1)%3]} disabled/></div>
          </div>
          <div className="field"><label>Catatan</label><textarea value={txt} onChange={e => setTxt(e.target.value)} rows={4} placeholder="Catatan untuk shift berikutnya..."/></div>
          <button className="btn btn-primary" onClick={add} disabled={!txt.trim()||saving}><I n="note" s={16}/> {saving?"Menyimpan...":"Simpan"}</button>
        </div>
      </div>
      <div className="panel"><div className="panel-header"><h2 className="panel-title">Riwayat</h2><span className="panel-counter">{ctx.handovers.length}</span></div>
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
// CABANG: REKAP FLIGHT STRIPS
// ============================================================
const CabangRekap = () => {
  const ctx = useApp()
  const myStrips = ctx.strips.filter(s => s.branch_code === ctx.user.branch_code)
  const [period,setPeriod] = useState("month")
  const [filterPetugas,setFilterPetugas] = useState("")
  const [filterUnit,setFilterUnit] = useState("")
  const [chartMode,setChartMode] = useState("bar")

  const filtered = myStrips.filter(s => {
    const d = (new Date()-new Date(s.strip_date))/864e5
    const pOk = period==="today" ? new Date(s.strip_date).toDateString()===new Date().toDateString() : period==="week" ? d<=7 : d<=30
    const petOk = !filterPetugas || (s.petugas||"").toLowerCase().includes(filterPetugas.toLowerCase())
    const unitOk = !filterUnit || (s.unit||"").toLowerCase().includes(filterUnit.toLowerCase())
    return pOk && petOk && unitOk
  }).sort((a,b) => (b.strip_date+""+(b.jam_mulai||"")).localeCompare(a.strip_date+""+(a.jam_mulai||"")))

  const totals = filtered.reduce((a,r) => ({dep:a.dep+(r.departure_count||0),arr:a.arr+(r.arrival_count||0),ovf:a.ovf+(r.overfly_count||0),tc:a.tc+(r.traffic_count||0)}),{dep:0,arr:0,ovf:0,tc:0})

  // Group by date for chart
  const byDate = {}
  filtered.forEach(r => {
    if(!byDate[r.strip_date]) byDate[r.strip_date] = {dep:0,arr:0,ovf:0}
    byDate[r.strip_date].dep += r.departure_count||0
    byDate[r.strip_date].arr += r.arrival_count||0
    byDate[r.strip_date].ovf += r.overfly_count||0
  })
  const dates = Object.keys(byDate).sort()
  const chartMax = Math.max(1,...dates.map(d => byDate[d].dep+byDate[d].arr+byDate[d].ovf))

  const exportCSV = () => {
    const head = ["Tanggal","Jam Mulai","Jam Selesai","Petugas","Unit","Sektor","DEP","ARR","OVF","Total","Catatan"]
    const rows = filtered.map(r => [r.strip_date,r.jam_mulai||"",r.jam_selesai||"",r.petugas||"",r.unit||"",r.sector||"",r.departure_count||0,r.arrival_count||0,r.overfly_count||0,r.traffic_count||0,`"${(r.notes||"").replace(/"/g,'""')}"`])
    const csv = [head.join(","),...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"})
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `rekap_fps_${ctx.user.branch_code}_${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="page-content">
      <Header title="Rekap Flight Strips" sub={"Data traffic — "+ctx.user.branch_code}/>

      {/* Filter bar */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <div className="filter-bar" style={{margin:0}}>{[["today","Hari Ini"],["week","7 Hari"],["month","30 Hari"]].map(([k,v]) => <button key={k} className={"filter-btn"+(period===k?" filter-btn-active":"")} onClick={() => setPeriod(k)}>{v}</button>)}</div>
        <input value={filterPetugas} onChange={e => setFilterPetugas(e.target.value)} placeholder="Filter petugas..." className="filter-input" style={{flex:1,minWidth:100,padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}/>
        <input value={filterUnit} onChange={e => setFilterUnit(e.target.value)} placeholder="Unit..." className="filter-input" style={{width:80,padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--fg)",fontSize:12}}/>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        <Stat icon="plane" label="Total FPS" value={totals.tc} sub={filtered.length+" record"} color="#10b981"/>
        <Stat icon="upload" label="Departure" value={totals.dep} color="#0284C7"/>
        <Stat icon="download" label="Arrival" value={totals.arr} color="#CA8A04"/>
        <Stat icon="radar" label="Overfly" value={totals.ovf} color="#64748B"/>
      </div>

      {/* Chart */}
      {dates.length>0 && <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title"><I n="chart" s={16}/> Grafik</h2>
          <div style={{display:"flex",gap:4}}>
            {[["bar","Bar"],["line","Trend"]].map(([k,v]) => <button key={k} className={"filter-btn"+(chartMode===k?" filter-btn-active":"")} onClick={() => setChartMode(k)} style={{padding:"4px 12px",fontSize:11}}>{v}</button>)}
          </div>
        </div>
        <div className="panel-body">
          <svg viewBox={`0 0 680 ${chartMode==="line"?200:240}`} width="100%" style={{display:"block"}}>
            {chartMode==="bar" ? (
              <>
                {/* Bar chart */}
                {[0,.25,.5,.75,1].map(f => {const y=20+(1-f)*180;return <g key={f}><line x1="46" y1={y} x2="664" y2={y} stroke="var(--border)" strokeWidth=".5"/><text x="42" y={y+4} textAnchor="end" fontSize="10" fill="var(--fg-muted)">{Math.round(chartMax*f)}</text></g>})}
                {dates.map((d,i) => {
                  const gw=Math.min(54,(618/dates.length)-8),bw=Math.max(3,(gw-4)/3),gap=(618-gw*dates.length)/(dates.length+1)
                  const x0=46+gap+i*(gw+gap)
                  const vals=[byDate[d].dep,byDate[d].arr,byDate[d].ovf],cols=["#0284C7","#CA8A04","#64748B"]
                  return <g key={d}>
                    {vals.map((v,j) => {const bh=(v/chartMax)*180;return <rect key={j} x={x0+j*(bw+1)} y={20+180-bh} width={bw} height={Math.max(0,bh)} fill={cols[j]} rx="2" opacity=".85"/>})}
                    <text x={x0+gw/2} y={225} textAnchor="middle" fontSize="9" fill="var(--fg-muted)" transform={`rotate(-25,${x0+gw/2},225)`}>{d.slice(5)}</text>
                  </g>
                })}
              </>
            ) : (
              <>
                {/* Line chart */}
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
              </>
            )}
          </svg>
          {/* Legend */}
          <div style={{display:"flex",gap:16,justifyContent:"center",marginTop:8}}>
            {FPS_TYPES.map(t => <div key={t.key} style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--fg-muted)"}}><div style={{width:10,height:10,borderRadius:2,background:t.color}}/>{t.full}</div>)}
          </div>
        </div>
      </div>}

      {/* Data Table */}
      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Data Detail</h2><span className="panel-counter">{filtered.length}</span></div>
        <div className="panel-body">
          {filtered.length===0 ? <div className="empty-state"><p>Tidak ada data untuk filter ini</p></div> :
          <div className="table-wrap"><table className="data-table"><thead><tr>
            <th>Tanggal</th><th>Jam</th><th>Petugas</th><th>Unit</th><th>Sektor</th>
            <th style={{textAlign:"center",color:"#0284C7"}}>DEP</th>
            <th style={{textAlign:"center",color:"#CA8A04"}}>ARR</th>
            <th style={{textAlign:"center",color:"#64748B"}}>OVF</th>
            <th style={{textAlign:"center"}}>Total</th><th>Catatan</th>
          </tr></thead>
          <tbody>{filtered.map(s => <tr key={s.id}>
            <td style={{whiteSpace:"nowrap"}}>{fmtD(s.strip_date)}</td>
            <td style={{whiteSpace:"nowrap",color:"var(--fg-muted)",fontSize:12}}>{s.jam_mulai||"-"}{s.jam_selesai?(" – "+s.jam_selesai):""}</td>
            <td><strong>{s.petugas||"-"}</strong></td>
            <td><span className="unit-tag">{s.unit}</span></td>
            <td>{s.sector||"-"}</td>
            <td style={{textAlign:"center",color:"#0284C7",fontWeight:700}}>{s.departure_count||0}</td>
            <td style={{textAlign:"center",color:"#CA8A04",fontWeight:700}}>{s.arrival_count||0}</td>
            <td style={{textAlign:"center",color:"#64748B",fontWeight:700}}>{s.overfly_count||0}</td>
            <td style={{textAlign:"center",fontWeight:800}}>{s.traffic_count}</td>
            <td style={{fontSize:11,color:"var(--fg-muted)",maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.notes||"-"}</td>
          </tr>)}</tbody>
          <tfoot><tr style={{fontWeight:700}}>
            <td colSpan={5} style={{textAlign:"right",color:"var(--fg-muted)"}}>TOTAL</td>
            <td style={{textAlign:"center",color:"#0284C7"}}>{totals.dep}</td>
            <td style={{textAlign:"center",color:"#CA8A04"}}>{totals.arr}</td>
            <td style={{textAlign:"center",color:"#64748B"}}>{totals.ovf}</td>
            <td style={{textAlign:"center"}}>{totals.tc}</td>
            <td></td>
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
  const todayTC = ctx.strips.filter(s => new Date(s.strip_date).toDateString() === new Date().toDateString()).reduce((a,s) => a+s.traffic_count, 0)
  const brAct = {}
  allActive.forEach(l => { brAct[l.branch_code] = (brAct[l.branch_code]||0)+1 })

  return (
    <div className="page-content">
      <Header title="Dashboard Admin Pusat" sub="Monitoring seluruh 70 cabang"/>
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
          return (
            <div key={b.code} className={"branch-card"+(c>0?" branch-card-active":"")}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="branch-code">{b.code}</div><Pulse on={c>0} s={7}/></div>
              <div className="branch-name">{b.name}</div><div className="branch-city">{b.city}</div>
              <div className="branch-units">{b.units.map(u => <span key={u} className="branch-unit-tag">{u}</span>)}</div>
              <div className="branch-status"><I n="mic" s={11}/> {c} on mic</div>
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
  const [br,setBr] = useState("ALL")
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
// ADMIN: MONITORING RECAP
// ============================================================
const AdminMonRecap = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [period,setPeriod] = useState("today")
  const fl = ctx.strips.filter(s => {
    const brOk = br==="ALL" || s.branch_code===br
    const d = (new Date()-new Date(s.strip_date))/864e5
    const pOk = period==="today" ? new Date(s.strip_date).toDateString()===new Date().toDateString() : period==="week" ? d<=7 : d<=30
    return brOk && pOk
  })
  const tot = fl.reduce((a,s) => a+s.traffic_count, 0)
  const byBr = {}
  fl.forEach(s => { if(!byBr[s.branch_code]) byBr[s.branch_code]={tc:0,n:0}; byBr[s.branch_code].tc+=s.traffic_count; byBr[s.branch_code].n++ })
  const brKeys = Object.keys(byBr).sort((a,b) => byBr[b].tc-byBr[a].tc)
  let mx = 1; brKeys.forEach(k => { if(byBr[k].tc>mx) mx=byBr[k].tc })

  return (
    <div className="page-content">
      <Header title="Monitoring Rekap Traffic" sub="Dari flight strips"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}><option value="ALL">Semua Cabang</option>{ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}</select>
        <div className="filter-bar" style={{margin:0}}>{[["today","Hari Ini"],["week","Minggu"],["month","Bulan"]].map(([k,v]) => <button key={k} className={"filter-btn"+(period===k?" filter-btn-active":"")} onClick={() => setPeriod(k)}>{v}</button>)}</div>
      </div>
      <div className="stats-grid">
        <Stat icon="plane" label="Total Traffic" value={tot} color="#10b981"/>
        <Stat icon="upload" label="Strip" value={fl.length} color="#38bdf8"/>
        <Stat icon="building" label="Cabang" value={brKeys.length} color="#8b5cf6"/>
      </div>
      {brKeys.length>0 && <div className="panel"><div className="panel-header"><h2 className="panel-title">Traffic Per Cabang</h2></div><div className="panel-body"><div className="simple-chart">{brKeys.map(code => <div key={code} className="chart-bar-row"><span className="chart-label">{code}</span><div className="chart-bar-track"><div className="chart-bar-fill" style={{width:(byBr[code].tc/mx*100)+"%"}}><span className="chart-bar-value">{byBr[code].tc}</span></div></div></div>)}</div></div></div>}
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING HANDOVER CHECKLIST (NEW)
// ============================================================
const AdminMonChecklist = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const [filterDate,setFilterDate] = useState("")

  const fl = ctx.handoverChecklists.filter(c => {
    const brOk = br==="ALL" || c.branch_id===br
    const dOk = !filterDate || c.checklist_date===filterDate
    return brOk && dOk
  })
  const [expandedId,setExpandedId] = useState(null)

  // Map branch_id to account info
  const accts = ctx.branches // fallback: we'll use branch_code matching
  const getAcctName = (bid) => {
    // Try to find a branch whose id matches, but since accounts table isn't in ctx,
    // we show branch_id short form. Admin can cross-reference.
    const found = ctx.branches.find(b => b.id === bid)
    return found ? found.code+" — "+found.city : bid?.slice(0,8)+"..."
  }

  return (
    <div className="page-content">
      <Header title="Monitoring Handover Checklist" sub="Dari seluruh cabang"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}>
          <option value="ALL">Semua Cabang</option>
          {/* Get unique branch_ids from checklists */}
          {[...new Set(ctx.handoverChecklists.map(c => c.branch_id))].map(bid => <option key={bid} value={bid}>{getAcctName(bid)}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="br-select"/>
        {filterDate && <button className="btn btn-ghost btn-sm" onClick={() => setFilterDate("")}>✕ Reset</button>}
      </div>

      <div className="stats-grid">
        <Stat icon="checklist" label="Total Checklist" value={fl.length} color="#8b5cf6"/>
        <Stat icon="shield" label="Not OK Items" value={fl.reduce((a,c) => a+CHECKLIST_ITEMS.filter(it => c[it.key+"_status"]==="Not OK").length,0)} color="#ef4444" sub="Perlu perhatian"/>
      </div>

      <div className="panel">
        <div className="panel-header"><h2 className="panel-title">Handover Checklists</h2><span className="panel-counter">{fl.length}</span></div>
        <div className="panel-body">
          {fl.length===0 ? <div className="empty-state"><I n="checklist" s={44}/><p>Tidak ada checklist ditemukan</p></div> :
          fl.map(cl => {
            const notOk = CHECKLIST_ITEMS.filter(it => cl[it.key+"_status"]==="Not OK").length
            return (
              <div key={cl.id} className={"handover-card "+(notOk>0?"handover-high":"handover-normal")} style={{cursor:"pointer"}} onClick={() => setExpandedId(expandedId===cl.id?null:cl.id)}>
                <div className="handover-header">
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <span style={{fontSize:14}}>{expandedId===cl.id?"▾":"▸"}</span>
                    <span className="handover-branch" style={{background:"#f5f3ff",color:"#6d28d9",padding:"2px 10px",borderRadius:12,fontSize:12,fontWeight:700}}>{getAcctName(cl.branch_id)}</span>
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
    </div>
  )
}

// ============================================================
// ADMIN: MONITORING HANDOVER NOTES
// ============================================================
const AdminMonHandover = () => {
  const ctx = useApp()
  const [br,setBr] = useState("ALL")
  const fl = br==="ALL" ? ctx.handovers : ctx.handovers.filter(h => h.branch_code===br)

  return (
    <div className="page-content">
      <Header title="Monitoring Handover Notes" sub="Dari seluruh cabang"/>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,flexWrap:"wrap"}}>
        <span className="monitor-label"><I n="eye" s={12}/> MONITORING</span>
        <select className="br-select" value={br} onChange={e => setBr(e.target.value)}><option value="ALL">Semua Cabang</option>{ctx.branches.map(a => <option key={a.code} value={a.code}>{a.code} — {a.city}</option>)}</select>
      </div>
      <div className="panel"><div className="panel-header"><h2 className="panel-title">Handover Notes</h2><span className="panel-counter">{fl.length}</span></div>
        <div className="panel-body">{fl.length===0 ? <div className="empty-state"><p>Belum ada</p></div> : fl.map(n => {
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
const AdminExport = () => (
  <div className="page-content"><Header title="Export Laporan" sub="PDF atau Excel"/>
    <div className="panel"><div className="panel-body"><div className="empty-state"><I n="download" s={44}/><p>Fitur export akan tersedia setelah integrasi jsPDF & SheetJS</p></div></div></div>
  </div>
)
const AdminAudit = () => (
  <div className="page-content"><Header title="Audit Log" sub="Aktivitas sistem"/>
    <div className="panel"><div className="panel-body"><div className="empty-state"><I n="shield" s={44}/><p>Audit log akan aktif setelah integrasi penuh</p></div></div></div>
  </div>
)

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [session,setSession] = useState(null)
  const [user,setUser] = useState(null)
  const [page,setPage] = useState("dashboard")
  const [col,setCol] = useState(false)
  const [loading,setLoading] = useState(true)

  const [branches,setBranches] = useState([])
  const [sectors,setSectors] = useState([])
  const [logs,setLogs] = useState([])
  const [strips,setStrips] = useState([])
  const [handovers,setHandovers] = useState([])
  const [handoverChecklists,setHandoverChecklists] = useState([])

  // Check existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (s) { setSession(s); loadProfile(s) }
      else setLoading(false)
    })
  }, [])

  const loadProfile = async (s) => {
    const { data, error } = await supabase.from("accounts").select("*").eq("id", s.user.id).single()
    if (data) { setUser(data); setSession(s) }
    else { alert("Akun tidak ditemukan di tabel accounts"); await supabase.auth.signOut() }
    setLoading(false)
  }

  const loadData = async () => {
    const [brRes, secRes, logRes, stripRes, hoRes, hcRes] = await Promise.all([
      supabase.from("branches").select("*").order("code"),
      supabase.from("sectors").select("*").order("sort_order"),
      supabase.from("position_logs").select("*").order("on_time",{ascending:false}).limit(500),
      supabase.from("flight_strips").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("handover_notes").select("*").order("created_at",{ascending:false}).limit(200),
      supabase.from("handover_checklists").select("*").order("created_at",{ascending:false}).limit(200),
    ])
    if (brRes.data) setBranches(brRes.data)
    if (secRes.data) setSectors(secRes.data)
    if (logRes.data) setLogs(logRes.data)
    if (stripRes.data) setStrips(stripRes.data)
    if (hoRes.data) setHandovers(hoRes.data)
    if (hcRes.data) setHandoverChecklists(hcRes.data)
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
    await supabase.auth.signOut()
    setSession(null); setUser(null); setPage("dashboard")
    setBranches([]); setSectors([]); setLogs([]); setStrips([]); setHandovers([]); setHandoverChecklists([])
  }

  if (loading) return <div className="loading-screen"><RadarLogo size={56}/><p>Memuat...</p><span className="login-spinner"/></div>
  if (!session) return <Login onLogin={handleLogin}/>
  if (!user) return <div className="loading-screen"><RadarLogo size={56}/><p>Memuat profil...</p><span className="login-spinner"/></div>

  const pageMap = user.role === "admin"
    ? {dashboard:AdminDash,mon_log:AdminMonLog,mon_recap:AdminMonRecap,mon_checklist:AdminMonChecklist,mon_handover:AdminMonHandover,export:AdminExport,audit:AdminAudit}
    : {dashboard:CabangDash,log:CabangLog,strips:CabangStrips,rekap:CabangRekap,handover:CabangHandover,handover_notes:CabangHandoverNotes}
  const CurrentPage = pageMap[page] || pageMap.dashboard

  return (
    <AppContext.Provider value={{user,branches,sectors,logs,strips,handovers,handoverChecklists,reload:loadData}}>
      <div className="app-layout">
        <Sidebar page={page} go={setPage} user={user} logout={handleLogout} col={col} toggle={() => setCol(!col)}/>
        <main className="main-area"><CurrentPage/></main>
      </div>
    </AppContext.Provider>
  )
}
