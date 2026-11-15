import { useEffect, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import { invalidateStoredSession } from '../access/session'
import { displayPrice, type Plan } from '../pricing/plans'
import { usePlanRequests, usePlans } from '../pricing/usePlans'
import { request, SpaceError } from './api'
import { parseCurrent, type Current } from './currentPlan'
import { useSpaceToken } from './hooks'
import { planCopy } from './planCopy'
import { Button } from '../cartografia'
import { Notice, PersonScreen } from './PersonScreen'
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
  return <PersonScreen title={c.title} lead={c.intro} wide>
    <section className="cg-card pg-card" aria-labelledby="plan-current"><h2 id="plan-current">{c.currentTitle}</h2>
      {current.state === 'loading' && <p role="status" aria-live="polite">{c.loading}</p>}
      {current.state === 'error' && <><Notice error text={c.loadError} /><div className="pg-actions"><Button variant="ghost" onClick={current.refresh}>{c.retry}</Button></div></>}
      {current.state === 'ready' && !current.plan && <p>{c.noPlan}</p>}
      {current.state === 'ready' && current.plan && <><p><strong>{name(current.plan)}</strong>{shown && <> · {displayPrice(shown, lang, c.free)}{period(shown)}</>}</p>
        {shown && shown[`features_${lang}`].length > 0 && <ul>{shown[`features_${lang}`].map((feature, index) => <li key={index}>{feature}</li>)}</ul>}</>}
    </section>
    {(requests.pending || requests.failed) && <section className="cg-card pg-card" aria-labelledby="plan-pending"><h2 id="plan-pending">{c.pendingTitle}</h2>
      {requests.pending
        ? <p>{pendingPlan ? c.pendingBody.replace('{plan}', name(pendingPlan)) : c.pendingUnknown}</p>
        : <><Notice error text={c.loadError} /><div className="pg-actions"><Button variant="ghost" onClick={requests.refresh}>{c.retry}</Button></div></>}
    </section>}
    <section className="cg-card pg-card" aria-labelledby="plan-change"><h2 id="plan-change">{c.changeTitle}</h2>
      <p className="cg-hint">{c.approval}</p>
      <Notice error={requests.state === 'unknown' || requests.state === 'unavailable'} text={notice} />
      {catalog.state === 'loading' && <p role="status" aria-live="polite">{c.plansLoading}</p>}
      {catalog.state === 'error' && <><Notice error text={c.plansError} /><div className="pg-actions"><Button variant="ghost" onClick={catalog.refresh}>{c.retry}</Button></div></>}
      {catalog.state === 'ready' && catalog.plans.length === 0 && <p>{c.noPlans}</p>}
      {catalog.state === 'ready' && catalog.plans.length > 0 && <div className="pg-grid">{catalog.plans.map(plan => {
        const isCurrent = current.plan?.id === plan.id; const off = isCurrent || blocked; const why = isCurrent ? c.isCurrent : requests.pending ? c.waitPending : ''
        return <article key={plan.id} className="cg-card pg-plan" aria-labelledby={`plan-${plan.id}`}>
          <h3 id={`plan-${plan.id}`}>{name(plan)}</h3>
          {plan[`description_${lang}`] && <p>{plan[`description_${lang}`]}</p>}
          <p className="pg-price">{displayPrice(plan, lang, c.free)}{period(plan)}</p>
          {plan[`features_${lang}`].length > 0 && <ul>{plan[`features_${lang}`].map((feature, index) => <li key={index}>{feature}</li>)}</ul>}
          <Button disabled={off} aria-describedby={why ? `plan-why-${plan.id}` : undefined} onClick={() => void send(plan.id)}
            aria-label={`${c.request} · ${name(plan)}`}>{requests.state === 'sending' ? c.sending : c.request}</Button>
          {why && <p id={`plan-why-${plan.id}`} className="cg-hint">{why}</p>}
        </article>
      })}</div>}
    </section>
  </PersonScreen>
}
