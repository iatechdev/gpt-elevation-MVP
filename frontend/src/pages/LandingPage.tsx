import { useLanguage } from '../i18n/useLanguage'
import { LandingSurface } from '../components/landing/LandingSurface'
import { HeroDoors } from '../components/landing/HeroDoors'
import { LandingJourney } from '../components/landing/LandingJourney'
import { LandingHeader } from '../components/landing/LandingHeader'
import { ExampleStrip } from '../components/landing/ExampleStrip'
import { LandingFeatures, LandingSkillMap } from '../components/landing/LandingOffering'
import { LandingProject } from '../components/landing/LandingProject'
import { LandingJoin } from '../components/landing/LandingJoin'
import { LandingPlans } from '../components/landing/LandingPlans'
import { useLandingContent } from '../content/useLandingContent'
import { useState, useEffect } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

type LandingContent = Record<string, string> | null

export function LandingPage() {
  const { t, lang, setLang } = useLanguage()
  const landing = useLandingContent(lang)
  const [content, setContent] = useState<LandingContent>(null)

  useEffect(() => {
    fetch(`${BACKEND}/api/landing-content?lang=${lang}`)
      .then(r => r.json())
      .then((data: Record<string, string>) => setContent(data))
      .catch(() => setContent(null))
  }, [lang])

  // Fallback al i18n si la API falla o no tiene el key
  const getText = (key: string) => content?.[key] ?? t(key)

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
        {/* ES-133: planes antes del estado del proyecto; S11 (ES-72) cierra antes del acceso */}
        <LandingPlans text={landing.text} />
        <LandingProject text={landing.text} />
        {/* ES-74 · S13: acceso y alta, sin registrar elección de puerta */}
        <LandingJoin text={landing.text} />

        {/* ES-133: el CTA final repetía el acceso de S13; se fusionó en LandingJoin. */}

        </main>

        {/* Footer */}
        <footer style={{ padding: '2.5rem 2rem', background: 'var(--color-base-100)', borderTop: '0.5px solid var(--color-base-300)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <span style={{ fontFamily: 'inherit', fontWeight: 300, letterSpacing: '0.2em', fontSize: '0.95rem', color: 'var(--color-base-content)' }}>ELEVATION</span>
          <p style={{ fontSize: '0.75rem', color: 'var(--landing-muted)', margin: 0, textAlign: 'center' }}>{getText('disclaimer')}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--landing-muted)' }}>© {new Date().getFullYear()}</span>
        </footer>

      </div>
    </LandingSurface>
  )
}
