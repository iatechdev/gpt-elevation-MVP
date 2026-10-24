import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import {
  colors, radius, spacing, typography,
  btnPrimaryStyle,
} from '../styles/tokens'

const BACKEND = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'

export function LoginPage() {
  const { t, lang, setLang } = useLanguage()
  const navigate = useNavigate()

  const [isRegistering, setIsRegistering] = useState(false)
  const [name,          setName]          = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [authMessage,   setAuthMessage]   = useState('')
  const [isLocked,      setIsLocked]      = useState(false)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthMessage('')
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
        role?: string; name?: string; onboardingCompleted?: boolean
      }

      if (!res.ok) {
        setIsLocked(data.locked === true)
        setAuthMessage(`❌ ${data.error ?? t('err_credentials')}`)
        return
      }

      if (isRegistering) {
        setAuthMessage(`✓ ${t('success_register')}`)
        setIsRegistering(false)
        setPassword('')
        setName('')
      } else {
        localStorage.setItem('elevation_token', data.token ?? '')
        localStorage.setItem('elevation_role',  data.role  ?? 'user')
        localStorage.setItem('elevation_name',  data.name  ?? '')
        const role = data.role ?? 'user'
        if (role === 'admin' || role === 'superadmin') {
          navigate('/admin/dashboard')
        } else if (role === 'therapist') {
          navigate('/therapist/dashboard')
        } else if (role === 'board') {
          navigate('/board/manifest')
        } else {
          const onboardingDone = data.onboardingCompleted === true
          navigate(onboardingDone ? '/app/dashboard' : '/app/onboarding')
        }
      }
    } catch {
      setAuthMessage(`❌ ${t('err_connection')}`)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    outline: 'none',
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

        {/* Form */}
        <form onSubmit={handleAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: spacing.xxl }}>

          {isRegistering && (
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={t('label_name')}
              required
              style={inputStyle}
            />
          )}

          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder={t('label_email')}
            required
            style={inputStyle}
          />

          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('label_password')}
              required
              style={{ ...inputStyle, paddingRight: '2rem' }}
            />
            <button
              type="button"
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
              color: authMessage.startsWith('✓') ? colors.success : colors.danger,
              margin: 0,
            }}>
              {authMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isLocked}
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
            {isLocked ? `🔒 ${t('err_locked')}` : isRegistering ? t('btn_register') : t('btn_login')}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering)
              setAuthMessage('')
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
            {isRegistering ? t('link_login') : t('link_register')}
          </button>

        </form>
      </div>
    </div>
  )
}