import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

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
      const data = await res.json() as { error?: string; locked?: boolean; token?: string; role?: string; name?: string }

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
          } else {
            navigate('/app/dashboard')
          }
    }
    } catch {
      setAuthMessage(`❌ ${t('err_connection')}`)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem', background: '#f9f9f7', fontFamily: 'Inter, sans-serif' }}>

      <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

        {/* Lang switcher */}
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: 6, marginBottom: '1rem' }}>
          {(['es', 'en'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, border: '0.5px solid #D6D2C4', background: lang === l ? '#6B7D5C' : 'transparent', color: lang === l ? '#FAF8F4' : '#7A7A7A', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Branding */}
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontWeight: 300, letterSpacing: '0.3em', fontSize: '1.5rem', color: '#1C1917', margin: 0 }}>
            {t('logo')}
          </h1>
          <div style={{ width: 40, height: 1, background: '#E7E5E4', margin: '1rem auto' }} />
          <p style={{ fontFamily: 'Noto Serif, serif', fontStyle: 'italic', fontSize: '0.8rem', color: '#A8A29E', margin: 0 }}>
            {t('tagline')}
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {isRegistering && (
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder={t('label_name')} required
              style={{ width: '100%', background: 'transparent', outline: 'none', padding: '0.75rem 0', borderBottom: '1px solid #E7E5E4', color: '#1C1917', fontSize: '1rem', boxSizing: 'border-box' }} />
          )}
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder={t('label_email')} required
            style={{ width: '100%', background: 'transparent', outline: 'none', padding: '0.75rem 0', borderBottom: '1px solid #E7E5E4', color: '#1C1917', fontSize: '1rem', boxSizing: 'border-box' }} />

          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t('label_password')} required
              style={{ width: '100%', background: 'transparent', outline: 'none', padding: '0.75rem 0', paddingRight: '2rem', borderBottom: '1px solid #E7E5E4', color: '#1C1917', fontSize: '1rem', boxSizing: 'border-box' }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 0, bottom: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: '#A8A29E', fontSize: 16 }}>
              {showPassword ? '🙈' : '👁'}
            </button>
          </div>

          {authMessage && (
            <p style={{ fontSize: '0.85rem', textAlign: 'center', color: authMessage.startsWith('✓') ? '#0d9488' : '#dc2626', margin: 0 }}>
              {authMessage}
            </p>
          )}

          <button type="submit" disabled={isLocked}
            style={{ width: '100%', padding: '0.85rem', color: 'white', fontWeight: 500, borderRadius: '1rem', border: 'none', fontSize: '0.9rem', cursor: isLocked ? 'not-allowed' : 'pointer', background: isLocked ? '#E7E5E4' : 'linear-gradient(135deg,#00685f,#008378)' }}>
            {isLocked ? `🔒 ${t('err_locked')}` : isRegistering ? t('btn_register') : t('btn_login')}
          </button>

          <button type="button"
            onClick={() => { setIsRegistering(!isRegistering); setAuthMessage(''); setPassword(''); setShowPassword(false) }}
            style={{ background: 'none', border: 'none', color: '#0d9488', fontSize: '0.85rem', cursor: 'pointer', textAlign: 'center' }}>
            {isRegistering ? t('link_login') : t('link_register')}
          </button>
        </form>
      </div>
    </div>
  )
}