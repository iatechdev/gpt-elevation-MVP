import { Link } from 'react-router-dom'
import { Button, Card, Chip } from '../../cartografia'
import { displayPrice, planLogin, type Plan } from '../../pricing/plans'
type Text = (key: string) => string

/** ES-328: las tarjetas de plan en Cartografía (Card, Chip, Button). Mismos datos, textos y enlaces que antes; «Destacado» = chip + barra superior, el plan elegido lleva contorno. */
export function PlanCards({ plans, lang, text, selected, authenticated, disabled, pendingId, send, heading = 3 }: {
  plans: Plan[]; lang: 'es' | 'en'; text: Text; selected: number | null; authenticated: boolean
  disabled: boolean; pendingId: number | null; send: (id: number) => void
  heading?: 2 | 3
}) {
  const Heading = heading === 2 ? 'h2' : 'h3'
  return <div className="pp-grid">
    {plans.map(plan => <Card key={plan.id} className={`pp-plan ${plan.isHighlighted ? 'pp-plan--hl' : ''} ${selected === plan.id ? 'pp-plan--sel' : ''}`.trim()}>
      {plan.isHighlighted && <Chip>{text('landing.pricing.featured')}</Chip>}
      <Heading>{plan[`name_${lang}`]}</Heading>
      {plan[`description_${lang}`] && <p>{plan[`description_${lang}`]}</p>}
      <p className="pp-price">{displayPrice(plan, lang, text('landing.pricing.free'))}</p>
      <p className="pp-period">{plan.priceCents === 0 && `${plan.currency} · `}{text(`landing.pricing.period.${plan.period}`)}</p>
      {plan[`features_${lang}`].length > 0 && <ul className="pp-feats">{plan[`features_${lang}`].map((feature, index) => <li key={index}>{feature}</li>)}</ul>}
      {authenticated
        ? <Button className="pp-cta" disabled={disabled} onClick={() => send(plan.id)}
          aria-label={`${pendingId === plan.id ? text('landing.pricing.pending') : text('landing.pricing.request')} · ${plan[`name_${lang}`]}`} aria-describedby={disabled ? 'landing-pricing-action-status' : undefined}>
          {pendingId === plan.id ? text('landing.pricing.pending') : text('landing.pricing.request')}
        </Button>
        : <Link className="cg-btn pp-cta" to={planLogin(plan.id)}
          aria-label={`${text('landing.pricing.register')} · ${plan[`name_${lang}`]}`} aria-describedby={disabled ? 'landing-pricing-action-status' : undefined}
          aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} onClick={event => { if (disabled) event.preventDefault() }}>
          {text('landing.pricing.register')}
        </Link>}
    </Card>)}
  </div>
}
