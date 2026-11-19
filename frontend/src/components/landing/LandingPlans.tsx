import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../../i18n/useLanguage'
import { useSessionEntry } from '../../access/useSessionEntry'
import { readStoredToken, sessionDestination } from '../../access/session'
import { Button } from '../../cartografia'
import { planIntent } from '../../pricing/plans'
import { usePlanRequests, usePlans } from '../../pricing/usePlans'
import { PlanCards } from './PlanCards'
import '../../pricing/pricing.css'

// ES-328 (P342-1): el marcador de carga reserva el MISMO número de tarjetas que tuvo el catálogo la última vez que se vio en esta pestaña (solo un número, en sessionStorage;
// sin dato previo, 4: los planes del piloto). Así el pie no sube ni baja al llegar el catálogo. Sin almacenamiento disponible, 4.
const COUNT_KEY = 'elv_plans_count'
const lastCount = (): number | null => {
  try { const raw = sessionStorage.getItem(COUNT_KEY); const n = Number(raw); return raw !== null && Number.isInteger(n) && n >= 0 && n <= 8 ? n : null } catch { return null }
}

const base = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
type Text = (key: string) => string

/** ES-328: la sección de planes en Cartografía. La usan /pricing (`fullPage`, dentro del marco público) y la portada (#planes). Misma lógica y textos del CMS que antes. */
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
  const [expected] = useState(lastCount)
  useEffect(() => { if (catalog.state === 'ready') { try { sessionStorage.setItem(COUNT_KEY, String(Math.min(catalog.plans.length, 8))) } catch { /* sin almacenamiento */ } } }, [catalog.state, catalog.plans.length])
  const slots = expected === null ? 4 : Math.min(Math.max(expected, 1), 4)
  const Title = fullPage ? 'h1' : 'h2'
  return <section id="planes" tabIndex={-1} className={`pp-plans ${fullPage ? 'pp-plans--page' : ''}`.trim()} aria-labelledby="landing-pricing-title">
    <div className="pp-plans-inner">
      <p className="pp-plans-label">{text('landing.nav.plans')}</p>
      <Title id="landing-pricing-title" className="pp-title">{title}</Title>
      {catalog.state === 'loading' && <div className="pp-state" role="status" aria-live="polite" aria-busy="true"><p>{text('landing.pricing.loading')}</p><div className={`pp-grid ${expected === 0 ? 'pp-grid--empty' : ''}`.trim()} aria-hidden="true">{Array.from({ length: expected === 0 ? 1 : slots }, (_, slot) => <div key={slot} className="pp-skel" />)}</div></div>}
      {catalog.state === 'error' && <div className="pp-state" role="alert"><div className="cg-banner cg-banner--error"><span className="cg-banner__title">{text('landing.pricing.load_error')}</span></div><Button variant="ghost" onClick={catalog.refresh}>{text('landing.pricing.retry')}</Button></div>}
      {catalog.state === 'ready' && catalog.plans.length === 0 && <div className="pp-state"><p role="status">{text('landing.pricing.empty')}</p></div>}
      {catalog.state === 'ready' && catalog.plans.length > 0 && <>
        {catalog.plans.some(plan => plan.priceCents === 0) && <p>{text('landing.pricing.subtitle')}</p>}
        {selected && <p role="status">{text(catalog.plans.some(plan => plan.id === selected) ? 'landing.pricing.review' : 'landing.pricing.retired')}</p>}
        <div id="landing-pricing-action-status" className="pp-status">
        {entry.result.status === 'checking' && <p role="status">{text('landing.access.checking')}</p>}
        {entry.result.status === 'invalid' && <p role="status">{text('landing.access.expired')}</p>}
        {entry.result.status === 'unavailable' && <div role="alert"><p>{text('landing.access.unavailable')}</p><Button variant="ghost" onClick={entry.retry}>{text('landing.pricing.retry')}</Button></div>}
        {verified && !requests.ready && requests.state !== 'unknown' && <p role={requests.failed ? 'alert' : 'status'}>{text(requests.failed ? 'landing.pricing.request_error' : 'landing.pricing.checking_request')}</p>}
        {verified && requests.state === 'sending' && <p role="status">{text('landing.pricing.submitting')}</p>}
        {verified && (requests.pending || requests.state === 'submitted') && <p role="status">{text(requests.state === 'submitted' ? 'landing.pricing.submitted' : 'landing.pricing.pending')}</p>}
        {verified && requests.state === 'unknown' && <p role="alert">{text('landing.pricing.unknown')}</p>}
        {verified && requests.state === 'unavailable' && <p role="alert">{text('landing.pricing.retired')}</p>}
        {verified && !requests.ready && requests.state !== 'sending' && <Button variant="ghost" onClick={requests.refresh}>{text('landing.pricing.check_status')}</Button>}
        </div>
        <PlanCards plans={catalog.plans} lang={lang} text={text} selected={selected} authenticated={verified} disabled={disabled}
          pendingId={requests.pending?.planId ?? null} send={id => { void send(id) }} heading={fullPage ? 2 : 3} />
        <p className="pp-note">{text('landing.pricing.note')}</p>
      </>}
      {entry.result.status === 'verified' && <Link className="pp-space" to={sessionDestination(entry.result.session)}>{text('landing.pricing.space')}</Link>}
    </div>
  </section>
}
