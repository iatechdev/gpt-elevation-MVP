import './register.ts' // ES-232: catálogo de textos de esta pantalla (ya no va en el arranque)
import type { ReactNode, MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../i18n/useLanguage'
import { PersonScreen } from '../space/PersonScreen'
// ES-308 (PR 2): las pantallas de evidencias van dentro del marco de persona (PersonLayout, ES-153): el encabezado, el selector de idioma, el tema y «Saltar al contenido» los pone el marco.
// Aquí queda la cabecera de pantalla en Cartografía y los dos enlaces de vuelta (con la guarda de «cambios sin guardar» del editor).
export function EvidenceShell({ title, lead, children, onLeave }: { title: string; lead?: string; children: ReactNode; onLeave?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  const { t } = useLanguage()
  return <PersonScreen title={title} lead={lead}>
    <nav className="pg-nav"><Link className="cg-linkbtn" to="/app/dashboard" onClick={onLeave}>{t('evidence.back')}</Link><Link className="cg-linkbtn" to="/app/evidence" onClick={onLeave}>{t('evidence.list')}</Link></nav>
    {children}
  </PersonScreen>
}
