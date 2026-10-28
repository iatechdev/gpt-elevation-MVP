// ES-34: simulación sintética aislada. Sin fetch, almacenamiento, JWT, IDs de personas ni transporte real.
export type ContextKey = 'education' | 'operations' | 'analysis'
export type Arrangement = 'remote' | 'hybrid' | 'onsite'
export type Constraints = { markets: string[]; languages: string[]; arrangements: Arrangement[]; regulated: 'yes' | 'no' | 'unknown'; origin: ContextKey | ''; interests: ContextKey[]; preferred: Arrangement[] }
export const emptyConstraints = (): Constraints => ({ markets: [], languages: [], arrangements: [], regulated: 'unknown', origin: '', interests: [], preferred: [] })
export type Slot = 'continuity' | 'adjacency' | 'exploration'
export type Route = { id: number; title: { es: string; en: string }; context: ContextKey; market: string; supported: boolean; regulated: boolean; stale: boolean; slot: Slot }
const catalog: Omit<Route, 'slot'>[] = [
  { id: 1, title: { es: 'Formación organizacional', en: 'Organizational training' }, context: 'education', market: 'CO', supported: true, regulated: false, stale: false },
  { id: 2, title: { es: 'Coordinación de operaciones', en: 'Operations coordination' }, context: 'operations', market: 'DK', supported: true, regulated: false, stale: true },
  { id: 3, title: { es: 'Análisis de información regulada', en: 'Regulated information analysis' }, context: 'analysis', market: 'CO', supported: false, regulated: true, stale: false },
]
export type Phase = 'ready' | 'in_progress' | 'submitted' | 'self_reviewed' | 'decided'
export type Assistance = 'none' | 'planning' | 'drafting' | 'substantial' | 'unknown'
export type Decision = 'continue' | 'adjust' | 'pause' | 'discard'
type History = { version: number; phase: Phase; basis: number; sample?: string; observation?: string; interpretation?: string; reason?: string }
export type Experiment = { id: number; route: Route; version: number; basis: number; phase: Phase; minutes: number; sample: string; evidence: boolean; assistance: Assistance | ''; observation: string; interpretation: string; decision: Decision | ''; reason: string; review: boolean; versions: History[] }
export type Action = { key: number; date: string; minutes: number; resource: boolean; cost: string; completed: string }
export type Plan = { id: number; experimentId: number; experimentVersion: number; basis: number; version: number; status: 'accepted' | 'paused' | 'superseded'; actions: Action[]; budget: string; currency: 'USD' | 'COP'; versions: { version: number; status: 'accepted' | 'paused' | 'superseded' }[] }
export type Reminder = { id: number; planId: number; planVersion: number; actionKey: number; dueAt: string; localTime: string; grant: number; status: 'active' | 'cancelled' | 'delivered' }
export type State = { loaded: boolean; constraints: Constraints; basis: number; choices: { id: number; route: Route; decision: 'chosen' | 'rejected'; basis: number }[]; experiments: Experiment[]; plans: Plan[]; requested: boolean; notifications: boolean; grant: number; reminders: Reminder[] }
export type Command =
  | { type: 'constraints'; value: Constraints }
  | { type: 'choice'; route: Route; decision: 'chosen' | 'rejected' }
  | { type: 'experiment'; routeId: number; minutes: number }
  | { type: 'change'; id: number; expected: number; value: Partial<Pick<Experiment, 'sample' | 'evidence' | 'assistance' | 'observation' | 'interpretation' | 'decision' | 'reason'>>; phase: Phase }
  | { type: 'review'; id?: number; selected?: boolean }
  | { type: 'rebase'; id: number }
  | { type: 'plan'; experimentId: number; actions: Action[]; budget: string; currency: 'USD' | 'COP' }
  | { type: 'complete'; planId: number; expected: number; key: number; text: string }
  | { type: 'pause'; planId: number; expected: number }
  | { type: 'notifications'; enabled: boolean }
  | { type: 'reminder'; planId: number; key: number; localTime: string; accepted: boolean }
  | { type: 'ack' | 'cancel'; id: number }
export class FixtureError extends Error { code: 'saveError' | 'lostAck' | 'conflict' | 'pending' | 'validate' | 'invalidPlan' | 'reminderInvalid'; constructor(code: FixtureError['code']) { super(code); this.code = code } }
export const isCurrent = (s: State, e: Experiment) => e.basis === s.basis
export const planCurrent = (s: State, p: Plan) => p.basis === s.basis && s.experiments.find(e => e.id === p.experimentId)?.version === p.experimentVersion
export function preferenceFor(s: State, route: Route): 'unknown' | 'matches' | 'partialMatch' | 'outside' {
  const c = s.constraints, contextMatch = c.interests.includes(route.context), arrangementMatch = c.preferred.some(m => m !== 'onsite')
  if (!c.interests.length && !c.preferred.length) return 'unknown'
  if ((!c.interests.length || contextMatch) && (!c.preferred.length || arrangementMatch)) return 'matches'
  return contextMatch || arrangementMatch ? 'partialMatch' : 'outside'
}
export function routesFor(s: State): Route[] {
  if (!s.basis) return []
  const c = s.constraints
  const candidates = catalog.filter(r => c.markets.includes(r.market) && (!c.languages.length || c.languages.includes(r.market === 'DK' ? 'en' : 'es')) && (!c.arrangements.length || c.arrangements.some(m => m === 'remote' || m === 'hybrid')) && !(r.regulated && c.regulated === 'no'))
  const out: Route[] = []
  for (const slot of ['continuity', 'adjacency', 'exploration'] as const) {
    const r = candidates.find(r => !out.some(x => x.id === r.id) && (slot === 'continuity' ? r.context === c.origin : slot === 'adjacency' ? r.context !== c.origin && r.supported : c.interests.includes(r.context) || c.preferred.some(m => m !== 'onsite')))
    if (r) out.push({ ...r, slot })
  }
  return out
}
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
const week = (date: string) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() || 7) + 1); return d.toISOString().slice(0, 10) }
export function validActions(actions: Action[], budget: string, now = new Date()): boolean {
  if (!actions.length || actions.length > 3 || new Set(actions.map(a => a.key)).size !== actions.length) return false
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(p => [p.type, p.value]))
  const today = `${parts.year}-${parts.month}-${parts.day}`
  const weeks = new Map<string, number>()
  let total = 0
  for (const a of actions) {
    if (![7, 30, 90].includes(a.key) || !validDate(a.date) || a.date < today || !Number.isInteger(a.minutes) || a.minutes < (a.key === 7 ? 20 : 1) || a.minutes > (a.key === 7 ? 45 : 60) || (a.resource && a.minutes < 20)) return false
    const parent = a.key === 30 ? 7 : a.key === 90 ? 30 : null
    if (parent && !actions.some(p => p.key === parent && p.date <= a.date)) return false
    weeks.set(week(a.date), (weeks.get(week(a.date)) ?? 0) + a.minutes)
    if (budget !== '') {
      if (a.resource || a.cost === '' || !Number.isFinite(Number(a.cost)) || Number(a.cost) < 0) return false
      total += Number(a.cost)
    }
  }
  return [...weeks.values()].every(minutes => minutes <= 60) && (budget === '' || (Number.isFinite(Number(budget)) && Number(budget) >= total && Number(budget) >= 0))
}
// La vista usa solo America/Bogota, snapshot sintético fijo; no infiere la zona del participante real.
export const fixtureInstant = (localTime: string) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localTime) || !validDate(localTime.slice(0, 10)) || Number(localTime.slice(11, 13)) > 23 || Number(localTime.slice(14, 16)) > 59) return null
  return new Date(Date.parse(localTime + ':00Z') + 5 * 3600000).toISOString()
}
export function createFixture(scenario = 'normal') {
  let state: State = { loaded: false, constraints: emptyConstraints(), basis: 0, choices: [], experiments: [], plans: [], requested: false, notifications: false, grant: 0, reminders: [] }
  let durable = state
  const listeners = new Set<() => void>()
  let sequence = 0
  const attempts = new Map<string, { input: string; result: number | undefined }>()
  const publish = (next: State) => { state = next; durable = next; listeners.forEach(fn => fn()) }
  const history = (e: Experiment): History => ({ version: e.version, phase: e.phase, basis: e.basis, sample: e.sample, observation: e.observation, interpretation: e.interpretation, reason: e.reason })
  const findExperiment = (next: State, id: number) => { const e = next.experiments.find(e => e.id === id); if (!e) throw new FixtureError('validate'); return e }
  const findPlan = (next: State, id: number) => { const p = next.plans.find(p => p.id === id); if (!p) throw new FixtureError('validate'); return p }
  return {
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } },
    snapshot: () => state,
    load: async () => { await new Promise(resolve => setTimeout(resolve, 40)); if (scenario === 'load-error') throw new FixtureError('saveError'); if (scenario === 'pending') throw new FixtureError('pending'); publish({ ...durable, loaded: true }) },
    async send(input: Command, requestId: string): Promise<number | undefined> {
      await new Promise(resolve => setTimeout(resolve, 40))
      const encoded = JSON.stringify(input), repeat = attempts.get(requestId)
      if (repeat) { if (repeat.input !== encoded) throw new FixtureError('conflict'); publish({ ...durable }); return repeat.result }
      if (scenario === 'save-error') throw new FixtureError('saveError')
      if (scenario === 'conflict') throw new FixtureError('conflict')
      if (scenario === 'pending') throw new FixtureError('pending')
      const next = structuredClone(durable)
      let result: number | undefined
      switch (input.type) {
        case 'constraints': {
          const c = input.value
          if (!c.markets.length || c.markets.length > 3 || c.markets.some(m => !['CO', 'DK'].includes(m)) || c.preferred.some(m => c.arrangements.length > 0 && !c.arrangements.includes(m))) throw new FixtureError('validate')
          next.constraints = structuredClone(c); next.basis++; break
        }
        case 'choice': {
          const r = routesFor(next).find(r => r.id === input.route.id && r.slot === input.route.slot)
          if (!r) throw new FixtureError('conflict')
          next.choices.push({ id: ++sequence, route: r, decision: input.decision, basis: next.basis }); break
        }
        case 'experiment': {
          const chosen = next.choices.findLast(c => c.route.id === input.routeId)
          if (!chosen || chosen.decision !== 'chosen' || chosen.basis !== next.basis) throw new FixtureError('conflict')
          if (chosen.route.regulated || ![20, 30, 45].includes(input.minutes)) throw new FixtureError('validate')
          const id = ++sequence; result = id
          next.experiments.push({ id, route: chosen.route, version: 1, basis: next.basis, phase: 'ready', minutes: input.minutes, sample: '', evidence: false, assistance: '', observation: '', interpretation: '', decision: '', reason: '', review: false, versions: [{ version: 1, phase: 'ready', basis: next.basis }] }); break
        }
        case 'change': {
          const e = findExperiment(next, input.id)
          if (e.version !== input.expected || !isCurrent(next, e)) throw new FixtureError('conflict')
          const allowed = input.phase === 'in_progress' ? e.phase === 'ready' : input.phase === 'submitted' ? e.phase !== 'ready' : input.phase === 'self_reviewed' ? ['submitted', 'self_reviewed'].includes(e.phase) : input.phase === 'decided' ? ['self_reviewed', 'decided'].includes(e.phase) : false
          if (!allowed) throw new FixtureError('validate')
          const value = input.value
          if (input.phase === 'submitted' && ((!value.sample?.trim() && !value.evidence) || !value.assistance || (value.sample?.length ?? 0) > 6000)) throw new FixtureError('validate')
          if (input.phase === 'self_reviewed' && (!value.observation?.trim() || !value.interpretation?.trim() || value.observation.length > 2000 || value.interpretation.length > 2000)) throw new FixtureError('validate')
          if (input.phase === 'decided' && (!value.decision || !value.reason?.trim() || value.reason.length > 2000)) throw new FixtureError('validate')
          if (input.phase === 'submitted') Object.assign(e, { observation: '', interpretation: '', decision: '', reason: '', review: false })
          Object.assign(e, value); e.phase = input.phase; e.version++; e.versions.push(history(e)); break
        }
        case 'review': {
          if (input.id === undefined) next.requested = !next.requested
          else { const e = findExperiment(next, input.id); if (!e.review && (!input.selected || !e.sample || !isCurrent(next, e))) throw new FixtureError('validate'); e.review = !e.review } break
        }
        case 'rebase': {
          const e = findExperiment(next, input.id); Object.assign(e, { phase: 'ready', basis: next.basis, sample: '', evidence: false, assistance: '', observation: '', interpretation: '', decision: '', reason: '', review: false }); e.version++; e.versions.push(history(e)); break
        }
        case 'plan': {
          const e = findExperiment(next, input.experimentId)
          if (!isCurrent(next, e) || e.phase !== 'decided' || !['continue', 'adjust'].includes(e.decision)) throw new FixtureError('conflict')
          if (!validActions(input.actions, input.budget)) throw new FixtureError('invalidPlan')
          const combined = [...next.plans.filter(p => p.status === 'accepted' && p.experimentId !== e.id).flatMap(p => p.actions.filter(a => !a.completed)), ...input.actions]
          const weeks = new Map<string, number>(); combined.forEach(a => weeks.set(week(a.date), (weeks.get(week(a.date)) ?? 0) + a.minutes))
          if ([...weeks.values()].some(v => v > 60)) throw new FixtureError('invalidPlan')
          const previous = next.plans.findLast(p => p.experimentId === e.id)
          if (previous) previous.status = 'superseded'
          result = ++sequence
          next.plans.push({ id: result, experimentId: e.id, experimentVersion: e.version, basis: next.basis, version: (previous?.version ?? 0) + 1, status: 'accepted', actions: structuredClone(input.actions), budget: input.budget, currency: input.currency, versions: [...(previous?.versions ?? []), { version: (previous?.version ?? 0) + 1, status: 'accepted' }] }); break
        }
        case 'complete': case 'pause': {
          const p = findPlan(next, input.planId)
          if (p.version !== input.expected || p.status !== 'accepted') throw new FixtureError('conflict')
          const copy = structuredClone(p); p.status = 'superseded'; copy.id = ++sequence; copy.version++
          if (input.type === 'pause') copy.status = 'paused'
          else {
            if (!planCurrent(next, copy) || !input.text.trim() || input.text.length > 2000) throw new FixtureError('validate')
            const a = copy.actions.find(a => a.key === input.key), parent = input.key === 30 ? 7 : input.key === 90 ? 30 : null
            if (!a || a.completed || (parent && !copy.actions.find(p => p.key === parent)?.completed)) throw new FixtureError('invalidPlan')
            a.completed = input.text.trim()
          }
          copy.versions.push({ version: copy.version, status: copy.status }); next.plans.push(copy); result = copy.id; break
        }
        case 'notifications': next.notifications = input.enabled; next.grant++; break
        case 'reminder': {
          const p = findPlan(next, input.planId), a = p.actions.find(a => a.key === input.key), dueAt = fixtureInstant(input.localTime)
          if (!next.notifications || !input.accepted || !a || a.completed || p.status !== 'accepted' || !planCurrent(next, p) || !dueAt || dueAt <= new Date().toISOString() || input.localTime.slice(0, 10) !== a.date) throw new FixtureError('reminderInvalid')
          next.reminders.filter(r => r.planId === p.id && r.actionKey === a.key && r.status === 'active').forEach(r => r.status = 'cancelled')
          next.reminders.push({ id: ++sequence, planId: p.id, planVersion: p.version, actionKey: a.key, localTime: input.localTime, dueAt, grant: next.grant, status: 'active' }); break
        }
        case 'ack': case 'cancel': {
          const r = next.reminders.find(r => r.id === input.id && r.status === 'active')
          if (!r) throw new FixtureError('validate')
          if (input.type === 'ack' && (!next.notifications || r.grant !== next.grant || r.dueAt > new Date().toISOString() || !next.plans.some(p => p.id === r.planId && p.status === 'accepted' && planCurrent(next, p)))) throw new FixtureError('reminderInvalid')
          r.status = input.type === 'ack' ? 'delivered' : 'cancelled'; break
        }
      }
      attempts.set(requestId, { input: encoded, result })
      if (scenario === 'lost-ack') { durable = next; throw new FixtureError('lostAck') }
      publish(next)
      return result
    },
  }
}
export type FixtureClient = ReturnType<typeof createFixture>
