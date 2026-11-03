import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { LandingCard, LandingLabel, LandingSection } from './LandingPrimitives'
import './professionals.css'

export function LandingProfessionals({ text, applicationAvailable }: {
  text: (key: string) => string; applicationAvailable: boolean
}) {
  useEffect(() => {
    if (window.location.hash !== '#profesionales') return
    const section = document.getElementById('profesionales')
    section?.focus({ preventScroll: true })
    section?.scrollIntoView({ block: 'start' })
  }, [])
  return <LandingSection id="profesionales" tabIndex={-1} className="landing-pros" aria-labelledby="landing-pros-title">
    <div className="landing-pros-inner">
      <p className="landing-pros-label"><span aria-hidden="true">{text('landing.pros.number')}</span>{text('landing.pros.label')}</p>
      <h2 id="landing-pros-title">{text('landing.pros.title')}</h2>
      <p className="landing-pros-intro">{text('landing.pros.intro')}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 landing-pros-grid">
        {[1, 2, 3, 4, 5, 6].map(item => <LandingCard key={item} className="landing-pros-card">
          <div className="elv-card-body">
            <LandingLabel>{text(`landing.pros.${item}.status`)}</LandingLabel>
            <h3>{text(`landing.pros.${item}.title`)}</h3>
            <p>{text(`landing.pros.${item}.body`)}</p>
          </div>
        </LandingCard>)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 landing-pros-boundaries">
        <div><h3>{text('landing.pros.private.title')}</h3><p>{text('landing.pros.private.body')}</p></div>
        <div><LandingLabel>{text('landing.pros.bridge.status')}</LandingLabel><h3>{text('landing.pros.bridge.title')}</h3><p>{text('landing.pros.bridge.body')}</p></div>
      </div>
      <div className="landing-pros-invitation">
        <h3>{text('landing.pros.invitation.title')}</h3>
        <p>{text('landing.pros.invitation.body')}</p>
        {applicationAvailable
          ? <Link to="/profesionales" className="elv-btn elv-btn-primary landing-pros-cta" aria-describedby="landing-pros-cta-note">{text('landing.pros.cta')}</Link>
          : <LandingLabel>{text('landing.pros.bridge.status')}</LandingLabel>}
        <p id="landing-pros-cta-note" className="landing-pros-note">{text('landing.pros.cta_note')}</p>
      </div>
    </div>
  </LandingSection>
}
