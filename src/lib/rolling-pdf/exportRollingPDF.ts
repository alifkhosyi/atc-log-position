// ============================================================
// src/lib/rolling-pdf/exportRollingPDF.ts
// ──────────────────────────────────────────────────────────
// Export Rolling Harian sebagai PDF lewat native browser print.
//
// Strategi: buka window baru dengan HTML print-optimized layout +
// inline CSS @page landscape A4, lalu trigger window.print(). User
// pilih "Save as PDF" di print dialog → file PDF tersimpan.
//
// Trade-off: bukan auto-save tanpa interaksi (perlu user pencet
// Save), tapi ZERO dependency (no jsPDF/html2canvas needed).
// Native browser PDF generation = real PDF, bukan rasterized image.
//
// Document title diset ke nama file yang sugesti → browser
// auto-fill filename di Save dialog.
// ============================================================

import type { DailyRolling, RecapEntry } from "../rolling-engine"

export interface ExportRollingPDFOptions {
  airportCode: string
  airportName: string
  unit: string
  /** ISO YYYY-MM-DD */
  date: string
  /** Indonesian long date, e.g. "Senin, 28 Mei 2026" */
  dateLong: string
  /** Roster status — ditampilkan di header */
  rosterStatus: "DRAFT" | "FINAL" | "NONE"
  /** Result dari computeMonthlyRolling()[selectedDay] */
  daily: DailyRolling
  /** Result dari computeRecap(daily) */
  recap: Record<string, RecapEntry> | null
  /**
   * Personnel lookup by key (key sama dengan key di daily.on_duty,
   * biasanya initial). Value: full name untuk display.
   */
  personnelNameByKey: Record<string, string>
}

/**
 * Suggest filename — caller pakai untuk set document.title atau download attr.
 */
export function suggestFilename(opts: { airportCode: string; unit: string; date: string }): string {
  return `Rolling_${opts.airportCode}_${opts.unit}_${opts.date}.pdf`
}

/**
 * Trigger native browser print-to-PDF flow.
 * Opens new window with print-optimized HTML, calls window.print().
 *
 * Returns true if window opened successfully; false if popup blocked.
 */
export function exportRollingPDF(opts: ExportRollingPDFOptions): boolean {
  const filename = suggestFilename(opts)
  const html = buildPrintHTML(opts, filename)

  const w = window.open("", "_blank", "width=1200,height=800")
  if (!w) return false  // popup blocked

  w.document.open()
  w.document.write(html)
  w.document.close()

  // Wait a tick for fonts/layout to settle, then trigger print.
  // Close window after print dialog closes (user cancel or finish).
  w.onload = () => {
    setTimeout(() => {
      try {
        w.focus()
        w.print()
      } catch (e) {
        // print might fail silently in some browsers — non-fatal
        console.warn("[rolling-pdf] print() failed:", e)
      }
    }, 200)
  }

  return true
}

/* ────────────────────────────────────────────────────────────
   HTML builder (inline CSS for portability — no external assets)
   ──────────────────────────────────────────────────────────── */
function buildPrintHTML(opts: ExportRollingPDFOptions, filename: string): string {
  const {
    airportCode, airportName, unit, dateLong, rosterStatus,
    daily, recap, personnelNameByKey,
  } = opts

  const printedAt = new Date().toLocaleString("id-ID", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })

  const startTime = daily.slots[0]?.start_utc ?? "—"
  const endTime = daily.slots[daily.slots.length - 1]?.end_utc ?? "—"

  // Build table rows
  const rows = daily.on_duty.map(ini => {
    const name = personnelNameByKey[ini] || ini
    const cells = daily.slots.map(s => {
      const pos = s.assignments[ini] || "—"
      return `<td class="cell ${posClass(pos)}">${posLabel(pos)}</td>`
    }).join("")
    return `<tr><td class="name"><b>${escapeHTML(ini)}</b><br><span class="full">${escapeHTML(name)}</span></td>${cells}</tr>`
  }).join("")

  const headerSlots = daily.slots.map(s =>
    `<th>${s.start_utc}<br>${s.end_utc}</th>`
  ).join("")

  // Recap footer
  const recapLine = recap && daily.on_duty.length > 0
    ? buildRecapLine(recap, daily.on_duty)
    : ""

  // Status pill
  const statusClass = rosterStatus.toLowerCase()

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>${escapeHTML(filename)}</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    color: #0f1424;
    background: #fff;
    line-height: 1.4;
    padding: 0;
  }
  .doc { width: 100%; }

  /* Header */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-bottom: 10px;
    border-bottom: 2px solid #0f1424;
    margin-bottom: 10px;
  }
  .doc-header h1 {
    font-size: 16px;
    font-weight: 700;
    letter-spacing: -.005em;
    margin-bottom: 3px;
  }
  .doc-header .sub {
    font-size: 11px;
    color: #4a5568;
  }
  .doc-header .sub b { color: #0f1424; font-weight: 600; }
  .doc-header .meta {
    font-size: 10px;
    text-align: right;
    color: #4a5568;
  }
  .doc-header .meta .pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    font-weight: 600;
    margin-bottom: 2px;
    font-size: 9.5px;
    letter-spacing: .04em;
  }
  .doc-header .meta .pill.final { background: rgba(5,150,105,.15); color: #059669; }
  .doc-header .meta .pill.draft { background: rgba(217,119,6,.15); color: #d97706; }
  .doc-header .meta .pill.none  { background: #eef2f8; color: #8492a6; }

  /* Shift section */
  .shift-section {
    margin-bottom: 10px;
  }
  .shift-h {
    background: #f6f9fd;
    border: 1px solid #d8e0ed;
    border-bottom: 0;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
  }
  .shift-h .token {
    display: inline-block;
    padding: 1px 6px;
    background: rgba(2,132,199,.10);
    color: #0284c7;
    border-radius: 3px;
    font-size: 9.5px;
    letter-spacing: .04em;
    text-transform: uppercase;
    margin-right: 6px;
  }
  .shift-h .meta {
    font-weight: 400;
    color: #4a5568;
    font-size: 10px;
  }

  /* Grid table */
  table.grid {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
  }
  table.grid thead th {
    background: #f6f9fd;
    border: 1px solid #d8e0ed;
    padding: 5px 6px;
    font-size: 9.5px;
    font-weight: 500;
    color: #4a5568;
    letter-spacing: .03em;
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
  }
  table.grid thead th.col-name { text-align: left; padding-left: 10px; min-width: 26mm; }
  table.grid tbody td {
    border: 1px solid #d8e0ed;
    padding: 5px 6px;
    text-align: center;
    font-family: ui-monospace, "Courier New", monospace;
    font-size: 10px;
    font-weight: 600;
  }
  table.grid tbody td.name {
    text-align: left;
    padding: 4px 10px;
    font-family: inherit;
    font-weight: 500;
    background: #fff;
  }
  table.grid tbody td.name .full {
    font-size: 9px;
    color: #8492a6;
    font-weight: 400;
  }
  table.grid tbody td.cell {
    padding: 0;
  }
  table.grid tbody td.cell > span {
    display: inline-block;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 9.5px;
    letter-spacing: .04em;
    font-weight: 700;
    min-width: 22mm;
  }
  /* Backgrounds for print: force colors via -webkit-print-color-adjust */
  td.cell.kontrol   { background: rgba(5,150,105,.18); color: #047857; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td.cell.asisten   { background: rgba(217,119,6,.20);  color: #b45309; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td.cell.istirahat { background: #eef2f8; color: #4a5568; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Recap footer */
  .recap {
    background: #f6f9fd;
    border: 1px solid #d8e0ed;
    border-top: 0;
    padding: 6px 10px;
    font-size: 10px;
    color: #4a5568;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 18px;
  }
  .recap b { color: #0f1424; font-weight: 600; }
  .recap .swatch {
    display: inline-block;
    width: 8px; height: 8px;
    border-radius: 2px;
    margin-right: 3px;
    vertical-align: middle;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .recap .swatch.k { background: #047857; }
  .recap .swatch.a { background: #b45309; }
  .recap .swatch.r { background: #8492a6; opacity: .5; }

  /* Legend */
  .legend {
    margin-top: 10px;
    padding: 6px 10px;
    border: 1px solid #d8e0ed;
    border-radius: 4px;
    font-size: 9.5px;
    color: #4a5568;
    display: flex;
    gap: 10px 16px;
    flex-wrap: wrap;
  }
  .legend b { color: #0f1424; font-weight: 600; }
  .legend .sw {
    display: inline-block;
    width: 10px; height: 10px;
    border-radius: 2px;
    margin-right: 4px;
    vertical-align: middle;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .legend .sw.kontrol   { background: rgba(5,150,105,.30); border: 1px solid #047857; }
  .legend .sw.asisten   { background: rgba(217,119,6,.30); border: 1px solid #b45309; }
  .legend .sw.istirahat { background: #eef2f8; border: 1px solid #8492a6; }

  /* Footer (printed bottom of last page) */
  .doc-footer {
    margin-top: 16px;
    padding-top: 8px;
    border-top: 1px solid #d8e0ed;
    font-size: 9.5px;
    color: #8492a6;
    display: flex;
    justify-content: space-between;
  }

  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="doc">
    <div class="doc-header">
      <div>
        <h1>Rolling Harian — ${escapeHTML(airportName)} ${escapeHTML(unit)}</h1>
        <div class="sub"><b>${escapeHTML(dateLong)}</b> · Cabang ${escapeHTML(airportCode)}</div>
      </div>
      <div class="meta">
        <span class="pill ${statusClass}">Roster · ${rosterStatus}</span><br>
        ${daily.on_duty.length} personnel on-duty · ${daily.slots.length} slot
      </div>
    </div>

    <div class="shift-section">
      <div class="shift-h">
        <div><span class="token">Shift I</span>${startTime} – ${endTime}</div>
        <div class="meta">${daily.slots[0]?.duration_min ?? "?"} menit/slot</div>
      </div>
      <table class="grid">
        <thead>
          <tr>
            <th class="col-name">Personnel</th>
            ${headerSlots}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      ${recapLine}
    </div>

    <div class="legend">
      <span><span class="sw kontrol"></span><b>KONTROL</b> — Mic aktif, kontrol traffic</span>
      <span><span class="sw asisten"></span><b>ASISTEN</b> — Support kontrol, koordinasi</span>
      <span><span class="sw istirahat"></span><b>ISTIRAHAT</b> — Off-mic, rest period</span>
    </div>

    <div class="doc-footer">
      <span>ATC Log Position — Rolling Harian</span>
      <span>Dicetak: ${escapeHTML(printedAt)}</span>
    </div>
  </div>
</body>
</html>`
}

function buildRecapLine(
  recap: Record<string, RecapEntry>,
  onDuty: string[],
): string {
  if (onDuty.length === 0) return ""
  const avgK = avgMin(recap, onDuty, "Kontrol")
  const avgA = avgMin(recap, onDuty, "Asisten")
  const avgR = avgMin(recap, onDuty, "Istirahat")
  return `<div class="recap">
    <span><span class="swatch k"></span> Kontrol <b>${minToH(avgK)} jam</b></span>
    <span><span class="swatch a"></span> Asisten <b>${minToH(avgA)} jam</b></span>
    <span><span class="swatch r"></span> Istirahat <b>${minToH(avgR)} jam</b></span>
    <span style="margin-left: auto; font-size: 9px;">Rata-rata per personnel (${onDuty.length} orang)</span>
  </div>`
}

function avgMin(recap: Record<string, RecapEntry>, ids: string[], pos: string): number {
  if (ids.length === 0) return 0
  return ids.reduce((s, i) => s + (recap[i]?.[pos] || 0), 0) / ids.length
}
function minToH(min: number): string {
  return (min / 60).toFixed(1)
}

function posClass(pos: string): string {
  const p = pos.toLowerCase()
  if (p === "kontrol")   return "kontrol"
  if (p === "asisten")   return "asisten"
  if (p === "istirahat") return "istirahat"
  return ""
}
function posLabel(pos: string): string {
  const p = pos.toLowerCase()
  if (p === "kontrol")   return "<span>KONTROL</span>"
  if (p === "asisten")   return "<span>ASISTEN</span>"
  if (p === "istirahat") return "<span>ISTIRAHAT</span>"
  return escapeHTML(pos)
}

function escapeHTML(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
