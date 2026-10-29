import { Link, NavLink, useLocation } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { useSpaceRoutes } from './routesContext'
import './space.css'
export function SpaceSkip() {
  const { lang } = useLanguage()
  return <a className="space-skip space-scope" href="#space-main">{copy[lang].skip}</a>
}
export function SpaceNav() {
  const { lang } = useLanguage(); const c = copy[lang]; const routes = useSpaceRoutes(); const { pathname } = useLocation()
  return <div className="space-scope space-nav">
    <nav className="space-tabs" aria-label={c.tabs}><NavLink to="/app/chat" end={false}>{c.conversation}</NavLink><NavLink to="/app/diary">{c.journal}</NavLink></nav>
    <details className="space-menu"><summary aria-label={c.menuLabel}>☰<span className="space-menu-text"> {c.menu}</span></summary>
    <nav aria-label={c.menuLabel}><NavLink className="elv-link" to="/app/bridge">{c.bridge}</NavLink><NavLink className="elv-link" to="/app/space/tools">{c.tools}</NavLink>{import.meta.env.VITE_ENABLE_COMPASS_CHAT === 'true' && <NavLink className="elv-link" to="/app/chat?mode=compass">{c.proCompass}</NavLink>}{routes.has('/app/exercises') && import.meta.env.VITE_ENABLE_COMPANION_EXERCISES === 'true' && <Link className="elv-link" to={`/app/exercises?from=${pathname === '/app/chat' ? 'chat' : 'dashboard'}`}>{c.exercises}</Link>}</nav></details>
  </div>
}
