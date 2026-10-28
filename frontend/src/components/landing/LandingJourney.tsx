import { LandingCard, LandingLabel, LandingSection } from './LandingPrimitives'

type Props = { text: (key: string) => string }

function SectionLabel({ text, section }: Props & { section: string }) {
  return <p className="landing-editorial-label">
    <span aria-hidden="true">{text(`landing.${section}.number`)}</span>
    <span>{text(`landing.${section}.label`)}</span>
  </p>
}

// ES-68: descriptive public content, without reading or transferring participant data.
export function LandingJourney({ text }: Props) {
  return <>
    <LandingSection className="landing-editorial" aria-labelledby="landing-problem-title">
      <div className="landing-editorial-inner">
        <SectionLabel text={text} section="problem" />
        <h2 id="landing-problem-title">{text('landing.problem.title')}</h2>
        <p className="landing-editorial-body">{text('landing.problem.body')}</p>
      </div>
    </LandingSection>

    <LandingSection className="landing-editorial" aria-labelledby="landing-modules-title">
      <div className="landing-editorial-inner">
        <SectionLabel text={text} section="modules" />
        <h2 id="landing-modules-title">{text('landing.modules.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 landing-module-grid">
          {(['elevation', 'skillmap'] as const).map(module => <LandingCard key={module} className="landing-module">
            <div className="elv-card-body">
              <LandingLabel className="landing-module-status">{text(`landing.modules.${module}.status`)}</LandingLabel>
              <h3 className="elv-card-title">{text(`landing.modules.${module}.title`)}</h3>
              <p>{text(`landing.modules.${module}.body`)}</p>
            </div>
          </LandingCard>)}
        </div>
        <p className="landing-editorial-note">{text('landing.modules.nontechnical')}</p>
        <p className="landing-editorial-body landing-connection">{text('landing.modules.connection')}</p>
      </div>
    </LandingSection>

    <LandingSection id="como-funciona" tabIndex={-1} className="landing-editorial" aria-labelledby="landing-journey-title">
      <div className="landing-editorial-inner">
        <SectionLabel text={text} section="journey" />
        <h2 id="landing-journey-title">{text('landing.journey.title')}</h2>
        <ol className="landing-journey-list" role="list">
          {[1, 2, 3, 4, 5, 6].map(step => <li key={step}>
            <span className="landing-step-number" aria-hidden="true">{text(`landing.journey.${step}.number`)}</span>
            <div>
              <h3>{text(`landing.journey.${step}.title`)}</h3>
              <p>{text(`landing.journey.${step}.body`)}</p>
            </div>
          </li>)}
        </ol>
        <p className="landing-editorial-note">{text('landing.journey.note')}</p>
      </div>
    </LandingSection>
  </>
}
