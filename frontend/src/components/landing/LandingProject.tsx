import { LandingCard, LandingSection } from './LandingPrimitives'

export function LandingProject({ text }: { text: (key: string) => string }) {
  return <LandingSection className="landing-project" aria-labelledby="landing-project-title">
    <div className="landing-project-inner">
      <p className="landing-project-eyebrow landing-project-label">
        <span aria-hidden="true">{text('landing.project.number')}</span>
        <span>{text('landing.project.label')}</span>
      </p>
      <h2 id="landing-project-title">{text('landing.project.title')}</h2>
      <div className="landing-project-row">
        <h3 className="landing-project-label">{text('landing.project.goals.label')}</h3>
        <ul className="landing-project-goals" role="list">
          {[1, 2, 3, 4, 5].map(goal => <li key={goal}>{text(`landing.project.goals.${goal}`)}</li>)}
        </ul>
      </div>
      <div className="landing-project-row">
        <h3 className="landing-project-label">{text('landing.project.state.label')}</h3>
        <LandingCard className="landing-project-state">
          <div className="elv-card-body"><p>{text('landing.project.state.body')}</p></div>
        </LandingCard>
      </div>
    </div>
  </LandingSection>
}
