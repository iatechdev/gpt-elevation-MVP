// ES-286: «El Puente» muestra un mensaje PROPIO cuando falta el permiso de la fuente al previsualizar (403 source_consent_required) y cuando se retiró mientras se confirmaba (403 source_consent_revoked),
// en lugar del genérico «No pudimos guardar». El cliente deja pasar esos códigos (antes los descartaba) y la pantalla los mapea. Textos ES/EN aprobados en ES-286.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { bridgeCopy } from '../src/bridge/copy.ts'

// api.ts importa './model' sin extensión: se transpila y se enlaza como en es-26-compass.
function url(file, replace = []) {
  let code = ts.transpileModule(readFileSync(new URL('../src/compass/' + file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
  for (const [a, b] of replace) code = code.replaceAll(a, b)
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
}
const modelUrl = url('model.ts')
const { compassApi, CompassError } = await import(url('api.ts', [["'./model'", JSON.stringify(modelUrl)]]))

const page = readFileSync(new URL('../src/bridge/BridgePage.tsx', import.meta.url), 'utf8')
const reply = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const FIELDS = [{ key: 'k', text: 'texto sintético', origin: { type: 'insight', id: 1 } }]

test('ES-286: el cliente conserva el código de los dos 403 de fuente (preview y confirm) y sigue descartando los desconocidos', async () => {
  for (const code of ['source_consent_required', 'source_consent_revoked']) {
    for (const call of [api => api.preview(FIELDS, 'es'), api => api.confirm({ fields: FIELDS, token: 't', requestId: 'r' })]) {
      const error = await call(compassApi('http://x', 'tok', reply(403, { code }))).then(() => null, e => e)
      assert.ok(error instanceof CompassError, code); assert.equal(error.status, 403); assert.equal(error.code, code)
    }
  }
  const unknown = await compassApi('http://x', 'tok', reply(403, { code: 'otro_codigo' })).preview(FIELDS, 'es').then(() => null, e => e)
  assert.equal(unknown.code, '', 'un código desconocido sigue sin pasar')
})

test('ES-286: la pantalla mapea cada código a su texto propio (distinto del genérico y del de «consent_required») en ES y EN', () => {
  assert.match(page, /source_consent_required: c\.sourceConsentRequired, source_consent_revoked: c\.sourceConsentRevoked/)
  for (const lang of ['es', 'en']) {
    const c = bridgeCopy[lang]
    for (const key of ['sourceConsentRequired', 'sourceConsentRevoked']) {
      assert.ok(c[key].length > 40, `${lang} ${key}`)
      for (const other of ['saveError', 'consent', 'notShareable', 'expired', 'conflict']) assert.notEqual(c[key], c[other], `${lang} ${key} ≠ ${other}`)
    }
    assert.notEqual(c.sourceConsentRequired, c.sourceConsentRevoked)
  }
})

test('ES-286: los textos dicen qué pasó y qué hacer, sin culpar ni prometer: «no se guardó nada» y la acción (autorizar la fuente o dejarla fuera)', () => {
  assert.match(bridgeCopy.es.sourceConsentRequired, /autoriza su análisis/); assert.match(bridgeCopy.es.sourceConsentRequired, /no se guardó nada/)
  assert.match(bridgeCopy.es.sourceConsentRevoked, /se retiró/); assert.match(bridgeCopy.es.sourceConsentRevoked, /no se guardó nada/); assert.match(bridgeCopy.es.sourceConsentRevoked, /Autorízala de nuevo|déjala fuera/)
  assert.match(bridgeCopy.en.sourceConsentRequired, /allow its analysis/); assert.match(bridgeCopy.en.sourceConsentRequired, /nothing was saved/)
  assert.match(bridgeCopy.en.sourceConsentRevoked, /withdrawn/); assert.match(bridgeCopy.en.sourceConsentRevoked, /nothing was saved/); assert.match(bridgeCopy.en.sourceConsentRevoked, /Allow it again|leave it out/)
  for (const lang of ['es', 'en']) for (const key of ['sourceConsentRequired', 'sourceConsentRevoked']) assert.doesNotMatch(bridgeCopy[lang][key], /culpa|tu error|fault|your mistake|garant|guarantee/i)
})

test('F404-1: tras source_consent_required / source_consent_revoked se relee el permiso de las fuentes (sin esperar a cambiar de pestaña)', () => {
  const page = readFileSync(new URL('../src/bridge/BridgePage.tsx', import.meta.url), 'utf8'), panel = readFileSync(new URL('../src/bridge/SourcesPanel.tsx', import.meta.url), 'utf8')
  assert.ok(page.includes("if (error.code === 'source_consent_required' || error.code === 'source_consent_revoked') setSyncKey(key => key + 1)"))
  assert.ok(page.includes('syncKey={syncKey}'))
  assert.ok(panel.includes('const check = async (force: boolean) =>'))
  assert.ok(panel.includes('if ((!force && document.visibilityState !== \'visible\') || !permsRef.current) return'))
  assert.ok(panel.includes('useEffect(() => { if (syncKey > 0) void syncNow.current() }, [syncKey])'))
  assert.ok(panel.includes('const refresh = () => { void check(false) }') && panel.includes("document.addEventListener('visibilitychange', refresh)"), 'volver a la pestaña sigue releyendo')
})
