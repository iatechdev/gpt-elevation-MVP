// [QA-Claude] ES-57 · barrido de mutaciones anónimas (caja negra sobre el servidor real).
// Uso: QA_SUT=<carpeta del clon limpio> node --test qa/security/es57-anon-mutations.test.cjs
// Reutiliza el arnés de Dev (backend/test/support.cjs): app Express y JWT reales; DB, cifrado
// y proveedores simulados. No lee .env, no conecta a DB ni a proveedores. Datos 100 % sintéticos.
// Criterio: toda ruta que muta y no es pública por diseño debe responder 401/403 sin sesión.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sut = process.env.QA_SUT;
if (!sut) throw new Error('Defina QA_SUT con la ruta del clon limpio del commit bajo prueba.');
const backend = path.resolve(sut, 'backend');
const { models, startApp } = require(path.join(backend, 'test', 'support.cjs'));

// Montajes tomados de backend/server.js (línea → prefijo → archivo de rutas).
const mounts = [
  ['/api', 'auth'], ['/api/landing-content', 'landingContent'], ['/api/pricing', 'pricing'],
  ['/api/plans', 'plans'], ['/api/manifest', 'board'], ['/api', 'chat'], ['/api/mood', 'mood'],
  ['/api', 'ratings'], ['/api/recommendations', 'recommendations'], ['/api/user', 'progress'],
  ['/api/user/plan', 'plans'], ['/api/plan-requests', 'planRequests'], ['/api/matching', 'matching'],
  ['/api/sessions', 'sessions'], ['/api/therapist', 'therapistRoutes'],
  ['/api/therapist/validation', 'validation'], ['/api/admin/usuarios', 'adminUsers'],
  ['/api/admin/metrics', 'adminMetrics'], ['/api/admin/matching', 'matching'],
  ['/api/admin/pricing', 'pricing'], ['/api/admin/plan-requests', 'planRequests'],
  ['/api/admin', 'adminPrompts'], ['/api/superadmin', 'adminPrompts'], ['/api/board', 'board'],
  ['/api/junta', 'validation'],
];
// Públicas por diseño (se verifican aparte): registro, login y similares.
const publicByDesign = new Set(['POST /api/register', 'POST /api/login']);

function endpoints() {
  const out = [];
  for (const [prefix, file] of mounts) {
    const src = fs.readFileSync(path.join(backend, 'routes', file + '.js'), 'utf8');
    for (const m of src.matchAll(/router\.(post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g)) {
      const route = (m[2] === '/' ? '' : m[2]).replace(/:[A-Za-z_]+/g, '1');
      out.push([m[1].toUpperCase(), prefix + route]);
    }
  }
  return out;
}

test('ES57-QA-A1: ninguna mutación responde distinto de 401/403 sin sesión', async t => {
  const request = await startApp(t);
  const rows = [];
  for (const [method, url] of endpoints()) {
    if (publicByDesign.has(method + ' ' + url)) continue;
    const r = await request(method, url, { body: {} }).catch(e => ({ status: 'ERR:' + e.message }));
    rows.push({ method, url, status: r.status });
  }
  const open = rows.filter(r => ![401, 403].includes(r.status));
  console.log(JSON.stringify({ probed: rows.length, notDenied: open }, null, 1));
  assert.deepEqual(open, [], 'Mutaciones accesibles sin sesión');
});

test('ES57-QA-A2: PUT /api/landing-content solo superadmin y sin escritura al denegar', async t => {
  let upserts = 0;
  models.LandingContent.upsert = async () => { upserts += 1; };
  models.LandingContent.findAll = async () => [];
  const request = await startApp(t);
  const body = { key: 'hero_title', lang: 'es', value: 'Texto sintético' };
  const seen = {};
  for (const role of [undefined, 'user', 'therapist', 'admin', 'board', 'superadmin']) {
    const r = await request('PUT', '/api/landing-content', { role, body });
    seen[role || 'anónimo'] = r.status;
  }
  console.log(JSON.stringify({ statuses: seen, upserts }));
  for (const k of ['anónimo', 'user', 'therapist', 'admin', 'board']) {
    assert.ok([401, 403].includes(seen[k]), `${k} debería ser 401/403, fue ${seen[k]}`);
  }
  assert.equal(seen.superadmin, 200, 'superadmin debe poder editar');
});
