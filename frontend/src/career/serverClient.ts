// ES-237 (paso 2b): cliente de SERVIDOR con la misma interfaz que el simulador (`subscribe` / `snapshot` / `load` / `send`): las pantallas de Rutas y Experimentos no cambian de forma.
// Qué hace: lee catálogo, restricciones, rutas, elecciones y experimentos del servidor (`api.ts`), los adapta al modelo de pantalla (`adapter.ts`) y traduce cada gesto en una llamada con `requestId`,
// `baseVersion`/`basisHash`/`expectedVersion`. Después de CADA escritura confirmada relee todo (el servidor es la fuente de la verdad; nada se actualiza a mano).
// Resultado incierto (5xx, corte, 2xx ilegible): `lostAck`. El MISMO intento (mismo gesto, mismos datos) reutiliza su `requestId` y su base hasta que sale bien o el servidor responde con claridad:
// así reenviar tras un corte no crea nada de más. El plan, los recordatorios y las notificaciones se conectan en el paso 3: aquí responden «pendiente» y no simulan nada.
import { CareerApiError, changeExperiment, chooseRoute, createExperiment, getConstraints, getExperiment, getRouteCatalog, getRouteReview, getRoutes, isUncertain, listChoices, listExperiments, listPlans, proposeExperiment, proposePlan, putConstraints, requestReview, requestRouteReview, savePlan } from './api.ts'
import type { ChoiceRecord, ExperimentChange, ExperimentProposal, ExperimentView, Modality, Opts, PlanProposal } from './api.ts'
import { adapt, emptyState, proposalViewOf } from './adapter.ts'
import type { Raw } from './adapter.ts'
import { FixtureError } from './fixture.ts'
import type { Command, PlanProposalView, State } from './fixture.ts'

export type CareerClient = { subscribe: (fn: () => void) => () => void; snapshot: () => State; load: () => Promise<void>; send: (input: Command, requestId: string) => Promise<number | undefined> }
type Operation = () => Promise<number | undefined>

const CONTEXT_CODES = new Set(['availability_unknown', 'timezone_unknown', 'context_incomplete'])
/** Traduce un fallo del cliente HTTP a un código de pantalla. Lo que no es un CareerApiError (p. ej. una cancelación) se deja pasar. */
export function toScreenError(error: unknown, kind: 'read' | 'write' | 'choose' | 'plan' = 'write'): unknown {
  if (!(error instanceof CareerApiError)) return error
  if (error.kind === 'expired') return new FixtureError('expired')
  if (isUncertain(error)) return new FixtureError(kind === 'read' ? 'saveError' : 'lostAck')
  // ES-398: 409 con un código de contexto incompleto = la persona debe completar «Mi contexto»; no es un conflicto de versión ni deja la pantalla bloqueada.
  if (error.kind === 'conflict' && error.code && CONTEXT_CODES.has(error.code)) return new FixtureError('needsContext')
  // Plan: los errores de negocio con código (needs_cost_confirmation, needs_scope_reduction, budget_exceeded, invalid_dependencies, resource_time_unknown, needs_availability) y las entradas inválidas dicen «revisa fechas, dependencias, esfuerzo y costos».
  if (kind === 'plan' && (error.kind === 'invalid' || (error.kind === 'rejected' && error.status === 422))) return new FixtureError('invalidPlan')
  if (kind === 'choose' && (error.kind === 'conflict' || error.code === 'route_not_proposed')) return new FixtureError('routesChanged')
  if (error.kind === 'conflict' || error.kind === 'not_found') return new FixtureError('conflict')
  if (error.kind === 'invalid' || (error.kind === 'rejected' && error.status === 422)) return new FixtureError(error.code === 'route_not_proposed' ? 'routesChanged' : 'validate')
  return new FixtureError('saveError')
}

const MODALITIES: Modality[] = ['onsite', 'hybrid', 'remote']
export function createServerClient({ baseUrl, token, fetcher }: { baseUrl: string; token: () => string; fetcher?: typeof fetch }): CareerClient {
  let state = emptyState(), basisHash: string | null = null
  let submissionVersions = new Map<number, number>(), planProposalView: PlanProposalView | undefined
  const listeners = new Set<() => void>(), frozen = new Map<string, { run: Operation; kind: 'write' | 'choose' | 'plan' }>()
  const opts = (): Opts => ({ baseUrl, token: token(), ...(fetcher ? { fetcher } : {}) })

  async function read(): Promise<Raw> {
    const o = opts()
    let catalogUnavailable = false
    const optional = async <T>(promise: Promise<T>): Promise<T | null> => {
      try { return await promise } catch (error) { if (error instanceof CareerApiError && error.code === 'catalog_unavailable') { catalogUnavailable = true; return null } throw error }
    }
    const pages = async <T extends { nextAfter: number | null }>(fetchPage: (cursor?: number) => Promise<T>): Promise<T[]> => {
      const out: T[] = []; let cursor: number | undefined
      for (let i = 0; i < 10; i++) { const page = await fetchPage(cursor); out.push(page); if (page.nextAfter === null) break; cursor = page.nextAfter }
      return out
    }
    const [catalog, constraints, routes, choicePages, experimentPages, review, planPages] = await Promise.all([optional(getRouteCatalog(o)), getConstraints(o), optional(getRoutes(o)), pages(cursor => listChoices(o, cursor)), pages(cursor => listExperiments(o, cursor)), getRouteReview(o), pages(cursor => listPlans(o, cursor))])
    const experiments: ExperimentView[] = await Promise.all(experimentPages.flatMap(page => page.experiments).map(item => getExperiment(o, item.id)))
    const choices: ChoiceRecord[] = choicePages.flatMap(page => page.choices)
    basisHash = routes?.basisHash ?? null
    submissionVersions = new Map(experiments.flatMap(view => view.current.payload.submission ? [[view.experiment.id, view.current.payload.submission.version] as const] : []))
    return { catalog, constraints: constraints.constraints, routes, choices, experiments, routeReviewOpen: review.reviewRequest?.status === 'open', catalogUnavailable, plans: planPages.flatMap(page => page.plans), ...(planProposalView ? { planProposal: planProposalView } : {}) }
  }
  const publish = (next: State) => { state = next; listeners.forEach(fn => fn()) }
  const refresh = async () => { try { publish(adapt(await read())) } catch (error) { throw toScreenError(error, 'read') } }
  const experimentOf = (id: number) => { const e = state.experiments.find(e => e.id === id); if (!e) throw new FixtureError('conflict'); return e }
  const change = (id: number, expectedVersion: number, requestId: string, body: ExperimentChange): Operation => async () => { await changeExperiment(opts(), id, { requestId, expectedVersion, change: body }); return undefined }

  // Congela el gesto: el estado y la base se leen UNA vez; reintentar el mismo gesto reenvía exactamente lo mismo.
  function plan(input: Command, requestId: string): { run: Operation; kind: 'write' | 'choose' | 'plan' } {
    switch (input.type) {
      case 'constraints': {
        const v = input.value, baseVersion = state.basis
        const payload = { targetMarkets: v.markets, languages: v.languages, modalities: v.arrangements as Modality[], acceptRegulated: v.regulated, originContextKey: v.origin || null, interestContextKeys: v.interests, preferredModalities: v.preferred as Modality[] }
        if (payload.modalities.some(m => !MODALITIES.includes(m))) throw new FixtureError('validate')
        return { kind: 'write', run: async () => { await putConstraints(opts(), { requestId, baseVersion, payload }); return undefined } }
      }
      case 'choice': {
        const roleKey = input.route.roleKey, hash = basisHash
        if (!roleKey || !hash) throw new FixtureError('routesChanged')
        return { kind: 'choose', run: async () => { await chooseRoute(opts(), { requestId, roleKey, slot: input.route.slot, decision: input.decision === 'chosen' ? 'accepted' : 'rejected', basisHash: hash }); return undefined } }
      }
      case 'experiment': {
        const choice = state.choices.findLast(c => c.route.id === input.routeId && c.decision === 'chosen' && c.basis === state.basis)
        if (!choice || ![20, 30, 45].includes(input.minutes)) throw new FixtureError('routesChanged')
        const minutes = input.minutes as 20 | 30 | 45
        // El servidor devuelve una propuesta firmada; el experimento nace de ella con el requestId del intento. La propuesta se congela con el intento: reenviar con OTRA propuesta (otro token)
        // sería «el mismo requestId con otro contenido» (409); con la misma, el servidor responde `created: false` y no duplica.
        let proposed: ExperimentProposal | undefined
        return { kind: 'write', run: async () => { proposed ??= await proposeExperiment(opts(), { choiceId: choice.id, taskIndex: 0, minutes }); return (await createExperiment(opts(), { requestId, proposal: proposed.proposal, token: proposed.token })).experimentId } }
      }
      case 'change': {
        const e = experimentOf(input.id), v = input.value
        if (input.phase === 'in_progress') return { kind: 'write', run: change(e.id, input.expected, requestId, { action: 'start' }) }
        if (input.phase === 'submitted') {
          if (!v.sample?.trim() || !v.assistance) throw new FixtureError('validate')
          return { kind: 'write', run: change(e.id, input.expected, requestId, { action: 'submit', sample: v.sample, evidenceRefs: [], assistance: v.assistance }) }
        }
        if (input.phase === 'self_reviewed') {
          if (!v.observation?.trim() || !v.interpretation?.trim()) throw new FixtureError('validate')
          return { kind: 'write', run: change(e.id, input.expected, requestId, { action: 'reflect', observation: v.observation, interpretation: v.interpretation }) }
        }
        if (input.phase === 'decided') {
          if (!v.decision || !v.reason?.trim()) throw new FixtureError('validate')
          return { kind: 'write', run: change(e.id, input.expected, requestId, { action: 'decide', decision: v.decision, reason: v.reason }) }
        }
        throw new FixtureError('validate')
      }
      case 'rebase': { const e = experimentOf(input.id); return { kind: 'write', run: change(e.id, e.version, requestId, { action: 'rebase' }) } }
      case 'adopt': case 'discard': { const e = experimentOf(input.id); return { kind: 'write', run: change(e.id, input.expected, requestId, { action: input.type, part: input.part }) } }
      case 'review': {
        if (input.id === undefined) {
          // El servidor no tiene «retirar» para la revisión de rutas: solo se pide (una abierta a la vez).
          if (state.requested) throw new FixtureError('conflict')
          return { kind: 'write', run: async () => { await requestRouteReview(opts(), { requestId }); return undefined } }
        }
        const e = experimentOf(input.id), expectedVersion = e.version
        if (e.review && e.reviewId) { const reviewId = e.reviewId; return { kind: 'write', run: async () => { await requestReview(opts(), e.id, { requestId, expectedVersion, action: 'withdraw', reviewId }); return undefined } } }
        const submissionVersion = submissionVersions.get(e.id)
        if (!input.selected || !e.sample || !submissionVersion) throw new FixtureError('validate')
        return { kind: 'write', run: async () => { await requestReview(opts(), e.id, { requestId, expectedVersion, action: 'request', submissionVersion, evidenceRefs: [], includeSample: true }); return undefined } }
      }
      case 'propose': {
        // Solo lectura de la propuesta (disponibilidad, zona y recursos reales) para mostrarla antes de elegir; el plan se acepta con una propuesta NUEVA que incluye el presupuesto.
        const e = experimentOf(input.experimentId)
        return { kind: 'plan', run: async () => { planProposalView = proposalViewOf((await proposePlan(opts(), { experimentId: e.id, expectedVersion: e.version })).proposal); return undefined } }
      }
      case 'plan': {
        const e = experimentOf(input.experimentId), amount = input.budget === '' ? null : Number(input.budget)
        if (amount !== null && !Number.isFinite(amount)) throw new FixtureError('invalidPlan')
        const budget = amount === null ? null : { amount, currency: input.currency }
        const selections = input.actions.map(a => ({ actionKey: `step_${a.key}`, chosenDate: a.date, estimatedMinutes: a.minutes, resourceRefs: a.resources ?? [], ...(a.cost !== '' ? { declaredCost: { amount: Number(a.cost), currency: input.currency } } : {}) }))
        // La propuesta se congela con el intento (el mismo requestId con otra propuesta/token sería «otro contenido»).
        const latest = Math.max(0, ...state.plans.filter(p => p.experimentId === e.id).map(p => p.version)) // el servidor exige la última versión del plan de ese experimento (0 si no hay)
        let proposed: PlanProposal | undefined
        return { kind: 'plan', run: async () => { proposed ??= await proposePlan(opts(), { experimentId: e.id, expectedVersion: e.version, budget }); return (await savePlan(opts(), { requestId, expectedVersion: latest, action: 'accept', proposal: proposed.proposal, token: proposed.token, selections })).plan.id } }
      }
      case 'complete': case 'pause': {
        const plan = state.plans.find(p => p.id === input.planId); if (!plan) throw new FixtureError('conflict')
        const body = input.type === 'pause' ? { action: 'pause' as const, planId: plan.id } : { action: 'complete' as const, planId: plan.id, actionKey: `step_${input.key}`, completionEvidence: input.text }
        if (input.type === 'complete' && !input.text.trim()) throw new FixtureError('validate')
        return { kind: 'plan', run: async () => { await savePlan(opts(), { requestId, expectedVersion: input.expected, ...body }); return undefined } }
      }
      default: throw new FixtureError('pending') // recordatorios y notificaciones: sin endpoint de consentimiento ni correo (decisión de Infra, ES-237 12704)
    }
  }
  return {
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } },
    snapshot: () => state,
    load: refresh,
    async send(input, requestId) {
      const key = JSON.stringify(input)
      const { run, kind } = frozen.get(key) ?? plan(input, requestId) // un gesto cuyo resultado quedó incierto conserva su requestId, su base y sus datos
      frozen.set(key, { run, kind })
      let result: number | undefined
      try { result = await run() } catch (error) { const mapped = toScreenError(error, kind); if (!(mapped instanceof FixtureError && mapped.code === 'lostAck')) frozen.delete(key); throw mapped }
      frozen.delete(key)
      try { await refresh() } catch (error) { throw error instanceof FixtureError && error.code === 'expired' ? error : new FixtureError('lostAck') } // se guardó, pero no se pudo releer: hay que recuperar antes de afirmar nada
      return result
    },
  }
}
