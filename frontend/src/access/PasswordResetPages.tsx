import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { PasswordRequirements } from './PasswordRequirements'
import { knownProblems, passwordProblems, type PasswordProblem } from './registrationPassword'
import { readResetToken, resetFailure } from './passwordReset'
import { colors, radius, spacing, typography, btnPrimaryStyle } from '../styles/tokens'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'transparent', padding: `${spacing.md} 0`, borderBottom: `1px solid ${colors.border}`,
  color: colors.text, fontSize: '1rem', fontFamily: typography.fontBody, boxSizing: 'border-box',
}
const submitStyle: React.CSSProperties = {
  ...btnPrimaryStyle, width: '100%', padding: `${spacing.md} ${spacing.lg}`, fontSize: '0.9rem', borderRadius: radius.lg,
  background: `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`, color: colors.bgCard, fontWeight: 500,
}
const linkStyle: React.CSSProperties = { color: colors.primary, fontSize: '0.85rem', textAlign: 'center', fontFamily: typography.fontBody }

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const { t, lang, setLang } = useLanguage()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem', background: colors.bg, fontFamily: typography.fontBody }}>
      <main style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: spacing.xs, marginBottom: spacing.lg }}>
          {(['es', 'en'] as const).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: radius.full, border: `0.5px solid ${colors.borderLight}`,
              background: lang === l ? colors.primary : 'transparent', color: lang === l ? colors.bgCard : colors.textMuted,
              cursor: 'pointer', fontFamily: typography.fontBody,
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
        <p style={{ fontFamily: typography.fontDisplay, fontWeight: 300, letterSpacing: '0.3em', fontSize: '1.5rem', color: colors.text, margin: `0 0 ${spacing.xl}` }}>{t('logo')}</p>
        <h1 style={{ fontFamily: typography.fontDisplay, fontWeight: 400, fontSize: '1.15rem', color: colors.text, margin: `0 0 ${spacing.xl}`, textAlign: 'center' }}>{title}</h1>
        {children}
      </main>
    </div>
  )
}

type Notice = { text: string; ok: boolean } | null
const Message = ({ notice, innerRef }: { notice: Notice; innerRef?: React.Ref<HTMLParagraphElement> }) => notice ? (
  <p ref={innerRef} tabIndex={innerRef ? -1 : undefined} role={notice.ok ? 'status' : 'alert'} style={{ fontSize: '0.85rem', textAlign: 'center', color: notice.ok ? colors.success : colors.danger, margin: 0 }}>{notice.ok ? '✓ ' : '❌ '}{notice.text}</p>
) : null

// ES-132: paso 1, pedir el enlace. La respuesta es la misma exista o no la cuenta.
export function ForgotPasswordPage() {
  const { lang } = useLanguage()
  const { text } = useLandingContent(lang)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const emailInput = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setNotice(null)
    try {
      const res = await fetch(`${BACKEND}/api/password-reset/request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), locale: lang }),
      })
      if (res.status === 202) setNotice({ text: text('landing.access.reset.sent'), ok: true })
      else {
        const data = await res.json().catch(() => ({})) as { code?: unknown }
        setNotice({ text: text(resetFailure(res.status, data.code) === 'rate_limited' ? 'landing.access.rate_limit' : 'landing.access.failed'), ok: false })
        emailInput.current?.focus()
      }
    } catch { setNotice({ text: text('landing.access.failed'), ok: false }) } finally { setBusy(false) }
  }

  return (
    <Shell title={text('landing.access.reset.forgot_title')}>
      <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: spacing.xxl }}>
        <p style={{ margin: 0, fontSize: '0.9rem', color: colors.textMuted, textAlign: 'center' }}>{text('landing.access.reset.forgot_intro')}</p>
        <input ref={emailInput} type="email" aria-label={text('landing.access.email')} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder={text('landing.access.email')} required style={inputStyle} />
        <Message notice={notice} />
        <button type="submit" disabled={busy} style={submitStyle}>{busy ? text('landing.access.submitting') : text('landing.access.reset.send')}</button>
        <Link to="/login" style={linkStyle}>{text('landing.access.reset.back')}</Link>
      </form>
    </Shell>
  )
}

// ES-132: paso 2, elegir la contraseña nueva. El token se lee del fragmento y se quita de la barra de direcciones.
export function ResetPasswordPage() {
  const { lang } = useLanguage()
  const { text } = useLandingContent(lang)
  const [token] = useState(() => readResetToken(window.location.hash))
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(token === null)
  const [missing, setMissing] = useState<PasswordProblem[]>([])
  const [notice, setNotice] = useState<Notice>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  // ES-156: tras un envío rechazado el foco va al mensaje (no al teclear de nuevo); el contador dispara el efecto una vez por rechazo.
  const [rejections, setRejections] = useState(0)
  useEffect(() => { if (rejections > 0) messageRef.current?.focus() }, [rejections])

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !token) return
    setNotice(null)
    const local = passwordProblems(password)
    if (local.length) { setMissing(local); setRejections(n => n + 1); return }
    setBusy(true); setMissing([])
    try {
      const res = await fetch(`${BACKEND}/api/password-reset/confirm`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }),
      })
      if (res.ok) { setDone(true); setPassword(''); return }
      const data = await res.json().catch(() => ({})) as { code?: unknown; missing?: unknown }
      const failure = resetFailure(res.status, data.code)
      if (failure === 'reset_invalid') setInvalid(true)
      else if (failure === 'password_policy') { setMissing(knownProblems(data.missing)); setRejections(n => n + 1) }
      else { setNotice({ text: text(failure === 'rate_limited' ? 'landing.access.rate_limit' : 'landing.access.failed'), ok: false }); setRejections(n => n + 1) }
    } catch { setNotice({ text: text('landing.access.failed'), ok: false }); setRejections(n => n + 1) } finally { setBusy(false) }
  }

  if (done) return (
    <Shell title={text('landing.access.reset.done_title')}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
        <Message notice={{ text: text('landing.access.reset.done'), ok: true }} />
        <Link to="/login" style={{ ...submitStyle, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>{text('landing.access.reset.go_login')}</Link>
      </div>
    </Shell>
  )

  if (invalid) return (
    <Shell title={text('landing.access.reset.invalid_title')}>
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: spacing.xl }}>
        <Message notice={{ text: text('landing.access.reset.invalid'), ok: false }} />
        <Link to="/forgot-password" style={{ ...submitStyle, textAlign: 'center', textDecoration: 'none', boxSizing: 'border-box' }}>{text('landing.access.reset.request_new')}</Link>
        <Link to="/login" style={linkStyle}>{text('landing.access.reset.back')}</Link>
      </div>
    </Shell>
  )

  const policyError = missing.length > 0
  const missingList = missing.map(id => text(`landing.access.pw.missing.${id}`)).join(', ')
  return (
    <Shell title={text('landing.access.reset.title')}>
      <form onSubmit={submit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: spacing.xxl }}>
        <div style={{ position: 'relative' }}>
          <input type={show ? 'text' : 'password'} aria-label={text('landing.access.reset.new_password')} autoComplete="new-password" value={password}
            onChange={e => { setPassword(e.target.value); if (policyError) setMissing([]) }} aria-describedby="pw-req" aria-invalid={policyError || undefined}
            placeholder={text('landing.access.reset.new_password')} required style={{ ...inputStyle, paddingRight: '2rem' }} />
          <button type="button" aria-label={text(show ? 'landing.access.hide_password' : 'landing.access.show_password')} onClick={() => setShow(!show)}
            style={{ position: 'absolute', right: 0, bottom: spacing.md, background: 'none', border: 'none', cursor: 'pointer', color: colors.textSubtle, fontSize: 16, padding: 0, minWidth: 24, minHeight: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{show ? '🙈' : '👁'}</button>
        </div>
        <PasswordRequirements id="pw-req" password={password} showErrors={policyError} serverProblems={missing} visibleSummary text={text} />
        <Message innerRef={messageRef} notice={policyError ? { text: text('landing.access.pw.missing').replace('{list}', missingList), ok: false } : notice} />
        <button type="submit" disabled={busy} style={submitStyle}>{busy ? text('landing.access.submitting') : text('landing.access.reset.save')}</button>
      </form>
    </Shell>
  )
}
