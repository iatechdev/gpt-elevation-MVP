import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { useLandingContent } from '../content/useLandingContent'
import { useSessionEntry } from '../access/useSessionEntry'
import { authFailureKey, isSessionInfo, registrationRequested, sessionDestination } from '../access/session'
import { accessParams, planDestination, planIntent } from '../pricing/plans'
import {
  colors, radius, spacing, typography,
  btnPrimaryStyle,
} from '../styles/tokens'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    padding: `${spacing.md} 0`,
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text,
    fontSize: '1rem',
    fontFamily: typography.fontBody,
    boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 1.5rem',
      background: colors.bg,
      fontFamily: typography.fontBody,
    }}>
      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Lang switcher */}
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: spacing.xs, marginBottom: spacing.lg }}>
          {(['es', 'en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              fontSize: 11,
              padding: `3px 10px`,
              borderRadius: radius.full,
              border: `0.5px solid ${colors.borderLight}`,
              background: lang === l ? colors.primary : 'transparent',
              color: lang === l ? colors.bgCard : colors.textMuted,
              cursor: 'pointer',
              fontFamily: typography.fontBody,
              transition: 'all 0.2s',
            }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Branding */}
        <header style={{ textAlign: 'center', marginBottom: spacing.xxxl }}>
          <h1 style={{
            fontFamily: typography.fontDisplay,
            fontWeight: 300,
            letterSpacing: '0.3em',
            fontSize: '1.5rem',
            color: colors.text,
            margin: 0,
          }}>
            {t('logo')}
          </h1>
          <div style={{ width: 40, height: 1, background: colors.border, margin: `${spacing.lg} auto` }} />
          <p style={{
            fontFamily: 'Noto Serif, serif',
            fontStyle: 'italic',
            fontSize: '0.8rem',
            color: colors.textSubtle,
            margin: 0,
          }}>
            {t('tagline')}
          </p>
        </header>

        {entry.result.status === 'checking' && <p role="status" style={{ color: colors.text }}>{text('landing.access.checking')}</p>}
        {entry.result.status === 'invalid' && <p role="status" style={{ color: colors.text }}>{text('landing.access.expired')}</p>}
        {entry.result.status === 'unavailable' && <div role="alert" style={{ marginBottom: spacing.lg, color: colors.text }}>
          <p>{text('landing.access.unavailable')}</p>
          <button type="button" className="elv-btn" onClick={entry.retry} style={{ ...btnPrimaryStyle, marginTop: spacing.md }}>{text('landing.access.retry')}</button>
        </div>}

        {/* Existing form layout and authentication endpoints are preserved. */}
        {entry.result.status !== 'checking' &&
        <form onSubmit={handleAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: spacing.xxl }}>

          {isRegistering && (
            <input
              type="text"
              aria-label={text('landing.access.name')}
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('label_name')}
              required
              style={inputStyle}
            />
          )}

          <input
            type="email"
            aria-label={text('landing.access.email')}
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('label_email')}
            required
            style={inputStyle}
          />

          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              aria-label={text('landing.access.password')}
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('label_password')}
              required
              style={{ ...inputStyle, paddingRight: '2rem' }}
            />
            <button
              type="button"
              aria-label={text(showPassword ? 'landing.access.hide_password' : 'landing.access.show_password')}
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 0,
                bottom: spacing.md,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.textSubtle,
                fontSize: 16,
                padding: 0,
              }}
            >
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>

          {authMessage && (
            <p style={{
              fontSize: '0.85rem',
              textAlign: 'center',
              color: authMessage.success ? colors.success : colors.danger,
              margin: 0,
            }} role="status">
              {authMessage.success ? '✓ ' : '❌ '}{text(authMessage.key)}
            </p>
          )}

          <button
            type="submit"
            disabled={isLocked || submitting}
            style={{
              ...btnPrimaryStyle,
              width: '100%',
              padding: `${spacing.md} ${spacing.lg}`,
              fontSize: '0.9rem',
              borderRadius: radius.lg,
              background: isLocked
                ? colors.border
                : `linear-gradient(135deg, ${colors.primaryDark}, ${colors.primary})`,
              cursor: isLocked ? 'not-allowed' : 'pointer',
              color: colors.bgCard,
              fontWeight: 500,
            }}
          >
            {isLocked ? `🔒 ${text('landing.access.locked')}` : submitting ? text('landing.access.submitting') : isRegistering ? text('landing.access.register') : t('btn_login')}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setParams(accessParams(!isRegistering, selectedPlan), { replace: true })
              setAuthMessage(null)
              setPassword('')
              setShowPassword(false)
            }}
            style={{
              background: 'none',
              border: 'none',
              color: colors.primary,
              fontSize: '0.85rem',
              cursor: 'pointer',
              textAlign: 'center',
              fontFamily: typography.fontBody,
            }}
          >
            {isRegistering ? t('link_login') : text('landing.access.register_link')}
          </button>

        </form>}
      </div>
    </div>
  )
}
