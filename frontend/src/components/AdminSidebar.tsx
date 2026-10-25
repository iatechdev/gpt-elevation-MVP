// frontend/src/components/AdminSidebar.tsx
import { NavLink } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'

const ADMIN_NAV = [
  {
    to: '/admin/dashboard',
    labelKey: 'admin_nav_dashboard',
    fallback: 'Dashboard',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    roles: ['admin', 'superadmin'],
  },
  {
    to: '/admin/prompts',
    labelKey: 'admin_nav_prompts',
    fallback: 'Prompts',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14v-4m0-4h.01"/></svg>,
    roles: ['admin', 'superadmin'],
  },
  {
    to: '/admin/content',
    labelKey: 'admin_nav_content',
    fallback: 'Content',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>,
    roles: ['admin', 'superadmin'],
  },
  {
    to: '/admin/users',
    labelKey: 'admin_nav_users',
    fallback: 'Users',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87m-4-12a4 4 0 010 7.75"/></svg>,
    roles: ['superadmin'],
  },
  {
    to: '/admin/metrics',
    labelKey: 'admin_nav_metrics',
    fallback: 'Metrics',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
    roles: ['admin', 'superadmin'],
  },
]

const BOARD_NAV = [
  {
    to: '/admin/manifest',
    labelKey: 'board_manifest_title',
    fallback: 'Ethical Manifest',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/></svg>,
    roles: ['superadmin'],
  },
]

export function AdminSidebar() {
  const { t } = useLanguage()
  const role = localStorage.getItem('elevation_role') ?? 'admin'

  const visibleAdmin = ADMIN_NAV.filter(item => item.roles.includes(role))
  const visibleBoard = BOARD_NAV.filter(item => item.roles.includes(role))

  const renderLink = (item: typeof ADMIN_NAV[0]) => (
    <NavLink
      key={item.to}
      to={item.to}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: '0.65rem',
        padding: '0.65rem 0.85rem', borderRadius: '0.75rem',
        fontSize: '0.875rem', textDecoration: 'none', transition: 'all 0.15s',
        color: isActive ? '#FAF8F4' : '#78716C',
        background: isActive ? '#6B7D5C' : 'transparent',
        fontWeight: isActive ? 500 : 400,
      })}
    >
      {item.icon}
      {t(item.labelKey) !== item.labelKey ? t(item.labelKey) : item.fallback}
    </NavLink>
  )

  return (
    <aside style={{
      width: 240, minHeight: 'calc(100vh - 60px)',
      background: '#EDEAE4', borderRight: '0.5px solid #E7E5E4',
      display: 'flex', flexDirection: 'column',
      padding: '1.5rem 0', flexShrink: 0,
    }}>

      {/* Admin nav */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0.75rem' }}>
        {visibleAdmin.map(renderLink)}
      </nav>

      {/* Ethics Board — superadmin only */}
      {visibleBoard.length > 0 && (
        <>
          <div style={{ margin: '1rem 0.75rem', borderTop: '0.5px solid #D6D2C4' }} />
          <div style={{ padding: '0 1.5rem', marginBottom: '0.5rem' }}>
            <p style={{ fontSize: 10, color: '#A8A29E', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
              Ethics Board
            </p>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 0.75rem' }}>
            {visibleBoard.map(renderLink)}
          </nav>
        </>
      )}

      {/* Version */}
      <div style={{ margin: '1rem 0.75rem', borderTop: '0.5px solid #D6D2C4' }} />
      <div style={{ padding: '0 1.5rem' }}>
        <p style={{ fontSize: 10, color: '#A8A29E', letterSpacing: '0.05em', margin: 0 }}>
          Elevation MVP · Sprint 9
        </p>
      </div>

    </aside>
  )
}