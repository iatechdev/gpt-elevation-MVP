// ES-237 (paso 2b): cliente de SERVIDOR con la misma interfaz que el simulador (`subscribe` / `snapshot` / `load` / `send`): las pantallas de Rutas y Experimentos no cambian de forma.
// Qué hace: lee catálogo, restricciones, rutas, elecciones y experimentos del servidor (`api.ts`), los adapta al modelo de pantalla (`adapter.ts`) y traduce cada gesto en una llamada con `requestId`,
// `baseVersion`/`basisHash`/`expectedVersion`. Después de CADA escritura confirmada relee todo (el servidor es la fuente de la verdad; nada se actualiza a mano).
// Resultado incierto (5xx, corte, 2xx ilegible): `lostAck`. El MISMO intento (mismo gesto, mismos datos) reutiliza su `requestId` y su base hasta que sale bien o el servidor responde con claridad:
// así reenviar tras un corte no crea nada de más. El plan, los recordatorios y las notificaciones se conectan en el paso 3: aquí responden «pendiente» y no simulan nada.
import { CareerApiError, changeExperiment, chooseRoute, createExperiment, getConstraints, getExperiment, getRouteCatalog, getRouteReview, getRoutes, isUncertain, listChoices, listExperiments, proposeExperiment, putConstraints, requestReview, requestRouteReview } from './api.ts'
import type { ChoiceRecord, ExperimentChange, ExperimentProposal, ExperimentView, Modality, Opts } from './api.ts'
import { adapt, emptyState } from './adapter.ts'
import type { Raw } from './adapter.ts'
import { FixtureError } from './fixture.ts'
import type { Command, State } from './fixture.ts'

export type CareerClient = { subscribe: (fn: () => void) => () => void; snapshot: () => State; load: () => Promise<void>; send: (input: Command, requestId: string) => Promise<number | undefined> }
type Operation = () => Promise<number | undefined>

/** Traduce un fallo del cliente HTTP a un código de pantalla. Lo que no es un CareerApiError (p. ej. una cancelación) se deja pasar. */
export function toScreenError(error: unknown, kind: 'read' | 'write' | 'choose' = 'write'): unknown {
  if (!(error instanceof CareerApiError)) return error
  if (error.kind === 'expired') return new FixtureError('expired')
  if (isUncertain(error)) return new FixtureError(kind === 'read' ? 'saveError' : 'lostAck')
  if (kind === 'choose' && (error.kind === 'conflict' || error.code === 'route_not_proposed')) return new FixtureError('routesChanged')
  if (error.kind === 'conflict' || error.kind === 'not_found') return new FixtureError('conflict')
  if (error.kind === 'invalid' || (error.kind === 'rejected' && error.status === 422)) return new FixtureError(error.code === 'route_not_proposed' ? 'routesChanged' : 'validate')
  return new FixtureError('saveError')
}

const MODALITIES: Modality[] = ['onsite', 'hybrid', 'remote']
export function createServerClient({ baseUrl, token, fetcher }: { baseUrl: string; token: () => string; fetcher?: typeof fetch }): CareerClient {
  let state = emptyState(), basisHash: string | null = null
  let submissionVersions = new Map<number, number>()
  const listeners = new Set<() => void>(), frozen = new Map<string, Operation>()
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
    const [catalog, constraints, routes, choicePages, experimentPages, review] = await Promise.all([optional(getRouteCatalog(o)), getConstraints(o), optional(getRoutes(o)), pages(cursor => listChoices(o, cursor)), pages(cursor => listExperiments(o, cursor)), getRouteReview(o)])
    const experiments: ExperimentView[] = await Promise.all(experimentPages.flatMap(page => page.experiments).map(item => getExperiment(o, item.id)))
    const choices: ChoiceRecord[] = choicePages.flatMap(page => page.choices)
    basisHash = routes?.basisHash ?? null
    submissionVersions = new Map(experiments.flatMap(view => view.current.payload.submission ? [[view.experiment.id, view.current.payload.submission.version] as const] : []))
    return { catalog, constraints: constraints.constraints, routes, choices, experiments, routeReviewOpen: review.reviewRequest?.status === 'open', catalogUnavailable }
  }
  const publish = (next: State) => { state = next; listeners.forEach(fn => fn()) }
  const refresh = async () => { try { publish(adapt(await read())) } catch (error) { throw toScreenError(error, 'read') } }
  const experimentOf = (id: number) => { const e = state.experiments.find(e => e.id === id); if (!e) throw new FixtureError('conflict'); return e }
  const change = (id: number, expectedVersion: number, requestId: string, body: ExperimentChange): Operation => async () => { await changeExperiment(opts(), id, { requestId, expectedVersion, change: body }); return undefined }

  // Congela el gesto: el estado y la base se leen UNA vez; reintentar el mismo gesto reenvía exactamente lo mismo.
  function plan(input: Command, requestId: string): { run: Operation; kind: 'write' | 'choose' } {
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
      default: throw new FixtureError('pending') // plan, recordatorios y notificaciones: paso 3
    }
  }
  return {
    subscribe: fn => { listeners.add(fn); return () => { listeners.delete(fn) } },
    snapshot: () => state,
    load: refresh,
    async send(input, requestId) {
      const key = JSON.stringify(input)
      const prior = frozen.get(key) // un gesto cuyo resultado quedó incierto conserva su requestId, su base y sus datos
      const { run, kind } = prior ? { run: prior, kind: input.type === 'choice' ? 'choose' as const : 'write' as const } : plan(input, requestId)
      frozen.set(key, run)
      let result: number | undefined
      try { result = await run() } catch (error) { const mapped = toScreenError(error, kind); if (!(mapped instanceof FixtureError && mapped.code === 'lostAck')) frozen.delete(key); throw mapped }
      frozen.delete(key)
      try { await refresh() } catch (error) { throw error instanceof FixtureError && error.code === 'expired' ? error : new FixtureError('lostAck') } // se guardó, pero no se pudo releer: hay que recuperar antes de afirmar nada
      return result
    },
  }
}
