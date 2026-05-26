// ============================================================
// src/components/Login.jsx — Login screen (redesign per audit)
// ──────────────────────────────────────────────────────────
// Full rewrite tracking CLAUDE_HANDOFF.md §8 "Login" acceptance
// criteria + the Login Prototype.html visual contract:
//
//   ✓ Single brand lockup (logo + name + branch caption) at top
//   ✓ Solid CTA in var(--accent) over #0a0e1a → AAA contrast (≥7:1)
//   ✓ Password visibility toggle exposes aria-pressed
//   ✓ Caps Lock indicator appears while the modifier is held
//   ✓ Inline errors with aria-invalid + aria-describedby
//   ✓ Offline detection disables submit + shows offline banner
//   ✓ Forgot-password rejects empty / malformed email up front
//   ✓ Loading state: aria-busy form + spinner + data-loading button
//   ✓ Dark + light themes both work (uses --accent / --surface tokens)
//
// All visuals are owned by src/styles/login-clean.css (lp-* classes).
// All colors are tokens from src/index.css — no new tokens invented.
// The screen mounts when context.session is falsy (see App.jsx).
// ============================================================

import React, {
  useCallback, useEffect, useMemo, useReducer, useRef, useState,
} from "react"
import { supabase } from "../supabase.js"
import { I } from "./Icons.jsx"
import "../styles/login-clean.css"

/* ────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────── */
const THEME_KEY = "atc-theme"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PW_MIN = 6
const VERSION = "v5.0"

/* ────────────────────────────────────────────────────────────
   Pure helpers
   ──────────────────────────────────────────────────────────── */
const pad2 = (n) => String(n).padStart(2, "0")
const fmtUTC = (d) =>
  `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}Z`

const validateEmail = (v) => {
  const t = (v || "").trim()
  if (!t) return "Email wajib diisi."
  if (!EMAIL_RE.test(t)) return "Format email tidak valid."
  return ""
}
const validatePassword = (v) => {
  if (!v) return "Password wajib diisi."
  if (v.length < PW_MIN) return `Password minimal ${PW_MIN} karakter.`
  return ""
}

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

/* ────────────────────────────────────────────────────────────
   Hooks
   ──────────────────────────────────────────────────────────── */
const useTickingClock = (ms = 1000) => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

const useOnline = () => {
  const [online, setOnline] = useState(
    () => (typeof navigator !== "undefined" ? navigator.onLine : true)
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener("online", on)
    window.addEventListener("offline", off)
    return () => {
      window.removeEventListener("online", on)
      window.removeEventListener("offline", off)
    }
  }, [])
  return online
}

const useTheme = () => {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark" }
    catch { return "dark" }
  })
  useEffect(() => {
    if (theme === "light") document.documentElement.dataset.theme = "light"
    else document.documentElement.removeAttribute("data-theme")
    try { localStorage.setItem(THEME_KEY, theme) }
    catch { /* private mode — ignore */ }
  }, [theme])
  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  )
  return [theme, toggle]
}

/* Caps Lock detection — fires on any key event reaching the input. */
const useCapsLock = () => {
  const [caps, setCaps] = useState(false)
  const onKey = useCallback((e) => {
    if (typeof e.getModifierState === "function") {
      setCaps(e.getModifierState("CapsLock"))
    }
  }, [])
  return { caps, onKey }
}

/* Banner state — collapse three setters (info/warn/danger/success/null)
   into a single reducer so we never end up with two banners at once. */
const bannerReducer = (_state, action) => {
  if (action === null) return null
  return action
}
const useBanner = () => useReducer(bannerReducer, null)

/* ────────────────────────────────────────────────────────────
   Hero pane — single brand lockup + product pitch
   ──────────────────────────────────────────────────────────── */
const Hero = ({ online }) => {
  const now = useTickingClock()
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
        <h1>
          Catat posisi, handover, dan jam jaga{" "}
          <em>tanpa friksi.</em>
        </h1>
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
        <span className="lp-hero-clock">{fmtUTC(now)}</span>
      </div>
    </aside>
  )
}

/* ────────────────────────────────────────────────────────────
   Alert banner — single instance, owned by parent
   ──────────────────────────────────────────────────────────── */
const ALERT_ICON = {
  danger: "alert",
  warn: "wifi-off",
  success: "check",
  info: "info",
}

const Banner = ({ banner, onClose }) => {
  if (!banner) return null
  return (
    <div
      className={`lp-alert lp-alert--${banner.kind}`}
      role={banner.kind === "danger" ? "alert" : "status"}
    >
      <I n={ALERT_ICON[banner.kind] || "info"} s={16} />
      <div className="lp-alert-body">
        <b>{banner.title}</b>
        <p>{banner.message}</p>
      </div>
      <button
        type="button"
        className="lp-alert-close"
        onClick={onClose}
        aria-label="Tutup notifikasi"
      >
        <I n="x" s={14} />
      </button>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Login form
   ──────────────────────────────────────────────────────────── */
const LoginForm = ({ online, onLogin }) => {
  /* ─── form state ─── */
  const [email,    setEmail]    = useState("")
  const [pw,       setPw]       = useState("")
  const [remember, setRemember] = useState(true)
  const [showPw,   setShowPw]   = useState(false)

  const [emailErr, setEmailErr] = useState("")
  const [pwErr,    setPwErr]    = useState("")
  const [banner,   setBanner]   = useBanner()
  const [submitting, setSubmitting] = useState(false)
  const [resetting,  setResetting]  = useState(false)

  const { caps, onKey } = useCapsLock()

  const emailRef = useRef(null)
  const pwRef    = useRef(null)

  const busy = submitting || resetting

  /* ─── focus first empty field on mount ─── */
  useEffect(() => {
    const t = window.setTimeout(() => {
      (email ? pwRef.current : emailRef.current)?.focus({ preventScroll: true })
    }, 50)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ─── sync offline → banner; clear banner when reconnected ─── */
  useEffect(() => {
    if (!online) {
      setBanner({
        kind: "warn",
        title: "Sedang offline",
        message: "Sambungkan internet Anda untuk melanjutkan.",
      })
    } else {
      // Only clear our own offline banner — leave auth-error banners intact
      setBanner((b) => (b && b.title === "Sedang offline" ? null : b))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  /* ─── handlers ─── */
  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (emailErr) setEmailErr("")
  }
  const handlePwChange = (e) => {
    setPw(e.target.value)
    if (pwErr) setPwErr("")
  }

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault?.()
    if (busy) return

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
    setEmailErr(eErr)
    setPwErr(pErr)
    if (eErr || pErr) {
      ;(eErr ? emailRef : pwRef).current?.focus()
      return
    }

    setSubmitting(true)
    setBanner(null)
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
  }, [busy, online, email, pw, onLogin, setBanner])

  const handleForgot = useCallback(async () => {
    if (busy) return

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

    setResetting(true)
    setBanner(null)
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
  }, [busy, email, online, setBanner])

  /* ─── render ─── */
  return (
    <form
      className="lp-form-card"
      onSubmit={handleSubmit}
      noValidate
      aria-busy={busy ? "true" : "false"}
    >
      {/* Mobile-only single lockup (hidden ≥ 980px — CSS) */}
      <div className="lp-lockup lp-mobile-lockup">
        <span className="lp-mark" aria-hidden="true" />
        <div className="lp-lockup-text">
          <b>Log Position</b>
          <small>AirNav Indonesia</small>
        </div>
      </div>

      <div className="lp-form-eyebrow">Sign in · {VERSION}</div>
      <h2>Masuk ke sistem</h2>
      <p className="lp-sub">
        Gunakan email AirNav resmi Anda untuk mengakses dashboard.
      </p>

      <Banner banner={banner} onClose={() => setBanner(null)} />

      {/* email field */}
      <div className="lp-field">
        <div className="lp-field-row">
          <label htmlFor="login-email">Email kerja</label>
        </div>
        <div className="lp-input-wrap">
          <input
            ref={emailRef}
            id="login-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            spellCheck={false}
            autoCapitalize="off"
            value={email}
            onChange={handleEmailChange}
            onBlur={(e) => setEmailErr(validateEmail(e.target.value))}
            disabled={busy}
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

      {/* password field */}
      <div className="lp-field">
        <div className="lp-field-row">
          <label htmlFor="login-pw">Password</label>
          <button
            type="button"
            className="lp-field-link"
            onClick={handleForgot}
            disabled={busy}
          >
            {resetting ? "Mengirim…" : "Lupa password?"}
          </button>
        </div>
        <div className="lp-input-wrap">
          <input
            ref={pwRef}
            id="login-pw"
            name="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            value={pw}
            onChange={handlePwChange}
            onBlur={(e) => setPwErr(validatePassword(e.target.value))}
            onKeyDown={onKey}
            onKeyUp={onKey}
            disabled={busy}
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
            disabled={busy}
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
            : <span>Minimal {PW_MIN} karakter.</span>}
        </div>
        {caps && (
          <span className="lp-caps-warn" role="status">
            <I n="alert" s={12} /> Caps Lock aktif
          </span>
        )}
      </div>

      {/* remember-me */}
      <div className="lp-helper-row">
        <label className="lp-checkbox">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            disabled={busy}
          />
          <span className="lp-checkbox-box" />
          Tetap masuk di perangkat ini
        </label>
      </div>

      {/* primary CTA */}
      <button
        type="submit"
        className="lp-btn-primary"
        disabled={busy || !online}
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
        <span className="lp-form-meta">{VERSION} · {new Date().getFullYear()}</span>
      </div>
    </form>
  )
}

/* ────────────────────────────────────────────────────────────
   Login — outer shell (split layout, theme toggle, online watch)
   ──────────────────────────────────────────────────────────── */
export const Login = ({ onLogin }) => {
  const [theme, toggleTheme] = useTheme()
  const online = useOnline()

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
          onClick={toggleTheme}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <I n={theme === "dark" ? "sun" : "moon"} s={16} />
        </button>

        <LoginForm online={online} onLogin={onLogin} />
      </div>
    </div>
  )
}

export default Login
