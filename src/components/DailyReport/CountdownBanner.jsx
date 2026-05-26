// ============================================================
// src/components/DailyReport/CountdownBanner.jsx
// ──────────────────────────────────────────────────────────
// Layer 3 reminder. Appears at the top of Section G when the
// current month has ≤ 5 days left AND there are still
// pending sessions to fill. Dismissable for the current page
// visit (resets on next mount, which is the desired nag).
//
// Only meaningful when the user is viewing a date in the
// current month — past months are read-only, future months
// have no deadline yet.
// ============================================================
import React, { useState } from "react"
import { I } from "../Icons.jsx"
import { daysToMonthEnd } from "../../hooks/useMonthLock.js"

export const CountdownBanner = ({ date, pendingCount, onJump }) => {
  const [dismissed, setDismissed] = useState(false)

  const now   = new Date()
  const sameM = date.getFullYear() === now.getFullYear()
               && date.getMonth()  === now.getMonth()
  const days  = daysToMonthEnd(date)

  if (dismissed) return null
  if (!sameM) return null
  if (days > 5) return null
  if (pendingCount <= 0) return null

  return (
    <div className="sg-countdown" role="alert">
      <span className="sg-countdown-bar"/>
      <span className="sg-countdown-icon"><I n="alert" s={20}/></span>
      <div className="sg-countdown-body">
        <b>
          {days === 0
            ? "Hari terakhir bulan ini"
            : `Tersisa ${days} hari sampai akhir bulan`}
        </b>
        <p>
          Masih ada <b>{pendingCount}</b> session belum diisi DEP/ARR/OVF.
          Setelah tanggal 1 bulan depan, data bulan ini akan dikunci.
        </p>
      </div>
      <div className="sg-countdown-actions">
        {onJump && (
          <button type="button" className="sg-btn-ghost" onClick={onJump}>
            Lihat yang pending
          </button>
        )}
        <button
          type="button"
          className="sg-btn-x"
          aria-label="Tutup pengingat"
          onClick={() => setDismissed(true)}
        >
          <I n="x" s={14}/>
        </button>
      </div>
    </div>
  )
}
