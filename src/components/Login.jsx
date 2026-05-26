// ============================================================
// src/components/Login.jsx — Login screen (Phase 5 redesign)
// ──────────────────────────────────────────────────────────
// What's new vs Phase 4:
//   • Enterprise split-panel layout (hero ≥1024px, stacked
//     below). Mobile keeps the brand at the top of the card.
//   • Composable in-file primitives — Alert, FormField,
//     PasswordInput — so the markup reads as form semantics
//     and we don't duplicate <label>/<input>/aria-* wiring.
//   • Six interaction states implemented end-to-end:
//       default · hover · focus-visible · active · disabled
//     plus loading (button + form), error (banner + per-field),
//     and success (post-reset flash).
//   • Inline client-side validation (email shape + required)
//     runs onBlur and again on submit; aria-invalid and
//     aria-describedby wire each field to its error message.
//   • Password visibility toggle with proper aria-pressed and
//     CapsLock detection — both purely additive (don't block
//     submit, don't break password managers / autofill).
//   • Friendly Indonesian error mapping is unchanged in spirit
//     but split into a pure helper for testability.
//   • Network-aware: shows an offline banner the instant the
//     browser reports `offline`, and blocks submit until back.
//   • "Lupa password?" wired to supabase.auth.resetPasswordForEmail
//     with the same friendly error mapping + success feedback.
//   • Prevents double-submit (button disabled + aria-busy on
//     form). All async paths null-safe.
//   • Honours prefers-reduced-motion via the stylesheet.
//
// All styling comes from src/styles/login-clean.css — this file
// owns behaviour & accessibility wiring, not visuals.
// ============================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "../supabase.js"
import { RadarLogo, I } from "./Icons.jsx"
import "../styles/login-clean.css"

/* ----------------------------------------------------------------
   Helpers
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
  if (!raw) return "Terjadi kesalahan. Silakan coba lagi."
  return raw
}

/* ----------------------------------------------------------------
   Primitives (kept in-file: only used here, and small enough that
   extracting them would add overhead without payoff)
   ---------------------------------------------------------------- */
const Alert = ({ kind = "danger", title, children, id, onDismiss }) => (
  <div
    id={id}
    className={`login-alert login-alert--${kind}`}
    role={kind === "danger" ? "alert" : "status"}
    aria-live={kind === "danger" ? "assertive" : "polite"}
  >
    <span className="login-alert-icon" aria-hidden="true">
      {kind === "danger" ? "!" : kind === "success" ? "✓" : "i"}
    </span>
    <div>
      {title && <strong>{title}</strong>}
      {title && children ? <> — </> : null}
      {children}
      {onDismiss && (
        <>
          {" "}
          <button
            type="button"
            className="login-link"
            onClick={onDismiss}
            aria-label="Tutup notifikasi"
          >
            Tutup
          </button>
        </>
      )}
    </div>
  </div>
)

const FormField = ({
  id,
  label,
  meta,
  error,
  hint,
  children,
}) => {
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : (hint ? helpId : undefined)
  return (
    <div className="login-field">
      <div className="login-field-row">
        <label htmlFor={id} className="login-label">{label}</label>
        {meta && <span className="login-label-meta">{meta}</span>}
      </div>
      {React.cloneElement(children, {
        id,
        "aria-invalid": error ? "true" : undefined,
        "aria-describedby": describedBy,
      })}
      <div
        id={error ? errorId : helpId}
        className={`login-help${error ? " login-help--error" : ""}`}
        aria-live="polite"
      >
        {error || hint || " "}
      </div>
    </div>
  )
}

const PasswordInput = ({
  id,
  value,
  onChange,
  onBlur,
  onKeyDown,
  disabled,
  placeholder = "••••••••",
  autoComplete = "current-password",
}) => {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)

  const handleKey = (e) => {
    // CapsLock detection — non-blocking, purely informational
    if (typeof e.getModifierState === "function") {
      setCapsLock(e.getModifierState("CapsLock"))
    }
    onKeyDown?.(e)
  }

  return (
    <>
      <div className="login-input-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          onKeyDown={handleKey}
          onKeyUp={handleKey}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          className="login-input login-input--has-trailing"
        />
        <button
          type="button"
          className="login-input-trailing"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          tabIndex={0}
          disabled={disabled}
        >
          <I n={visible ? "eye-off" : "eye"} s={18} />
          {/* Icon flips with state; aria-pressed carries the meaning for SR. */}
        </button>
      </div>
      {capsLock && (
        <span className="login-caps" role="status">
          <I n="alert-triangle" s={14} /> Caps Lock aktif
        </span>
      )}
    </>
  )
}

/* ----------------------------------------------------------------
   Login component
   ---------------------------------------------------------------- */
export const Login = ({ onLogin }) => {
  // form state
  const [email, setEmail] = useState("")
  const [pw, setPw] = useState("")
  const [remember, setRemember] = useState(true)

  // per-field validation
  const [emailErr, setEmailErr] = useState("")
  const [pwErr, setPwErr] = useState("")

  // global ui state
  const [submitting, setSubmitting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [banner, setBanner] = useState(null) // { kind, title?, message }
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  )

  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  /* --- focus the first empty field on mount ----------------------- */
  useEffect(() => {
    const t = window.setTimeout(() => {
      const target = email ? passwordRef.current : emailRef.current
      target?.focus({ preventScroll: true })
    }, 50)
    return () => window.clearTimeout(t)
    // mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* --- online / offline awareness -------------------------------- */
  useEffect(() => {
    const onOn = () => setOnline(true)
    const onOff = () => setOnline(false)
    window.addEventListener("online", onOn)
    window.addEventListener("offline", onOff)
    return () => {
      window.removeEventListener("online", onOn)
      window.removeEventListener("offline", onOff)
    }
  }, [])

  /* --- validators ------------------------------------------------- */
  const validateEmail = useCallback((v) => {
    const trimmed = v.trim()
    if (!trimmed) return "Email wajib diisi."
    if (!EMAIL_RE.test(trimmed)) return "Format email tidak valid."
    return ""
  }, [])

  const validatePassword = useCallback((v) => {
    if (!v) return "Password wajib diisi."
    if (v.length < 6) return "Password minimal 6 karakter."
    return ""
  }, [])

  /* --- submit ----------------------------------------------------- */
  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault?.()
      if (submitting) return

      // hard guard: offline
      if (!online) {
        setBanner({
          kind: "warn",
          title: "Tidak ada koneksi",
          message: "Hubungkan kembali jaringan internet Anda untuk masuk.",
        })
        return
      }

      // client-side validation
      const eErr = validateEmail(email)
      const pErr = validatePassword(pw)
      setEmailErr(eErr)
      setPwErr(pErr)
      if (eErr || pErr) {
        // Move focus to the first invalid field — keyboard + SR friendly
        if (eErr) emailRef.current?.focus()
        else passwordRef.current?.focus()
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
          // re-focus password to fix it — but don't clobber the value
          passwordRef.current?.focus()
          return
        }
        // success — handoff to parent
        onLogin?.(data?.session ?? null)
      } catch (err) {
        setBanner({
          kind: "danger",
          title: "Gagal masuk",
          message: friendlyAuthError(err?.message || ""),
        })
        setSubmitting(false)
      }
    },
    [email, pw, online, submitting, validateEmail, validatePassword, onLogin]
  )

  /* --- forgot password ------------------------------------------- */
  const handleForgot = useCallback(async () => {
    if (resetting) return
    const eErr = validateEmail(email)
    if (eErr) {
      setEmailErr("Isi email Anda dulu untuk reset password.")
      emailRef.current?.focus()
      return
    }
    if (!online) {
      setBanner({
        kind: "warn",
        title: "Tidak ada koneksi",
        message: "Hubungkan kembali jaringan internet Anda untuk mengirim email reset.",
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
          message: `Kami sudah mengirim instruksi reset ke ${email.trim()}.`,
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
  }, [email, online, resetting, validateEmail])

  /* --- derived UI ------------------------------------------------ */
  const formBusy = submitting || resetting
  const yearLabel = useMemo(() => new Date().getFullYear(), [])

  return (
    <div className="login-bg">
      {/* ---------- Hero panel (desktop ≥1024px) -------------------- */}
      <aside className="login-hero" aria-hidden="true">
        <div>
          <div className="login-hero-top">
            <RadarLogo size={32} />
            <span>ATC Log Position</span>
          </div>
          <span className="login-hero-eyebrow" style={{ marginTop: 12, display: "inline-flex" }}>
            AirNav Indonesia · Operations
          </span>
          <h1 className="login-hero-headline">
            Catat posisi, handover, dan kontrol jam jaga tanpa friksi.
          </h1>
          <p className="login-hero-sub">
            Satu tempat untuk Log Position, Handover Mo-to-Mo, dan rekap traffic harian — siap pakai dari menara hingga kantor pusat.
          </p>
          <ul className="login-hero-list">
            <li><span>Approval otomatis sesuai FRMS &amp; control allowance</span></li>
            <li><span>Audit trail penuh untuk setiap pergantian shift</span></li>
            <li><span>Dukungan multi-cabang dengan permission per-role</span></li>
          </ul>
        </div>
        <div className="login-hero-footer">
          <span className="login-hero-status">
            <span className="login-hero-status-dot" />
            Sistem operasional &middot; All systems normal
          </span>
          <span>v5.0 · {yearLabel}</span>
        </div>
      </aside>

      {/* ---------- Form panel ------------------------------------- */}
      <section className="login-panel">
        <div className="login-container">
          {/* Mobile brand (hidden on desktop via CSS) */}
          <div className="login-brand">
            <div className="login-brand-mark">
              <RadarLogo size={40} />
              <div>
                <h1 className="login-title">ATC Log Position</h1>
                <p className="login-subtitle">AirNav Indonesia</p>
              </div>
            </div>
            <p className="login-desc">
              Air Traffic Control · Position Management System
            </p>
          </div>

          <form
            className="login-card"
            onSubmit={handleSubmit}
            noValidate
            aria-busy={formBusy ? "true" : "false"}
            aria-describedby="login-banner-region"
          >
            <header className="login-card-head">
              <h2 className="login-card-title">Masuk ke sistem</h2>
              <p className="login-card-sub">
                Gunakan email AirNav resmi Anda untuk mengakses dashboard.
              </p>
            </header>

            {/* Banner region — always present so SR doesn't lose context */}
            <div id="login-banner-region">
              {!online && (
                <Alert kind="warn" title="Sedang offline">
                  Sambungkan internet Anda untuk melanjutkan. Form di bawah akan otomatis aktif kembali begitu jaringan tersambung.
                </Alert>
              )}
              {banner && (
                <Alert
                  kind={banner.kind}
                  title={banner.title}
                  id="login-banner"
                  onDismiss={() => setBanner(null)}
                >
                  {banner.message}
                </Alert>
              )}
            </div>

            <div className="login-form">
              <FormField
                id="login-email"
                label="Email kerja"
                error={emailErr}
                hint="Contoh: nama@airnavindonesia.co.id"
              >
                <input
                  ref={emailRef}
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (emailErr) setEmailErr("")
                  }}
                  onBlur={(e) => setEmailErr(validateEmail(e.target.value))}
                  disabled={formBusy}
                  placeholder="nama@airnavindonesia.co.id"
                  className="login-input"
                />
              </FormField>

              <FormField
                id="login-password"
                label="Password"
                meta={
                  <button
                    type="button"
                    className="login-link"
                    onClick={handleForgot}
                    disabled={formBusy}
                    aria-busy={resetting ? "true" : "false"}
                  >
                    {resetting ? "Mengirim…" : "Lupa password?"}
                  </button>
                }
                error={pwErr}
              >
                <PasswordInput
                  value={pw}
                  onChange={(e) => {
                    setPw(e.target.value)
                    if (pwErr) setPwErr("")
                  }}
                  onBlur={(e) => setPwErr(validatePassword(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSubmit(e)
                  }}
                  disabled={formBusy}
                />
              </FormField>

              <div className="login-helper-row">
                <label className="login-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={formBusy}
                  />
                  Tetap masuk di perangkat ini
                </label>
              </div>

              <button
                type="submit"
                className="login-btn"
                disabled={formBusy || !online}
                data-loading={submitting ? "true" : "false"}
                aria-live="polite"
              >
                <span className="login-btn-label">
                  {submitting ? "Memverifikasi…" : "Masuk"}
                </span>
                {submitting && (
                  <span className="login-spinner" role="presentation" aria-hidden="true" />
                )}
                <span className="login-sr-only">
                  {submitting ? "Sedang memverifikasi kredensial" : "Submit form login"}
                </span>
              </button>
            </div>

            <div className="login-card-foot">
              <p style={{ margin: 0 }}>
                Belum punya akun?{" "}
                <a
                  className="login-link"
                  href="mailto:helpdesk@airnavindonesia.co.id?subject=Permintaan%20akun%20ATC%20Log%20Position"
                >
                  Hubungi admin AirNav
                </a>
              </p>
            </div>
          </form>

          <footer className="login-footer">
            <span className="login-footer-meta">
              <span className={`login-trust${online ? "" : " login-trust--offline"}`}>
                <span className="login-trust-dot" />
                {online ? "Terhubung ke server" : "Offline"}
              </span>
            </span>
            <span>&copy; {yearLabel} AirNav Indonesia · v5.0</span>
          </footer>
        </div>
      </section>
    </div>
  )
}
