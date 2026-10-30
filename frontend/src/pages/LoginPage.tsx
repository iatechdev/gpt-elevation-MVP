import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { useSessionEntry } from '../access/useSessionEntry'
import { authFailureKey, isSessionInfo, registrationRequested, sessionDestination } from '../access/session'
import { accessParams, planDestination, planIntent } from '../pricing/plans'
import { interfaceCopy } from '../access/interfaceCopy'
import '../styles/accessAdmin.css'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

export function LoginPage() {
  const { t, lang, setLang } = useLanguage()
  const copy = interfaceCopy[lang]
  const [params, setParams] = useSearchParams()
  const isRegistering = registrationRequested(params.toString())
  const selectedPlan = planIntent(params.toString())
  const { text } = useLandingContent(lang)
  const entry = useSessionEntry(BACKEND)

  const [name,          setName]          = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [authMessage,   setAuthMessage]   = useState<{ key: string; success: boolean } | null>(null)
  const [isLocked,      setIsLocked]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || isLocked) return
    setAuthMessage(null)
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
        role?: string; name?: string; onboardingCompleted?: boolean; deactivated?: boolean; code?: string
      }

      if (!res.ok) {
        setIsLocked(data.locked === true)
        setAuthMessage({ key: authFailureKey(res.status, data, isRegistering), success: false })
        return
      }

      if (isRegistering) {
        if (res.status !== 201) throw new Error('Invalid registration response')
        setAuthMessage({ key: 'landing.access.registered', success: true })
        setParams(accessParams(false, selectedPlan), { replace: true })
        setPassword('')
        setName('')
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
    } finally { setSubmitting(false) }
  }

  const preferredLanguage = entry.result.status === 'verified' ? entry.result.preferredLanguage : undefined
  useEffect(() => {
    if (preferredLanguage && preferredLanguage !== lang) setLang(preferredLanguage)
  }, [preferredLanguage, lang, setLang])

  if (entry.result.status === 'verified') return <Navigate to={planDestination(params.toString()) ?? sessionDestination(entry.result.session)} replace />

  return (
    <div className="access-page elv-theme">
      <a className="interface-skip" href="#access-main">{copy.skip}</a>
      <header className="interface-header">
        <span className="interface-brand">{t('logo')} <span aria-hidden="true">●</span></span>
        <div className="interface-language" role="group" aria-label={copy.language}>
          {(['es', 'en'] as const).map(code => (
            <button key={code} type="button" lang={code} aria-pressed={lang === code}
              className="elv-btn" onClick={() => setLang(code)}>{code.toUpperCase()}</button>
          ))}
        </div>
      </header>
      <main id="access-main" className="access-main" tabIndex={-1}>
        <header className="access-heading">
          <div className="access-rule" aria-hidden="true" />
          <h1>{isRegistering ? text('landing.access.register') : t('btn_login')}</h1>
          <p>{t('login_subtitle')}</p>
        </header>
        {entry.result.status === 'checking' && <p role="status" className="access-notice">{text('landing.access.checking')}</p>}
        {entry.result.status === 'invalid' && <p role="status" className="access-notice">{text('landing.access.expired')}</p>}
        {entry.result.status === 'unavailable' && <div role="alert" className="access-notice access-notice--error">
          <p>{text('landing.access.unavailable')}</p>
          <button type="button" className="elv-btn elv-btn-outline" onClick={entry.retry}>{text('landing.access.retry')}</button>
        </div>}
        {entry.result.status !== 'checking' &&
        <form onSubmit={handleAuth} className="access-form" aria-busy={submitting}>
          {isRegistering && <div>
            <label htmlFor="access-name">{text('landing.access.name')}</label>
            <input id="access-name" className="elv-input" type="text" autoComplete="name"
              value={name} onChange={e => setName(e.target.value)} placeholder={t('label_name')} required />
          </div>}
          <div>
            <label htmlFor="access-email">{text('landing.access.email')}</label>
            <input id="access-email" className="elv-input" type="email" autoComplete="email"
              value={email} onChange={e => setEmail(e.target.value)} placeholder={t('label_email')} required />
          </div>
          <div>
            <label htmlFor="access-password">{text('landing.access.password')}</label>
            <div className="access-password">
              <input id="access-password" className="elv-input" type={showPassword ? 'text' : 'password'}
                autoComplete={isRegistering ? 'new-password' : 'current-password'} value={password}
                onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="elv-btn elv-btn-ghost" aria-controls="access-password"
                aria-label={text(showPassword ? 'landing.access.hide_password' : 'landing.access.show_password')}
                onClick={() => setShowPassword(!showPassword)}>{showPassword ? copy.hide : copy.show}</button>
            </div>
          </div>
          {authMessage && <p role={authMessage.success ? 'status' : 'alert'}
            className={`access-notice access-notice--${authMessage.success ? 'success' : 'error'}`}>
            {text(authMessage.key)}
          </p>}
          <button type="submit" className="elv-btn elv-btn-primary" disabled={isLocked || submitting}>
            {isLocked ? text('landing.access.locked') : submitting ? text('landing.access.submitting') : isRegistering ? text('landing.access.register') : t('btn_login')}
          </button>
          <button type="button" className="elv-btn elv-btn-outline" disabled={submitting}
            onClick={() => {
              setParams(accessParams(!isRegistering, selectedPlan), { replace: true })
              setAuthMessage(null)
              setPassword('')
              setShowPassword(false)
            }}>
            {isRegistering ? t('link_login') : text('landing.access.register_link')}
          </button>
        </form>}
      </main>
    </div>
  )
}
