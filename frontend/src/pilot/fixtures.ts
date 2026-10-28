import type { Feedback, Intent, Metrics } from './model'
import { parseMetrics, validAnswers } from './model.ts'
export type Scenario = 'normal' | 'load-error' | 'save-error' | 'lost-ack' | 'conflict' | 'unconfigured' | 'metrics-error'
export function scenario(value: unknown): Scenario { return ['load-error', 'save-error', 'lost-ack', 'conflict', 'unconfigured', 'metrics-error'].includes(String(value)) ? value as Scenario : 'normal' }
export class FixtureError extends Error {
  code: 'load' | 'save' | 'unknown' | 'conflict' | 'mismatch' | 'unconfigured'
  constructor(code: FixtureError['code']) { super(code); this.code = code }
}
// Deliberately no fetch, token/owner parameters, storage or backend fallback.
export function createFixtureRepository(mode: Scenario = 'normal') {
  let row: Feedback = { synthetic: true, version: 0, questionnaireVersion: 1, window: 'day7', permission: mode === 'unconfigured' ? 'not_configured' : 'fixture_only', answers: null, lastRequestId: null }
  const replays = new Map<string, { input: string; result: Feedback }>(); let injected = false
  return {
    async read(): Promise<Feedback> { if (mode === 'load-error') throw new FixtureError('load'); return structuredClone(row) },
    async save(intent: Intent): Promise<Feedback> {
      if (row.permission !== 'fixture_only') throw new FixtureError('unconfigured')
      if (!validAnswers(intent.answers)) throw new FixtureError('save')
      const input = JSON.stringify(intent); const previous = replays.get(intent.requestId)
      if (previous) { if (previous.input !== input) throw new FixtureError('mismatch'); return structuredClone(previous.result) }
      if (mode === 'save-error') throw new FixtureError('save')
      if (mode === 'conflict' && !injected) { injected = true; row = { ...row, version: row.version + 1 }; throw new FixtureError('conflict') }
      if (row.version !== intent.baseVersion) throw new FixtureError('conflict')
      row = { ...row, version: row.version + 1, answers: structuredClone(intent.answers), lastRequestId: intent.requestId }
      replays.set(intent.requestId, { input, result: structuredClone(row) })
      if (mode === 'lost-ack' && !injected) { injected = true; throw new FixtureError('unknown') }
      return structuredClone(row)
    },
    async withdraw(version: number): Promise<Feedback> {
      if (row.permission !== 'fixture_only') throw new FixtureError('unconfigured')
      if (version !== row.version) throw new FixtureError('conflict')
      row = { ...row, version: row.version + 1, answers: null, lastRequestId: null }; return structuredClone(row)
    },
    async metrics(): Promise<Metrics> {
      if (mode === 'metrics-error') throw new FixtureError('load')
      return parseMetrics({ synthetic: true, metrics: [{ key: 'activation', status: mode === 'unconfigured' ? 'not_configured' : 'suppressed' }, { key: 'experiment', status: 'not_available' }, { key: 'listening', status: 'suppressed' }, { key: 'utility', status: 'in_progress' }] })
    },
  }
}
export type FixtureRepository = ReturnType<typeof createFixtureRepository>
