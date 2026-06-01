// ============================================================
// src/components/Icons.jsx — All app icons via single <I/> + RadarLogo
// ============================================================
import React from "react"

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
  "eye-off":"M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22",
  monitor:"M2 3h20v14H2zM8 21h8M12 17v4",
  building:"M4 2h16v20H4zM9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01",
  users:"M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  "map-pin":"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",

  // ── REDESIGN: added for new layouts ──
  trash:"M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6",
  // Phase 10 — emoji elimination additions:
  edit:"M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
  ban:"M4.93 4.93l14.14 14.14M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z",
  "cloud-storm":"M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9M13 11l-4 6h6l-4 6",
  "arrow-up-right":"M7 17 17 7M7 7h10v10",
  "arrow-down-right":"M7 7l10 10M17 7v10H7",
  refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  search:"M21 21l-4.35-4.35M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
  filter:"M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
  "chevron-down":"M6 9l6 6 6-6",
  "chevron-up":"M18 15l-6-6-6 6",
  "chevron-left":"M15 18l-6-6 6-6",
  "chevron-right":"M9 18l6-6-6-6",
  caret:"M6 9l6 6 6-6",
  chev:"M9 18l6-6-6-6",
  external:"M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
  home:"M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z",
  list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  "arrow-up":"M12 19V5M5 12l7-7 7 7",
  "arrow-down":"M12 5v14M19 12l-7 7-7-7",
  bell:"M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  alert:"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  "alert-triangle":"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  check:"M20 6 9 17 4 12",
  save:"M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8",
  send:"M22 2 11 13M22 2l-7 20-4-9-9-4z",
  file:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  globe:"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
  pin:"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  radio:"M4.93 19.07a10 10 0 0 1 0-14.14M19.07 4.93a10 10 0 0 1 0 14.14M7.76 16.24a6 6 0 0 1 0-8.48M16.24 7.76a6 6 0 0 1 0 8.48M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  wifi:"M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01",
  "wifi-off":"M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.58 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01",

  // ── Phase 5 additions (login prototype port) ──
  "arrow-right":"M5 12h14M12 5l7 7-7 7",
  info:"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 16v-4M12 8h.01",
  sun:"M7 12a5 5 0 1 0 10 0 5 5 0 1 0-10 0M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon:"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",

  // ── Roster restructure additions ──
  calendar:"M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18",
  wallet:"M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4z",
}

export const I = ({ n, s = 18 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={ICONS[n] || ""}/>
  </svg>
)

export const RadarLogo = ({ size = 28 }) => (
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
