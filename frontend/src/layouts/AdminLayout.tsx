import { Outlet, useNavigate } from 'react-router-dom'
import { AdminSidebar } from '../components/AdminSidebar.tsx'
import { useLanguage } from '../i18n/useLanguage'

export function AdminLayout() {
  const navigate = useNavigate()
  const { lang, setLang } = useLanguage()
  const name = localStorage.getItem('elevation_name') ?? 'Admin'
  const role = localStorage.getItem('elevation_role') ?? 'admin'

  const handleLogout = () => {
    localStorage.removeItem('elevation_token')
    localStorage.removeItem('elevation_role')
    localStorage.removeItem('elevation_name')
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EF', fontFamily: 'Inter, sans-serif' }}>

      {/* Header fijo */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 2rem',
        background: 'rgba(245,243,239,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid #E7E5E4',
      }}>
        {/* Logo */}
        <span style={{
          fontFamily: 'Playfair Display, serif', fontWeight: 300,
          letterSpacing: '0.2em', fontSize: '1rem', color: '#1C1917',
        }}>
          ELEVATION <span style={{ fontSize: 10, color: '#A8A29E', letterSpacing: '0.15em' }}>ADMIN</span>
        </span>

        {/* Derecha: selector idioma + usuario + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

          {/* Selector ES / EN */}
          <div style={{ display: 'flex', gap: 2, background: '#EDEAE4', borderRadius: 9999, padding: 2 }}>
            {(['es', 'en'] as const).map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                style={{
                  padding: '2px 10px', borderRadius: 9999, border: 'none',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', letterSpacing: '0.05em',
                  background: lang === l ? '#fff' : 'transparent',
                  color: lang === l ? '#1C1917' : '#A8A29E',
                  boxShadow: lang === l ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <span style={{ fontSize: 13, color: '#78716C' }}>{name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '3px 10px',
            borderRadius: 9999, letterSpacing: '0.08em',
            background: role === 'superadmin' ? '#EAF0E6' : '#F5F3EF',
            color: role === 'superadmin' ? '#6B7D5C' : '#78716C',
            border: `0.5px solid ${role === 'superadmin' ? '#A8B5A2' : '#D6D2C4'}`,
          }}>
            {role.toUpperCase()}
          </span>
          <button onClick={handleLogout} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#A8A29E', display: 'flex', padding: 4,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', paddingTop: 60 }}>
        <AdminSidebar />
        <main style={{ flex: 1, padding: '2rem', minWidth: 0, overflowY: 'auto' }}>
          <Outlet />
        </main>
      </div>

    </div>
  )
}
