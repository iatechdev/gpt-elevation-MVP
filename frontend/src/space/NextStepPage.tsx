import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { SpaceShell } from './SpaceShell'
import { useSpaceRoutes } from './routesContext'
export function NextStepPage() {
  const { lang } = useLanguage(); const c = copy[lang]; const routes = useSpaceRoutes()
  const options = [['/app/compass', c.compass], ['/app/evidence', c.evidence], ['/app/skill-map', c.map], ['/app/route-catalog', c.catalog]]
  return <SpaceShell><h1>{c.next}</h1>{!options.some(([path]) => routes.has(path)) && <p>{c.nextEmpty}</p>}<div className="space-grid">{options.map(([path, title]) => <section className="elv-card space-card" key={path}><h2>{title}</h2>{routes.has(path) ? <Link className="elv-btn" to={path}>{c.open}</Link> : <p>{c.preparation}</p>}</section>)}</div></SpaceShell>
}
