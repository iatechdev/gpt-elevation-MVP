import { Link } from 'react-router-dom'
import { LandingCard, LandingLabel, LandingSection } from './LandingPrimitives'

export function LandingJoin({ text }: { text: (key: string) => string }) {
  return <LandingSection className="landing-join" aria-labelledby="landing-join-title">
    <div className="landing-join-inner">
      <p className="landing-join-eyebrow">
        <span aria-hidden="true">{text('landing.join.number')}</span>
        <span>{text('landing.join.label')}</span>
      </p>
      <h2 id="landing-join-title">{text('landing.join.title')}</h2>
      <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 landing-join-steps" role="list">
        {[1, 2, 3, 4].map(step => <li key={step}>
          <LandingCard className="landing-join-card"><div className="elv-card-body">
            <span className="landing-join-eyebrow" aria-hidden="true">{text(`landing.join.steps.${step}.number`)}</span>
            <h3>{text('landing.join.people')}</h3>
            <p>{text(`landing.join.steps.${step}.body`)}</p>
            {step >= 3 && <LandingLabel>{text('landing.join.soon')}</LandingLabel>}
          </div></LandingCard>
        </li>)}
      </ol>
      <Link to="/login?mode=register" className="elv-btn elv-btn-primary landing-join-create">{text('landing.join.create')}</Link>
      <div className="landing-join-professionals">
        <h3>{text('landing.join.professionals')}</h3>
        <div><p>{text('landing.join.professional_body')}</p><p>{text('landing.join.professional_pending')}</p></div>
        <Link to="/profesionales" className="elv-btn landing-join-create">{text('landing.join.professional_cta')}</Link>
      </div>
    </div>
  </LandingSection>
}
