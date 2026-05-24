// ============================================================
// src/lib/constants.js — App-wide constants
// ============================================================

// ── Handover/Takeover checklist (Cabang & Admin Monitoring) ──
export const CHECKLIST_ITEMS = [
  { key:"traffic_situation", label:"Traffic Situation" },
  { key:"conflict_solution", label:"Conflict & Solution" },
  { key:"weather",           label:"Weather" },
  { key:"facilities",        label:"Facilities" },
  { key:"coordination",      label:"Coordination" },
  { key:"others",            label:"Others" },
]
export const STATUS_OPTS = ["OK", "Not OK", "N/A"]

// ── HO/TO MO Pre-Shift Briefing checklist ────────────────────
export const MO_PRE_SHIFT = [
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

// ── HO/TO MO Handover/Takeover checklist ─────────────────────
export const MO_HANDOVER = [
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

// ── HO/TO MO Post-Shift Briefing checklist ───────────────────
export const MO_POST_SHIFT = [
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

export const MO_TABS = [
  {id:"pre_shift",  label:"Pre-Shift Briefing", items:MO_PRE_SHIFT,  icon:"📋"},
  {id:"handover",   label:"Handover/Takeover",  items:MO_HANDOVER,   icon:"🔄"},
  {id:"post_shift", label:"Post-Shift Briefing",items:MO_POST_SHIFT, icon:"📝"},
]
