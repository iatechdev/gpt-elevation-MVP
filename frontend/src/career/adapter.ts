// ES-237 (paso 2b): del modelo del SERVIDOR (versiones inmutables, basisHash, elecciones) al modelo de PANTALLA (`State` del simulador). Funciones puras: sin red, sin almacenamiento, sin reloj.
// Regla de honestidad: no se inventa nada. Lo que el servidor no trae queda vacío o desconocido; «sintético» solo si el servidor lo marca (`synthetic: true`).
import type { ChoiceRecord, ConstraintsRecord, ExperimentView, I18n, RouteProposal, RoutesView } from './api.ts'
import type { Assistance, CatalogContext, Carried, Constraints, Decision, Experiment, Preference, Reason, Route, Slot, State } from './fixture.ts'

export type CatalogView = { contexts: { contextKey: string; labels?: I18n; synthetic?: true }[]; roles: { roleKey: string; labels?: I18n; synthetic?: true }[] }
export type Raw = { catalog: CatalogView | null; constraints: ConstraintsRecord | null; routes: RoutesView | null; choices: ChoiceRecord[]; experiments: ExperimentView[]; routeReviewOpen: boolean; catalogUnavailable: boolean }

const text = (value: I18n | undefined, fallback: string) => ({ es: value?.es ?? value?.en ?? fallback, en: value?.en ?? value?.es ?? fallback })
const REASONS: Record<string, Reason> = { route_choice_changed: 'route_choice_changed', rules_changed: 'rules_changed', context_changed: 'context_changed', route_evidence_changed: 'route_evidence_changed', cited_evidence_changed: 'cited_evidence_changed' }
const PREFERENCE: Record<string, Preference> = { matches: 'matches', partial: 'partialMatch', outside_interests: 'outside', unknown: 'unknown' }

export const emptyState = (): State => ({ source: 'api', loaded: false, constraints: { markets: [], languages: [], arrangements: [], regulated: 'unknown', origin: '', interests: [], preferred: [] }, basis: 0, choices: [], experiments: [], plans: [], requested: false, notifications: false, grant: 0, reminders: [], basisLog: [] })

export function contextsOf(catalog: CatalogView | null): CatalogContext[] {
  return (catalog?.contexts ?? []).map(c => ({ key: c.contextKey, label: text(c.labels, c.contextKey), synthetic: c.synthetic === true }))
}
export function constraintsOf(record: ConstraintsRecord | null): Constraints {
  if (!record) return emptyState().constraints
  const p = record.payload
  return { markets: [...p.targetMarkets], languages: [...p.languages], arrangements: [...p.modalities], regulated: p.acceptRegulated, origin: p.originContextKey ?? '', interests: [...p.interestContextKeys], preferred: [...p.preferredModalities] }
}
/** Ruta del servidor → ruta de pantalla. El chip «sintética» exige `synthetic: true` en la ruta o en alguna de sus fuentes. */
export function routeOf(route: RouteProposal): Route {
  const sources = (route.sources ?? []).map(s => ({ title: s.title ?? s.sourceKey, url: typeof s.url === 'string' ? s.url : '', stale: s.stale === true, synthetic: s.synthetic === true }))
  const transfer = route.dimensions?.demonstratedTransfer?.status
  return { id: route.roleKey, roleKey: route.roleKey, title: text(route.labels, route.roleKey), context: '', market: route.market, supported: transfer === 'strong' || transfer === 'partial', regulated: route.regulated?.isRegulated === true,
    stale: sources.some(s => s.stale), slot: route.slot, synthetic: route.synthetic === true || sources.some(s => s.synthetic), preference: PREFERENCE[route.dimensions?.preferenceFit?.status ?? 'unknown'] ?? 'unknown',
    tasks: (route.tasks ?? []).map(task => text(task.text, '')).filter(task => task.es || task.en), sources }
}
const stub = (roleKey: string, slot: Slot, catalog: CatalogView | null): Route => {
  const role = catalog?.roles.find(r => r.roleKey === roleKey)
  return { id: roleKey, roleKey, title: text(role?.labels, roleKey), context: '', market: '', supported: false, regulated: false, stale: false, slot, synthetic: role?.synthetic === true }
}

function carriedOf(raw: Record<string, unknown> | undefined): Carried | undefined {
  if (!raw) return undefined
  const out: Carried = {}
  const s = raw.submission as { fromVersion: number; sample: string | null; assistance: Assistance; evidenceRefs?: unknown[]; retiredEvidence?: number } | undefined
  if (s) out.submission = { from: s.fromVersion, sample: s.sample ?? '', assistance: s.assistance, evidence: (s.evidenceRefs?.length ?? 0) > 0, retired: s.retiredEvidence ?? 0 }
  const r = raw.reflection as { fromVersion: number; observation: string; interpretation: string } | undefined
  if (r) out.reflection = { from: r.fromVersion, observation: r.observation, interpretation: r.interpretation }
  const d = raw.decision as { fromVersion: number; value: Decision; reason: string } | undefined
  if (d) out.decision = { from: d.fromVersion, decision: d.value, reason: d.reason }
  return Object.keys(out).length ? out : undefined
}

/** Un experimento del servidor. `basis` de pantalla: la base actual si el servidor dice «current»; -1 (nunca igual a la vigente) si «needs_review». */
export function experimentOf(view: ExperimentView, basis: number, route: Route): Experiment {
  const current = view.basis.status === 'current', payload = view.current.payload, mark = (isCurrentVersion: boolean) => current && isCurrentVersion ? basis : -1
  const pending = (view.humanReview as { requests?: { id: number; status: string; needsReview: boolean }[] }).requests?.find(r => r.status === 'pending_authorization' && !r.needsReview)
  const task = (payload as { task?: { text?: I18n } }).task?.text
  return { id: view.experiment.id, route, version: view.current.version, basis: mark(true), phase: payload.lifecycle, minutes: payload.minutes,
    sample: payload.submission?.sample ?? '', evidence: (payload.submission?.evidenceRefs.length ?? 0) > 0, assistance: payload.submission?.assistance.degree ?? '',
    observation: payload.reflection?.observation ?? '', interpretation: payload.reflection?.interpretation ?? '', decision: payload.decision?.value ?? '', reason: payload.decision?.reason ?? '',
    review: Boolean(pending), ...(pending ? { reviewId: pending.id } : {}), ...(task ? { task: text(task, '') } : {}),
    reasons: view.basis.reasons.map(reason => REASONS[reason]).filter((reason): reason is Reason => Boolean(reason)),
    ...(carriedOf(payload.carriedOver) ? { carried: carriedOf(payload.carriedOver) } : {}),
    versions: view.versions.map(v => ({ version: v.version, phase: v.payload.lifecycle, basis: mark(v.version === view.current.version), sample: v.payload.submission?.sample ?? '', observation: v.payload.reflection?.observation ?? '', interpretation: v.payload.reflection?.interpretation ?? '', reason: v.payload.decision?.reason ?? '' })) }
}

/** Todo lo leído del servidor → el estado que dibujan las pantallas. */
export function adapt(raw: Raw): State {
  const basis = raw.constraints?.version ?? 0, routes = (raw.routes?.routes ?? []).map(routeOf)
  const routeFor = (roleKey: string, slot: Slot) => routes.find(r => r.roleKey === roleKey && r.slot === slot) ?? stub(roleKey, slot, raw.catalog)
  const byChoice = new Map(raw.choices.map(choice => [choice.id, choice]))
  return { ...emptyState(), loaded: true, constraints: constraintsOf(raw.constraints), basis, contexts: contextsOf(raw.catalog), catalogUnavailable: raw.catalogUnavailable, routes, routesStatus: raw.routes?.status ?? 'needs_constraints', requested: raw.routeReviewOpen,
    choices: raw.choices.map(choice => ({ id: choice.id, route: routeFor(choice.roleKey, choice.slot), decision: choice.decision === 'accepted' ? 'chosen' as const : 'rejected' as const, basis: choice.basisChanged ? -1 : basis, version: choice.constraintsVersion })),
    experiments: raw.experiments.map(view => { const choice = byChoice.get(view.experiment.choiceId); return experimentOf(view, basis, choice ? routeFor(choice.roleKey, choice.slot) : stub(view.current.payload.roleKey, 'continuity', raw.catalog)) }) }
}
