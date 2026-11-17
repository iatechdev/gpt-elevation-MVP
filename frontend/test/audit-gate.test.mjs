// Puerta de auditoría de dependencias (scripts/audit-gate.cjs): GHSA permitida antes de su fecha = pasa; después = falla; cualquier otro aviso alto/crítico = falla; informe ilegible = falla.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { evaluate, EXCEPTIONS } = require('../scripts/audit-gate.cjs')
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

const advisory = (id, severity = 'high', name = 'picomatch') => ({ source: 1, name, dependency: name, title: `aviso de ${name}`, url: `https://github.com/advisories/${id}`, severity, range: '<=1' })
// Forma real de `npm audit --omit=dev --json` del 17-nov-2026 (picomatch → fdir/tinyglobby → vite).
const real = (extra = {}) => ({
  auditReportVersion: 2,
  vulnerabilities: {
    fdir: { name: 'fdir', severity: 'high', via: ['picomatch'] },
    picomatch: { name: 'picomatch', severity: 'high', via: [advisory('GHSA-fc5q-39xc-vjpf')] },
    tinyglobby: { name: 'tinyglobby', severity: 'high', via: ['fdir', 'picomatch'] },
    vite: { name: 'vite', severity: 'high', via: ['picomatch', 'tinyglobby'] },
    ...extra,
  },
})

test('audit-gate: la única excepción es GHSA-fc5q-39xc-vjpf y caduca el 2026-12-01', () => {
  assert.deepEqual(EXCEPTIONS.map(({ id, until }) => [id, until]), [['GHSA-fc5q-39xc-vjpf', '2026-12-01']])
  assert.ok(EXCEPTIONS[0].reason.length > 80, 'lleva el motivo escrito')
})

test('audit-gate: la GHSA permitida PASA antes de la fecha (incluido el último día) y FALLA después', () => {
  for (const day of ['2026-11-17T10:00:00Z', '2026-12-01T00:00:00Z', '2026-12-01T23:59:59Z']) {
    const result = evaluate(real(), new Date(day)); assert.equal(result.ok, true, day); assert.equal(result.allowed.length, 1); assert.deepEqual(result.blocked, [])
  }
  for (const day of ['2026-12-02T00:00:00Z', '2027-01-15T00:00:00Z']) {
    const result = evaluate(real(), new Date(day)); assert.equal(result.ok, false, day); assert.equal(result.expired.length, 1); assert.match(result.expired[0], /caducó el 2026-12-01/)
  }
})

test('audit-gate: cualquier OTRO aviso alto o crítico falla, aunque el permitido siga vigente', () => {
  const now = new Date('2026-11-17T00:00:00Z')
  for (const severity of ['high', 'critical']) {
    const result = evaluate(real({ lodash: { name: 'lodash', severity, via: [advisory('GHSA-aaaa-bbbb-cccc', severity, 'lodash')] } }), now)
    assert.equal(result.ok, false, severity); assert.equal(result.blocked.length, 1); assert.match(result.blocked[0], /GHSA-aaaa-bbbb-cccc.*sin excepción/)
    assert.equal(result.allowed.length, 1, 'el permitido se sigue informando')
  }
  // Un paquete que arrastra OTRO aviso por la cadena también falla.
  const chained = evaluate(real({ vite: { name: 'vite', severity: 'critical', via: ['picomatch', 'otro'] }, otro: { name: 'otro', severity: 'critical', via: [advisory('GHSA-zzzz-yyyy-xxxx', 'critical', 'otro')] } }), now)
  assert.equal(chained.ok, false); assert.match(chained.blocked.join('\n'), /GHSA-zzzz-yyyy-xxxx/)
})

test('audit-gate: moderadas y bajas no bloquean; sin avisos pasa; origen desconocido o informe ilegible falla', () => {
  const now = new Date('2026-11-17T00:00:00Z')
  assert.equal(evaluate({ vulnerabilities: { x: { name: 'x', severity: 'moderate', via: [advisory('GHSA-mmmm-nnnn-oooo', 'moderate', 'x')] }, y: { name: 'y', severity: 'low', via: [] } } }, now).ok, true)
  assert.equal(evaluate({ auditReportVersion: 2, vulnerabilities: {} }, now).ok, true)
  assert.equal(evaluate({ vulnerabilities: { a: { name: 'a', severity: 'high', via: ['no-existe'] } } }, now).ok, false, 'cadena sin aviso raíz')
  assert.equal(evaluate({ vulnerabilities: { a: { name: 'a', severity: 'high', via: [] } } }, now).ok, false, 'alta sin origen explicable')
  for (const bad of [null, undefined, 'x', [], {}, { vulnerabilities: null }, { vulnerabilities: 5 }]) assert.equal(evaluate(bad, now).ok, false, JSON.stringify(bad))
})

test('audit-gate: la excepción es por identificador del aviso, no por paquete (otro aviso de picomatch falla)', () => {
  const result = evaluate({ vulnerabilities: { picomatch: { name: 'picomatch', severity: 'high', via: [advisory('GHSA-nuev-oooo-avis')] } } }, new Date('2026-11-17T00:00:00Z'))
  assert.equal(result.ok, false); assert.match(result.blocked[0], /GHSA-nuev-oooo-avis/)
})

test('audit-gate: la CI del frontend usa la puerta (no el audit directo) y los textos de docs existen', () => {
  const ci = read('../../.github/workflows/ci.yml')
  const frontend = ci.slice(ci.indexOf('frontend:'), ci.indexOf('\n  backend:') > 0 ? ci.indexOf('\n  backend:') : undefined)
  assert.match(frontend, /node scripts\/audit-gate\.cjs/); assert.ok(!/npm audit --omit=dev --audit-level=high/.test(frontend), 'el job frontend ya no llama al audit sin excepciones')
  const docs = read('../../docs/AUDITORIA-DEPENDENCIAS.md')
  for (const text of ['GHSA-fc5q-39xc-vjpf', '2026-12-01', 'picomatch', 'audit-gate.cjs']) assert.ok(docs.includes(text), text)
})
