import { useSpaceRoutes } from '../../space/routesContext'
import { LandingSurface } from './LandingSurface'
import { LandingFooter } from './LandingClosing'
import { Features, SkillMap, Languages, NextStep, Professionals } from './PortadaSections'
import { LandingTrust, LandingFaq } from './LandingTrustFaq'
import { trustFaqEnabled } from '../../content/landingTrustFaq'
import { professionalsEnabled } from '../../content/landingProfessionals'
import { useScrollToHash } from '../portada/useScrollToHash'
import '../portada/portadaTail.css'

/** ES-155 (tramo C) y ES-360: lo que va debajo de «Cómo funciona» en la portada. Va en un bloque aparte (se descarga en paralelo, sin bloquear el primer pintado).
 *  ES-360: se retiraron la sección de planes (ya no se leen planes de la base desde la portada), «Estado del proyecto» y «Cómo vincularte»; la oferta se explica en
 *  «Qué puedes hacer», SkillMap, idiomas, próximo paso y solicitud profesional, con una sola escala de estado (Disponible / En preparación). */
export default function LandingTail({ text, manifestLabel }: { text: (key: string) => string; manifestLabel: string }) {
  const routes = useSpaceRoutes()
  useScrollToHash()
  const showProfessionals = professionalsEnabled(import.meta.env.VITE_ENABLE_LANDING_PROFESSIONALS)
  const trust = trustFaqEnabled(import.meta.env.VITE_ENABLE_LANDING_TRUST_FAQ)
  return (
    <LandingSurface className="cg-tail">
      {/* Con la sección de confianza apagada (bandera), el ancla antigua /#privacidad lleva al pie, nunca a un ancla vacía */}
      {trust && <div id="privacidad" tabIndex={-1}><LandingTrust text={text} /></div>}
      <Features text={text} />
      <SkillMap text={text} />
      <Languages text={text} />
      <NextStep text={text} />
      {showProfessionals && <Professionals text={text} applicationAvailable={routes.has('/profesionales')} />}
      {trust && <LandingFaq text={text} />}
      <div id={trust ? undefined : 'privacidad'} tabIndex={trust ? undefined : -1}><LandingFooter text={text} manifestLabel={manifestLabel} /></div>
    </LandingSurface>
  )
}
