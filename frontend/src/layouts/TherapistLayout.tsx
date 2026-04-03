// frontend/src/layouts/TherapistLayout.tsx
// HU-046 — Layout for therapist role

import { Outlet, useNavigate } from 'react-router-dom'

export function TherapistLayout() {
  const navigate = useNavigate()
  const name = localStorage.getItem('elevation_name') ?? 'Therapist'

  const handleLogout = () => {
    localStorage.removeItem('elevation_token')
    localStorage.removeItem('elevation_role')
    localStorage.removeItem('elevation_name')
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9f9f7', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        height: 60, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 2rem',
        background: 'rgba(249,249,247,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '0.5px solid #E7E5E4',
      }}>
        {/* Logo */}
        <span style={{
          fontFamily: 'Playfair Display, serif', fontWeight: 300,
          letterSpacing: '0.2em', fontSize: '1rem', color: '#1C1917',
        }}>
          ELEVATION{' '}
          <span style={{ fontSize: 10, color: '#A8A29E', letterSpacing: '0.15em' }}>
            THERAPIST
          </span>
        </span>

        {/* User + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: 13, color: '#78716C' }}>{name}</span>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '3px 10px',
            borderRadius: 9999, letterSpacing: '0.08em',
            background: '#E0F2FE', color: '#0369A1',
            border: '0.5px solid #BAE6FD',
          }}>
            THERAPIST
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

      {/* Main content */}
      <main style={{ paddingTop: 60, padding: '80px 2rem 2rem', maxWidth: 900, margin: '0 auto' }}>
        <Outlet />
      </main>

    </div>
  )
}