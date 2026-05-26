// ============================================================
// src/components/Login.jsx — Login screen (Phase 5 · prototype 1:1)
// ──────────────────────────────────────────────────────────
// Ports the standalone "Login Prototype" verbatim and wires it
// to real Supabase auth.
//
// IMPORTANT — class names are namespaced `lp-*` to avoid the
// global collisions that bit the first deploy. src/index.css
// owns `.field`, `.field input`, `.field label`, `.input-wrap`,
// `.input-wrap input`, `.btn-primary` etc., and was leaking
// uppercase labels, gradient buttons, and tall inputs into this
// page. The matching stylesheet is src/styles/login-clean.css.
//
// What's added over the prototype:
//   • Real Supabase auth (signInWithPassword + resetPasswordForEmail)
//   • Friendly Indonesian error mapping
//   • Network online/offline awareness (window events)
//   • Double-submit guard + aria-busy
//   • Auto-focus first empty field on mount
//   • Inline client-side validation (email shape + min length)
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../supabase.js"
import { I } from "./Icons.jsx"
import "../styles/login-clean.css"

/* ----------------------------------------------------------------
   helpers
   ---------------------------------------------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const friendlyAuthError = (raw = "") => {
  const m = String(raw).toLowerCase()
  if (m.includes("invalid login credentials") || m.includes("invalid_grant"))
    return "Email atau password salah. Silakan periksa kembali."
  if (m.includes("rate limit") || m.includes("too many"))
    return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi."
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch"))
    return "Koneksi terputus. Pastikan internet Anda aktif lalu coba lagi."
  if (m.includes("not confirmed") || m.includes("email not confirmed"))
    return "Email belum dikonfirmasi. Cek inbox Anda untuk link aktivasi."
  if (m.includes("user not found"))
    return "Akun tidak ditemukan. Hubungi admin AirNav untuk pendaftaran."
  return raw || "Terjadi kesalahan. Silakan coba lagi."
}

const validateEmail = (v) => {
  const t = (v || "").trim()
  if (!t) return "Email wajib diisi."
  if (!EMAIL_RE.test(t)) return "Format email tidak valid."
  return ""
}
const validatePassword = (v) => {
  if (!v) return "Password wajib diisi."
  if (v.length < 6) return "Password minimal 6 karakter."
  return ""
}

/* ----------------------------------------------------------------
   live UTC clock — hero footer
   ---------------------------------------------------------------- */
const fmtZ = (d) => {
  const pad = (n) => String(n).padStart(2, "0")
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z`
}
const useNow = () => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(t)
  }, [])
  return now
}

/* ----------------------------------------------------------------
   theme — same contract as ThemeToggle.jsx (atc-theme key)
   ---------------------------------------------------------------- */
const readTheme = () => {
  try { return localStorage.getItem("atc-theme") === "light" ? "light" : "dark" }
  catch { return "dark" }
}
const useTheme = () => {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => {
    if (theme === "light") document.documentElement.dataset.theme = "light"
    else document.documentElement.removeAttribute("data-theme")
    try { localStorage.setItem("atc-theme", theme) } catch {}
  }, [theme])
  return [theme, setTheme]
}

/* ----------------------------------------------------------------
   Hero pane
   ---------------------------------------------------------------- */
const Hero = ({ online }) => {
  const now = useNow()
  return (
    <aside className="lp-hero" aria-hidden="true">
      <div className="lp-lockup">
        <span className="lp-mark" aria-hidden="true" />
        <div className="lp-lockup-text">
          <b>Log Position</b>
          <small>AirNav Indonesia · Operations</small>
        </div>
      </div>

      <div className="lp-pitch">
        <span className="lp-eyebrow">Operational sign-in</span>
        <h1>Catat posisi, handover, dan jam jaga <em>tanpa friksi.</em></h1>
        <p>
          Satu tempat untuk Log Position, Handover Mo-to-Mo, dan rekap traffic
          harian — dari menara hingga kantor pusat.
        </p>

        <ul className="lp-features">
          <li>
            <I n="check" s={14} />
            <span><b>Approval otomatis</b> sesuai FRMS &amp; control allowance.</span>
          </li>
          <li>
            <I n="check" s={14} />
            <span><b>Audit trail penuh</b> untuk setiap pergantian shift.</span>
          </li>
          <li>
            <I n="check" s={14} />
            <span><b>Multi-cabang</b> dengan permission per-role.</span>
          </li>
        </ul>
      </div>

      <div className="lp-hero-footer">
        <span className={`lp-trust${online ? "" : " is-offline"}`}>
          <span className="lp-dot" />
          <b>{online ? "Sistem operasional" : "Sambungan terputus"}</b>
        </span>
        <span className="lp-hero-clock">{fmtZ(now)}</span>
      </div>
    </aside>
  )
}

/* ----------------------------------------------------------------
   Login form
   ---------------------------------------------------------------- */
const LoginForm = ({ online, onLogin }) => {
  const [email, setEmail]       = useState("")
  const [pw, setPw]             = useState("")
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw]     = useState(false)
  const [caps, setCaps]         = useState(false)

  const [emailErr, setEmailErr] = useState("")
  const [pwErr, setPwErr]       = useState("")
  const [banner, setBanner]     = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [resetting,  setResetting]  = useState(false)

  const emailRef = useRef(null)
  const pwRef    = useRef(null)

  // focus first empty field on mount
  useEffect(() => {
    const t = window.setTimeout(() => {
      (email ? pwRef.current : emailRef.current)?.focus({ preventScroll: true })
    }, 50)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // sync offline banner
  useEffect(() => {
    if (!online) {
      setBanner({
        kind: "warn",
        title: "Sedang offline",
        message: "Sambungkan internet Anda untuk melanjutkan.",
      })
    } else {
      setBanner((b) => (b && b.title === "Sedang offline" ? null : b))
    }
  }, [online])

  const handleKey = (e) => {
    if (typeof e.getModifierState === "function") {
      setCaps(e.getModifierState("CapsLock"))
    }
  }

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.()
    if (submitting || resetting) return
    if (!online) {
      setBanner({
        kind: "warn",
        title: "Sedang offline",
        message: "Sambungkan internet Anda untuk melanjutkan.",
      })
      return
    }
    const eErr = validateEmail(email)
    const pErr = validatePassword(pw)
    setEmailErr(eErr); setPwErr(pErr)
    if (eErr || pErr) {
      ;(eErr ? emailRef : pwRef).current?.focus()
      return
    }

    setSubmitting(true); setBanner(null)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pw,
      })
      if (error) {
        setBanner({
          kind: "danger",
          title: "Gagal masuk",
          message: friendlyAuthError(error.message),
        })
        setSubmitting(false)
        pwRef.current?.focus()
        return
      }
      onLogin?.(data?.session ?? null)
    } catch (err) {
      setBanner({
        kind: "danger",
        title: "Gagal masuk",
        message: friendlyAuthError(err?.message || ""),
      })
      setSubmitting(false)
    }
  }, [email, pw, online, submitting, resetting, onLogin])

  const handleForgot = useCallback(async () => {
    if (resetting || submitting) return
    const eErr = validateEmail(email)
    if (eErr) {
      setEmailErr("Isi email Anda dulu untuk reset password.")
      emailRef.current?.focus()
      return
    }
    if (!online) {
      setBanner({
        kind: "warn",
        title: "Sedang offline",
        message: "Sambungkan internet Anda untuk mengirim email reset.",
      })
      return
    }
    setResetting(true); setBanner(null)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      })
      if (error) {
        setBanner({
          kind: "danger",
          title: "Reset gagal",
          message: friendlyAuthError(error.message),
        })
      } else {
        setBanner({
          kind: "success",
          title: "Email terkirim",
          message: `Instruksi reset dikirim ke ${email.trim()}.`,
        })
      }
    } catch (err) {
      setBanner({
        kind: "danger",
        title: "Reset gagal",
        message: friendlyAuthError(err?.message || ""),
      })
    } finally {
      setResetting(false)
    }
  }, [email, online, resetting, submitting])

  const formBusy = submitting || resetting

  return (
    <form
      className="lp-form-card"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={formBusy ? "true" : "false"}
    >
      {/* Mobile brand — only visible ≤ 980px (see CSS) */}
      <div className="lp-lockup lp-mobile-lockup">
        <span className="lp-mark" aria-hidden="true" />
        <div className="lp-lockup-text">
          <b>Log Position</b>
          <small>AirNav Indonesia</small>
        </div>
      </div>

      <div className="lp-form-eyebrow">Sign in · v5.0</div>
      <h2>Masuk ke sistem</h2>
      <p className="lp-sub">Gunakan email AirNav resmi Anda untuk mengakses dashboard.</p>

      {banner && (
        <div
          className={`lp-alert lp-alert--${banner.kind}`}
          role={banner.kind === "danger" ? "alert" : "status"}
        >
          <I
            n={
              banner.kind === "danger"  ? "alert"
              : banner.kind === "success" ? "check"
              : banner.kind === "warn"    ? "wifi-off"
              : "info"
            }
            s={16}
          />
          <div className="lp-alert-body">
            <b>{banner.title}</b>
            <p>{banner.message}</p>
          </div>
          <button
            type="button"
            className="lp-alert-close"
            onClick={() => setBanner(null)}
            aria-label="Tutup notifikasi"
          >
            <I n="x" s={14} />
          </button>
        </div>
      )}

      {/* email */}
      <div className="lp-field">
        <div className="lp-field-row">
          <label htmlFor="login-email">Email kerja</label>
        </div>
        <div className="lp-input-wrap">
          <input
            ref={emailRef}
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="off"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr("") }}
            onBlur={(e) => setEmailErr(validateEmail(e.target.value))}
            disabled={formBusy}
            placeholder="nama@airnavindonesia.co.id"
            className={`lp-input${emailErr ? " is-invalid" : ""}`}
            aria-invalid={emailErr ? "true" : undefined}
            aria-describedby="login-email-hint"
          />
        </div>
        <div
          id="login-email-hint"
          className={`lp-field-hint${emailErr ? " is-error" : ""}`}
          aria-live="polite"
        >
          {emailErr
            ? <><I n="alert" s={12} /> {emailErr}</>
            : <span>Contoh: nama@airnavindonesia.co.id</span>}
        </div>
      </div>

      {/* password */}
      <div className="lp-field">
        <div className="lp-field-row">
          <label htmlFor="login-pw">Password</label>
          <button
            type="button"
            className="lp-field-link"
            onClick={handleForgot}
            disabled={formBusy}
          >
            {resetting ? "Mengirim…" : "Lupa password?"}
          </button>
        </div>
        <div className="lp-input-wrap">
          <input
            ref={pwRef}
            id="login-pw"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            value={pw}
            onChange={(e) => { setPw(e.target.value); if (pwErr) setPwErr("") }}
            onBlur={(e) => setPwErr(validatePassword(e.target.value))}
            onKeyDown={handleKey}
            onKeyUp={handleKey}
            disabled={formBusy}
            placeholder="••••••••"
            className={`lp-input lp-input--trailing${pwErr ? " is-invalid" : ""}`}
            aria-invalid={pwErr ? "true" : undefined}
            aria-describedby="login-pw-hint"
          />
          <button
            type="button"
            className="lp-input-trailing"
            onClick={() => setShowPw((v) => !v)}
            aria-pressed={showPw}
            aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
            disabled={formBusy}
            tabIndex={0}
          >
            <I n={showPw ? "eye-off" : "eye"} s={16} />
          </button>
        </div>
        <div
          id="login-pw-hint"
          className={`lp-field-hint${pwErr ? " is-error" : ""}`}
          aria-live="polite"
        >
          {pwErr
            ? <><I n="alert" s={12} /> {pwErr}</>
            : <span>Minimal 6 karakter.</span>}
        </div>
        {caps && (
          <span className="lp-caps-warn" role="status">
            <I n="alert" s={12} /> Caps Lock aktif
          </span>
        )}
      </div>

      {/* remember me */}
      <div className="lp-helper-row">
        <label className="lp-checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={formBusy}
          />
          <span className="lp-checkbox-box" />
          Tetap masuk di perangkat ini
        </label>
      </div>

      <button
        type="submit"
        className="lp-btn-primary"
        disabled={formBusy || !online}
        data-loading={submitting ? "true" : "false"}
      >
        {submitting
          ? <><span className="lp-spinner" /> Memverifikasi…</>
          : <>Masuk <I n="arrow-right" s={16} /></>}
      </button>

      <div className="lp-form-footer">
        <span>
          Belum punya akun?{" "}
          <a href="mailto:helpdesk@airnavindonesia.co.id?subject=Permintaan%20akun%20ATC%20Log%20Position">
            Hubungi admin
          </a>
        </span>
        <span className="lp-form-meta">v5.0 · {new Date().getFullYear()}</span>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------------
   Login — outer shell (theme toggle, stage layout, network)
   ---------------------------------------------------------------- */
export const Login = ({ onLogin }) => {
  const [theme, setTheme] = useTheme()
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  useEffect(() => {
    const onOn  = () => setOnline(true)
    const onOff = () => setOnline(false)
    window.addEventListener("online", onOn)
    window.addEventListener("offline", onOff)
    return () => {
      window.removeEventListener("online", onOn)
      window.removeEventListener("offline", onOff)
    }
  }, [])

  const themeLabel = useMemo(
    () => (theme === "dark" ? "Beralih ke mode terang" : "Beralih ke mode gelap"),
    [theme]
  )

  return (
    <div className="lp-stage" data-layout="split">
      <Hero online={online} />

      <div className="lp-form-pane">
        <button
          className="lp-theme-toggle"
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Ganti tema"
          title={themeLabel}
        >
          <I n={theme === "dark" ? "sun" : "moon"} s={16} />
        </button>

        <LoginForm online={online} onLogin={onLogin} />
      </div>
    </div>
  )
}
