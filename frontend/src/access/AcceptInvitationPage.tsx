import './accessRegister.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { PasswordRequirements } from './PasswordRequirements'
import { knownProblems, passwordProblems, type PasswordProblem } from './registrationPassword'
import { invitationFailure, readInvitationToken } from './invitation'
import { AccessCard, AccessField, TermsCheck } from './AccessCard'
import { fieldErrors, firstInvalid, type FieldErrors } from './fieldErrors'
import { TERMS_VERSION } from '../legal/version.ts'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

type Notice = { text: string; ok: boolean } | null
const Message = ({ notice, innerRef }: { notice: Notice; innerRef?: React.Ref<HTMLParagraphElement> }) => notice ? (
  <p ref={innerRef} tabIndex={innerRef ? -1 : undefined} role={notice.ok ? 'status' : 'alert'} className={`ac-notice ac-notice--${notice.ok ? 'success' : 'error'}`}>{notice.text}</p>
) : null

// ES-326 (E301-4): quien acepta una invitación elige su nombre y su contraseña y acepta el aviso de privacidad y los términos (misma casilla y misma versión que el registro).
// El servidor pone la versión y la fecha y valida todo antes de gastar el enlace. No se muestran el correo ni el rol de la invitación (el servidor no los devuelve).
export function AcceptInvitationPage() {
  const { lang, t } = useLanguage()
  const { text } = useLandingContent(lang)
  const [token] = useState(() => readInvitationToken(window.location.hash))
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [terms, setTerms] = useState(false)
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(token === null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [missing, setMissing] = useState<PasswordProblem[]>([])
  const [notice, setNotice] = useState<Notice>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const termsInput = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  const inputs = { name: nameInput, email: nameInput, password: passwordInput, terms: termsInput }
  // Tras un rechazo el foco va al aviso (el contador dispara el efecto una vez por rechazo); si el servidor rechazó la aceptación, a la casilla ya habilitada.
  const [rejections, setRejections] = useState(0)
  const [termsRejected, setTermsRejected] = useState(0)
  useEffect(() => { if (rejections > 0) messageRef.current?.focus() }, [rejections])
  useEffect(() => { if (termsRejected > 0) termsInput.current?.focus() }, [termsRejected])
  useEffect(() => { if (window.location.hash) window.history.replaceState(null, '', window.location.pathname) }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !token) return
    setNotice(null)
    const found = fieldErrors({ name, email: '', password, terms }, 'invite'); setErrors(found)
    const first = firstInvalid(found)
    if (first) { inputs[first].current?.focus(); return }
    const local = passwordProblems(password)
    if (local.length) { setMissing(local); passwordInput.current?.focus(); return }
    setBusy(true); setMissing([])
    try {
      const res = await fetch(`${BACKEND}/api/invitations/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: name.trim(), password, acceptedTerms: true, termsVersion: TERMS_VERSION }),
      })
      if (res.ok) { setDone(true); setPassword(''); return }
      const data = await res.json().catch(() => ({})) as { code?: unknown; missing?: unknown }
      const failure = invitationFailure(res.status, data.code)
      if (failure === 'invitation_invalid') setInvalid(true)
      else if (failure === 'password_policy') { setMissing(knownProblems(data.missing)); passwordInput.current?.focus() }
      else if (failure === 'terms') { setErrors({ terms: 'terms' }); setTermsRejected(n => n + 1) }
      else if (failure === 'terms_changed') { setNotice({ text: t('access.terms_changed'), ok: false }); setRejections(n => n + 1) }
      else { setNotice({ text: text(failure === 'rate_limited' ? 'landing.access.rate_limit' : 'landing.access.failed'), ok: false }); setRejections(n => n + 1) }
    } catch { setNotice({ text: text('landing.access.failed'), ok: false }); setRejections(n => n + 1) } finally { setBusy(false) }
  }

  if (done) return (
    <AccessCard title={t('access.invite_done_title')}>
      <Message notice={{ text: t('access.invite_done'), ok: true }} />
      <Link to="/login" className="ac-submit">{text('landing.access.reset.go_login')}</Link>
    </AccessCard>
  )

  if (invalid) return (
    <AccessCard title={t('access.invite_invalid_title')}>
      <Message notice={{ text: t('access.invite_invalid'), ok: false }} />
      <div className="ac-secondary"><Link to="/login">{text('landing.access.reset.back')}</Link></div>
    </AccessCard>
  )

  const policyError = missing.length > 0
  const missingList = missing.map(id => text(`landing.access.pw.missing.${id}`)).join(', ')
  const clear = (field: keyof FieldErrors) => setErrors(previous => (previous[field] ? { ...previous, [field]: undefined } : previous))
  return (
    <AccessCard title={t('access.invite_title')} intro={t('access.invite_intro')}>
      <form onSubmit={submit} className="ac-form" noValidate aria-busy={busy}>
        <AccessField id="invite-name" label={text('landing.access.name')} inputRef={nameInput} type="text" autoComplete="name" value={name}
          error={errors.name ? t('access.err_name') : undefined} onChange={e => { setName(e.target.value); clear('name') }} />
        <AccessField id="invite-password" label={text('landing.access.password')} inputRef={passwordInput} type={show ? 'text' : 'password'} autoComplete="new-password" value={password}
          aria-describedby="pw-req" invalid={policyError} error={errors.password ? t('access.err_password') : undefined}
          onChange={e => { setPassword(e.target.value); clear('password'); if (policyError) setMissing([]) }}
          adornment={<button type="button" className="ac-toggle" aria-controls="invite-password"
            aria-label={text(show ? 'landing.access.hide_password' : 'landing.access.show_password')} onClick={() => setShow(!show)}>{show ? t('access.hide') : t('access.show')}</button>} />
        <PasswordRequirements id="pw-req" password={password} showErrors={policyError} serverProblems={missing} visibleSummary text={text} />
        <TermsCheck checked={terms} error={errors.terms ? t('access.err_terms') : undefined} disabled={busy} inputRef={termsInput} onChange={checked => { setTerms(checked); clear('terms') }} />
        <Message innerRef={messageRef} notice={policyError ? { text: text('landing.access.pw.missing').replace('{list}', missingList), ok: false } : notice} />
        <button type="submit" disabled={busy} className="ac-submit">{busy ? t('access.invite_busy') : t('access.invite_submit')}</button>
      </form>
    </AccessCard>
  )
}
