// ============================================================
// src/components/Login.jsx — Redesain Login (branding AirNav, clean)
// ──────────────────────────────────────────────────────────
// Drop-in: timpa SELURUH isi components/Login.jsx lama dgn file ini.
//  - Export NAMED { Login } (cocok: import { Login } from "./components/Login.jsx")
//  - Kontrak SAMA dengan versi lama:
//      • auth di dalam Login: supabase.auth.signInWithPassword(...)
//      • import { supabase } from "../supabase.js"
//      • sukses → onLogin?.(data?.session ?? null)
//  - Dipertahankan: error ID-friendly, validasi email, show/hide,
//    Caps Lock, deteksi offline, "Lupa password?" (kirim email reset).
//  - Disederhanakan (sesuai pilihan desain): tanpa panel hero,
//    tanpa toggle tema, tanpa "remember me".
//  - TANPA dependency baru: ikon & style inline (tidak butuh
//    Icons.jsx, lucide, atau Tailwind). File ../styles/login-clean.css
//    tidak lagi dipakai (boleh dihapus, aman dibiarkan).
//  - Catatan: tampilan ini LIGHT. Kalau mau ikut tema gelap/terang
//    aplikasi, bilang saja — mudah ditambahkan.
// ============================================================
import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase.js";

const BLUE = "#0F5DA8";
const BLUE_DARK = "#0B3D6B";
const RED = "#E1251B";
const LOGO = "data:image/png;base64,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";
const HELPDESK = "mailto:helpdesk@airnavindonesia.co.id?subject=Permintaan%20akun%20ATC%20Log%20Position";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
@keyframes anlUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes anlSpin{to{transform:rotate(360deg)}}
.anl-up{animation:anlUp .6s cubic-bezier(.2,.7,.2,1) both}
.anl-spin{animation:anlSpin .8s linear infinite;transform-origin:center}
.anl-btn{transition:filter .15s ease, transform .06s ease}
.anl-btn:hover:not(:disabled){filter:brightness(1.07)}
.anl-btn:active:not(:disabled){transform:translateY(1px)}
.anl-btn:disabled{cursor:default;opacity:.7}
.anl-input::placeholder{color:#9AA5B1}
.anl-input:focus{outline:none}
.anl-input:disabled{cursor:not-allowed}
.anl-link{transition:color .15s ease}
.anl-link:hover:not(:disabled){text-decoration:underline}
.anl-link:disabled{cursor:default;opacity:.6}
.anl-pw{background:transparent;border:0;padding:0;cursor:pointer;display:flex;align-items:center;color:#94A3B8;transition:color .15s ease}
.anl-pw:hover:not(:disabled){color:#475569}
.anl-pw:disabled{cursor:default;opacity:.6}
.anl-x{transition:opacity .15s ease}
.anl-x:hover{opacity:1 !important}
`;

/* ---------- ikon inline (tanpa dependency) ---------- */
function Svg({ size = 18, className, style, children }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}
         style={style} aria-hidden="true">{children}</svg>
  );
}
const IconMail = (p) => (<Svg {...p}><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 5L2 7" /></Svg>);
const IconLock = (p) => (<Svg {...p}><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>);
const IconEye = (p) => (<Svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></Svg>);
const IconEyeOff = (p) => (<Svg {...p}><path d="M9.88 4.24A9.6 9.6 0 0 1 12 4c6.5 0 10 8 10 8a13.2 13.2 0 0 1-2.16 3.19M6.5 6.5C3.6 8.27 2 12 2 12s3.5 7 10 7a9.5 9.5 0 0 0 3.5-.66" /><line x1="3" y1="3" x2="21" y2="21" /></Svg>);
const IconAlert = (p) => (<Svg {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></Svg>);
const IconCheck = (p) => (<Svg {...p}><polyline points="20 6 9 17 4 12" /></Svg>);
const IconArrow = (p) => (<Svg {...p}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></Svg>);
const IconX = (p) => (<Svg {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>);
function IconSpinner({ size = 18, className, style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} style={style} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeOpacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- helpers (sama semangatnya dgn versi lama) ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const friendlyAuthError = (raw = "") => {
  const m = String(raw).toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_grant")) return "Email atau password salah. Silakan periksa kembali.";
  if (m.includes("rate limit") || m.includes("too many")) return "Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.";
  if (m.includes("network") || m.includes("fetch") || m.includes("failed to fetch")) return "Koneksi terputus. Pastikan internet Anda aktif lalu coba lagi.";
  if (m.includes("not confirmed") || m.includes("email not confirmed")) return "Email belum dikonfirmasi. Cek inbox Anda untuk link aktivasi.";
  if (m.includes("user not found")) return "Akun tidak ditemukan. Hubungi admin AirNav untuk pendaftaran.";
  return raw || "Terjadi kesalahan. Silakan coba lagi.";
};
const validateEmail = (v) => {
  const t = (v || "").trim();
  if (!t) return "Email wajib diisi.";
  if (!EMAIL_RE.test(t)) return "Format email tidak valid.";
  return "";
};
const validatePassword = (v) => {
  if (!v) return "Password wajib diisi.";
  if (v.length < 6) return "Password minimal 6 karakter.";
  return "";
};
const alertSkin = (kind) => {
  if (kind === "success") return { bg: "#ECFDF3", bd: "#A6F4C5", fg: "#067647" };
  if (kind === "warn") return { bg: "#FFFAEB", bd: "#FEDF89", fg: "#B54708" };
  return { bg: "#FEF2F2", bd: "#FECACA", fg: "#B91C1C" };
};

/* ---------- input field ---------- */
function Field({ id, label, labelRight, icon: Icon, type = "text", value, onChange, onBlur, onKeyDown, onKeyUp,
                 placeholder, autoComplete, inputMode, inputRef, error, trailing, disabled, belowExtra }) {
  const [focus, setFocus] = useState(false);
  const borderColor = error ? "#FCA5A5" : (focus ? BLUE : "#E2E8F0");
  const ringColor = error ? "#FECACA" : `${BLUE}1f`;
  const iconColor = focus ? BLUE : (error ? "#DC2626" : "#94A3B8");
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: labelRight ? "space-between" : "flex-start", alignItems: "baseline", marginBottom: 6 }}>
        <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: "#334155", letterSpacing: "0.01em" }}>{label}</label>
        {labelRight}
      </div>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: iconColor, display: "flex", pointerEvents: "none" }}>
          <Icon size={18} />
        </span>
        <input
          id={id} name={id} type={type} value={value} ref={inputRef}
          onChange={onChange} onFocus={() => setFocus(true)} onBlur={(e) => { setFocus(false); onBlur && onBlur(e); }}
          onKeyDown={onKeyDown} onKeyUp={onKeyUp}
          placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode}
          disabled={disabled} className="anl-input" aria-invalid={error ? "true" : undefined}
          style={{
            width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 40px", fontSize: 14,
            border: `1.5px solid ${borderColor}`, boxShadow: (focus || error) ? `0 0 0 4px ${ringColor}` : "none",
            color: "#0F172A", background: disabled ? "#F8FAFC" : "#fff",
            transition: "box-shadow .15s ease, border-color .15s ease",
          }}
        />
        {trailing}
      </div>
      {error && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#DC2626", display: "flex", alignItems: "center", gap: 5 }}>
          <IconAlert size={12} /> {error}
        </div>
      )}
      {belowExtra}
    </div>
  );
}

/* ---------- Login ---------- */
export function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [alert, setAlert] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const emailRef = useRef(null);
  const pwRef = useRef(null);
  const formBusy = submitting || resetting;

  // fokus field pertama yang kosong saat mount
  useEffect(() => {
    const t = window.setTimeout(() => { (email ? pwRef : emailRef).current?.focus({ preventScroll: true }); }, 50);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // pantau online/offline
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  useEffect(() => {
    if (!online) setAlert({ kind: "warn", msg: "Sedang offline. Sambungkan internet Anda untuk melanjutkan." });
    else setAlert((a) => (a && a.kind === "warn" ? null : a));
  }, [online]);

  const handleKey = (e) => { if (typeof e.getModifierState === "function") setCaps(e.getModifierState("CapsLock")); };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (formBusy) return;
    if (!online) { setAlert({ kind: "warn", msg: "Sambungkan internet Anda untuk melanjutkan." }); return; }
    const eErr = validateEmail(email);
    const pErr = validatePassword(pw);
    setEmailErr(eErr); setPwErr(pErr);
    if (eErr || pErr) { (eErr ? emailRef : pwRef).current?.focus(); return; }

    setSubmitting(true); setAlert(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
      if (error) {
        setAlert({ kind: "danger", msg: friendlyAuthError(error.message) });
        setSubmitting(false);
        pwRef.current?.focus();
        return;
      }
      onLogin?.(data?.session ?? null);   // sukses → App pindah ke dashboard
    } catch (err) {
      setAlert({ kind: "danger", msg: friendlyAuthError(err?.message || "") });
      setSubmitting(false);
    }
  };

  const forgot = async () => {
    if (formBusy) return;
    const eErr = validateEmail(email);
    if (eErr) { setEmailErr("Isi email Anda dulu untuk reset password."); emailRef.current?.focus(); return; }
    if (!online) { setAlert({ kind: "warn", msg: "Sambungkan internet untuk reset password." }); return; }
    setResetting(true); setAlert(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
      if (error) setAlert({ kind: "danger", msg: friendlyAuthError(error.message) });
      else setAlert({ kind: "success", msg: `Instruksi reset dikirim ke ${email.trim()}.` });
    } catch (err) {
      setAlert({ kind: "danger", msg: friendlyAuthError(err?.message || "") });
    } finally {
      setResetting(false);
    }
  };

  const skin = alert ? alertSkin(alert.kind) : null;

  return (
    <div style={{
      minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, position: "relative", overflow: "hidden",
      fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
      background: "radial-gradient(1100px 560px at 50% -12%, #E9F2FC 0%, #F3F8FC 46%, #EDF2F8 100%)",
    }}>
      <style>{CSS}</style>

      {/* motif radar samar */}
      <svg style={{ position: "absolute", top: -130, right: -120, opacity: 0.06, pointerEvents: "none" }}
           width="540" height="540" viewBox="0 0 540 540" fill="none" aria-hidden="true">
        {[70, 140, 210, 268].map((r) => <circle key={r} cx="270" cy="270" r={r} stroke={BLUE} strokeWidth="2" />)}
        <line x1="270" y1="6" x2="270" y2="534" stroke={BLUE} strokeWidth="1.5" />
        <line x1="6" y1="270" x2="534" y2="270" stroke={BLUE} strokeWidth="1.5" />
      </svg>

      <div className="anl-up" style={{ width: "100%", maxWidth: 400, position: "relative" }}>
        <div style={{ background: "#fff", borderRadius: 24, overflow: "hidden",
                      boxShadow: "0 26px 64px -22px rgba(15,93,168,0.30), 0 8px 24px -14px rgba(15,23,42,0.12)",
                      border: "1px solid #EEF2F7" }}>
          <div style={{ height: 5, background: `linear-gradient(90deg, ${BLUE} 0%, ${BLUE} 68%, ${RED} 100%)` }} />
          <div style={{ padding: "36px 32px 28px" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <img src={LOGO} alt="AirNav Indonesia" width="66" height="66" style={{ display: "block" }} />
            </div>
            <h1 style={{ textAlign: "center", marginTop: 16, marginBottom: 0, color: BLUE, fontSize: 23, fontWeight: 800, letterSpacing: "-0.02em" }}>
              ATC Log Position
            </h1>
            <p style={{ textAlign: "center", marginTop: 4, marginBottom: 0, color: "#64748B", fontSize: 14 }}>
              Masuk dengan email AirNav resmi Anda
            </p>

            {alert && (
              <div role={alert.kind === "danger" ? "alert" : "status"}
                   style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 20, borderRadius: 12,
                            padding: "10px 12px", fontSize: 13.5, background: skin.bg, border: `1px solid ${skin.bd}`, color: skin.fg }}>
                <span style={{ display: "flex", marginTop: 1, flexShrink: 0 }}>
                  {alert.kind === "success" ? <IconCheck size={17} /> : <IconAlert size={17} />}
                </span>
                <span style={{ flex: 1 }}>{alert.msg}</span>
                <button type="button" onClick={() => setAlert(null)} aria-label="Tutup" className="anl-x"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: skin.fg, opacity: 0.7, display: "flex", flexShrink: 0 }}>
                  <IconX size={14} />
                </button>
              </div>
            )}

            <form onSubmit={submit} noValidate aria-busy={formBusy ? "true" : "false"} style={{ marginTop: 20 }}>
              <Field
                id="login-email" label="Email" icon={IconMail} type="email" inputMode="email" autoComplete="username"
                inputRef={emailRef} value={email} disabled={formBusy}
                onChange={(e) => { setEmail(e.target.value); if (emailErr) setEmailErr(""); }}
                onBlur={(e) => setEmailErr(validateEmail(e.target.value))}
                placeholder="nama@airnavindonesia.co.id" error={emailErr}
              />
              <Field
                id="login-pw" label="Password" icon={IconLock} type={showPw ? "text" : "password"} autoComplete="current-password"
                inputRef={pwRef} value={pw} disabled={formBusy}
                onChange={(e) => { setPw(e.target.value); if (pwErr) setPwErr(""); }}
                onBlur={(e) => setPwErr(validatePassword(e.target.value))}
                onKeyDown={handleKey} onKeyUp={handleKey}
                placeholder="Masukkan password" error={pwErr}
                labelRight={
                  <button type="button" className="anl-link" onClick={forgot} disabled={formBusy}
                          style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: BLUE, fontSize: 12, fontWeight: 600 }}>
                    {resetting ? "Mengirim…" : "Lupa password?"}
                  </button>
                }
                trailing={
                  <button type="button" className="anl-pw" onClick={() => setShowPw((s) => !s)} disabled={formBusy}
                          aria-pressed={showPw} aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)" }}>
                    {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                }
                belowExtra={caps ? (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#B54708", display: "flex", alignItems: "center", gap: 5 }}>
                    <IconAlert size={12} /> Caps Lock aktif
                  </div>
                ) : null}
              />

              <button type="submit" disabled={formBusy || !online} className="anl-btn"
                      style={{ width: "100%", boxSizing: "border-box", borderRadius: 12, padding: "12px 16px",
                               fontSize: 14, fontWeight: 700, color: "#fff", border: 0,
                               background: submitting ? BLUE_DARK : BLUE,
                               boxShadow: "0 12px 22px -10px rgba(15,93,168,0.65)",
                               display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                               cursor: formBusy ? "default" : "pointer", marginTop: 4 }}>
                {submitting
                  ? (<><IconSpinner className="anl-spin" /> Memverifikasi…</>)
                  : (<>Masuk <IconArrow size={18} /></>)}
              </button>
            </form>

            <p style={{ textAlign: "center", marginTop: 16, marginBottom: 0, fontSize: 12.5, color: "#64748B" }}>
              Belum punya akun? <a href={HELPDESK} style={{ color: BLUE, fontWeight: 600, textDecoration: "none" }}>Hubungi admin</a>
            </p>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, marginBottom: 0, color: "#7C8BA0", fontSize: 12, fontWeight: 500 }}>
          AirNav Indonesia · Perum LPPNPI
        </p>
      </div>
    </div>
  );
}

export default Login;
