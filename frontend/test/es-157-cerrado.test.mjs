// ES-157: el 503 not_accepting del límite global es un estado propio («closed»), distinto de un fallo del servidor; el envío queda inactivo y lo escrito se conserva.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { copy } from '../src/professional/copy.ts'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
// api.ts lee import.meta.env (solo existe en Vite): se carga una copia con ese valor fijado, sin tocar el código fuente.
const dir = mkdtempSync(join(tmpdir(), 'es157-'))
writeFileSync(join(dir, 'validation.ts'), read('../src/professional/validation.ts'))
writeFileSync(join(dir, 'api.ts'), read('../src/professional/api.ts').replace("import.meta.env.VITE_BACKEND_URL ?? ''", "''"))
const { submitApplication } = await import(pathToFileURL(join(dir, 'api.ts')).href)
const reply = (status, body) => async () => ({ status, json: async () => { if (body === undefined) throw new Error('sin cuerpo'); return body } })
const run = async (impl) => { const original = globalThis.fetch; globalThis.fetch = impl; try { return await submitApplication(new FormData()) } finally { globalThis.fetch = original } }

test('ES-157: 503 con code not_accepting = closed; cualquier otro 5xx o 503 sin ese código = server', async () => {
  assert.deepEqual(await run(reply(503, { code: 'not_accepting', error: 'x' })), { status: 'closed' })
  assert.deepEqual(await run(reply(503, { code: 'otro' })), { status: 'server' })
  assert.deepEqual(await run(reply(503, undefined)), { status: 'server' })
  assert.deepEqual(await run(reply(500, { code: 'not_accepting' })), { status: 'server' })
  assert.deepEqual(await run(reply(201, {})), { status: 'ok' })
  assert.deepEqual(await run(reply(429, {})), { status: 'rate_limited' })
  assert.deepEqual(await run(async () => { throw new Error('red') }), { status: 'network' })
})

test('ES-157: textos ES/EN del estado cerrado, sin promesas de plazo ni de empleo', () => {
  assert.match(copy.es.closed, /Por ahora no estamos recibiendo solicitudes/)
  assert.match(copy.en.closed, /not accepting applications right now/)
  for (const lang of ['es', 'en']) assert.ok(!/(\d+\s*(d[ií]as|days|horas|hours))|empleo|salario|job|salary|guarantee|garant/i.test(copy[lang].closed))
})

test('ES-157: la página muestra el aviso, inactiva el envío y lo rehabilita al editar sin borrar lo escrito', () => {
  const page = read('../src/professional/ProfessionalApplicationPage.tsx')
  assert.match(page, /result\.status === 'closed' \? 'closed'/)
  assert.match(page, /phase === 'closed' \? c\.closed/)
  assert.match(page, /disabled=\{phase === 'sending' \|\| phase === 'closed'\}/)
  // rehabilita al editar texto, archivo o consentimiento; solo el éxito limpia el formulario (lo escrito se conserva en el cierre)
  assert.equal((page.match(/reopen\(\)/g) || []).length, 3)
  assert.equal((page.match(/setValues\(EMPTY\)/g) || []).length, 1)
})
