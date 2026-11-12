import './accessRegister.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { PasswordRequirements } from './PasswordRequirements'
import { knownProblems, passwordProblems, type PasswordProblem } from './registrationPassword'
import { readResetToken, resetFailure } from './passwordReset'
import { AccessCard, AccessField } from './AccessCard'
import { fieldErrors } from './fieldErrors'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

type Notice = { text: string; ok: boolean } | null
const Message = ({ notice, innerRef }: { notice: Notice; innerRef?: React.Ref<HTMLParagraphElement> }) => notice ? (
  <p ref={innerRef} tabIndex={innerRef ? -1 : undefined} role={notice.ok ? 'status' : 'alert'} className={`ac-notice ac-notice--${notice.ok ? 'success' : 'error'}`}>{notice.text}</p>
) : null

// ES-132: paso 1, pedir el enlace. La respuesta es la misma exista o no la cuenta. ES-155: en el marco público de Cartografía; el correo escrito se conserva
// y el foco vuelve al campo del correo en CUALQUIER rechazo (también en un error de red) y ante un correo mal escrito.
export function ForgotPasswordPage() {
  const { lang } = useLanguage()
  const { text } = useLandingContent(lang)
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [emailError, setEmailError] = useState(false)
  const emailInput = useRef<HTMLInputElement>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setNotice(null)
    if (fieldErrors({ name: '', email, password: '' }, 'forgot').email) { setEmailError(true); emailInput.current?.focus(); return }
    setEmailError(false); setBusy(true)
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
    } catch { setNotice({ text: text('landing.access.failed'), ok: false }); emailInput.current?.focus() } finally { setBusy(false) }
  }

  return (
    <AccessCard title={text('landing.access.reset.forgot_title')} intro={text('landing.access.reset.forgot_intro')}>
      <form onSubmit={submit} className="ac-form" noValidate aria-busy={busy}>
        <AccessField id="reset-email" label={text('landing.access.email')} inputRef={emailInput} type="email" autoComplete="email" value={email}
          error={emailError ? t('access.err_email') : undefined} onChange={e => { setEmail(e.target.value); setEmailError(false) }} />
        <Message notice={notice} />
        <button type="submit" disabled={busy} className="ac-submit">{busy ? text('landing.access.submitting') : text('landing.access.reset.send')}</button>
      </form>
      <div className="ac-secondary"><Link to="/login">{text('landing.access.reset.back')}</Link></div>
    </AccessCard>
  )
}

// ES-132: paso 2, elegir la contraseña nueva. El token se lee del fragmento y se quita de la barra de direcciones.
export function ResetPasswordPage() {
  const { lang, t } = useLanguage()
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
    <AccessCard title={text('landing.access.reset.done_title')}>
      <Message notice={{ text: text('landing.access.reset.done'), ok: true }} />
      <Link to="/login" className="ac-submit">{text('landing.access.reset.go_login')}</Link>
    </AccessCard>
  )

  if (invalid) return (
    <AccessCard title={text('landing.access.reset.invalid_title')}>
      <Message notice={{ text: text('landing.access.reset.invalid'), ok: false }} />
      <Link to="/forgot-password" className="ac-submit">{text('landing.access.reset.request_new')}</Link>
      <div className="ac-secondary"><Link to="/login">{text('landing.access.reset.back')}</Link></div>
    </AccessCard>
  )

  const policyError = missing.length > 0
  const missingList = missing.map(id => text(`landing.access.pw.missing.${id}`)).join(', ')
  return (
    <AccessCard title={text('landing.access.reset.title')}>
      <form onSubmit={submit} className="ac-form" noValidate aria-busy={busy}>
        <AccessField id="reset-password" label={text('landing.access.reset.new_password')} type={show ? 'text' : 'password'} autoComplete="new-password" value={password}
          aria-describedby="pw-req" onChange={e => { setPassword(e.target.value); if (policyError) setMissing([]) }}
          adornment={<button type="button" className="ac-toggle" aria-controls="reset-password"
            aria-label={text(show ? 'landing.access.hide_password' : 'landing.access.show_password')} onClick={() => setShow(!show)}>{show ? t('access.hide') : t('access.show')}</button>} />
        <PasswordRequirements id="pw-req" password={password} showErrors={policyError} serverProblems={missing} visibleSummary text={text} />
        <Message innerRef={messageRef} notice={policyError ? { text: text('landing.access.pw.missing').replace('{list}', missingList), ok: false } : notice} />
        <button type="submit" disabled={busy} className="ac-submit">{busy ? text('landing.access.submitting') : text('landing.access.reset.save')}</button>
      </form>
    </AccessCard>
  )
}
