// ============================================================
// src/pages/admin/Dashboard.jsx — INMC dashboard (West/East hierarchy)
// ============================================================
import React from "react"
import { useApp } from "../../lib/context.jsx"
import { getShift } from "../../lib/utils.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

export const AdminDash = () => {
  const ctx = useApp()
  const allActive = ctx.logs.filter(l => !l.off_time)
  const todayLogs = ctx.logs.filter(l => new Date(l.on_time).toDateString() === new Date().toDateString())
  const todayTC = ctx.logs.filter(l => l.off_time && new Date(l.on_time).toDateString() === new Date().toDateString())
    .reduce((a, l) => a + (l.departure_count||0) + (l.arrival_count||0) + (l.overfly_count||0), 0)

  const brAct = {}, brTraffic = {}
  allActive.forEach(l => { brAct[l.branch_code] = (brAct[l.branch_code]||0) + 1 })
  todayLogs.filter(l => l.off_time).forEach(l => {
    const t = (l.departure_count||0) + (l.arrival_count||0) + (l.overfly_count||0)
    brTraffic[l.branch_code] = (brTraffic[l.branch_code]||0) + t
  })

  const handleBranchClick = (code) => { ctx.setNavBranch(code); ctx.goPage("mon_log") }

  const moCodeSet = new Set(ctx.moBranchCodes)
  const allBr = ctx.branches.filter(b => b.region)
  const westTop = allBr.filter(b => b.region === "west" && !b.parent_code).sort((a,b) => (brAct[b.code]||0) - (brAct[a.code]||0))
  const eastTop = allBr.filter(b => b.region === "east" && !b.parent_code).sort((a,b) => (brAct[b.code]||0) - (brAct[a.code]||0))

  const getDirectChildren = (code) => allBr.filter(b => b.parent_code === code)
  const getAllChildren = (code) => {
    const kids = getDirectChildren(code)
    const result = []
    for (const k of kids) {
      result.push(k)
      if (!moCodeSet.has(k.code)) result.push(...getAllChildren(k.code))
    }
    return result
  }

  const westCodes = allBr.filter(b => b.region === "west").map(b => b.code)
  const eastCodes = allBr.filter(b => b.region === "east").map(b => b.code)
  const westOnMic = allActive.filter(l => westCodes.includes(l.branch_code)).length
  const eastOnMic = allActive.filter(l => eastCodes.includes(l.branch_code)).length
  const westTraffic = Object.entries(brTraffic).filter(([k]) => westCodes.includes(k)).reduce((a, [, v]) => a + v, 0)
  const eastTraffic = Object.entries(brTraffic).filter(([k]) => eastCodes.includes(k)).reduce((a, [, v]) => a + v, 0)

  const BranchCard = ({ b, isTopLevel }) => {
    const c = brAct[b.code] || 0
    const traffic = brTraffic[b.code] || 0
    const children = isTopLevel ? getAllChildren(b.code) : []
    const childOnMic = children.reduce((a, ch) => a + (brAct[ch.code]||0), 0)
    const totalOnMic = c + childOnMic
    const persCount = ctx.personnel.filter(p => p.branch_code === b.code).length
    const moChildren   = children.filter(ch => moCodeSet.has(ch.code))
    const unitChildren = children.filter(ch => !moCodeSet.has(ch.code))
    const totalChildren = children.length

    return (
      <div onClick={() => handleBranchClick(b.code)} style={{
        cursor:"pointer", padding:"14px 16px", borderRadius:12, transition:"all .2s",
        border: totalOnMic > 0 ? "1.5px solid var(--status-on)" : "1px solid var(--border)",
        background: totalOnMic > 0 ? "var(--status-on-soft)" : "var(--card)",
        boxShadow: totalOnMic > 0 ? "0 0 16px rgba(16,185,129,.1)" : "none",
        opacity: totalOnMic > 0 ? 1 : .6,
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Pulse on={totalOnMic > 0} s={totalOnMic > 0 ? 9 : 6}/>
            <span style={{ fontSize:14, fontWeight:700, color:"var(--fg)" }}>{b.code}</span>
            <span style={{ fontSize:12, color:"var(--fg-muted)" }}>— {b.name}</span>
          </div>
          {totalOnMic > 0 && (
            <span style={{
              fontSize:11, fontWeight:700, color:"var(--status-on)", background:"var(--status-on-soft)",
              padding:"3px 10px", borderRadius:20, display:"flex", alignItems:"center", gap:4,
            }}><I n="mic" s={11}/> {totalOnMic}</span>
          )}
        </div>
        <div style={{ fontSize:11, color:"var(--fg-muted)", marginBottom: totalChildren > 0 ? 8 : 0 }}>
          {b.city} · {persCount} personel{traffic > 0 ? ` · ${traffic.toLocaleString()} traffic` : ""}
        </div>
        {moChildren.length > 0 && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom: unitChildren.length > 0 ? 6 : 0 }}>
            {moChildren.map(ch => {
              const chActive = (brAct[ch.code]||0) > 0
              const chOnMic = brAct[ch.code] || 0
              const chPers = ctx.personnel.filter(p => p.branch_code === ch.code).length
              const chTraffic = brTraffic[ch.code] || 0
              const regionBorder = b.region === "west" ? "rgba(37,99,235,.15)" : "rgba(220,38,38,.15)"
              return (
                <div key={ch.code} onClick={e => { e.stopPropagation(); handleBranchClick(ch.code) }} style={{
                  padding:"8px 10px", borderRadius:8, cursor:"pointer", transition:"all .15s", minWidth:90,
                  background: chActive ? "var(--status-on-soft)" : "var(--bg)",
                  border: chActive ? "1px solid rgba(16,185,129,.3)" : "1px solid " + regionBorder,
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:3 }}>
                    <Pulse on={chActive} s={5}/>
                    <span style={{ fontSize:11, fontWeight:700, color:"var(--fg)" }}>{ch.city || ch.name}</span>
                    <span style={{ fontSize:8, color:"#2563eb", background:"rgba(37,99,235,.1)",
                                   padding:"1px 5px", borderRadius:8, fontWeight:700 }}>MO</span>
                  </div>
                  <div style={{ fontSize:10, color:"var(--fg-muted)" }}>
                    {chPers} pers{chActive ? ` · ${chOnMic} on mic` : " · Idle"}{chTraffic > 0 ? ` · ${chTraffic}t` : ""}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {unitChildren.length > 0 && (
          <div style={{ fontSize:10, color:"var(--fg-muted)", paddingTop:6, borderTop:"0.5px solid var(--border)" }}>
            <I n="building" s={11}/> +{unitChildren.length} unit: {unitChildren.slice(0, 6).map(u => u.city || u.name).join(", ")}
            {unitChildren.length > 6 ? ", ..." : ""}
          </div>
        )}
      </div>
    )
  }

  const RegionSection = ({ title, branches, color, bgColor, onMic, traffic, icon }) => (
    <div>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"10px 14px", borderRadius:10, marginBottom:10, background: bgColor,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color }}><I n={icon} s={16}/></span>
          <span style={{ fontSize:14, fontWeight:700, color }}>{title}</span>
        </div>
        <div style={{ display:"flex", gap:12, fontSize:11, fontWeight:600 }}>
          <span style={{ color }}><I n="mic" s={11}/> {onMic} on mic</span>
          <span style={{ color }}><I n="plane" s={11}/> {traffic.toLocaleString()}</span>
          <span style={{ color:"var(--fg-muted)" }}>{branches.length} cabang</span>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {branches.map(b => <BranchCard key={b.code} b={b} isTopLevel={true}/>)}
      </div>
    </div>
  )

  const westMoChildren = allBr.filter(b => b.region === "west" && b.parent_code && moCodeSet.has(b.code))
    .sort((a,b) => (brAct[b.code]||0) - (brAct[a.code]||0))
  const eastMoChildren = allBr.filter(b => b.region === "east" && b.parent_code && moCodeSet.has(b.code))
    .sort((a,b) => (brAct[b.code]||0) - (brAct[a.code]||0))

  return (
    <div className="page-content">
      <Header title="Dashboard INMC" sub="Monitoring seluruh cabang — West & East Region"/>
      <div className="stats-grid">
        <Stat icon="radar" label="Total Lokasi" value={allBr.length} sub="West + East" color="var(--accent)"/>
        <Stat icon="mic"   label="On Mic"        value={allActive.length} sub={`W:${westOnMic} | E:${eastOnMic}`} color="var(--status-on)"/>
        <Stat icon="log"   label="Log Hari Ini"  value={todayLogs.length} sub={"Shift " + getShift()} color="var(--purple)"/>
        <Stat icon="plane" label="Traffic"       value={todayTC} sub={`W:${westTraffic} | E:${eastTraffic}`} color="var(--status-warn)"/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
        <div>
          <RegionSection title="West Region" branches={westTop} color="#3b82f6"
                         bgColor="rgba(37,99,235,.06)" onMic={westOnMic} traffic={westTraffic} icon="map-pin"/>
          {westMoChildren.length > 0 && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--text-faint)", marginTop:14, marginBottom:8,
                            paddingLeft:4, textTransform:"uppercase", letterSpacing:".5px" }}>
                Cabang MO Bawahan — West
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {westMoChildren.map(b => <BranchCard key={b.code} b={b} isTopLevel={true}/>)}
              </div>
            </>
          )}
        </div>
        <div>
          <RegionSection title="East Region" branches={eastTop} color="#dc2626"
                         bgColor="rgba(220,38,38,.06)" onMic={eastOnMic} traffic={eastTraffic} icon="map-pin"/>
          {eastMoChildren.length > 0 && (
            <>
              <div style={{ fontSize:11, fontWeight:700, color:"var(--text-faint)", marginTop:14, marginBottom:8,
                            paddingLeft:4, textTransform:"uppercase", letterSpacing:".5px" }}>
                Cabang MO Bawahan — East
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {eastMoChildren.map(b => <BranchCard key={b.code} b={b} isTopLevel={true}/>)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
