import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { SpaceShell } from './SpaceShell'
import { useSpaceRoutes } from './routesContext'
// Menú de «Mi espacio» hacia las pantallas profesionales que estén registradas. La ruta /app/next-step es del recorrido de ES-34, no de esta página.
// ES-153 (paso 1): al salir el menú «☰» de SpaceNav, esta pantalla es la entrada a los ejercicios opcionales y (con su bandera) a la Brújula en el chat.
type Option = { path: string; title: string; line: string; to?: string }
export function SpaceToolsPage() {
  const { lang } = useLanguage(); const c = copy[lang]; const routes = useSpaceRoutes()
  const options: Option[] = [
    { path: '/app/compass', title: c.compass, line: c.compassLine }, { path: '/app/evidence', title: c.evidence, line: c.evidenceLine },
    { path: '/app/skill-map', title: c.map, line: c.mapLine }, { path: '/app/route-catalog', title: c.catalog, line: c.catalogLine },
    { path: '/app/exercises', title: c.exercises, line: c.exercisesLine, to: '/app/exercises?from=dashboard' },
    ...(import.meta.env.VITE_ENABLE_COMPASS_CHAT === 'true' ? [{ path: '/app/chat', title: c.proCompass, line: c.compassChatLine, to: '/app/chat?mode=compass' }] : []),
  ]
  return <SpaceShell><h1>{c.tools}</h1>{!options.some(option => routes.has(option.path)) && <p>{c.toolsEmpty}</p>}<div className="space-grid">{options.map(option => <section className="elv-card space-card" key={option.to ?? option.path}><h2>{option.title}</h2><p>{option.line}</p>{routes.has(option.path) ? <Link className="elv-btn" to={option.to ?? option.path}>{c.open}</Link> : <p>{c.preparation}</p>}</section>)}</div></SpaceShell>
}
