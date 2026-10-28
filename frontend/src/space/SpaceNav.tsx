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
    <nav aria-label={c.space}><NavLink className="elv-btn" to="/app/chat">{c.space}</NavLink><NavLink className="elv-btn" to="/app/space/tools">{c.tools}</NavLink></nav>
    <nav aria-label={c.journal}><NavLink className="elv-link" to="/app/chat">{c.talk}</NavLink><NavLink className="elv-link" to="/app/diary">{c.journal}</NavLink>{routes.has('/app/exercises') && import.meta.env.VITE_ENABLE_COMPANION_EXERCISES === 'true' && <Link className="elv-link" to={`/app/exercises?from=${pathname === '/app/chat' ? 'chat' : 'dashboard'}`}>{c.exercises}</Link>}</nav>
  </div>
}
