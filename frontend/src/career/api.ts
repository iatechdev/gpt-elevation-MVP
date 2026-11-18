// ES-237 (pasos 1–2a): cliente tipado de `/api/experiments`, `/api/career-plan` (ES-32/33) y `/api/routes` + `/api/route-catalog` (ES-31/32). Solo transporte, tipos y errores; lo usa `serverClient.ts` (paso 2b: rutas y experimentos); el plan y los recordatorios se conectan en el paso 3.
// El titular sale del token, nunca del cuerpo. El servidor es un modelo de VERSIONES inmutables: cada gesto de la persona (iniciar, entregar, reflexionar, decidir; aceptar/pausar/completar el plan)
// es una versión nueva con `expectedVersion` y un `requestId` estable por intento (reintentar el MISMO intento no crea una versión de más). Vocabulario del servidor (decisión del 17-nov-2026):
// continuar / ajustar / pausar / descartar; no hay «deshacer aceptación» ni «aplazar».
// Resultado incierto: un 5xx o un corte NO dice si el servidor guardó; `isUncertain(error)` lo marca para releer (GET) antes de declarar éxito o fallo.
export type Opts = { baseUrl: string; token: string; signal?: AbortSignal; fetcher?: typeof fetch; timeoutMs?: number }

export type CareerFailure = 'expired' | 'network' | 'forbidden' | 'not_found' | 'conflict' | 'invalid' | 'rejected' | 'unavailable'
/** Error del cliente: `code` es el código estable del servidor (p. ej. `transition_not_allowed`, `version_conflict`, `needs_scope_reduction`) o vacío si no lo hubo. */
export class CareerApiError extends Error {
  readonly kind: CareerFailure; readonly status: number; readonly code: string
  constructor(kind: CareerFailure, status: number, code: string) { super(code || kind); this.kind = kind; this.status = status; this.code = code }
}
const kindOf = (status: number): CareerFailure => status === 401 ? 'expired' : status === 403 ? 'forbidden' : status === 404 ? 'not_found' : status === 409 ? 'conflict'
  : status === 400 ? 'invalid' : status >= 500 ? 'unavailable' : 'rejected'
/** true cuando NO se sabe si el servidor guardó (corte de red, 5xx): hay que releer antes de decir nada. Un 4xx con código es una respuesta clara. */
export const isUncertain = (error: unknown): boolean => error instanceof CareerApiError && (error.kind === 'network' || error.kind === 'unavailable')
/** Identificador de un intento (8–64 caracteres A-Za-z0-9_-). Se conserva hasta que el intento sale bien. */
export const newRequestId = (): string => crypto.randomUUID().replace(/-/g, '')

export type Assistance = 'none' | 'planning' | 'drafting' | 'substantial' | 'unknown'
export type Decision = 'continue' | 'adjust' | 'pause' | 'discard'
export type Lifecycle = 'ready' | 'in_progress' | 'submitted' | 'self_reviewed' | 'decided'
export type EvidenceRef = { evidenceId: number; version: number }
export type Basis = { status: 'current' | 'needs_review'; reasons: string[] }
export type ExperimentPayload = { lifecycle: Lifecycle; roleKey: string; taskIndex: number; minutes: 20 | 30 | 45; templateVersion: number; basisHash: string;
  submission?: { sample: string | null; evidenceRefs: EvidenceRef[]; assistance: { degree: Assistance; source: 'self_report' }; version: number }
  reflection?: { observation: string; interpretation: string; source: 'self_report' }; decision?: { value: Decision; reason: string }
  carriedOver?: Record<string, unknown>; [key: string]: unknown }
export type ExperimentVersion = { id: number; experimentId: number; version: number; lifecycle: Lifecycle; payload: ExperimentPayload; createdAt: string }
export type ExperimentView = { experiment: { id: number; choiceId: number; currentVersion: number }; current: ExperimentVersion; basis: Basis; versions: ExperimentVersion[]; nextAfter: number | null; humanReview: Record<string, unknown> }
export type ExperimentProposal = { proposal: Record<string, unknown>; token: string }
export type PlanProposal = { proposal: Record<string, unknown>; token: string }
export type PlanSelection = { actionKey: string; chosenDate: string; estimatedMinutes: number; resourceRefs: string[]; declaredCost?: { status?: string; amount?: number; currency?: string } }
export type Money = { amount: number; currency: string }

// Cada cambio de una versión del experimento (el servidor valida la forma exacta y la transición).
export type ExperimentChange =
  | { action: 'start' } | { action: 'rebase' }
  | { action: 'submit'; sample?: string | null; evidenceRefs?: EvidenceRef[]; assistance: Assistance }
  | { action: 'reflect'; observation: string; interpretation: string }
  | { action: 'decide'; decision: Decision; reason: string }
  | { action: 'adopt' | 'discard'; part: 'submission' | 'reflection' | 'decision' }
export type ReviewRequest =
  | { action: 'request'; submissionVersion: number; evidenceRefs: EvidenceRef[]; includeSample: boolean }
  | { action: 'withdraw'; reviewId: number }
export type PlanChange =
  | { action: 'accept'; proposal: Record<string, unknown>; token: string; selections: PlanSelection[] }
  | { action: 'pause'; planId: number }
  | { action: 'complete'; planId: number; actionKey: string; completionEvidence: string }
export type ReminderChange =
  | { action: 'accept'; planVersionId: number; actionKey: string; localDateTime: string; timeZone: string; accepted: true }
  | { action: 'cancel' | 'acknowledge'; reminderId: number }

async function call({ baseUrl, token, signal, fetcher = fetch, timeoutMs = 20000 }: Opts, path: string, method: 'GET' | 'POST' | 'PUT', body?: unknown): Promise<unknown> {
  if (!token) throw new CareerApiError('expired', 401, '')
  const timeout = AbortSignal.timeout(timeoutMs)
  let response: Response
  try {
    response = await fetcher(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method, cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw error // la pantalla canceló: no es un fallo
    throw new CareerApiError('network', 0, '')
  }
  // ES-237 E307-1: un 2xx cuyo cuerpo está vacío, se corta, no es JSON (p. ej. HTML de un proxy) o no es un objeto NO es un éxito: no se sabe si el servidor guardó → resultado incierto.
  let value: unknown = null, readable = true
  try { const text = await response.text(); value = text ? JSON.parse(text) : null } catch (error) {
    if (signal?.aborted) throw error // E336-1: la pantalla canceló a mitad del cuerpo: es una cancelación (AbortError), no un servidor caído
    readable = false
  }
  if (!response.ok) throw new CareerApiError(kindOf(response.status), response.status, value && typeof value === 'object' && 'code' in value && typeof value.code === 'string' ? value.code : '')
  if (!readable || value === null || typeof value !== 'object' || Array.isArray(value)) throw new CareerApiError('unavailable', response.status, '')
  return value
}
const after = (cursor?: number) => cursor ? `?after=${cursor}` : ''
// Las funciones con id son async: un id no válido es una promesa rechazada (no una excepción síncrona), igual que cualquier otro fallo.
const safeId = (value: number) => { if (!Number.isSafeInteger(value) || value < 1) throw new CareerApiError('invalid', 400, 'invalid_input'); return value }

// Experimentos ---------------------------------------------------------------------------------------------------------------------------
export const proposeExperiment = (o: Opts, input: { choiceId: number; taskIndex: number; minutes: 20 | 30 | 45 }) => call(o, '/api/experiments/proposals', 'POST', input) as Promise<ExperimentProposal>
export const createExperiment = (o: Opts, input: { requestId: string; proposal: Record<string, unknown>; token: string }) => call(o, '/api/experiments', 'POST', input) as Promise<{ experimentId: number; created: boolean }>
export const listExperiments = (o: Opts, cursor?: number) => call(o, `/api/experiments${after(cursor)}`, 'GET') as Promise<{ experiments: { id: number; choiceId: number; currentVersion: number; createdAt: string }[]; nextAfter: number | null }>
export const getExperiment = async (o: Opts, id: number, cursor?: number) => call(o, `/api/experiments/${safeId(id)}${after(cursor)}`, 'GET') as Promise<ExperimentView>
export const changeExperiment = async (o: Opts, id: number, input: { requestId: string; expectedVersion: number; change: ExperimentChange }) =>
  call(o, `/api/experiments/${safeId(id)}/versions`, 'POST', input) as Promise<{ version: ExperimentVersion; created: boolean }>
export const listReviews = async (o: Opts, id: number, cursor?: number) => call(o, `/api/experiments/${safeId(id)}/review-requests${after(cursor)}`, 'GET') as Promise<{ reviewRequests: unknown[]; nextAfter: number | null }>
export const requestReview = async (o: Opts, id: number, input: { requestId: string; expectedVersion: number } & ReviewRequest) =>
  call(o, `/api/experiments/${safeId(id)}/review-requests`, 'POST', input) as Promise<{ reviewRequest: { id: number; status: string }; created: boolean }>

// Plan -----------------------------------------------------------------------------------------------------------------------------------
export const proposePlan = (o: Opts, input: { experimentId: number; expectedVersion: number; budget?: Money | null }) => call(o, '/api/career-plan/proposals', 'POST', input) as Promise<PlanProposal>
export const savePlan = (o: Opts, input: { requestId: string; expectedVersion: number } & PlanChange) => call(o, '/api/career-plan/versions', 'POST', input) as Promise<{ plan: Record<string, unknown>; created: boolean }>
export const listPlans = (o: Opts, cursor?: number) => call(o, `/api/career-plan${after(cursor)}`, 'GET') as Promise<{ plans: unknown[]; nextAfter: number | null }>
export const getPlan = async (o: Opts, id: number) => call(o, `/api/career-plan/versions/${safeId(id)}`, 'GET') as Promise<{ plan: Record<string, unknown> }>
export const listReminders = (o: Opts, { history = false, cursor }: { history?: boolean; cursor?: number } = {}) =>
  call(o, `/api/career-plan/reminders${history ? '?history=true' : cursor ? `?after=${cursor}` : ''}`, 'GET') as Promise<{ reminders: unknown[]; nextAfter: number | null }>
export const saveReminder = (o: Opts, input: { requestId: string } & ReminderChange) => call(o, '/api/career-plan/reminders', 'POST', input) as Promise<{ reminder: Record<string, unknown>; created: boolean }>

// Rutas (ES-32) y catálogo (ES-31) --------------------------------------------------------------------------------------------------------
// Router `/api/routes`: restricciones con versión (`baseVersion`), rutas calculadas por el servidor, elecciones y pedido de revisión. Un experimento se crea desde una elección ACEPTADA (`choiceId`).
// `basisHash` es la base con que se calcularon las rutas: la elección debe enviarla tal cual y el servidor responde 409 `conflict` si cambió.
export type Modality = 'onsite' | 'hybrid' | 'remote'
export type RouteSlot = 'continuity' | 'adjacency' | 'exploration'
export type ConstraintsPayload = { targetMarkets: string[]; languages: string[]; modalities: Modality[]; acceptRegulated: 'yes' | 'no' | 'unknown'; originContextKey: string | null; interestContextKeys: string[]; preferredModalities: Modality[] }
export type ConstraintsRecord = { id: number; version: number; status: string; payload: ConstraintsPayload; createdAt: string }
/** Ruta propuesta por el motor: solo se tipan los campos que la pantalla usa; el resto llega tal cual (`[key: string]: unknown`). */
export type I18n = { es?: string; en?: string }
export type RouteProposal = { roleKey: string; slot: RouteSlot; labels: I18n; market: string; regulated: { isRegulated: boolean; status: string }; synthetic?: true
  tasks?: { text?: I18n; aiExposure?: { status: string } }[]
  sources: { sourceKey: string; title?: string; url?: string; stale?: boolean; synthetic?: true }[]
  dimensions?: { preferenceFit?: { status: string }; demonstratedTransfer?: { status: string }; viability?: { status: string } }
  [key: string]: unknown }
/** `needs_constraints` es el PRIMER estado de toda persona (E336-2): GET /api/routes lo devuelve mientras no haya restricciones guardadas (routes vacío y basisHash null). */
export type RoutesStatus = 'needs_constraints' | 'ok' | 'partial' | 'no_pertinent_catalog'
export type RoutesView = { status: RoutesStatus; routes: RouteProposal[]; constraintsVersion: number; basisHash: string | null; humanReview: { offered: boolean }; [key: string]: unknown }
export type ChoiceRecord = { id: number; roleKey: string; slot: RouteSlot; decision: 'accepted' | 'rejected'; catalogVersion: number | string; constraintsVersion: number; status: string; basisChanged: boolean; createdAt: string }
export type RouteReview = { id: number; status: string; note: string | null; createdAt: string }

export const getRouteCatalog = (o: Opts) => call(o, '/api/route-catalog', 'GET') as Promise<{ version: number | string; contexts: { contextKey: string; labels?: I18n; synthetic?: true; [key: string]: unknown }[]; roles: { roleKey: string; labels?: I18n; synthetic?: true; [key: string]: unknown }[]; [key: string]: unknown }>
export const getRoleProfile = (o: Opts, roleKey: string) => call(o, `/api/route-catalog/roles/${encodeURIComponent(roleKey)}`, 'GET') as Promise<{ version: number | string; role: Record<string, unknown>; [key: string]: unknown }>
export const getRoutes = (o: Opts) => call(o, '/api/routes', 'GET') as Promise<RoutesView>
export const getConstraints = (o: Opts) => call(o, '/api/routes/constraints', 'GET') as Promise<{ constraints: ConstraintsRecord | null }>
export const putConstraints = (o: Opts, input: { requestId: string; baseVersion: number; payload: ConstraintsPayload }) => call(o, '/api/routes/constraints', 'PUT', input) as Promise<{ constraints: ConstraintsRecord; created: boolean }>
export const listChoices = (o: Opts, cursor?: number) => call(o, `/api/routes/choices${after(cursor)}`, 'GET') as Promise<{ choices: ChoiceRecord[]; nextAfter: number | null }>
export const getChoice = async (o: Opts, id: number) => call(o, `/api/routes/choices/${safeId(id)}`, 'GET') as Promise<{ choice: ChoiceRecord }>
export const chooseRoute = (o: Opts, input: { requestId: string; roleKey: string; slot: RouteSlot; decision: 'accepted' | 'rejected'; basisHash: string }) => call(o, '/api/routes/choices', 'POST', input) as Promise<{ choice: ChoiceRecord; created: boolean }>
export const getRouteReview = (o: Opts) => call(o, '/api/routes/review-requests', 'GET') as Promise<{ reviewRequest: RouteReview | null }>
export const requestRouteReview = (o: Opts, input: { requestId: string; note?: string | null }) => call(o, '/api/routes/review-requests', 'POST', input) as Promise<{ reviewRequest: RouteReview; created: boolean }>
