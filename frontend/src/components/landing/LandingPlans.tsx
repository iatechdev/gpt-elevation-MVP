import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { useSessionEntry } from '../../access/useSessionEntry'
import { readStoredToken, sessionDestination } from '../../access/session'
import { planIntent } from '../../pricing/plans'
import { usePlanRequests, usePlans } from '../../pricing/usePlans'
import { LandingButton, LandingSection } from './LandingPrimitives'
import { PlanCards } from './PlanCards'
import '../../pricing/pricing.css'

const base = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
type Text = (key: string) => string

export function LandingPlans({ text, fullPage = false }: { text: Text; fullPage?: boolean }) {
  const { lang } = useLanguage()
  const [params] = useSearchParams()
  const selected = fullPage ? planIntent(params.toString()) : null
  const catalog = usePlans(base)
  const entry = useSessionEntry(base)
  const verified = entry.result.status === 'verified'
  const token = readStoredToken()
  const requests = usePlanRequests(base, verified, token)
  const disabled = ['checking', 'unavailable'].includes(entry.result.status) || (verified && (!requests.ready || !!requests.pending || requests.state === 'sending'))
  const send = async (id: number) => { if (await requests.send(id)) catalog.refresh() }
  const title = text('landing.pricing.title')
  return <LandingSection id="planes" tabIndex={-1} className="landing-plans" aria-labelledby="landing-pricing-title">
    <div className="landing-plans-inner">
      <p className="landing-plans-label"><span aria-hidden="true">{text('landing.pricing.number')}</span>{text('landing.nav.plans')}</p>
      {fullPage ? <h1 id="landing-pricing-title">{title}</h1> : <h2 id="landing-pricing-title">{title}</h2>}
      {catalog.state === 'loading' && <div role="status" aria-live="polite"><p>{text('landing.pricing.loading')}</p><div className="landing-plan-skeleton" aria-hidden="true" /></div>}
      {catalog.state === 'error' && <div role="alert"><p>{text('landing.pricing.load_error')}</p><LandingButton onClick={catalog.refresh}>{text('landing.pricing.retry')}</LandingButton></div>}
      {catalog.state === 'ready' && catalog.plans.length === 0 && <p role="status">{text('landing.pricing.empty')}</p>}
      {catalog.state === 'ready' && catalog.plans.length > 0 && <>
        {catalog.plans.some(plan => plan.priceCents === 0) && <p>{text('landing.pricing.subtitle')}</p>}
        {selected && <p role="status">{text(catalog.plans.some(plan => plan.id === selected) ? 'landing.pricing.review' : 'landing.pricing.retired')}</p>}
        <div id="landing-pricing-action-status">
        {entry.result.status === 'checking' && <p role="status">{text('landing.access.checking')}</p>}
        {entry.result.status === 'invalid' && <p role="status">{text('landing.access.expired')}</p>}
        {entry.result.status === 'unavailable' && <div role="alert"><p>{text('landing.access.unavailable')}</p><LandingButton onClick={entry.retry}>{text('landing.pricing.retry')}</LandingButton></div>}
        {verified && !requests.ready && requests.state !== 'unknown' && <p role={requests.failed ? 'alert' : 'status'}>{text(requests.failed ? 'landing.pricing.request_error' : 'landing.pricing.checking_request')}</p>}
        {verified && requests.state === 'sending' && <p role="status">{text('landing.pricing.submitting')}</p>}
        {verified && (requests.pending || requests.state === 'submitted') && <p role="status">{text(requests.state === 'submitted' ? 'landing.pricing.submitted' : 'landing.pricing.pending')}</p>}
        {verified && requests.state === 'unknown' && <p role="alert">{text('landing.pricing.unknown')}</p>}
        {verified && requests.state === 'unavailable' && <p role="alert">{text('landing.pricing.retired')}</p>}
        {verified && !requests.ready && requests.state !== 'sending' && <LandingButton onClick={requests.refresh}>{text('landing.pricing.check_status')}</LandingButton>}
        </div>
        <PlanCards plans={catalog.plans} lang={lang} text={text} selected={selected} authenticated={verified} disabled={disabled}
          pendingId={requests.pending?.planId ?? null} send={id => { void send(id) }} heading={fullPage ? 2 : 3} />
        <p className="landing-pricing-note">{text('landing.pricing.note')}</p>
      </>}
      {entry.result.status === 'verified' && <Link className="elv-link landing-plans-space" to={sessionDestination(entry.result.session)}>{text('landing.pricing.space')}</Link>}
    </div>
  </LandingSection>
}
