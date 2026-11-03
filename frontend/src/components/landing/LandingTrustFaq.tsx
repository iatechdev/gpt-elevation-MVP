import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LandingButton, LandingCard, LandingLabel, LandingSection } from './LandingPrimitives'
import './trust-faq.css'

type Props = { text: (key: string) => string }
function useLandingAnchor(id: string) {
  useEffect(() => {
    if (window.location.hash !== '#' + id) return
    const section = document.getElementById(id)
    section?.focus({ preventScroll: true })
    section?.scrollIntoView({ block: 'start' })
  }, [id])
}
export function LandingTrust({ text }: Props) {
  useLandingAnchor('privacidad-limites')
  return <LandingSection id="privacidad-limites" tabIndex={-1} className="landing-trust-faq" aria-labelledby="landing-trust-title">
    <div className="landing-trust-inner">
      <p className="landing-trust-label"><span aria-hidden="true">{text('landing.trust.number')}</span>{text('landing.trust.label')}</p>
      <h2 id="landing-trust-title">{text('landing.trust.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 landing-trust-grid">
        {[1, 2, 3, 4, 5].map(item => <LandingCard key={item} className="landing-trust-card">
          <div className="elv-card-body">
            <h3>{text(`landing.trust.${item}.title`)}</h3>
            {item === 4 && <LandingLabel>{text('landing.trust.coming')}</LandingLabel>}
            <p>{text(`landing.trust.${item}.body`)}</p>
          </div>
        </LandingCard>)}
      </div>
      {/* ES-65 owns the replacement policy; preserve /privacy without endorsing its legacy text. */}
      <p className="landing-trust-policy">{text('landing.trust.policy')} · {text('landing.trust.pending')}</p>
    </div>
  </LandingSection>
}

export function LandingFaq({ text }: Props) {
  useLandingAnchor('preguntas-frecuentes')
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set())
  const toggle = (item: number) => setOpen(previous => {
    const next = new Set(previous)
    if (next.has(item)) next.delete(item)
    else next.add(item)
    return next
  })
  return <LandingSection id="preguntas-frecuentes" tabIndex={-1} className="landing-trust-faq" aria-labelledby="landing-faq-title">
    <div className="landing-trust-inner">
      <p className="landing-trust-label"><span aria-hidden="true">{text('landing.faq.number')}</span>{text('landing.faq.label')}</p>
      <h2 id="landing-faq-title">{text('landing.faq.title')}</h2>
      <div className="landing-faq-list">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(item => <div key={item} className="landing-faq-item">
          <h3><LandingButton id={`landing-faq-question-${item}`} className="elv-btn-ghost landing-faq-question"
            aria-expanded={open.has(item)} aria-controls={`landing-faq-answer-${item}`} onClick={() => toggle(item)}>
            <span>{text(`landing.faq.q${item}`)}</span><span aria-hidden="true">{open.has(item) ? '−' : '+'}</span>
          </LandingButton></h3>
          <div id={`landing-faq-answer-${item}`} hidden={!open.has(item)} aria-labelledby={`landing-faq-question-${item}`} className="landing-faq-answer">
            <p>{text(`landing.faq.a${item}`)}</p>
            {item === 9 && <Link className="elv-link landing-faq-plans" to="/pricing">{text('landing.faq.plans')}</Link>}
          </div>
        </div>)}
      </div>
    </div>
  </LandingSection>
}
