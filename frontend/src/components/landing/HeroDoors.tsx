import { Link } from 'react-router-dom'
import { doorTarget, splitLastWord } from '../../content/landingDoors'
import { LandingLabel, LandingSection } from './LandingPrimitives'

// Héroe editorial y dos puertas de entrada (ES-63). Los textos llegan ya resueltos con respaldo ES/EN (landing.*).
export function HeroDoors({ text }: { text: (key: string) => string }) {
  const { head, last } = splitLastWord(text('landing.hero.title'))
  const target = doorTarget()
  const doors = [1, 2] as const

  return (
    <>
      <LandingSection className="landing-hero" aria-labelledby="landing-hero-title">
        <div className="landing-container">
          <LandingLabel>{text('landing.hero.label')}</LandingLabel>
          <h1 id="landing-hero-title" className="landing-hero-title">
            {head}<span className="landing-underline">{last}</span>
          </h1>
          <p className="landing-hero-sub">{text('landing.hero.subtitle')}</p>
        </div>
      </LandingSection>
      <div className="landing-doors" role="group" aria-label={text('landing.hero.label')}>
        {doors.map(n => (
          <Link key={n} to={target} className="landing-door">
            <span className="landing-door-label">{`0${n} · ${text(`landing.doors.${n}.label`)}`}</span>
            <h2 className="landing-door-title">{text(`landing.doors.${n}.title`)}</h2>
            <span className="landing-door-desc">{text(`landing.doors.${n}.desc`)}</span>
            <span className="landing-door-go">{text('landing.doors.go')}<span aria-hidden="true"> →</span></span>
          </Link>
        ))}
      </div>
    </>
  )
}
