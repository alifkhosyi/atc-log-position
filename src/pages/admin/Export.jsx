// ============================================================
// src/pages/admin/Export.jsx — Export laporan (extracted as-is)
// ============================================================
import React, { useState, useEffect } from "react"
import { supabase } from "../../supabase.js"
import { useApp } from "../../lib/context.jsx"
import { fmtT, fmtD, fmtDT, durMin, getShift } from "../../lib/utils.js"
import { CHECKLIST_ITEMS, MO_TABS, MO_PRE_SHIFT, MO_HANDOVER, MO_POST_SHIFT } from "../../lib/constants.js"
import { I } from "../../components/Icons.jsx"
import { Pulse } from "../../components/Pulse.jsx"
import { Header } from "../../components/Header.jsx"
import { Stat } from "../../components/Stat.jsx"

export const AdminExport = () => {
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
      <div className="topbar">
        <div>
          <h1 className="topbar-title">Export Laporan</h1>
          <p className="topbar-sub">Download Excel atau PDF</p>
        </div>
      </div>

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
