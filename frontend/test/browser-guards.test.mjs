// ES-292 (E271-1) · Guardas de los scripts de navegador: (a) una comprobación fallida termina con código ≠ 0 aunque la limpieza llame a process.exit(0);
// (b) la huella de build falla con servidor viejo / SPA que contesta HTML / otro sha / sin servidor y NO imprime el HTML; (c) todos los scripts con PostgreSQL embebido usan el gancho.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const scripts = fileURLToPath(new URL('../scripts/', import.meta.url))
const hook = join(scripts, '_exitOnFailure.cjs')
const run = (source) => { const dir = mkdtempSync(join(tmpdir(), 'es292-')); const file = join(dir, 'probe.cjs'); writeFileSync(file, source); return spawnSync(process.execPath, [file], { encoding: 'utf8' }) }

test('E271-1: con el gancho, un fallo sale con 1 aunque el finally llame a process.exit(0) (el patrón que pisaba el código)', () => {
  const broken = `try { throw new Error('x') } catch { process.exitCode = 1 } finally { process.exit(0) }`
  assert.equal(run(broken).status, 0, 'control: el patrón antiguo salía con 0')
  const fixed = `const { fail } = require(${JSON.stringify(hook)}); try { throw new Error('x') } catch { fail() } finally { process.exit(0) }`
  assert.equal(run(fixed).status, 1)
  assert.equal(run(`const { fail } = require(${JSON.stringify(hook)}); try { throw new Error('x') } catch { fail() }`).status, 1, 'sin process.exit también')
  assert.equal(run(`require(${JSON.stringify(hook)}); process.exit(0)`).status, 0, 'sin fallo, 0')
  assert.equal(run(`require(${JSON.stringify(hook)}); console.log('ok')`).status, 0)
})

test('E271-1: todo script con PostgreSQL embebido que marca fallo usa el gancho (o sale con process.exit(1) explícito, como es26/es28/es31); ninguno deja el `process.exitCode = 1` suelto', () => {
  const embedded = readdirSync(scripts).filter((f) => f.endsWith('.cjs') && /\.stop\(\)/.test(readFileSync(join(scripts, f), 'utf8')))
  assert.ok(embedded.length >= 15, 'scripts con PG embebido: ' + embedded.length)
  let hooked = 0
  for (const f of embedded) {
    const s = readFileSync(join(scripts, f), 'utf8'); assert.doesNotMatch(s, /process\.exitCode = 1;/, f + ': exitCode suelto (lo pisa el cierre)')
    const hook = /require\('\.\/_exitOnFailure\.cjs'\)\.fail\(\)/.test(s); const explicit = /process\.exit\(1\)/.test(s)
    assert.ok(hook || explicit, f + ': sin forma segura de fallar'); if (hook) hooked++
  }
  assert.ok(hooked >= 12, 'con gancho: ' + hooked)
})

const serve = (handler) => new Promise((resolve) => { const server = http.createServer(handler); server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}` })) })
async function check(url, expected) {
  const guard = require(join(scripts, '_buildSha.cjs')); const lines = []; const log = console.log; console.log = (...a) => lines.push(a.join(' '))
  const old = process.env.EXPECT_SHA; process.env.EXPECT_SHA = expected
  try { await guard(url, assert); return { ok: true, lines } } catch (error) { return { ok: false, lines, message: String(error.message) } } finally { console.log = log; if (old === undefined) delete process.env.EXPECT_SHA; else process.env.EXPECT_SHA = old }
}
const SHA = 'a'.repeat(40)

test('E271-1: la huella pasa con el sha correcto y FALLA con otro sha, con un servidor que contesta HTML (SPA vieja, sin imprimirlo) y sin servidor', async () => {
  const good = await serve((req, res) => { res.end(req.url === '/BUILD_SHA' ? SHA + '\n' : 'x') }); const html = await serve((req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><html><head>' + 'Z'.repeat(5000) + '</head></html>') })
  try {
    assert.equal((await check(good.url, SHA)).ok, true)
    const other = await check(good.url, 'b'.repeat(40)); assert.equal(other.ok, false); assert.match(other.message, /OTRO build/)
    const spa = await check(html.url, SHA); assert.equal(spa.ok, false); assert.match(spa.message, /no trae BUILD_SHA/)
    const printed = spa.lines.join('\n'); assert.ok(printed.length < 200, 'no imprime el HTML entero (' + printed.length + ' caracteres)'); assert.match(printed, /no es un sha/); assert.ok(!printed.includes('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ'.slice(0, 41)))
  } finally { good.server.close(); html.server.close() }
  const down = await check('http://127.0.0.1:9', SHA); assert.equal(down.ok, false); assert.match(down.lines.join('\n'), /\(ausente\)/)
})

test('ES-292: `npm run build:sha` existe y escribe dist/BUILD_SHA desde git (no a mano)', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')); assert.match(pkg.scripts['build:sha'], /vite build && node scripts\/write-build-sha\.cjs/)
  assert.match(readFileSync(join(scripts, 'write-build-sha.cjs'), 'utf8'), /git.*rev-parse.*HEAD/s)
})
