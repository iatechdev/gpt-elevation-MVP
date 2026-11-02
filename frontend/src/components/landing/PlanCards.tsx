import { Link } from 'react-router-dom'
import { displayPrice, planLogin, type Plan } from '../../pricing/plans'
import { LandingButton, LandingCard, LandingLabel } from './LandingPrimitives'
type Text = (key: string) => string

export function PlanCards({ plans, lang, text, selected, authenticated, disabled, pendingId, send, heading = 3 }: {
  plans: Plan[]; lang: 'es' | 'en'; text: Text; selected: number | null; authenticated: boolean
  disabled: boolean; pendingId: number | null; send: (id: number) => void
  heading?: 2 | 3
}) {
  const Heading = heading === 2 ? 'h2' : 'h3'
  return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 landing-plan-grid">
    {plans.map(plan => <LandingCard key={plan.id} className={`landing-plan ${plan.isHighlighted ? 'landing-plan-featured' : ''} ${selected === plan.id ? 'landing-plan-selected' : ''}`}>
      <div className="elv-card-body">
        {plan.isHighlighted && <LandingLabel>{text('landing.pricing.featured')}</LandingLabel>}
        <Heading>{plan[`name_${lang}`]}</Heading>
        {plan[`description_${lang}`] && <p>{plan[`description_${lang}`]}</p>}
        <p className="landing-plan-price">{displayPrice(plan, lang, text('landing.pricing.free'))}</p>
        <p>{plan.priceCents === 0 && `${plan.currency} · `}{text(`landing.pricing.period.${plan.period}`)}</p>
        {plan[`features_${lang}`].length > 0 && <ul>{plan[`features_${lang}`].map((feature, index) => <li key={index}>{feature}</li>)}</ul>}
        {authenticated
          ? <LandingButton className="elv-btn-primary landing-plan-cta" disabled={disabled} onClick={() => send(plan.id)}
            aria-label={`${text('landing.pricing.request')} · ${plan[`name_${lang}`]}`} aria-describedby={disabled ? 'landing-pricing-action-status' : undefined}>
            {pendingId === plan.id ? text('landing.pricing.pending') : text('landing.pricing.request')}
          </LandingButton>
          : <Link className={`elv-btn elv-btn-primary landing-plan-cta ${disabled ? 'elv-btn-disabled' : ''}`} to={planLogin(plan.id)}
            aria-label={`${text('landing.pricing.register')} · ${plan[`name_${lang}`]}`} aria-describedby={disabled ? 'landing-pricing-action-status' : undefined}
            aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} onClick={event => { if (disabled) event.preventDefault() }}>
            {text('landing.pricing.register')}
          </Link>}
      </div>
    </LandingCard>)}
  </div>
}

