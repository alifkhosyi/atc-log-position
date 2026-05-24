// ============================================================
// src/components/Login.jsx — Login screen
// ============================================================
import React, { useState } from "react"
import { supabase } from "../supabase.js"
import { RadarLogo } from "./Icons.jsx"

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
    if (error) { setErr(error.message); setLd(false); return }
    onLogin(data.session)
    setLd(false)
  }

  return (
    <div className="login-bg">
      <div className="login-particles">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="particle" style={{
            left: Math.random() * 100 + "%",
            top:  Math.random() * 100 + "%",
            animationDelay: Math.random() * 6 + "s",
            animationDuration: 4 + Math.random() * 4 + "s",
          }}/>
        ))}
      </div>
      <div className="login-container">
        <div className="login-brand">
          <div style={{ marginBottom: 16 }}><RadarLogo size={56}/></div>
          <h1 className="login-title">ATC LOG POSITION</h1>
          <p className="login-subtitle">AIRNAV INDONESIA</p>
          <p className="login-desc">Air Traffic Control Position Management System</p>
        </div>
        <div className="login-card">
          <h2 className="login-card-title">Masuk ke Sistem</h2>
          {err && <div className="login-error">{err}</div>}
          <div className="field">
            <label>Email</label>
            <input value={email} onChange={e => setEmail(e.target.value)}
                   placeholder="email@airnav.co.id"
                   onKeyDown={e => e.key === "Enter" && go()}/>
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={pw} onChange={e => setPw(e.target.value)}
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
