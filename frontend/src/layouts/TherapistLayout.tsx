// frontend/src/layouts/TherapistLayout.tsx
// HU-046 — Layout for therapist role
// HU-082 — Selector ES/EN
// ES-100 — Cabecera adaptable (dos líneas en pantallas estrechas), contraste, foco visible y objetivos táctiles (ES93-M6 y B4)

import { Outlet, useNavigate } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import '../styles/therapist.css'

export function TherapistLayout() {
  const navigate = useNavigate()
  const { lang, setLang, t } = useLanguage()
  const name = localStorage.getItem('elevation_name') ?? t('therapist_role')

  const handleLogout = () => {
    localStorage.removeItem('elevation_token')
    localStorage.removeItem('elevation_role')
    localStorage.removeItem('elevation_name')
    navigate('/login')
  }

  return (
    <div className="th-root">

      {/* Header */}
      <header className="th-header">
        {/* Logo */}
        <span className="th-logo">
          ELEVATION{' '}
          <small>THERAPIST</small>
        </span>

        {/* Selector ES / EN */}
        <div role="group" aria-label={lang === 'es' ? 'Idioma' : 'Language'} className="th-lang">
          {(['es', 'en'] as const).map(l => (
            <button
              key={l}
              className="th-pill-btn"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              style={{
                padding: '2px 10px', borderRadius: 9999, border: 'none',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em',
                background: lang === l ? '#fff' : 'transparent',
                color: lang === l ? '#1C1917' : '#57534E',
                boxShadow: lang === l ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Usuario y rol: en la misma fila en pantallas anchas; en la segunda línea, truncado, en las estrechas */}
        <div className="th-who">
          <span className="th-name">{name}</span>
          <span className="th-chip">{t('therapist_role')}</span>
          <span className="th-who-role">{t('therapist_role')}</span>
        </div>

        <button
          className="th-logout"
          onClick={handleLogout}
          aria-label={lang === 'es' ? 'Cerrar sesión' : 'Log out'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </header>

      {/* Main content */}
      <main className="th-main">
        <Outlet />
      </main>

    </div>
  )
}
