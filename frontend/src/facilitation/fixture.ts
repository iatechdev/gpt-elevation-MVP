// Synthetic view model only. No transport, account information, or production permission contract.
import { LIMITS, textProblem } from './validation.ts'
export type Invitation = 'pending' | 'accepted' | 'expired'
export type Progress = 'unknown' | 'context' | 'choice' | 'submitted' | 'plan'
export type Scenario = 'normal' | 'empty' | 'load-error' | 'save-error' | 'lost-ack' | 'conflict' | 'revoked'
export type Material = { id: string; version: number; active: boolean; evidenceRefs: string[] }
export type Participant = { id: string; alias: string; invitation: Invitation; progress: Progress; issue: boolean; materials: Material[] }
export type ReviewEvent = { id: string; type: 'objection' | 'response'; reviewId: string; objectionId?: string; text: string; locale: 'es' | 'en'; author: 'participant' | 'reviewer'; at: string }
export type Review = { id: string; participantId: string; shareId: string; materialVersion: number; evidenceRefs: string[]; observation: string; limits: string; locale: 'es' | 'en'; author: 'reviewer'; at: string; version: number }
export type Snapshot = { revision: number; participants: Participant[]; reviews: Review[]; events: ReviewEvent[] }
export type Command =
  | { kind: 'review'; participantId: string; shareId: string; materialVersion: number; evidenceRefs: string[]; observation: string; limits: string; locale: 'es' | 'en' }
  | { kind: 'objection'; reviewId: string; reason: string; locale: 'es' | 'en' }
  | { kind: 'response'; reviewId: string; objectionId: string; response: string; locale: 'es' | 'en' }
  | { kind: 'invitation'; participantId: string }
export class PreviewError extends Error {
  code: 'save-error' | 'conflict' | 'revoked' | 'invalid' | 'load-error'
  constructor(code: PreviewError['code']) { super(code); this.code = code }
}
export const enabled = (flag: unknown) => flag === 'true'
export const scenarioOf = (value: unknown): Scenario => ['empty', 'load-error', 'save-error', 'lost-ack', 'conflict', 'revoked'].includes(String(value)) ? value as Scenario : 'normal'
const clone = <T,>(value: T): T => structuredClone(value)
const initial = (): Snapshot => ({
  revision: 0, participants: ['A', 'B', 'C', 'D', 'E', 'F'].map((alias, index) => ({
    id: 'synthetic-' + alias, alias, invitation: (['accepted', 'accepted', 'accepted', 'pending', 'expired', 'accepted'] as Invitation[])[index],
    progress: (['submitted', 'plan', 'choice', 'unknown', 'unknown', 'context'] as Progress[])[index],
    issue: index === 1,
    materials: index < 3 ? [{ id: 'synthetic-share-' + alias, version: 1, active: index < 2, evidenceRefs: ['synthetic-evidence-' + alias] }] : [],
  })), reviews: [], events: [],
})
export function createFixture(scenario: Scenario = 'normal', now = () => new Date().toISOString()) {
  const durable = initial()
  if (scenario === 'empty') durable.participants = []
  if (scenario === 'revoked') durable.participants = []
  let snapshot = clone(durable)
  const requests = new Map<string, { body: string; result: string }>()
  let failed = false
  let readFailed = false
  const material = (personId: string, shareId: string) => {
    const person = durable.participants.find(p => p.id === personId)
    const row = person?.materials.find(m => m.id === shareId && m.active)
    if (!person || !row) throw new PreviewError('revoked')
    return row
  }
  const review = (id: string) => {
    const row = durable.reviews.find(r => r.id === id)
    if (!row) throw new PreviewError('revoked')
    return row
  }
  const validText = (s: string, max: number) => textProblem(s, max) === null
  const publish = () => { snapshot = clone(durable); return clone(snapshot) }
  return {
    read() {
      if (scenario === 'revoked') throw new PreviewError('revoked')
      if (scenario === 'load-error' && !readFailed) { readFailed = true; throw new PreviewError('load-error') }
      return publish()
    },
    // All public data are copies; callers cannot mutate the durable simulated store.
    current: () => clone(snapshot),
    apply(requestId: string, command: Command, expectedRevision: number, actor: 'reviewer' | 'participant') {
      if (!/^[a-zA-Z0-9_-]{8,64}$/.test(requestId)) throw new PreviewError('invalid')
      const body = JSON.stringify({ command, expectedRevision, actor })
      const replay = requests.get(requestId)
      if (replay) {
        if (replay.body !== body) throw new PreviewError('conflict')
        if (command.kind === 'review') {
          if (material(command.participantId, command.shareId).version !== command.materialVersion) throw new PreviewError('conflict')
        } else if (command.kind === 'response') {
          const r = review(command.reviewId)
          if (material(r.participantId, r.shareId).version !== r.materialVersion) throw new PreviewError('conflict')
        }
        publish()
        return replay.result
      }
      if (scenario === 'save-error' && !failed) { failed = true; throw new PreviewError('save-error') }
      if (scenario === 'conflict' && !failed) {
        failed = true
        for (const p of durable.participants) for (const m of p.materials) m.version++
        durable.revision++
        throw new PreviewError('conflict')
      }
      if (expectedRevision !== durable.revision) throw new PreviewError('conflict')
      let result: string
      if (command.kind === 'review') {
        if (actor !== 'reviewer') throw new PreviewError('revoked')
        const m = material(command.participantId, command.shareId)
        if (m.version !== command.materialVersion) throw new PreviewError('conflict')
        if (!validText(command.observation, LIMITS.observation) || !validText(command.limits, LIMITS.limits) ||
          !['es', 'en'].includes(command.locale) || !command.evidenceRefs.length ||
          new Set(command.evidenceRefs).size !== command.evidenceRefs.length ||
          command.evidenceRefs.some(ref => !m.evidenceRefs.includes(ref))) throw new PreviewError('invalid')
        result = 'synthetic-review-' + (durable.reviews.length + 1)
        durable.reviews.push({ ...clone(command), id: result, at: now(), version: 1, author: 'reviewer' })
      } else if (command.kind === 'invitation') {
        if (actor !== 'reviewer') throw new PreviewError('revoked')
        const person = durable.participants.find(p => p.id === command.participantId)
        if (!person || person.invitation === 'accepted') throw new PreviewError('revoked')
        person.invitation = 'pending'
        result = 'synthetic-invitation-' + person.alias
      } else {
        const r = review(command.reviewId)
        if (command.kind === 'objection') {
          if (actor !== 'participant' || r.participantId !== 'synthetic-A') throw new PreviewError('revoked')
          if (!validText(command.reason, LIMITS.reason) || !['es', 'en'].includes(command.locale)) throw new PreviewError('invalid')
          result = 'synthetic-event-' + (durable.events.length + 1)
          durable.events.push({ id: result, reviewId: r.id, type: 'objection', text: command.reason, author: 'participant', locale: command.locale, at: now() })
        } else {
          if (actor !== 'reviewer') throw new PreviewError('revoked')
          if (material(r.participantId, r.shareId).version !== r.materialVersion) throw new PreviewError('conflict')
          const objection = durable.events.find(e => e.id === command.objectionId && e.reviewId === r.id && e.type === 'objection')
          if (!objection || durable.events.some(e => e.type === 'response' && e.objectionId === objection.id) ||
            !validText(command.response, LIMITS.response) || !['es', 'en'].includes(command.locale)) throw new PreviewError('invalid')
          result = 'synthetic-event-' + (durable.events.length + 1)
          durable.events.push({ id: result, reviewId: r.id, objectionId: objection.id, type: 'response', text: command.response, author: 'reviewer', locale: command.locale, at: now() })
        }
      }
      durable.revision++
      requests.set(requestId, { body, result })
      if (scenario === 'lost-ack' && !failed) { failed = true; throw new PreviewError('save-error') }
      publish()
      return result
    },
    revoke(personId: string) {
      durable.participants = durable.participants.filter(p => p.id !== personId)
      durable.revision++
      publish()
    },
  }
}
export type Fixture = ReturnType<typeof createFixture>
