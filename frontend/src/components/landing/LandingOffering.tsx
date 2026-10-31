import { useEffect } from 'react'
import { LandingCard, LandingLabel, LandingSection } from './LandingPrimitives'

type Props = { text: (key: string) => string }
const features = ['conversation', 'exercises', 'journal', 'compass', 'languages', 'data'] as const
const routes = ['continuity', 'adjacent', 'exploratory'] as const

function SectionLabel({ text, section }: Props & { section: string }) {
  return <p className="landing-offer-label">
    <span aria-hidden="true">{text(`landing.${section}.number`)}</span>
    <span>{text(`landing.${section}.label`)}</span>
  </p>
}

export function LandingFeatures({ text }: Props) {
  return <LandingSection className="landing-offer-section" aria-labelledby="landing-features-title">
    <div className="landing-offer-inner">
      <SectionLabel text={text} section="features" />
      <h2 id="landing-features-title">{text('landing.features.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 landing-feature-grid">
        {features.map(feature => <LandingCard key={feature} className="landing-offer-card">
          <div className="elv-card-body">
            <LandingLabel className="landing-offer-status">{text(`landing.features.${feature}.status`)}</LandingLabel>
            <h3 className="elv-card-title">{text(`landing.features.${feature}.title`)}</h3>
            <p>{text(`landing.features.${feature}.body`)}</p>
          </div>
        </LandingCard>)}
      </div>
    </div>
  </LandingSection>
}

// Public description only: no real assessments, personal data, route offers or scores.
export function LandingSkillMap({ text }: Props) {
  // The SPA mounts after the initial native fragment lookup. Honour direct links and reloads too.
  useEffect(() => {
    if (window.location.hash !== '#skill-map') return
    const section = document.getElementById('skill-map')
    section?.focus({ preventScroll: true })
    section?.scrollIntoView({ block: 'start' })
  }, [])
  return <LandingSection id="skill-map" tabIndex={-1} className="landing-offer-section" aria-labelledby="landing-skillmap-title">
    <div className="landing-offer-inner">
      <SectionLabel text={text} section="skillmap" />
      <h2 id="landing-skillmap-title">{text('landing.skillmap.title')}</h2>
      <LandingLabel className="landing-offer-status">{text('landing.skillmap.status')}</LandingLabel>
      <div className="landing-map-row">
        <h3>{text('landing.skillmap.capabilities.title')}</h3>
        <p>{text('landing.skillmap.capabilities.body')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 landing-map-panels">
        <LandingCard className="landing-offer-card">
          <div className="elv-card-body">
            <h3 className="elv-card-title">{text('landing.skillmap.evidence.title')}</h3>
            <p>{text('landing.skillmap.evidence.body')}</p>
            <ul className="landing-map-list" role="list">
              {['none', 'initial', 'reviewed', 'contradictory'].map(state => <li key={state}>
                {text(`landing.skillmap.evidence.${state}`)}
              </li>)}
            </ul>
          </div>
        </LandingCard>
        <LandingCard className="landing-offer-card landing-autonomy">
          {/* ES-133: el detalle de los cuatro niveles se pliega para acortar la sección sin quitar contenido aprobado. */}
          <details className="landing-autonomy-details">
            <summary><h3 className="elv-card-title">{text('landing.skillmap.autonomy.title')}</h3></summary>
            <ol className="landing-map-list" role="list">
              {[1, 2, 3, 4].map(level => <li key={level}>
                <span aria-hidden="true">{text(`landing.skillmap.autonomy.${level}.number`)}</span>
                {text(`landing.skillmap.autonomy.${level}.title`)}
              </li>)}
            </ol>
            <p className="landing-offer-note">{text('landing.skillmap.autonomy.note')}</p>
          </details>
        </LandingCard>
      </div>
      <div className="landing-map-row">
        <h3>{text('landing.skillmap.routes.title')}</h3>
        <p>{text('landing.skillmap.routes.body')}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 landing-route-grid">
        {routes.map(route => <LandingCard key={route} className="landing-offer-card">
          <div className="elv-card-body">
            <h4>{text(`landing.skillmap.routes.${route}.title`)}</h4>
            <p>{text(`landing.skillmap.routes.${route}.pending`)}</p>
          </div>
        </LandingCard>)}
      </div>
      <div className="landing-map-row">
        <h3>{text('landing.skillmap.experiment.title')}</h3>
        <p>{text('landing.skillmap.experiment.body')}</p>
      </div>
      <div className="landing-map-row">
        <h3>{text('landing.skillmap.ai.title')}</h3>
        <p>{text('landing.skillmap.ai.body')}</p>
      </div>
      <p className="landing-offer-note landing-map-connection">{text('landing.skillmap.connection')}</p>
    </div>
  </LandingSection>
}
