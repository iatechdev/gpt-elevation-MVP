// frontend/src/layouts/BoardLayout.tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

const NAV_ITEMS = [
  {
    to: '/board/manifest',
    label: 'Manifiesto Ético',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
      </svg>
    ),
  },
]

export function BoardLayout() {
  const navigate = useNavigate()
  const name = localStorage.getItem('elevation_name') ?? 'Board Member'
  const role = localStorage.getItem('elevation_role') ?? 'board'

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
          ELEVATION{' '}
          <span style={{ fontSize: 10, color: '#6B7D5C', letterSpacing: '0.15em' }}>
            ETHICS BOARD
          </span>
        </span>

        {/* Usuario */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: 13, color: '#78716C' }}>{name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '3px 10px',
            borderRadius: 9999, letterSpacing: '0.08em',
            background: '#EAF0E6', color: '#6B7D5C',
            border: '0.5px solid #A8B5A2',
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

        {/* Sidebar */}
        <aside style={{
          width: 220, minHeight: 'calc(100vh - 60px)',
          background: '#FAFAF8', borderRight: '0.5px solid #E7E5E4',
          padding: '1.5rem 0', position: 'sticky', top: 60,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                padding: '0.6rem 1.25rem', fontSize: 13, textDecoration: 'none',
                borderRadius: 6, margin: '0 0.5rem',
                color: isActive ? '#6B7D5C' : '#78716C',
                background: isActive ? '#EAF0E6' : 'transparent',
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.15s ease',
              })}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </aside>

        {/* Contenido */}
        <main style={{ flex: 1, padding: '2rem', minWidth: 0, overflowY: 'auto' }}>
          <Outlet />
        </main>

      </div>
    </div>
  )
}