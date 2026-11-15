import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { SpaceShell } from './SpaceShell'
import { useSpaceRoutes } from './routesContext'
// Menú de «Mi espacio» hacia las pantallas profesionales que estén registradas. La ruta /app/next-step es del recorrido de ES-34, no de esta página.
export function SpaceToolsPage() {
  const { lang } = useLanguage(); const c = copy[lang]; const routes = useSpaceRoutes()
  const options = [['/app/compass', c.compass, c.compassLine], ['/app/evidence', c.evidence, c.evidenceLine], ['/app/skill-map', c.map, c.mapLine], ['/app/route-catalog', c.catalog, c.catalogLine]]
  return <SpaceShell><h1>{c.tools}</h1>{!options.some(([path]) => routes.has(path)) && <p>{c.toolsEmpty}</p>}<div className="space-grid">{options.map(([path, title, line]) => <section className="elv-card space-card" key={path}><h2>{title}</h2><p>{line}</p>{routes.has(path) ? <Link className="elv-btn" to={path}>{c.open}</Link> : <p>{c.preparation}</p>}</section>)}</div></SpaceShell>
}
