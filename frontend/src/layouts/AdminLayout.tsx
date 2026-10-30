import { useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AdminSidebar } from '../components/AdminSidebar.tsx'
import { useLanguage } from '../i18n/useLanguage'
import { interfaceCopy } from '../access/interfaceCopy'
import '../styles/accessAdmin.css'

export function AdminLayout({ pilotPreview = false }: { pilotPreview?: boolean }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { lang, setLang } = useLanguage()
  const copy = interfaceCopy[lang]
  const name = localStorage.getItem('elevation_name') ?? 'Admin'
  const role = localStorage.getItem('elevation_role') ?? 'admin'
  const [expandedAt, setExpandedAt] = useState<string | null>(null)
  const open = expandedAt === location.key
  const menuButton = useRef<HTMLButtonElement>(null)
  const main = useRef<HTMLElement>(null)

  const handleLogout = () => {
    localStorage.removeItem('elevation_token')
    localStorage.removeItem('elevation_role')
    localStorage.removeItem('elevation_name')
    navigate('/login')
  }

  return (
    <div className={`admin-shell elv-theme${pilotPreview ? ' pilot-admin-layout' : ''}`}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) {
          setExpandedAt(null)
          if (menuButton.current?.getClientRects().length) menuButton.current.focus()
        }
      }}>
      <a className="interface-skip" href="#admin-main">{copy.skip}</a>
      <header className="interface-header">
        <span className="interface-brand">ELEVATION <span aria-hidden="true">●</span></span>
        <button ref={menuButton} type="button" className="elv-btn elv-btn-outline admin-menu-toggle"
          aria-expanded={open} aria-controls="admin-navigation" onClick={() => setExpandedAt(open ? null : location.key)}>
          {open ? copy.closeMenu : copy.openMenu}
        </button>
        <div className="admin-header-actions">
          <div className="interface-language" role="group" aria-label={copy.language}>
            {(['es', 'en'] as const).map(code => (
              <button key={code} type="button" lang={code} aria-pressed={lang === code}
                className="elv-btn" onClick={() => setLang(code)}>{code.toUpperCase()}</button>
            ))}
          </div>
          <span className="admin-name">{name}</span>
          <span className="admin-role">{role === 'superadmin' ? copy.superadministrator : copy.administrator}</span>
          <button type="button" onClick={handleLogout} className="elv-btn elv-btn-outline">{copy.logout}</button>
        </div>
      </header>
      <div className="admin-body">
        <AdminSidebar open={open} onNavigate={() => {
          setExpandedAt(null)
          main.current?.focus()
        }} />
        <main id="admin-main" ref={main} className="admin-main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
