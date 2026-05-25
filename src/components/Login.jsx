// ============================================================
// src/components/Login.jsx — Login screen (Phase 4 audit fix C-06)
// ──────────────────────────────────────────────────────────
// Audit feedback (v1.0): particle effect, 3px letter-spacing title, gradient
// button — visual register error untuk operational tool.
//
// Changes:
//   - Hapus 15 particle elements (CPU-wasted decoration)
//   - Override letter-spacing & gradient via login-clean.css (new file)
//   - Keep all auth logic intact
// ============================================================
import React, { useState } from "react"
import { supabase } from "../supabase.js"
import { RadarLogo } from "./Icons.jsx"
import "../styles/login-clean.css"

export const Login = ({ onLogin }) => {
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [err, setErr] = useState("")
  const [ld, setLd] = useState(false)

  const go = async () => {
    if (!email.trim() || !pw.trim()) { setErr("Masukkan email dan password"); return }
    setLd(true); setErr("")
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pw.trim(),
    })
    if (error) {
      // Translate Supabase error ke Indonesian
      const raw = (error.message || "").toLowerCase()
      let friendly = error.message
      if (raw.includes("invalid login credentials")) friendly = "Email atau password salah"
      else if (raw.includes("rate limit")) friendly = "Terlalu banyak percobaan, tunggu sebentar"
      else if (raw.includes("network") || raw.includes("fetch")) friendly = "Koneksi terputus, coba lagi"
      else if (raw.includes("not confirmed")) friendly = "Email belum dikonfirmasi"
      setErr(friendly)
      setLd(false)
      return
    }
    onLogin(data.session)
    setLd(false)
  }

  return (
    <div className="login-bg">
      <div className="login-container">
        <div className="login-brand">
          <div style={{ marginBottom: 16 }}><RadarLogo size={56}/></div>
          <h1 className="login-title">ATC LOG POSITION</h1>
          <p className="login-subtitle">AIRNAV INDONESIA</p>
          <p className="login-desc">Air Traffic Control Position Management System</p>
        </div>
        <div className="login-card">
          <h2 className="login-card-title">Masuk ke Sistem</h2>
          {err && <div className="login-error" role="alert">{err}</div>}
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@airnav.co.id"
              onKeyDown={e => e.key === "Enter" && go()}/>
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === "Enter" && go()}/>
          </div>
          <button className="login-btn" onClick={go} disabled={ld}>
            {ld ? <span className="login-spinner"/> : "Masuk"}
          </button>
        </div>
        <p className="login-footer">© 2026 Airnav Indonesia</p>
      </div>
    </div>
  )
}
