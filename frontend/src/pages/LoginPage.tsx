import '../access/accessRegister.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { useSessionEntry } from '../access/useSessionEntry'
import { authFailureKey, isSessionInfo, registrationRequested, sessionDestination } from '../access/session'
import { accessParams, planDestination, planIntent } from '../pricing/plans'
import { knownProblems, passwordProblems, type PasswordProblem } from '../access/registrationPassword'
import { PasswordRequirements } from '../access/PasswordRequirements'
import { AccessCard, AccessField } from '../access/AccessCard'
import { fieldErrors, firstInvalid, type FieldErrors } from '../access/fieldErrors'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

/** ES-155 (tramo B): entrar y crear cuenta con Cartografía en el marco público. La lógica de sesión, el bloqueo por intentos y los requisitos de la contraseña no cambiaron:
 *  se añaden el error POR CAMPO con foco al primero, el foco al aviso tras cada rechazo, el aviso de que no hay pago en línea y la nota de privacidad (sin casilla: llega con ES-301). */
export function LoginPage() {
  const { t, lang, setLang } = useLanguage()
  const [params, setParams] = useSearchParams()
  const isRegistering = registrationRequested(params.toString())
  const selectedPlan = planIntent(params.toString())
  const { text } = useLandingContent(lang)
  const entry = useSessionEntry(BACKEND)

  const [name,          setName]          = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [authMessage,   setAuthMessage]   = useState<{ key: string; success: boolean; missing?: PasswordProblem[] } | null>(null)
  const [errors,        setErrors]        = useState<FieldErrors>({})
  const [isLocked,      setIsLocked]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)
  const [rejections,    setRejections]    = useState(0)
  const nameInput = useRef<HTMLInputElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const passwordInput = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLParagraphElement>(null)
  const inputs = { name: nameInput, email: emailInput, password: passwordInput }
  // Tras cada rechazo del servidor el foco va al aviso (el contador dispara el efecto una vez por rechazo).
  useEffect(() => { if (rejections > 0) messageRef.current?.focus() }, [rejections])

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || isLocked) return
    setAuthMessage(null)
    const found = fieldErrors({ name, email, password }, isRegistering ? 'register' : 'login')
    setErrors(found)
    const first = firstInvalid(found)
    if (first) { inputs[first].current?.focus(); return }
    if (isRegistering) {
      const missing = passwordProblems(password)
      if (missing.length) {
        setAuthMessage({ key: 'landing.access.password_policy', success: false, missing })
        passwordInput.current?.focus()
        return
      }
    }
    setSubmitting(true)
    const endpoint = isRegistering ? 'register' : 'login'
    const body = isRegistering
      ? { name, email, password }
      : { email, password }

    try {
      const res  = await fetch(`${BACKEND}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as {
        error?: string; locked?: boolean; token?: string
        role?: string; name?: string; onboardingCompleted?: boolean; deactivated?: boolean; code?: string; missing?: unknown
      }

      if (!res.ok) {
        setIsLocked(data.locked === true)
        const key = authFailureKey(res.status, data, isRegistering)
        setAuthMessage({ key, success: false, missing: key === 'landing.access.password_policy' ? knownProblems(data.missing) : undefined })
        if (key === 'landing.access.password_policy') passwordInput.current?.focus()
        else setRejections(n => n + 1)
        return
      }

      if (isRegistering) {
        if (res.status !== 201) throw new Error('Invalid registration response')
        setAuthMessage({ key: 'landing.access.registered', success: true })
        setParams(accessParams(false, selectedPlan), { replace: true })
        setPassword('')
        setName('')
        setRejections(n => n + 1) // también se enfoca el aviso de «cuenta creada»: es lo siguiente que hay que leer
      } else {
        const token = data.token
        const displayName = data.name
        if (res.status !== 200 || !isSessionInfo(data) || typeof token !== 'string' || !token.trim()) throw new Error('Invalid login response')
        localStorage.setItem('elevation_token', token)
        localStorage.setItem('elevation_role', data.role)
        localStorage.setItem('elevation_name', typeof displayName === 'string' ? displayName : '')
        window.dispatchEvent(new Event('elevation-session-change'))
      }
    } catch {
      setAuthMessage({ key: 'landing.access.failed', success: false })
      setRejections(n => n + 1)
    } finally { setSubmitting(false) }
  }

  const preferredLanguage = entry.result.status === 'verified' ? entry.result.preferredLanguage : undefined
  useEffect(() => {
    if (preferredLanguage && preferredLanguage !== lang) setLang(preferredLanguage)
  }, [preferredLanguage, lang, setLang])

  if (entry.result.status === 'verified') return <Navigate to={planDestination(params.toString()) ?? sessionDestination(entry.result.session)} replace />

  // ES-128: los requisitos que faltan, del cliente o del servidor, se nombran en el aviso.
  const policyError = authMessage?.key === 'landing.access.password_policy'
  const missingList = authMessage?.missing?.map(id => text(`landing.access.pw.missing.${id}`)).join(', ')
  const messageText = policyError && missingList ? text('landing.access.pw.missing').replace('{list}', missingList) : authMessage ? text(authMessage.key) : ''
  const clear = (field: keyof FieldErrors) => setErrors(previous => (previous[field] ? { ...previous, [field]: undefined } : previous))
  const switchMode = () => {
    setParams(accessParams(!isRegistering, selectedPlan), { replace: true })
    setAuthMessage(null); setErrors({}); setPassword(''); setShowPassword(false)
  }

  return (
    <AccessCard title={isRegistering ? text('landing.access.register') : t('access.sign_in')} intro={t('login_subtitle')}>
      {entry.result.status === 'checking' && <p role="status" className="ac-notice">{text('landing.access.checking')}</p>}
      {entry.result.status === 'invalid' && <p role="status" className="ac-notice">{text('landing.access.expired')}</p>}
      {entry.result.status === 'unavailable' && <div role="alert" className="ac-notice ac-notice--error">
        <p>{text('landing.access.unavailable')}</p>
        <button type="button" className="ac-submit" onClick={entry.retry}>{text('landing.access.retry')}</button>
      </div>}
      {entry.result.status !== 'checking' && <>
        <form onSubmit={handleAuth} className="ac-form" aria-busy={submitting} noValidate>
          {isRegistering && <AccessField id="access-name" label={text('landing.access.name')} inputRef={nameInput} type="text" autoComplete="name" value={name}
            error={errors.name ? t('access.err_name') : undefined} onChange={e => { setName(e.target.value); clear('name') }} />}
          <AccessField id="access-email" label={text('landing.access.email')} inputRef={emailInput} type="email" autoComplete="email" value={email}
            error={errors.email ? t('access.err_email') : undefined} onChange={e => { setEmail(e.target.value); clear('email') }} />
          <AccessField id="access-password" label={text('landing.access.password')} inputRef={passwordInput} type={showPassword ? 'text' : 'password'}
            autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password}
            aria-describedby={isRegistering ? 'pw-req' : undefined} invalid={policyError} error={errors.password ? t('access.err_password') : undefined}
            onChange={e => { setPassword(e.target.value); clear('password'); if (policyError) setAuthMessage(null) }}
            adornment={<button type="button" className="ac-toggle" aria-controls="access-password"
              aria-label={text(showPassword ? 'landing.access.hide_password' : 'landing.access.show_password')}
              onClick={() => setShowPassword(!showPassword)}>{showPassword ? t('access.hide') : t('access.show')}</button>} />
          {isRegistering && (
            <PasswordRequirements id="pw-req" password={password} showErrors={policyError} serverProblems={authMessage?.missing} text={text} />
          )}
          {authMessage && <p ref={messageRef} tabIndex={-1} role={authMessage.success ? 'status' : 'alert'}
            className={`ac-notice ac-notice--${authMessage.success ? 'success' : 'error'}`}>
            {messageText}
          </p>}
          {isRegistering && <p className="ac-note">{t('access.no_payment')}</p>}
          <button type="submit" className="ac-submit" disabled={isLocked || submitting}>
            {isLocked ? text('landing.access.locked') : submitting ? text('landing.access.submitting') : isRegistering ? text('landing.access.register') : t('btn_login')}
          </button>
          {isRegistering && <p className="ac-note">{t('access.privacy_note')} <Link to="/#privacidad">{t('access.privacy_link')}</Link>.</p>}
        </form>
        <div className="ac-secondary">
          {!isRegistering && <p><Link to="/forgot-password">{text('landing.access.reset.forgot_link')}</Link></p>}
          <p>{isRegistering ? t('access.have_account') : t('access.no_account')}</p>
          <button type="button" disabled={submitting} onClick={switchMode}>{isRegistering ? t('access.sign_in') : text('landing.access.register')}</button>
        </div>
      </>}
    </AccessCard>
  )
}
