import { useLanguage } from '../i18n/useLanguage'
import { LandingSurface } from '../components/landing/LandingSurface'
import { LandingClosing, LandingFooter } from '../components/landing/LandingClosing'
import { HeroDoors } from '../components/landing/HeroDoors'
import { LandingJourney } from '../components/landing/LandingJourney'
import { LandingHeader } from '../components/landing/LandingHeader'
import { ExampleStrip } from '../components/landing/ExampleStrip'
import { LandingFeatures, LandingSkillMap } from '../components/landing/LandingOffering'
import { LandingProject } from '../components/landing/LandingProject'
import { LandingJoin } from '../components/landing/LandingJoin'
import { LandingPlans } from '../components/landing/LandingPlans'
import { useLandingContent } from '../content/useLandingContent'
export function LandingPage() {
  const { lang, setLang } = useLanguage()
  const landing = useLandingContent(lang)
  return (
    <LandingSurface>
      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Cabecera, idioma y salto al contenido (ES-62) */}
        <LandingHeader text={landing.text} lang={lang} setLang={setLang} />

        <main id="contenido" tabIndex={-1}>
          {/* Hero + puertas (ES-63) */}
          <div className="landing-frame">
            <HeroDoors text={landing.text} />
            {/* Franja de ejemplo ilustrativo (ES-64): oculta hasta aprobar el texto */}
            <ExampleStrip text={landing.text} />
          </div>

        {/* ES-68 · Problema, módulos y recorrido */}
        <LandingJourney text={landing.text} />

        {/* ES-70 · S7 y S9; S8 se incorporará mediante ES-71. */}
        <LandingFeatures text={landing.text} />
        <LandingSkillMap text={landing.text} />
        {/* ES-72 · S11: objetivos y estado del proyecto */}
        <LandingProject text={landing.text} />
        <LandingPlans text={landing.text} />
        {/* ES-74 · S13: acceso y alta, sin registrar elección de puerta */}
        <LandingJoin text={landing.text} />

        <LandingClosing text={landing.text} />

        </main>

        <LandingFooter text={landing.text} />

      </div>
    </LandingSurface>
  )
}
