// ES-316: el arranque de /app/* pide la sesión, la compuerta, el catálogo de textos y el marco en paralelo (antes: bloque → commit de React → /api/session).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('ES-316: sin token no se pide nada; con token se pide /api/session con Authorization y sin token en la URL', () => {
  const hook = read('../src/shell/useVerifiedSession.ts')
  const start = hook.slice(hook.indexOf('export function startEarlySession'), hook.indexOf('function takeEarlySession'))
  assert.ok(start.includes('const token = readStoredToken()') && start.includes('if (token) early = { token, baseUrl, promise: readVerifiedSession({ baseUrl, token }), at: Date.now() }'), 'solo con token')
  const session = read('../src/access/session.ts')
  assert.ok(session.includes('fetch(`${baseUrl}/api/session`') && session.includes('headers: { Authorization: `Bearer ${token}` }'), 'el token va en la cabecera, no en la URL')
})

test('ES-316: el gancho consume la petición temprana una sola vez, solo con el mismo token y base y hasta 10 s después; la verificación sigue siendo del servidor', () => {
  const hook = read('../src/shell/useVerifiedSession.ts')
  assert.match(hook, /takeEarlySession\(baseUrl, token\) \?\? readVerifiedSession\(\{ baseUrl, token, signal: controller\.signal \}\)/)
  assert.match(hook, /taken\.token === token && taken\.baseUrl === baseUrl && Date\.now\(\) - taken\.at < 10000/)
  assert.match(hook, /const taken = early; early = null/)
})

test('ES-316: el arranque de /app/* inicia marco, pantalla, compuerta, sesión y catálogo de textos', () => {
  const app = read('../src/App.tsx')
  assert.match(app, /void loadPersonLayout\(\); void PERSON_PRELOAD\[window\.location\.pathname\]\?\.\(\); void import\('\.\/shell\/GateScreens'\); startEarlySession\(\); void loadCatalog\(resolveInitialLang\(readSavedLang\(\), navigator\.language\)\)/)
})
