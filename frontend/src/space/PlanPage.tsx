import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { invalidateStoredSession } from '../access/session'
import { displayPrice, type Plan } from '../pricing/plans'
import { usePlanRequests, usePlans } from '../pricing/usePlans'
import { request, SpaceError } from './api'
import { parseCurrent, type Current } from './currentPlan'
import { useSpaceToken } from './hooks'
import { planCopy } from './planCopy'
import { SpaceShell } from './SpaceShell'
// ES-174 — «Mi plan»: plan actual, solicitud pendiente y cambio de plan. Reutiliza los lectores y el escritor de la landing (pricing/): propietario verificado por el servidor,
// una solicitud a la vez, sin pago en línea y sin cancelar solicitudes (el servidor no lo permite).
const base = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:8080' : '')
function useCurrentPlan(token: string) {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<{ attempt: number; plan: Current | null; failed: boolean } | null>(null)
  useEffect(() => {
    let live = true
    request(token, '/api/user/plan/me').then(data => { if (live) setLoaded({ attempt, plan: parseCurrent(data), failed: false }) })
      .catch(error => { if (!live) return; if (error instanceof SpaceError && [401, 403].includes(error.status)) invalidateStoredSession(token); setLoaded({ attempt, plan: null, failed: true }) })
    return () => { live = false }
  }, [token, attempt])
  const fresh = loaded?.attempt === attempt ? loaded : null
  return { state: !fresh ? 'loading' as const : fresh.failed ? 'error' as const : 'ready' as const, plan: fresh?.plan ?? null, refresh: () => setAttempt(value => value + 1) }
}
export function PlanPage() {
  const { lang } = useLanguage(); const c = planCopy[lang]; const token = useSpaceToken()
  const current = useCurrentPlan(token); const catalog = usePlans(base); const requests = usePlanRequests(base, !!token, token)
  const name = (plan: { name_es: string; name_en: string }) => plan[`name_${lang}`]
  const byId = new Map<number, Plan>(catalog.plans.map(plan => [plan.id, plan]))
  const period = (plan: Plan) => plan.priceCents === 0 ? '' : ` · ${c[plan.period]}`
  const send = async (id: number) => { if (await requests.send(id)) catalog.refresh() }
  const shown = current.plan ? byId.get(current.plan.id) : undefined
  const pendingPlan = requests.pending ? byId.get(requests.pending.planId) : undefined
  const notice = requests.state === 'submitted' ? c.submitted : requests.state === 'pending' ? c.alreadyPending : requests.state === 'unknown' ? c.unknown : requests.state === 'unavailable' ? c.unavailable : ''
  const blocked = !requests.ready || !!requests.pending || requests.state === 'sending'
  return <SpaceShell>
    <h1>{c.title}</h1><p>{c.intro}</p>
    <section className="elv-card space-card" aria-labelledby="plan-current"><h2 id="plan-current">{c.currentTitle}</h2>
      {current.state === 'loading' && <p role="status" aria-live="polite">{c.loading}</p>}
      {current.state === 'error' && <><p role="alert" className="space-error">{c.loadError}</p><button className="elv-btn" onClick={current.refresh}>{c.retry}</button></>}
      {current.state === 'ready' && !current.plan && <p>{c.noPlan}</p>}
      {current.state === 'ready' && current.plan && <><p><strong>{name(current.plan)}</strong>{shown && <> · {displayPrice(shown, lang, c.free)}{period(shown)}</>}</p>
        {shown && shown[`features_${lang}`].length > 0 && <ul>{shown[`features_${lang}`].map((feature, index) => <li key={index}>{feature}</li>)}</ul>}</>}
    </section>
    {(requests.pending || requests.failed) && <section className="elv-card space-card" aria-labelledby="plan-pending"><h2 id="plan-pending">{c.pendingTitle}</h2>
      {requests.pending
        ? <p>{pendingPlan ? c.pendingBody.replace('{plan}', name(pendingPlan)) : c.pendingUnknown}</p>
        : <><p role="alert" className="space-error">{c.loadError}</p><button className="elv-btn" onClick={requests.refresh}>{c.retry}</button></>}
    </section>}
    <section className="elv-card space-card" aria-labelledby="plan-change"><h2 id="plan-change">{c.changeTitle}</h2>
      <p className="space-note">{c.approval}</p>
      <p role={requests.state === 'unknown' || requests.state === 'unavailable' ? 'alert' : 'status'} aria-live="polite" className={requests.state === 'unknown' || requests.state === 'unavailable' ? 'space-error' : 'space-note'}>{notice}</p>
      {catalog.state === 'loading' && <p role="status" aria-live="polite">{c.plansLoading}</p>}
      {catalog.state === 'error' && <><p role="alert" className="space-error">{c.plansError}</p><button className="elv-btn" onClick={catalog.refresh}>{c.retry}</button></>}
      {catalog.state === 'ready' && catalog.plans.length === 0 && <p>{c.noPlans}</p>}
      {catalog.state === 'ready' && catalog.plans.length > 0 && <div className="space-plan-grid">{catalog.plans.map(plan => {
        const isCurrent = current.plan?.id === plan.id; const off = isCurrent || blocked; const why = isCurrent ? c.isCurrent : requests.pending ? c.waitPending : ''
        return <article key={plan.id} className="space-plan" aria-labelledby={`plan-${plan.id}`}>
          <h3 id={`plan-${plan.id}`}>{name(plan)}</h3>
          {plan[`description_${lang}`] && <p>{plan[`description_${lang}`]}</p>}
          <p className="space-plan-price">{displayPrice(plan, lang, c.free)}{period(plan)}</p>
          {plan[`features_${lang}`].length > 0 && <ul>{plan[`features_${lang}`].map((feature, index) => <li key={index}>{feature}</li>)}</ul>}
          <button className="elv-btn elv-btn-primary" disabled={off} aria-describedby={why ? `plan-why-${plan.id}` : undefined} onClick={() => void send(plan.id)}
            aria-label={`${c.request} · ${name(plan)}`}>{requests.state === 'sending' ? c.sending : c.request}</button>
          {why && <p id={`plan-why-${plan.id}`} className="space-note">{why}</p>}
        </article>
      })}</div>}
    </section>
  </SpaceShell>
}
