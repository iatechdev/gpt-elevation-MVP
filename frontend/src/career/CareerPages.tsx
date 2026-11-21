import { useId, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { useCareer } from './context'
import { useDraft } from './useDraft'
import { blockReason } from './reason'
import { isCurrent, planCurrent, preferenceFor, reasonsFor, routesFor, validActions } from './fixture'
import type { Action, Arrangement, Assistance, Constraints, ContextKey, Decision, Experiment, Part, Plan, Reason, Route } from './fixture'
import type { CopyKey } from './copy'
import { CheckField, Chip, SelectField, TextAreaField, TextField } from '../cartografia/controls'

// ES-329 (Siguiente paso): misma lógica y mismos textos; solo cambia la presentación (piezas de Cartografía, cero estilos en línea).
const base = '/app/next-step'
const dot = ' · ', dash = ' — ', external = { target: '_blank', rel: 'noopener noreferrer' }
const contexts: ContextKey[] = ['education', 'operations', 'analysis']
const arrangements: Arrangement[] = ['remote', 'hybrid', 'onsite']
const toggle = <T,>(values: T[], value: T) => values.includes(value) ? values.filter(v => v !== value) : [...values, value]
// QA-34 obs. 2 y 3: un control deshabilitado explica por qué con aria-describedby (texto solo para lectores; el diseño visual no cambia).
function Button({ children, disabled, onClick, primary = false, danger = false, own = null }: { children: ReactNode; disabled?: boolean; onClick?: () => void; primary?: boolean; danger?: boolean; own?: CopyKey | null }) {
  const c = useCareer(), id = useId()
  const key = disabled ? blockReason({ busy: c.busy, uncertain: c.uncertain, dirty: c.dirty }, own) : null
  return <><button type="button" className={`cg-btn${danger ? ' cg-btn--danger' : primary ? '' : ' cg-btn--ghost'}`} disabled={disabled} aria-describedby={key ? id : undefined} onClick={onClick}>{children}</button>{key && <span id={id} className="career-sr">{c.t(key)}</span>}</>
}
function Submit({ blocked, own = null, plain = false, children }: { blocked: boolean; own?: CopyKey | null; plain?: boolean; children: ReactNode }) {
  const c = useCareer(), id = useId()
  const key = blocked ? (blockReason({ busy: c.busy, uncertain: c.uncertain, dirty: false }, own) ?? 'otherDraft') : null
  return <><button className={plain ? 'cg-btn cg-btn--ghost' : 'cg-btn'} disabled={blocked} aria-describedby={key ? id : undefined}>{children}</button>{key && <span id={id} className="career-sr">{c.t(key)}</span>}</>
}
function ConstraintsForm() {
  const c = useDraft('constraints'), [value, setValue] = useState<Constraints>(() => structuredClone(c.state.constraints))
  // Modo servidor: las opciones de contexto son las del catálogo publicado (con sus etiquetas ES/EN); el simulador usa sus tres fijas.
  const options = c.state.contexts ? c.state.contexts.map(x => x.key) : contexts, label = (key: string) => c.state.contexts?.find(x => x.key === key)?.label[c.lang] ?? c.t(key as CopyKey)
  const update = <K extends keyof Constraints>(key: K, next: Constraints[K]) => { c.touch(); setValue(v => ({ ...v, [key]: next })) }
  const submit = (e: FormEvent) => { e.preventDefault(); void c.save({ type: 'constraints', value }) }
  return <form className="cg-card pg-card" onSubmit={submit}><h2>{c.t('constraints')}</h2>{c.state.basis > 0 && <p>{c.t('version')} {c.state.basis} · {c.t('saved')}</p>}<p id="career-constraints-help">{c.t('constraintsHelp')}</p><fieldset className="pc-fields" disabled={c.busy || c.uncertain} aria-describedby="career-constraints-help">
    <div className="pc-pair"><fieldset className="cg-field"><legend className="cg-label">{c.t('market')}</legend>{(['CO', 'DK'] as const).map(m => <CheckField key={m} checked={value.markets.includes(m)} onChange={() => update('markets', toggle(value.markets, m))} label={c.t(m === 'CO' ? 'co' : 'dk')} />)}</fieldset>
      <fieldset className="cg-field"><legend className="cg-label">{c.t('languages')}</legend>{(['es', 'en'] as const).map(l => <CheckField key={l} checked={value.languages.includes(l)} onChange={() => update('languages', toggle(value.languages, l))} label={c.t(l)} />)}</fieldset></div>
    <fieldset className="cg-field"><legend className="cg-label">{c.t('arrangements')}</legend>{arrangements.map(m => <CheckField key={m} checked={value.arrangements.includes(m)} onChange={() => update('arrangements', toggle(value.arrangements, m))} label={c.t(m)} />)}</fieldset>
    <SelectField label={c.t('regulatedQuestion')} value={value.regulated} onChange={e => update('regulated', e.target.value as Constraints['regulated'])}>{(['unknown', 'yes', 'no'] as const).map(k => <option key={k} value={k}>{c.t(k)}</option>)}</SelectField>
    <p>{c.t('contextHelp')}</p><SelectField label={c.t('origin')} value={value.origin} onChange={e => update('origin', e.target.value as ContextKey | '')}><option value="">{c.t('unspecified')}</option>{options.map(k => <option key={k} value={k}>{label(k)}</option>)}</SelectField>
    <fieldset className="cg-field"><legend className="cg-label">{c.t('interests')}</legend>{options.map(k => <CheckField key={k} checked={value.interests.includes(k)} onChange={() => update('interests', toggle(value.interests, k))} label={label(k)} />)}</fieldset>
    <fieldset className="cg-field"><legend className="cg-label">{c.t('preferred')}</legend>{arrangements.map(k => <CheckField key={k} checked={value.preferred.includes(k)} onChange={() => update('preferred', toggle(value.preferred, k))} label={c.t(k)} />)}</fieldset>
    <div className="pg-actions"><Submit blocked={c.blocked}>{c.t('saveConstraints')}</Submit><Button disabled={c.busy} onClick={() => { setValue(structuredClone(c.state.constraints)); c.clean() }}>{c.t('cancel')}</Button></div>
  </fieldset></form>
}
function RouteCard({ route }: { route: Route }) {
  const c = useCareer(), choice = c.state.choices.findLast(ch => ch.route.id === route.id)
  const [minutes, setMinutes] = useState(20)
  const blocked = c.busy || c.uncertain || c.dirty
  const prepare = async () => { const result = await c.send({ type: 'experiment', routeId: route.id, minutes }); if (result.ok && result.id) c.navigate(`${base}/experiments/${result.id}`) }
  const real = c.state.source === 'api' // con datos reales el chip «sintética» solo aparece si el servidor marca la ruta o su fuente como synthetic:true
  return <article className="cg-card pg-card">{real ? <Chip>{[route.synthetic ? c.t('synthetic') : '', c.t(route.slot)].filter(Boolean).join(dot)}</Chip> : <Chip>{c.t('synthetic')} · {c.t(route.slot)}</Chip>}<h3>{route.title[c.lang]}</h3><p>{route.market} · {c.t('occupational')}</p>
    <dl className="pc-defs"><dt>{c.t('preferences')}</dt><dd>{c.t(preferenceFor(c.state, route))}</dd><dt>{c.t('transfer')}</dt><dd>{c.t(route.supported ? 'supported' : 'noEvidence')}</dd><dt>{c.t('feasibility')}</dt><dd>{c.t('conditional')}</dd></dl>
    {route.regulated && <p className="pc-warn">{c.t('pendingLicense')}</p>}
    {real ? <details className="pc-details"><summary>{c.t('details')}</summary>
      {route.tasks && route.tasks.length > 0 && <><p>{c.t('tasks')}</p><ul>{route.tasks.map((task, index) => <li key={index}>{task[c.lang]}</li>)}</ul></>}
      {route.sources && route.sources.length > 0 && <><p>{c.t('source')}</p><ul>{route.sources.map(source => <li key={`${source.title}-${source.url}`}>{source.url.startsWith('https://') ? <a className="pc-link" href={source.url} {...external}>{[source.title, c.t('openSource')].join(dash)}</a> : source.title}{source.synthetic ? dot + c.t('synthetic') : ''}</li>)}</ul></>}
      {route.stale && <p className="pc-warn">{c.t('stale')}</p>}</details>
    : <details className="pc-details"><summary>{c.t('details')}</summary><p>{c.t('languages')}: {c.t(route.market === 'DK' ? 'en' : 'es')} · {c.t('arrangements')}: {c.t('remote')}, {c.t('hybrid')}</p><p>{c.t('tasks')} · {c.t('hypothesis')}</p><p>{c.t('taskText')}</p><p>{c.t('source')}</p><p>{c.t('sourceDate')}</p><a href="https://example.org/synthetic-source" target="_blank" rel="noopener noreferrer">example.org — {c.t('openSource')}</a>{route.stale && <p className="pc-warn">{c.t('stale')}</p>}<p>{c.t('expired')}</p></details>}
    <p>{c.t('routeLimit')}</p>
    {choice && <p>{c.t(choice.decision)} · {c.t(choice.basis === c.state.basis ? 'current' : 'needsReview')}</p>}
    <div className="pg-actions"><Button primary disabled={blocked} onClick={() => void c.send({ type: 'choice', route, decision: 'chosen' })}>{c.t('choose')}</Button><Button disabled={blocked} onClick={() => void c.send({ type: 'choice', route, decision: 'rejected' })}>{c.t('reject')}</Button></div>
    {choice?.decision === 'chosen' && choice.basis === c.state.basis && <div><SelectField label={c.t('minutes')} value={minutes} disabled={blocked} onChange={e => setMinutes(Number(e.target.value))}>{[20, 30, 45].map(n => <option key={n}>{n}</option>)}</SelectField><div className="pg-actions"><Button disabled={blocked || route.regulated} onClick={() => void prepare()}>{c.t('acceptExperiment')}</Button></div><p>{c.t('questionText')}</p><p>{c.t('costUnknown')}</p><p>{c.t('criteriaText')}</p><p>{c.t('limitation')}</p></div>}
  </article>
}
export function RoutesScreen() {
  const c = useCareer(), routes = routesFor(c.state), noWithdraw = c.state.source === 'api' && c.state.requested // el servidor no tiene «retirar» para la revisión de rutas
  return <><ConstraintsForm /><h2 className="pc-h2">{c.t('options')}</h2>{c.state.catalogUnavailable ? (<div role="alert"><p>{c.t('catalogUnavailable')}</p><Button disabled={c.busy} onClick={c.reload}>{c.t('retry')}</Button></div>) : !c.state.basis ? <p>{c.t('needConstraints')}</p> : !routes.length ? <p>{c.t('noRoutes')}</p> : <>{routes.length < 3 && <p>{c.t('partial')}</p>}<div className="pc-routes">{routes.map(r => <RouteCard key={`${r.id}-${c.state.basis}`} route={r} />)}</div></>}
    <section className="cg-card pg-card"><h2>{c.t('history')}</h2>{c.state.choices.length ? <ol>{c.state.choices.map(ch => <li key={ch.id}>{ch.route.title[c.lang]} · {c.t(ch.decision)} · {c.t('version')} {ch.version ?? ch.basis} · {c.t(ch.basis === c.state.basis ? 'current' : 'needsReview')}</li>)}</ol> : <p>{c.t('noHistory')}</p>}
      {!noWithdraw && <div className="pg-actions"><Button disabled={c.busy || c.uncertain || c.dirty} onClick={() => void c.send({ type: 'review' })}>{c.t(c.state.requested ? 'withdraw' : 'requestReview')}</Button></div>}{c.state.requested && <p>{c.t('requested')}</p>}
    </section></>
}
export function ExperimentList() {
  const c = useCareer()
  return <section className="pc-col"><h2 className="pc-h2">{c.t('experiments')}</h2>{!c.state.experiments.length && <p>{c.t('noExperiments')}</p>}{c.state.experiments.map(e => <article className="cg-card pg-card" key={e.id}><h3>{e.route.title[c.lang]}</h3><p>{c.t(e.phase)} · {c.t('version')} {e.version} · {c.t(isCurrent(c.state, e) ? 'current' : 'needsReview')}</p><div className="pg-actions"><Button onClick={() => c.navigate(`${base}/experiments/${e.id}`)}>{c.t('open')}</Button></div></article>)}</section>
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
  return <form noValidate onSubmit={submit}><fieldset className="pc-fields" disabled={c.busy || c.uncertain || !current}>
    {e.phase === 'in_progress' && <><TextAreaField label={c.t('sample')} maxLength={6000} value={sample} onChange={event => { c.touch(); setSample(event.target.value) }} />{c.state.source !== 'api' && <CheckField checked={selected} onChange={event => { c.touch(); setSelected(event.target.checked) }} label={c.t('evidenceExample')} />}<SelectField label={c.t('help')} required value={assistance} onChange={event => { c.touch(); setAssistance(event.target.value as Assistance) }}><option value="">{c.t('unspecified')}</option>{(['none', 'planning', 'drafting', 'substantial', 'unknown'] as const).map(k => <option key={k} value={k}>{c.t(k)}</option>)}</SelectField></>}
    {e.phase === 'submitted' && <><p>{c.t('selfReport')}</p><div className="pc-pair"><TextAreaField label={c.t('observation')} required maxLength={2000} value={observation} onChange={event => { c.touch(); setObservation(event.target.value) }} /><TextAreaField label={c.t('interpretation')} required maxLength={2000} value={interpretation} onChange={event => { c.touch(); setInterpretation(event.target.value) }} /></div></>}
    {e.phase === 'self_reviewed' && <><SelectField label={c.t('decision')} required value={decision} onChange={event => { c.touch(); setDecision(event.target.value as Decision) }}><option value="">{c.t('unspecified')}</option>{(['continue', 'adjust', 'pause', 'discard'] as const).map(k => <option key={k} value={k}>{c.t(k)}</option>)}</SelectField><TextAreaField label={c.t('reason')} required maxLength={2000} value={reason} onChange={event => { c.touch(); setReason(event.target.value) }} /></>}
    {['in_progress', 'submitted', 'self_reviewed'].includes(e.phase) && <div className="pg-actions"><Submit blocked={c.blocked}>{c.t(e.phase === 'in_progress' ? 'saveSubmission' : e.phase === 'submitted' ? 'saveReflection' : 'saveDecision')}</Submit><Button onClick={reset}>{c.t('cancel')}</Button></div>}
  </fieldset></form>
}
function ReviewBox({ experiment: e }: { experiment: Experiment }) {
  const c = useCareer(), [selected, setSelected] = useState(false)
  if (!e.sample) return null
  return <section><h3>{c.t('humanReview')}</h3><CheckField checked={selected} disabled={c.busy || c.uncertain || e.review} onChange={event => setSelected(event.target.checked)} label={c.t('shareSample')} /><div className="pg-actions"><Button disabled={c.busy || c.uncertain || c.dirty || (!e.review && !selected)} onClick={() => void c.send({ type: 'review', id: e.id, selected })}>{c.t(e.review ? 'withdraw' : 'requestReview')}</Button></div>{e.review && <p>{c.t('requested')}</p>}</section>
}
const reasonKey: Record<Reason, CopyKey> = { route_evidence_changed: 'reasonRouteEvidence', cited_evidence_changed: 'reasonCitedEvidence', context_changed: 'reasonContext', route_choice_changed: 'reasonChoice', rules_changed: 'reasonRules' }
const partKey: Record<Part, CopyKey> = { submission: 'partSubmission', reflection: 'partReflection', decision: 'partDecision' }
// El foco pasa al borrador pendiente o, si ya no hay, al título del experimento: el botón pulsado desaparece del árbol.
const refocus = () => window.setTimeout(() => (document.getElementById('career-carried-title') ?? document.getElementById('career-experiment-title'))?.focus(), 0)
// QA-33-02: avisa POR QUÉ cambió la base y qué se conserva al empezar otra versión.
function BasisNotice({ experiment: e, blocked }: { experiment: Experiment; blocked: boolean }) {
  const c = useCareer(), reasons = reasonsFor(c.state, e), hasWork = Boolean(e.sample || e.observation || e.decision || e.carried)
  const rebase = async () => { const result = await c.send({ type: 'rebase', id: e.id }); if (result.ok) refocus() }
  return <div className="cg-banner pc-notice" role="status"><h3 className="cg-banner__title">{c.t('basisTitle')}</h3>
    {reasons.length > 0 && <><p>{c.t('basisWhat')}</p><ul>{reasons.map(r => <li key={r}>{c.t(reasonKey[r])}</li>)}</ul></>}
    <p className="cg-hint">{c.t(hasWork ? 'basisKeep' : 'basisKeepEmpty')}</p>
    <div className="pg-actions"><Button disabled={blocked} onClick={() => void rebase()}>{c.t('rebase')}</Button></div></div>
}
// Entrega, reflexión y decisión de la versión anterior: borrador por revisar, nunca resultado vigente; se usan o se descartan parte por parte y en orden.
function CarriedDrafts({ experiment: e, blocked }: { experiment: Experiment; blocked: boolean }) {
  const c = useCareer(), [asking, setAsking] = useState<Part | null>(null), carried = e.carried
  if (!carried) return null
  const can: Record<Part, boolean> = { submission: ['ready', 'in_progress'].includes(e.phase), reflection: ['submitted', 'self_reviewed'].includes(e.phase), decision: ['self_reviewed', 'decided'].includes(e.phase) }
  const first: Record<Part, CopyKey | null> = { submission: null, reflection: 'firstSubmission', decision: 'firstReflection' }
  const act = async (type: 'adopt' | 'discard', part: Part) => { setAsking(null); const result = await c.send({ type, id: e.id, expected: e.version, part }); if (result.ok) refocus() }
  return <section className="pc-carried" aria-labelledby="career-carried-title"><h3 id="career-carried-title" tabIndex={-1}>{c.t('carriedTitle')}</h3><p className="cg-hint">{c.t('carriedNotCurrent')}</p>
    {(['submission', 'reflection', 'decision'] as const).filter(part => carried[part]).map(part => {
      const draft = carried[part]!, lines = part === 'submission' ? [(draft as NonNullable<typeof carried.submission>).sample] : part === 'reflection' ? [(draft as NonNullable<typeof carried.reflection>).observation, (draft as NonNullable<typeof carried.reflection>).interpretation] : [(draft as NonNullable<typeof carried.decision>).reason]
      const retired = part === 'submission' ? carried.submission!.retired : 0
      return <article className="pc-draft" key={part}><h4>{c.t(partKey[part])}</h4><Chip tone="wait">{c.t('carriedDraft')} · {c.t('fromVersion')} {draft.from}</Chip>
        {part === 'decision' && <p>{c.t(carried.decision!.decision)}</p>}
        {lines.filter(Boolean).map((line, index) => <p className="pc-original" key={index}>{line}</p>)}
        {part === 'submission' && carried.submission!.evidence && <p className="cg-hint">{c.t('evidenceCited')}</p>}
        {retired > 0 && <p className="cg-hint">{c.t('retiredEvidence')} {retired}</p>}
        {asking === part ? <><p role="status">{c.t('discardAsk')}</p><div className="pg-actions"><Button danger disabled={blocked} onClick={() => void act('discard', part)}>{c.t('discardYes')}</Button><Button onClick={() => setAsking(null)}>{c.t('keepDraft')}</Button></div></>
          : <div className="pg-actions"><Button primary disabled={blocked || !can[part]} own={can[part] ? null : first[part]} onClick={() => void act('adopt', part)}>{c.t('useDraft')}</Button><Button disabled={blocked} onClick={() => setAsking(part)}>{c.t('discardDraft')}</Button></div>}
      </article>
    })}
  </section>
}
export function ExperimentScreen() {
  const { id } = useParams(), c = useCareer(), e = c.state.experiments.find(e => String(e.id) === id)
  if (!e) return <p role="status">{c.t('empty')}</p>
  const blocked = c.busy || c.uncertain || c.dirty, current = isCurrent(c.state, e)
  return <article className="cg-card pg-card"><div className="pg-actions"><Button onClick={() => c.navigate(`${base}/experiments`)}>{c.t('experiments')}</Button></div><h2 id="career-experiment-title" tabIndex={-1}>{c.t('experiment')} · {e.route.title[c.lang]}</h2><p>{c.t('version')} {e.version} · {c.t(e.phase)} · {c.t(current ? 'current' : 'needsReview')}</p>
    {!current && <BasisNotice experiment={e} blocked={blocked} />}
    <CarriedDrafts experiment={e} blocked={blocked} />
    <h3>{c.t('question')}</h3><p>{c.t('questionText')}</p><p>{c.t('taskText')}</p>{e.task && <p>{e.task[c.lang]}</p>}<p>{e.minutes} {c.t('minutes')} · {c.t('costUnknown')}</p><details className="pc-details"><summary>{c.t('criteria')}</summary><p>{c.t('criteriaText')}</p><p>{c.t('limitation')}</p></details>
    {e.phase === 'ready' && <div className="pg-actions"><Button primary disabled={blocked || !current} own={current ? null : 'needsReview'} onClick={() => void c.send({ type: 'change', id: e.id, expected: e.version, phase: 'in_progress', value: {} })}>{c.t('start')}</Button></div>}
    {e.sample && <section><h3>{c.t('sample')}</h3><p className="pc-original">{e.sample}</p><p>{c.t('help')}: {e.assistance && c.t(e.assistance)}</p></section>}
    {e.observation && <dl className="pc-defs"><dt>{c.t('observation')}</dt><dd className="pc-original">{e.observation}</dd><dt>{c.t('interpretation')}</dt><dd className="pc-original">{e.interpretation}</dd></dl>}
    <ExperimentForm key={`${e.id}-${e.version}`} experiment={e} /><ReviewBox key={`review-${e.id}-${e.version}`} experiment={e} />
    {e.decision && <p>{c.t(e.decision)}: <span className="pc-original">{e.reason}</span></p>}
    {e.phase === 'decided' && ['continue', 'adjust'].includes(e.decision) && <div className="pg-actions"><Button disabled={blocked || !current} own={current ? null : 'needsReview'} onClick={() => c.navigate(`${base}/plan`)}>{c.t('proposePlan')}</Button></div>}
    {current && <div className="pg-actions"><Button disabled={blocked} onClick={() => void c.send({ type: 'rebase', id: e.id })}>{c.t('rebase')}</Button></div>}
    <details className="pc-details"><summary>{c.t('versions')}</summary>{e.versions.map(v => <section key={v.version}><h3>{c.t('version')} {v.version} · {c.t(v.phase)}</h3><p>{c.t(v.basis === c.state.basis ? 'current' : 'needsReview')}</p>{[v.sample, v.observation, v.interpretation, v.reason].filter(Boolean).map((value, index) => <p className="pc-original" key={index}>{value}</p>)}</section>)}</details>
  </article>
}
const actionTitle = (key: number): CopyKey => key === 7 ? 'step7' : key === 30 ? 'step30' : 'step90'
// Con datos reales la disponibilidad y la zona vienen de la propuesta del servidor; el simulador conserva su línea fija.
function availabilityLine(c: ReturnType<typeof useCareer>, av?: { weeklyMinutes: number; timeZone: string }) {
  // Con datos reales solo hay línea si el servidor trae la disponibilidad confirmada (sin dato no hay cifra ni zona inventadas).
  if (c.state.source === 'api') return av && av.weeklyMinutes > 0 && av.timeZone ? `${c.t('availability')}: ${av.weeklyMinutes} ${c.t('minutes').toLowerCase()}${dot}${c.t('zone')}: ${av.timeZone}` : ''
  return av ? `${c.t('availability')}: ${av.weeklyMinutes} ${c.t('minutes').toLowerCase()}${dot}${c.t('zone')}: ${av.timeZone}` : `${c.t('availability')}${dot}${c.t('zone')}: America/Bogota`
}
function PlanProposal({ experiment, onAccepted, onPending }: { experiment: Experiment; onAccepted: () => void; onPending: (plan: Plan | null) => void }) {
  const c = useDraft('plan-proposal'), [selected, setSelected] = useState<number[]>([]), [budget, setBudget] = useState(''), [currency, setCurrency] = useState<'USD' | 'COP'>('USD'), [review, setReview] = useState(false)
  const initial = () => [7, 30, 90].map(key => ({ key, date: '', minutes: 20, resource: false, cost: '', completed: '' }))
  const [actions, setActions] = useState<Action[]>(initial)
  const update = (key: number, patch: Partial<Action>) => { c.touch(); setReview(false); setActions(a => a.map(a => a.key === key ? { ...a, ...patch } : a)) }
  const real = c.state.source === 'api', proposalView = real && c.state.planProposal?.experimentId === experiment.id ? c.state.planProposal : undefined
  const chosen = actions.filter(a => selected.includes(a.key)), valid = validActions(chosen, budget, new Date(), proposalView?.weeklyMinutes || 60)
  const submit = (event: FormEvent) => { event.preventDefault(); if (valid) setReview(true) }
  // E377-1: al pulsar «Confirmar plan» la propuesta (alta) se sustituye de inmediato, DENTRO del tiempo de la entrada, por el plan con la MISMA forma que tendrá al aceptarse (con lo elegido, en espera);
  // así la respuesta del servidor, si tarda, solo reemplaza datos y no hay salto de diseño. Si el servidor rechaza, la propuesta vuelve con todo lo que la persona había escrito (sigue montada).
  const waiting = (): Plan => ({ id: -1, experimentId: experiment.id, experimentVersion: experiment.version, basis: c.state.basis, version: Math.max(0, ...c.state.plans.filter(p => p.experimentId === experiment.id).map(p => p.version)) + 1, status: 'accepted', actions: chosen, budget, currency,
    availability: proposalView?.weeklyMinutes ? { weeklyMinutes: proposalView.weeklyMinutes, timeZone: proposalView.timeZone } : undefined, versions: [] })
  const confirm = async () => {
    onPending(waiting())
    const result = await c.save({ type: 'plan', experimentId: experiment.id, actions: chosen, budget, currency })
    if (result.ok) { setReview(false); setSelected([]); onAccepted() } else onPending(null)
  }
  return <section className="cg-card pg-card"><h3>{c.t('proposal')} · {experiment.route.title[c.lang]}</h3>{availabilityLine(c, proposalView?.weeklyMinutes ? { weeklyMinutes: proposalView.weeklyMinutes, timeZone: proposalView.timeZone } : undefined) && <p>{availabilityLine(c, proposalView?.weeklyMinutes ? { weeklyMinutes: proposalView.weeklyMinutes, timeZone: proposalView.timeZone } : undefined)}</p>}{review ? <><p>{c.t('reviewSelection')}</p>{chosen.map(a => <p key={a.key}>{a.key} {c.t('days')} · {a.date} · {a.minutes} {c.t('minutes')} · {a.cost || c.t('costUnknown')} {a.cost && currency}</p>)}<p>{c.t('completionLimit')}</p><div className="pg-actions"><Button primary disabled={c.blocked} onClick={() => void confirm()}>{c.t('confirmPlan')}</Button><Button onClick={() => setReview(false)}>{c.t('edit')}</Button></div></> : <form onSubmit={submit}><fieldset className="pc-fields" disabled={c.busy || c.uncertain}>
    {actions.map(a => <fieldset key={a.key} className="pc-panel"><legend className="cg-label">{a.key} {c.t('days')}</legend><p>{c.t(actionTitle(a.key))}</p><p>{c.t('expected')}</p>{a.key !== 7 && <p>{c.t('dependency')}</p>}
      <CheckField checked={selected.includes(a.key)} onChange={() => { c.touch(); setSelected(toggle(selected, a.key)) }} label={c.t('selectAction')} />
      <TextField label={c.t('date')} type="date" required={selected.includes(a.key)} value={a.date} onChange={event => update(a.key, { date: event.target.value })} />
      <TextField label={c.t('effort')} type="number" min={a.key === 7 ? 20 : 1} max={a.key === 7 ? 45 : 60} step={1} value={a.minutes} onChange={event => update(a.key, { minutes: Number(event.target.value) })} />
      {real ? (proposalView?.resources.length ? <fieldset className="cg-field"><legend className="cg-label">{c.t('resource')}</legend>{proposalView.resources.map(r => <div key={r.key}>
        <CheckField checked={a.resources?.includes(r.key) ?? false} onChange={event => update(a.key, { resources: event.target.checked ? [...(a.resources ?? []), r.key] : (a.resources ?? []).filter(k => k !== r.key) })} label={[r.title, r.minutes ? `${r.minutes} ${c.t('minutes')}` : '', r.price].filter(Boolean).join(dot)} />
        {r.url.startsWith('https://') && <a className="pc-link" href={r.url} {...external}>{c.t('openSource')}</a>}</div>)}</fieldset> : null)
        : <><details className="pc-details"><summary>{c.t('resource')}</summary><a className="pc-link" href="https://example.org/synthetic-resource" target="_blank" rel="noopener noreferrer">example.org — {c.t('openSource')}</a></details><CheckField checked={a.resource} onChange={event => update(a.key, { resource: event.target.checked })} label={c.t('selectResource')} /></>}
      <TextField label={`${c.t('cost')} (${currency})`} type="number" min={0} step="any" value={a.cost} onChange={event => update(a.key, { cost: event.target.value })} />
    </fieldset>)}
    <div className="pc-pair"><TextField label={c.t('budget')} type="number" min={0} step="any" value={budget} onChange={event => { c.touch(); setBudget(event.target.value) }} /><SelectField label={c.t('currency')} value={currency} onChange={event => { c.touch(); setCurrency(event.target.value as 'USD' | 'COP') }}><option>USD</option><option>COP</option></SelectField></div>
    {selected.length > 0 && !valid && <p className="cg-error">{c.t('invalidPlan')}</p>}
    <div className="pg-actions"><Submit blocked={c.blocked || !valid} own={valid ? null : 'invalidPlan'}>{c.t('reviewSelection')}</Submit><Button onClick={() => { setActions(initial()); setSelected([]); setBudget(''); c.clean() }}>{c.t('cancel')}</Button></div>
  </fieldset></form>}</section>
}
function ProgressForm({ plan, onSaved }: { plan: Plan; onSaved: () => void }) {
  const c = useDraft('progress'), [actionKey, setActionKey] = useState(''), [text, setText] = useState('')
  const submit = async (event: FormEvent) => { event.preventDefault(); const result = await c.save({ type: 'complete', planId: plan.id, expected: plan.version, key: Number(actionKey), text }); if (result.ok) { setText(''); setActionKey(''); onSaved() } }
  return <form onSubmit={event => void submit(event)}><fieldset className="pc-fields" disabled={c.busy || c.uncertain || !planCurrent(c.state, plan)}><h3>{c.t('complete')}</h3><SelectField label={c.t('selectAction')} required value={actionKey} onChange={event => { c.touch(); setActionKey(event.target.value) }}><option value="">{c.t('unspecified')}</option>{plan.actions.filter(a => !a.completed).map(a => <option key={a.key} value={a.key}>{a.key} {c.t('days')}</option>)}</SelectField><TextAreaField label={c.t('completion')} required maxLength={2000} value={text} onChange={event => { c.touch(); setText(event.target.value) }} /><p>{c.t('completionLimit')}</p><div className="pg-actions"><Submit blocked={c.blocked}>{c.t('complete')}</Submit><Button onClick={() => { setText(''); setActionKey(''); c.clean() }}>{c.t('cancel')}</Button></div></fieldset></form>
}
function ReminderForm({ plan }: { plan: Plan }) {
  const c = useDraft('reminder'), [actionKey, setActionKey] = useState(''), [localTime, setLocalTime] = useState(''), [accepted, setAccepted] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); const result = await c.save({ type: 'reminder', planId: plan.id, key: Number(actionKey), localTime, accepted }); if (result.ok) { setActionKey(''); setLocalTime(''); setAccepted(false) } }
  return <form onSubmit={event => void submit(event)}><fieldset className="pc-fields" disabled={c.busy || c.uncertain || !planCurrent(c.state, plan)}><h3>{c.t('reminder')}</h3><p>{c.t('reminderHelp')}</p><p>{c.t('zone')}: America/Bogota</p><SelectField label={c.t('selectAction')} required value={actionKey} onChange={event => { c.touch(); setActionKey(event.target.value) }}><option value="">{c.t('unspecified')}</option>{plan.actions.filter(a => !a.completed).map(a => <option key={a.key} value={a.key}>{a.key} {c.t('days')} · {a.date}</option>)}</SelectField><TextField label={c.t('localTime')} required type="datetime-local" value={localTime} onChange={event => { c.touch(); setLocalTime(event.target.value) }} /><CheckField checked={accepted} onChange={event => { c.touch(); setAccepted(event.target.checked) }} label={c.t('acceptReminder')} /><div className="pg-actions"><Submit plain blocked={c.blocked || !accepted || !c.state.notifications} own={!accepted || !c.state.notifications ? 'reminderInvalid' : null}>{c.t('acceptReminder')}</Submit><Button onClick={() => { setAccepted(false); setLocalTime(''); setActionKey(''); c.clean() }}>{c.t('cancel')}</Button></div></fieldset></form>
}
export function PlanScreen() {
  const c = useCareer(), [experimentId, setExperimentId] = useState(''), [proposal, setProposal] = useState(false), [selectedId, setSelectedId] = useState(''), [waiting, setWaiting] = useState<Plan | null>(null)
  // ES-237 paso 3: con datos reales el PLAN va contra el servidor; los recordatorios y las notificaciones siguen «pendientes» (sin endpoint de consentimiento ni correo).
  const real = c.state.source === 'api'
  const eligible = c.state.experiments.filter(e => e.phase === 'decided' && ['continue', 'adjust'].includes(e.decision) && isCurrent(c.state, e))
  const selected = eligible.find(e => String(e.id) === experimentId)
  const saved = c.state.plans.find(p => String(p.id) === selectedId) ?? c.state.plans.findLast(p => p.status === 'accepted' || p.status === 'paused')
  const plan = waiting ?? saved // mientras se confirma, el plan «en espera» ocupa su lugar (E377-1)
  const blocked = c.busy || c.uncertain || c.dirty
  const activeReminders = c.state.reminders.filter(r => r.status === 'active' && r.grant === c.state.grant && c.state.notifications && c.state.plans.some(p => p.id === r.planId && p.status === 'accepted' && planCurrent(c.state, p)))
  return <section className="pc-col"><h2 className="pc-h2">{c.t('plan')}</h2>{!plan && <p>{c.t('noPlan')}</p>}
    <section className="cg-card pg-card"><SelectField label={c.t('experiment')} value={experimentId} disabled={blocked} onChange={event => { setProposal(false); setExperimentId(event.target.value) }}><option value="">{c.t('unspecified')}</option>{eligible.map(e => <option key={e.id} value={e.id}>{e.route.title[c.lang]} · {c.t('version')} {e.version}</option>)}</SelectField><div className="pg-actions"><Button disabled={blocked || !selected} own={selected ? null : 'pickExperiment'} onClick={() => { setProposal(true); if (real && selected) void c.send({ type: 'propose', experimentId: selected.id }) }}>{c.t('proposePlan')}</Button></div></section>
    {proposal && selected && <div hidden={waiting !== null}><PlanProposal key={`${selected.id}-${selected.version}`} experiment={selected} onPending={setWaiting} onAccepted={() => { setWaiting(null); setProposal(false); setSelectedId('') }} /></div>}
    {(c.state.plans.length > 0 || waiting) && <SelectField label={c.t('versions')} disabled={blocked} value={plan?.id ?? ''} onChange={event => setSelectedId(event.target.value)}>{[...c.state.plans, ...(waiting ? [waiting] : [])].map(p => <option key={p.id} value={p.id}>{p === waiting ? c.t('saving') : `${c.t('version')} ${p.version} · ${c.t(p.status)}`}</option>)}</SelectField>}
    {plan && <article className="cg-card pg-card" aria-busy={waiting !== null}><h3>{waiting ? c.t('saving') : `${c.t(plan.status)} · ${c.t('version')} ${plan.version}`}</h3>{availabilityLine(c, plan.availability) && <p>{availabilityLine(c, plan.availability)}</p>}<p>{c.t(planCurrent(c.state, plan) ? 'current' : 'needsReview')}</p>{plan.actions.map(a => <section className="pc-panel" key={a.key}><h3>{a.key} {c.t('days')}</h3><p>{c.t(actionTitle(a.key))}</p><p>{a.date} · {a.minutes} {c.t('minutes')} · {a.cost || c.t('costUnknown')} {a.cost && plan.currency}</p>{a.resource && <p>{c.t('resource')}</p>}<p>{c.t('expected')}</p>{a.completed && <p>{c.t('completed')}: <span className="pc-original">{a.completed}</span></p>}</section>)}
      {plan.status === 'accepted' && <><ProgressForm key={`progress-${plan.id}`} plan={plan} onSaved={() => setSelectedId('')} /><div className="pg-actions"><Button disabled={blocked} onClick={() => void c.send({ type: 'pause', planId: plan.id, expected: plan.version }).then(result => { if (result.ok) setSelectedId('') })}>{c.t('pause')}</Button></div>
        {!real && <><CheckField disabled={blocked} checked={c.state.notifications} onChange={event => void c.send({ type: 'notifications', enabled: event.target.checked })} label={c.t('notificationConsent')} /><ReminderForm key={`reminder-${plan.id}`} plan={plan} /></>}</>}
    </article>}
    <section className="cg-card pg-card"><h3>{c.t('reminder')}</h3><p>{c.t('reminderHelp')}</p>{real && <p role="status">{c.t('pending')}</p>}{!real && !activeReminders.length && <p>{c.t('noReminders')}</p>}{!real && activeReminders.map(r => <section key={r.id}><p>{r.localTime} · America/Bogota</p><div className="pg-actions"><Button disabled={blocked || r.dueAt > new Date().toISOString()} own={r.dueAt > new Date().toISOString() ? 'ackLater' : null} onClick={() => void c.send({ type: 'ack', id: r.id })}>{c.t('acknowledge')}</Button><Button disabled={blocked} onClick={() => void c.send({ type: 'cancel', id: r.id })}>{c.t('cancel')}</Button></div></section>)}</section>
  </section>
}
