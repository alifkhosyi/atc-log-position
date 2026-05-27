// ============================================================
// src/pages/RosterPage/OvertimeTab.tsx — Tab 3 "Jam Tambahan"
// ──────────────────────────────────────────────────────────
// Step 5 placeholder. Real implementation di step 7
// (form 5-field v3 simplified, CRUD ke atc_overtime, anti-pattern
// stability §10).
//
// Render placeholder card biar user tahu fitur datang.
// ============================================================

import React from "react"
import { I } from "../../components/Icons.jsx"

export default function OvertimeTab() {
  return (
    <div className="or-tab or-placeholder">
      <div className="or-placeholder-card">
        <div className="or-placeholder-ic">
          <I n="plus" s={32}/>
        </div>
        <h2>Jam Tambahan (Advance / Extend)</h2>
        <p>
          Fitur baru untuk pencatatan jam kontrol di luar window operasi.
          Form 5-field minimal: Personel · Tanggal · Jenis (Advance/Extend) ·
          Durasi (jam + menit) · Catatan.
        </p>
        <p className="faint">
          Implementasi datang di step 7 dari rangkaian roster restructure.
          Migration <code>20260527_overtime.sql</code> sudah landing — table
          <code>atc_overtime</code> ready menerima data.
        </p>
      </div>
    </div>
  )
}
