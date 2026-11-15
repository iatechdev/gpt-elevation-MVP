import { useSpaceRoutes } from '../../space/routesContext'
import { LandingSurface } from './LandingSurface'
import { LandingFooter } from './LandingClosing'
import { LandingFeatures, LandingSkillMap } from './LandingOffering'
import { LandingProject } from './LandingProject'
import { LandingTrust, LandingFaq } from './LandingTrustFaq'
import { trustFaqEnabled } from '../../content/landingTrustFaq'
import { LandingProfessionals } from './LandingProfessionals'
import { professionalsEnabled } from '../../content/landingProfessionals'
import { LandingJoin } from './LandingJoin'
import { LandingPlans } from './LandingPlans'
import { useScrollToHash } from '../portada/useScrollToHash'
import '../portada/portadaTail.css'

/** ES-155 (tramo C): lo que se CONSERVA de la portada de ES-61…74, debajo del hero nuevo. Va en un bloque aparte (se descarga en paralelo, sin bloquear el primer pintado):
 *  su CSS (landing.css) ya no pesa en el arranque. Mismo contenido del CMS `landing.*`, con los colores del sistema (portadaTail.css). */
export default function LandingTail({ text, manifestLabel }: { text: (key: string) => string; manifestLabel: string }) {
  const routes = useSpaceRoutes()
  useScrollToHash()
  const showProfessionals = professionalsEnabled(import.meta.env.VITE_ENABLE_LANDING_PROFESSIONALS)
  const trust = trustFaqEnabled(import.meta.env.VITE_ENABLE_LANDING_TRUST_FAQ)
  return (
    <LandingSurface className="cg-tail">
      {/* El enlace «Privacidad» del marco va a #privacidad: con la sección de confianza apagada (bandera) lleva al aviso del cierre, nunca a un ancla vacía */}
      {trust && <div id="privacidad" tabIndex={-1}><LandingTrust text={text} /></div>}
      <LandingFeatures text={text} />
      {showProfessionals && <LandingProfessionals text={text} applicationAvailable={routes.has('/profesionales')} />}
      <LandingSkillMap text={text} />
      <LandingPlans text={text} />
      <LandingProject text={text} />
      <LandingJoin text={text} />
      {trust && <LandingFaq text={text} />}
      <div id={trust ? undefined : 'privacidad'} tabIndex={trust ? undefined : -1}><LandingFooter text={text} manifestLabel={manifestLabel} /></div>
    </LandingSurface>
  )
}
