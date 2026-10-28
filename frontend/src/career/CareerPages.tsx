import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useCareer } from './context'
import { useDraft } from './useDraft'
import { blockReason } from './reason'
import { isCurrent, planCurrent, preferenceFor, routesFor, validActions } from './fixture'
import type { Action, Arrangement, Assistance, Constraints, ContextKey, Decision, Experiment, Plan, Route } from './fixture'
import type { CopyKey } from './copy'

const base = '/app/next-step'
const contexts: ContextKey[] = ['education', 'operations', 'analysis']
const arrangements: Arrangement[] = ['remote', 'hybrid', 'onsite']
const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter(v => v !== value) : [...values, value]
// QA-34 obs. 2 y 3: un control deshabilitado explica por qué con aria-describedby (texto solo para lectores; el diseño visual no cambia).
function Button({ children, disabled, onClick, primary = false, own = null }: { children: ReactNode; disabled?: boolean; onClick?: () => void; primary?: boolean; own?: CopyKey | null }) {
  const c = useCareer(), id = useId()
  const key = disabled ? blockReason({ busy: c.busy, uncertain: c.uncertain, dirty: c.dirty }, own) : null
  return <><button type="button" className={`elv-btn ${primary ? 'career-primary' : 'elv-btn-outline'}`} disabled={disabled} aria-describedby={key ? id : undefined} onClick={onClick}>{children}</button>{key && <span id={id} className="career-sr">{c.t(key)}</span>}</>
}
function Submit({ blocked, own = null, plain = false, children }: { blocked: boolean; own?: CopyKey | null; plain?: boolean; children: ReactNode }) {
  const c = useCareer(), id = useId()
  const key = blocked ? (blockReason({ busy: c.busy, uncertain: c.uncertain, dirty: false }, own) ?? 'otherDraft') : null
  return <><button className={plain ? 'elv-btn' : 'elv-btn career-primary'} disabled={blocked} aria-describedby={key ? id : undefined}>{children}</button>{key && <span id={id} className="career-sr">{c.t(key)}</span>}</>
}
function ConstraintsForm() {
  const c = useDraft('constraints'), [value, setValue] = useState<Constraints>(() => structuredClone(c.state.constraints))
  const update = <K extends keyof Constraints>(key: K, next: Constraints[K]) => { c.touch(); setValue(v => ({ ...v, [key]: next })) }
  const submit = (e: FormEvent) => { e.preventDefault(); void c.save({ type: 'constraints', value }) }
  return <form className="elv-card" onSubmit={submit}><h2>{c.t('constraints')}</h2>{c.state.basis > 0 && <p>{c.t('version')} {c.state.basis} · {c.t('saved')}</p>}<p id="career-constraints-help">{c.t('constraintsHelp')}</p><fieldset disabled={c.busy || c.uncertain} aria-describedby="career-constraints-help">
    <div className="career-pair"><fieldset className="elv-fieldset"><legend>{c.t('market')}</legend>{(['CO', 'DK'] as const).map(m => <label key={m}><input className="elv-checkbox" type="checkbox" checked={value.markets.includes(m)} onChange={() => update('markets', toggle(value.markets, m))} />{c.t(m === 'CO' ? 'co' : 'dk')}</label>)}</fieldset>
      <fieldset className="elv-fieldset"><legend>{c.t('languages')}</legend>{(['es', 'en'] as const).map(l => <label key={l}><input className="elv-checkbox" type="checkbox" checked={value.languages.includes(l)} onChange={() => update('languages', toggle(value.languages, l))} />{c.t(l)}</label>)}</fieldset></div>
    <fieldset className="elv-fieldset"><legend>{c.t('arrangements')}</legend>{arrangements.map(m => <label key={m}><input className="elv-checkbox" type="checkbox" checked={value.arrangements.includes(m)} onChange={() => update('arrangements', toggle(value.arrangements, m))} />{c.t(m)}</label>)}</fieldset>
    <label className="career-field">{c.t('regulatedQuestion')}<select aria-label={c.t('regulatedQuestion')} className="elv-select" value={value.regulated} onChange={e => update('regulated', e.target.value as Constraints['regulated'])}>{(['unknown', 'yes', 'no'] as const).map(k => <option key={k} value={k}>{c.t(k)}</option>)}</select></label>
    <p>{c.t('contextHelp')}</p><label className="career-field">{c.t('origin')}<select aria-label={c.t('origin')} className="elv-select" value={value.origin} onChange={e => update('origin', e.target.value as ContextKey | '')}><option value="">{c.t('unspecified')}</option>{contexts.map(k => <option key={k} value={k}>{c.t(k)}</option>)}</select></label>
    <fieldset><legend>{c.t('interests')}</legend>{contexts.map(k => <label key={k}><input className="elv-checkbox" type="checkbox" checked={value.interests.includes(k)} onChange={() => update('interests', toggle(value.interests, k))} />{c.t(k)}</label>)}</fieldset>
    <fieldset><legend>{c.t('preferred')}</legend>{arrangements.map(k => <label key={k}><input className="elv-checkbox" type="checkbox" checked={value.preferred.includes(k)} onChange={() => update('preferred', toggle(value.preferred, k))} />{c.t(k)}</label>)}</fieldset>
    <div className="career-actions"><Submit blocked={c.blocked}>{c.t('saveConstraints')}</Submit><Button disabled={c.busy} onClick={() => { setValue(structuredClone(c.state.constraints)); c.clean() }}>{c.t('cancel')}</Button></div>
  </fieldset></form>
}
function RouteCard({ route }: { route: Route }) {
  const c = useCareer(), choice = c.state.choices.findLast(ch => ch.route.id === route.id)
  const [minutes, setMinutes] = useState(20)
  const blocked = c.busy || c.uncertain || c.dirty
  const prepare = async () => { const result = await c.send({ type: 'experiment', routeId: route.id, minutes }); if (result.ok && result.id) c.navigate(`${base}/experiments/${result.id}`) }
  return <article className="elv-card"><span className="career-tag">{c.t('synthetic')} · {c.t(route.slot)}</span><h3>{route.title[c.lang]}</h3><p>{route.market} · {c.t('occupational')}</p>
    <dl><dt>{c.t('preferences')}</dt><dd>{c.t(preferenceFor(c.state, route))}</dd><dt>{c.t('transfer')}</dt><dd>{c.t(route.supported ? 'supported' : 'noEvidence')}</dd><dt>{c.t('feasibility')}</dt><dd>{c.t('conditional')}</dd></dl>
    {route.regulated && <p className="career-warning">{c.t('pendingLicense')}</p>}
    <details><summary>{c.t('details')}</summary><p>{c.t('languages')}: {c.t(route.market === 'DK' ? 'en' : 'es')} · {c.t('arrangements')}: {c.t('remote')}, {c.t('hybrid')}</p><p>{c.t('tasks')} · {c.t('hypothesis')}</p><p>{c.t('taskText')}</p><p>{c.t('source')}</p><p>{c.t('sourceDate')}</p><a href="https://example.org/synthetic-source" target="_blank" rel="noopener noreferrer">example.org — {c.t('openSource')}</a>{route.stale && <p className="career-warning">{c.t('stale')}</p>}<p>{c.t('expired')}</p></details>
    <p>{c.t('routeLimit')}</p>
    {choice && <p>{c.t(choice.decision)} · {c.t(choice.basis === c.state.basis ? 'current' : 'needsReview')}</p>}
    <div className="career-actions"><Button primary disabled={blocked} onClick={() => void c.send({ type: 'choice', route, decision: 'chosen' })}>{c.t('choose')}</Button><Button disabled={blocked} onClick={() => void c.send({ type: 'choice', route, decision: 'rejected' })}>{c.t('reject')}</Button></div>
    {choice?.decision === 'chosen' && choice.basis === c.state.basis && <div><label className="career-field">{c.t('minutes')}<select aria-label={c.t('minutes')} className="elv-select" value={minutes} disabled={blocked} onChange={e => setMinutes(Number(e.target.value))}>{[20, 30, 45].map(n => <option key={n}>{n}</option>)}</select></label><Button disabled={blocked || route.regulated} onClick={() => void prepare()}>{c.t('acceptExperiment')}</Button><p>{c.t('questionText')}</p><p>{c.t('costUnknown')}</p><p>{c.t('criteriaText')}</p><p>{c.t('limitation')}</p></div>}
  </article>
}
export function RoutesScreen() {
  const c = useCareer(), routes = routesFor(c.state)
  return <><ConstraintsForm /><h2>{c.t('options')}</h2>{!c.state.basis ? <p>{c.t('needConstraints')}</p> : !routes.length ? <p>{c.t('noRoutes')}</p> : <>{routes.length < 3 && <p>{c.t('partial')}</p>}<div className="career-grid">{routes.map(r => <RouteCard key={`${r.id}-${c.state.basis}`} route={r} />)}</div></>}
    <section className="career-panel"><h2>{c.t('history')}</h2>{c.state.choices.length ? <ol>{c.state.choices.map(ch => <li key={ch.id}>{ch.route.title[c.lang]} · {c.t(ch.decision)} · {c.t('version')} {ch.basis} · {c.t(ch.basis === c.state.basis ? 'current' : 'needsReview')}</li>)}</ol> : <p>{c.t('noHistory')}</p>}
      <Button disabled={c.busy || c.uncertain || c.dirty} onClick={() => void c.send({ type: 'review' })}>{c.t(c.state.requested ? 'withdraw' : 'requestReview')}</Button>{c.state.requested && <p>{c.t('requested')}</p>}
    </section></>
}
export function ExperimentList() {
  const c = useCareer()
  return <section><h2>{c.t('experiments')}</h2>{!c.state.experiments.length && <p>{c.t('noExperiments')}</p>}{c.state.experiments.map(e => <article className="elv-card" key={e.id}><h3>{e.route.title[c.lang]}</h3><p>{c.t(e.phase)} · {c.t('version')} {e.version} · {c.t(isCurrent(c.state, e) ? 'current' : 'needsReview')}</p><Button onClick={() => c.navigate(`${base}/experiments/${e.id}`)}>{c.t('open')}</Button></article>)}</section>
}
function ExperimentForm({ experiment: e }: { experiment: Experiment }) {
  const c = useDraft(`experiment-${e.id}`), [sample, setSample] = useState(e.sample), [selected, setSelected] = useState(e.evidence), [assistance, setAssistance] = useState<Assistance | ''>(e.assistance)
  const [observation, setObservation] = useState(e.observation), [interpretation, setInterpretation] = useState(e.interpretation), [decision, setDecision] = useState<Decision | ''>(e.decision), [reason, setReason] = useState(e.reason)
  const current = isCurrent(c.state, e)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (e.phase === 'in_progress') void c.save({ type: 'change', id: e.id, expected: e.version, phase: 'submitted', value: { sample, evidence: selected, assistance } })
    if (e.phase === 'submitted') void c.save({ type: 'change', id: e.id, expected: e.version, phase: 'self_reviewed', value: { observation, interpretation } })
    if (e.phase === 'self_reviewed') void c.save({ type: 'change', id: e.id, expected: e.version, phase: 'decided', value: { decision, reason } })
  }
  const reset = () => { setSample(e.sample); setSelected(e.evidence); setAssistance(e.assistance); setObservation(e.observation); setInterpretation(e.interpretation); setDecision(e.decision); setReason(e.reason); c.clean() }
  return <form noValidate onSubmit={submit}><fieldset disabled={c.busy || c.uncertain || !current}>
    {e.phase === 'in_progress' && <><label className="career-field">{c.t('sample')}<textarea className="elv-textarea" maxLength={6000} value={sample} onChange={event => { c.touch(); setSample(event.target.value) }} /></label><label><input type="checkbox" className="elv-checkbox" checked={selected} onChange={event => { c.touch(); setSelected(event.target.checked) }} />{c.t('evidenceExample')}</label><label className="career-field">{c.t('help')}<select aria-label={c.t('help')} required className="elv-select" value={assistance} onChange={event => { c.touch(); setAssistance(event.target.value as Assistance) }}><option value="">{c.t('unspecified')}</option>{(['none', 'planning', 'drafting', 'substantial', 'unknown'] as const).map(k => <option key={k} value={k}>{c.t(k)}</option>)}</select></label></>}
    {e.phase === 'submitted' && <><p>{c.t('selfReport')}</p><div className="career-pair"><label className="career-field">{c.t('observation')}<textarea required maxLength={2000} className="elv-textarea" value={observation} onChange={event => { c.touch(); setObservation(event.target.value) }} /></label><label className="career-field">{c.t('interpretation')}<textarea required maxLength={2000} className="elv-textarea" value={interpretation} onChange={event => { c.touch(); setInterpretation(event.target.value) }} /></label></div></>}
    {e.phase === 'self_reviewed' && <><label className="career-field">{c.t('decision')}<select aria-label={c.t('decision')} required className="elv-select" value={decision} onChange={event => { c.touch(); setDecision(event.target.value as Decision) }}><option value="">{c.t('unspecified')}</option>{(['continue', 'adjust', 'pause', 'discard'] as const).map(k => <option key={k} value={k}>{c.t(k)}</option>)}</select></label><label className="career-field">{c.t('reason')}<textarea required className="elv-textarea" maxLength={2000} value={reason} onChange={event => { c.touch(); setReason(event.target.value) }} /></label></>}
    {['in_progress', 'submitted', 'self_reviewed'].includes(e.phase) && <div className="career-actions"><Submit blocked={c.blocked}>{c.t(e.phase === 'in_progress' ? 'saveSubmission' : e.phase === 'submitted' ? 'saveReflection' : 'saveDecision')}</Submit><Button onClick={reset}>{c.t('cancel')}</Button></div>}
  </fieldset></form>
}
function ReviewBox({ experiment: e }: { experiment: Experiment }) {
  const c = useCareer(), [selected, setSelected] = useState(false)
  if (!e.sample) return null
  return <section><h3>{c.t('humanReview')}</h3><label><input type="checkbox" className="elv-checkbox" checked={selected} disabled={c.busy || c.uncertain || e.review} onChange={event => setSelected(event.target.checked)} />{c.t('shareSample')}</label><Button disabled={c.busy || c.uncertain || c.dirty || (!e.review && !selected)} onClick={() => void c.send({ type: 'review', id: e.id, selected })}>{c.t(e.review ? 'withdraw' : 'requestReview')}</Button>{e.review && <p>{c.t('requested')}</p>}</section>
}
export function ExperimentScreen() {
  const { id } = useParams(), c = useCareer(), e = c.state.experiments.find(e => String(e.id) === id)
  if (!e) return <p role="status">{c.t('empty')}</p>
  const blocked = c.busy || c.uncertain || c.dirty, current = isCurrent(c.state, e)
  return <article className="elv-card"><Button onClick={() => c.navigate(`${base}/experiments`)}>{c.t('experiments')}</Button><h2>{c.t('experiment')} · {e.route.title[c.lang]}</h2><p>{c.t('version')} {e.version} · {c.t(e.phase)} · {c.t(current ? 'current' : 'needsReview')}</p>
    <h3>{c.t('question')}</h3><p>{c.t('questionText')}</p><p>{c.t('taskText')}</p><p>{e.minutes} {c.t('minutes')} · {c.t('costUnknown')}</p><details><summary>{c.t('criteria')}</summary><p>{c.t('criteriaText')}</p><p>{c.t('limitation')}</p></details>
    {e.phase === 'ready' && <Button primary disabled={blocked || !current} own={current ? null : 'needsReview'} onClick={() => void c.send({ type: 'change', id: e.id, expected: e.version, phase: 'in_progress', value: {} })}>{c.t('start')}</Button>}
    {e.sample && <section><h3>{c.t('sample')}</h3><p className="career-original">{e.sample}</p><p>{c.t('help')}: {e.assistance && c.t(e.assistance)}</p></section>}
    {e.observation && <dl><dt>{c.t('observation')}</dt><dd className="career-original">{e.observation}</dd><dt>{c.t('interpretation')}</dt><dd className="career-original">{e.interpretation}</dd></dl>}
    <ExperimentForm key={`${e.id}-${e.version}`} experiment={e} /><ReviewBox key={`review-${e.id}-${e.version}`} experiment={e} />
    {e.decision && <p>{c.t(e.decision)}: <span className="career-original">{e.reason}</span></p>}
    {e.phase === 'decided' && ['continue', 'adjust'].includes(e.decision) && <Button disabled={blocked || !current} own={current ? null : 'needsReview'} onClick={() => c.navigate(`${base}/plan`)}>{c.t('proposePlan')}</Button>}
    <div className="career-actions"><Button disabled={blocked} onClick={() => void c.send({ type: 'rebase', id: e.id })}>{c.t('rebase')}</Button></div>
    <details><summary>{c.t('versions')}</summary>{e.versions.map(v => <section key={v.version}><h3>{c.t('version')} {v.version} · {c.t(v.phase)}</h3><p>{c.t(v.basis === c.state.basis ? 'current' : 'needsReview')}</p>{[v.sample, v.observation, v.interpretation, v.reason].filter(Boolean).map((value, index) => <p className="career-original" key={index}>{value}</p>)}</section>)}</details>
  </article>
}
const actionTitle = (key: number): CopyKey => key === 7 ? 'step7' : key === 30 ? 'step30' : 'step90'
function PlanProposal({ experiment, onAccepted }: { experiment: Experiment; onAccepted: () => void }) {
  const c = useDraft('plan-proposal'), [selected, setSelected] = useState<number[]>([]), [budget, setBudget] = useState(''), [currency, setCurrency] = useState<'USD' | 'COP'>('USD'), [review, setReview] = useState(false)
  const initial = () => [7, 30, 90].map(key => ({ key, date: '', minutes: 20, resource: false, cost: '', completed: '' }))
  const [actions, setActions] = useState<Action[]>(initial)
  const update = (key: number, patch: Partial<Action>) => { c.touch(); setReview(false); setActions(a => a.map(a => a.key === key ? { ...a, ...patch } : a)) }
  const chosen = actions.filter(a => selected.includes(a.key)), valid = validActions(chosen, budget)
  const submit = (event: FormEvent) => { event.preventDefault(); if (valid) setReview(true) }
  const confirm = async () => { const result = await c.save({ type: 'plan', experimentId: experiment.id, actions: chosen, budget, currency }); if (result.ok) { setReview(false); setSelected([]); onAccepted() } }
  return <section className="elv-card"><h3>{c.t('proposal')} · {experiment.route.title[c.lang]}</h3><p>{c.t('availability')} · {c.t('zone')}: America/Bogota</p>{review ? <><p>{c.t('reviewSelection')}</p>{chosen.map(a => <p key={a.key}>{a.key} {c.t('days')} · {a.date} · {a.minutes} {c.t('minutes')} · {a.cost || c.t('costUnknown')} {a.cost && currency}</p>)}<p>{c.t('completionLimit')}</p><Button primary disabled={c.blocked} onClick={() => void confirm()}>{c.t('confirmPlan')}</Button><Button onClick={() => setReview(false)}>{c.t('edit')}</Button></> : <form onSubmit={submit}><fieldset disabled={c.busy || c.uncertain}>
    {actions.map(a => <fieldset key={a.key} className="career-panel"><legend>{a.key} {c.t('days')}</legend><p>{c.t(actionTitle(a.key))}</p><p>{c.t('expected')}</p>{a.key !== 7 && <p>{c.t('dependency')}</p>}
      <label><input type="checkbox" className="elv-checkbox" checked={selected.includes(a.key)} onChange={() => { c.touch(); setSelected(toggle(selected, a.key)) }} />{c.t('selectAction')}</label>
      <label className="career-field">{c.t('date')}<input type="date" className="elv-input" required={selected.includes(a.key)} value={a.date} onChange={event => update(a.key, { date: event.target.value })} /></label>
      <label className="career-field">{c.t('effort')}<input type="number" className="elv-input" min={a.key === 7 ? 20 : 1} max={a.key === 7 ? 45 : 60} step={1} value={a.minutes} onChange={event => update(a.key, { minutes: Number(event.target.value) })} /></label>
      <details><summary>{c.t('resource')}</summary><a href="https://example.org/synthetic-resource" target="_blank" rel="noopener noreferrer">example.org — {c.t('openSource')}</a></details><label><input type="checkbox" className="elv-checkbox" checked={a.resource} onChange={event => update(a.key, { resource: event.target.checked })} />{c.t('selectResource')}</label>
      <label className="career-field">{c.t('cost')} ({currency})<input type="number" className="elv-input" min={0} step="any" value={a.cost} onChange={event => update(a.key, { cost: event.target.value })} /></label>
    </fieldset>)}
    <div className="career-pair"><label className="career-field">{c.t('budget')}<input type="number" className="elv-input" min={0} step="any" value={budget} onChange={event => { c.touch(); setBudget(event.target.value) }} /></label><label className="career-field">{c.t('currency')}<select aria-label={c.t('currency')} className="elv-select" value={currency} onChange={event => { c.touch(); setCurrency(event.target.value as 'USD' | 'COP') }}><option>USD</option><option>COP</option></select></label></div>
    {selected.length > 0 && !valid && <p className="career-error">{c.t('invalidPlan')}</p>}
    <div className="career-actions"><Submit blocked={c.blocked || !valid} own={valid ? null : 'invalidPlan'}>{c.t('reviewSelection')}</Submit><Button onClick={() => { setActions(initial()); setSelected([]); setBudget(''); c.clean() }}>{c.t('cancel')}</Button></div>
  </fieldset></form>}</section>
}
function ProgressForm({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const c = useDraft('progress'), [actionKey, setActionKey] = useState(''), [text, setText] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); const result = await c.save({ type: 'complete', planId: plan.id, expected: plan.version, key: Number(actionKey), text }); if (result.ok) { setText(''); setActionKey(''); onSaved() } }
  return <form onSubmit={event => void submit(event)}><fieldset disabled={c.busy || c.uncertain || !planCurrent(c.state, plan)}><h3>{c.t('complete')}</h3><label className="career-field">{c.t('selectAction')}<select aria-label={c.t('selectAction')} required className="elv-select" value={actionKey} onChange={event => { c.touch(); setActionKey(event.target.value) }}><option value="">{c.t('unspecified')}</option>{plan.actions.filter(a => !a.completed).map(a => <option key={a.key} value={a.key}>{a.key} {c.t('days')}</option>)}</select></label><label className="career-field">{c.t('completion')}<textarea required className="elv-textarea" maxLength={2000} value={text} onChange={event => { c.touch(); setText(event.target.value) }} /></label><p>{c.t('completionLimit')}</p><div className="career-actions"><Submit blocked={c.blocked}>{c.t('complete')}</Submit><Button onClick={() => { setText(''); setActionKey(''); c.clean() }}>{c.t('cancel')}</Button></div></fieldset></form>
}
function ReminderForm({ plan }: { plan: Plan }) {
  const c = useDraft('reminder'), [actionKey, setActionKey] = useState(''), [localTime, setLocalTime] = useState(''), [accepted, setAccepted] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); const result = await c.save({ type: 'reminder', planId: plan.id, key: Number(actionKey), localTime, accepted }); if (result.ok) { setActionKey(''); setLocalTime(''); setAccepted(false) } }
  return <form onSubmit={event => void submit(event)}><fieldset disabled={c.busy || c.uncertain || !planCurrent(c.state, plan)}><h3>{c.t('reminder')}</h3><p>{c.t('reminderHelp')}</p><p>{c.t('zone')}: America/Bogota</p><label className="career-field">{c.t('selectAction')}<select aria-label={c.t('selectAction')} className="elv-select" required value={actionKey} onChange={event => { c.touch(); setActionKey(event.target.value) }}><option value="">{c.t('unspecified')}</option>{plan.actions.filter(a => !a.completed).map(a => <option key={a.key} value={a.key}>{a.key} {c.t('days')} · {a.date}</option>)}</select></label><label className="career-field">{c.t('localTime')}<input className="elv-input" required type="datetime-local" value={localTime} onChange={event => { c.touch(); setLocalTime(event.target.value) }} /></label><label><input className="elv-checkbox" type="checkbox" checked={accepted} onChange={event => { c.touch(); setAccepted(event.target.checked) }} />{c.t('acceptReminder')}</label><div className="career-actions"><Submit plain blocked={c.blocked || !accepted || !c.state.notifications} own={!accepted || !c.state.notifications ? 'reminderInvalid' : null}>{c.t('acceptReminder')}</Submit><Button onClick={() => { setAccepted(false); setLocalTime(''); setActionKey(''); c.clean() }}>{c.t('cancel')}</Button></div></fieldset></form>
}
export function PlanScreen() {
  const c = useCareer(), [experimentId, setExperimentId] = useState(''), [proposal, setProposal] = useState(false), [selectedId, setSelectedId] = useState('')
  const eligible = c.state.experiments.filter(e => e.phase === 'decided' && ['continue', 'adjust'].includes(e.decision) && isCurrent(c.state, e))
  const selected = eligible.find(e => String(e.id) === experimentId)
  const plan = c.state.plans.find(p => String(p.id) === selectedId) ?? c.state.plans.findLast(p => p.status === 'accepted' || p.status === 'paused')
  const blocked = c.busy || c.uncertain || c.dirty
  const activeReminders = c.state.reminders.filter(r => r.status === 'active' && r.grant === c.state.grant && c.state.notifications && c.state.plans.some(p => p.id === r.planId && p.status === 'accepted' && planCurrent(c.state, p)))
  return <section><h2>{c.t('plan')}</h2>{!plan && <p>{c.t('noPlan')}</p>}
    <section className="career-panel"><label className="career-field">{c.t('experiment')}<select aria-label={c.t('experiment')} className="elv-select" value={experimentId} disabled={blocked} onChange={event => { setProposal(false); setExperimentId(event.target.value) }}><option value="">{c.t('unspecified')}</option>{eligible.map(e => <option key={e.id} value={e.id}>{e.route.title[c.lang]} · {c.t('version')} {e.version}</option>)}</select></label><Button disabled={blocked || !selected} own={selected ? null : 'pickExperiment'} onClick={() => setProposal(true)}>{c.t('proposePlan')}</Button></section>
    {proposal && selected && <PlanProposal key={`${selected.id}-${selected.version}`} experiment={selected} onAccepted={() => { setProposal(false); setSelectedId('') }} />}
    {c.state.plans.length > 0 && <label className="career-field">{c.t('versions')}<select aria-label={c.t('versions')} className="elv-select" disabled={blocked} value={plan?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>{c.state.plans.map(p => <option key={p.id} value={p.id}>{c.t('version')} {p.version} · {c.t(p.status)}</option>)}</select></label>}
    {plan && <article className="elv-card"><h3>{c.t(plan.status)} · {c.t('version')} {plan.version}</h3><p>{c.t('availability')} · {c.t('zone')}: America/Bogota</p><p>{c.t(planCurrent(c.state, plan) ? 'current' : 'needsReview')}</p>{plan.actions.map(a => <section className="career-panel" key={a.key}><h3>{a.key} {c.t('days')}</h3><p>{c.t(actionTitle(a.key))}</p><p>{a.date} · {a.minutes} {c.t('minutes')} · {a.cost || c.t('costUnknown')} {a.cost && plan.currency}</p>{a.resource && <p>{c.t('resource')}</p>}<p>{c.t('expected')}</p>{a.completed && <p>{c.t('completed')}: <span className="career-original">{a.completed}</span></p>}</section>)}
      {plan.status === 'accepted' && <><ProgressForm key={`progress-${plan.id}`} plan={plan} onSaved={() => setSelectedId('')} /><Button disabled={blocked} onClick={() => void c.send({ type: 'pause', planId: plan.id, expected: plan.version }).then(result => { if (result.ok) setSelectedId('') })}>{c.t('pause')}</Button>
        <label><input className="elv-checkbox" type="checkbox" disabled={blocked} checked={c.state.notifications} onChange={event => void c.send({ type: 'notifications', enabled: event.target.checked })} />{c.t('notificationConsent')}</label><ReminderForm key={`reminder-${plan.id}`} plan={plan} /></>}
    </article>}
    <section className="career-panel"><h3>{c.t('reminder')}</h3><p>{c.t('reminderHelp')}</p>{!activeReminders.length && <p>{c.t('noReminders')}</p>}{activeReminders.map(r => <section key={r.id}><p>{r.localTime} · America/Bogota</p><Button disabled={blocked || r.dueAt > new Date().toISOString()} own={r.dueAt > new Date().toISOString() ? 'ackLater' : null} onClick={() => void c.send({ type: 'ack', id: r.id })}>{c.t('acknowledge')}</Button><Button disabled={blocked} onClick={() => void c.send({ type: 'cancel', id: r.id })}>{c.t('cancel')}</Button></section>)}</section>
  </section>
}
