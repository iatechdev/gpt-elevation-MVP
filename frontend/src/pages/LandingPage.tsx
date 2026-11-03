import { useLanguage } from '../i18n/useLanguage'
import { LandingSurface } from '../components/landing/LandingSurface'
import { LandingFooter } from '../components/landing/LandingClosing'
import { HeroDoors } from '../components/landing/HeroDoors'
import { LandingJourney } from '../components/landing/LandingJourney'
import { LandingHeader } from '../components/landing/LandingHeader'
import { ExampleStrip } from '../components/landing/ExampleStrip'
import { LandingFeatures, LandingSkillMap } from '../components/landing/LandingOffering'
import { LandingProject } from '../components/landing/LandingProject'
import { LandingTrust, LandingFaq } from '../components/landing/LandingTrustFaq'
import { trustFaqEnabled } from '../content/landingTrustFaq'
import { LandingProfessionals } from '../components/landing/LandingProfessionals'
import { professionalsEnabled } from '../content/landingProfessionals'
import { useSpaceRoutes } from '../space/routesContext'
import { LandingJoin } from '../components/landing/LandingJoin'
import { LandingPlans } from '../components/landing/LandingPlans'
import { useLandingContent } from '../content/useLandingContent'
export function LandingPage() {
  const { lang, setLang } = useLanguage()
  const landing = useLandingContent(lang)
  const routes = useSpaceRoutes()
  const showProfessionals = professionalsEnabled(import.meta.env.VITE_ENABLE_LANDING_PROFESSIONALS)

  return (
    <LandingSurface>
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Cabecera, idioma y salto al contenido (ES-62) */}
        <LandingHeader text={landing.text} lang={lang} setLang={setLang} showProfessionals={showProfessionals} />

        <main id="contenido" tabIndex={-1}>
          {/* Hero + puertas (ES-63) */}
          <div className="landing-frame">
            <HeroDoors text={landing.text} />
            {/* Franja de ejemplo ilustrativo (ES-64): oculta hasta aprobar el texto */}
            <ExampleStrip text={landing.text} />
          </div>

        {/* ES-68 · Problema, módulos y recorrido */}
        <LandingJourney text={landing.text} />
        {trustFaqEnabled(import.meta.env.VITE_ENABLE_LANDING_TRUST_FAQ) && <LandingTrust text={landing.text} />}

        {/* ES-70 · S7 y S9; ES-71 · S8 solo en el build de revisión. */}
        <LandingFeatures text={landing.text} />
        {showProfessionals && <LandingProfessionals text={landing.text} applicationAvailable={routes.has('/profesionales')} />}
        <LandingSkillMap text={landing.text} />
        {/* ES-133: planes antes del estado del proyecto; S11 (ES-72) cierra antes del acceso */}
        <LandingPlans text={landing.text} />
        <LandingProject text={landing.text} />
        {/* ES-74 · S13: acceso y alta, sin registrar elección de puerta */}
        <LandingJoin text={landing.text} />
        {trustFaqEnabled(import.meta.env.VITE_ENABLE_LANDING_TRUST_FAQ) && <LandingFaq text={landing.text} />}


        </main>

        <LandingFooter text={landing.text} />

      </div>
    </LandingSurface>
  )
}
