// [QA-Claude] ES-66 · contenido de la landing: roles, entradas inválidas, contenido hostil, respaldo,
// catálogo y latencia. Uso: QA_SUT=<clon limpio del commit> node --test qa/security/es66-landing-content.test.cjs
// Reutiliza el arnés de Dev (backend/test/support.cjs): Express y JWT reales; DB y proveedores simulados.
// No lee .env ni conecta a DB. Datos sintéticos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const sut = process.env.QA_SUT;
if (!sut) throw new Error('Defina QA_SUT con la ruta del clon limpio del commit bajo prueba.');
const backend = path.resolve(sut, 'backend');
const { models, startApp } = require(path.join(backend, 'test', 'support.cjs'));
const catalog = require(path.join(sut, 'shared', 'landing-content.json'));

const upserts = [];
models.LandingContent.upsert = async row => { upserts.push(row); };
let rows = [];
models.LandingContent.findAll = async opts => rows.filter(r => !opts?.where?.lang || r.lang === opts.where.lang);

test('ES66-F01: catálogo completo, sin duplicados ni vacíos, ES y EN', () => {
  assert.equal(catalog.length, 23);
  const keys = catalog.map(e => e.key);
  assert.equal(new Set(keys).size, keys.length, 'claves duplicadas');
  for (const e of catalog) {
    assert.match(e.key, /^landing\./);
    for (const l of ['es', 'en']) assert.ok(typeof e[l] === 'string' && e[l].trim().length > 0, `${e.key} ${l} vacío`);
    assert.ok(e.es.length <= 5000 && e.en.length <= 5000);
  }
});

test('ES66-F02/F03: GET público mezcla defaults, ignora blancos y responde con respaldo si falla la base', async t => {
  const request = await startApp(t);
  rows = [{ key: 'landing.hero.title', lang: 'es', value: 'Editado ES' }, { key: 'landing.hero.subtitle', lang: 'es', value: '   ' }];
  const es = await request('GET', '/api/landing-content?lang=es');
  assert.equal(es.status, 200);
  assert.equal(es.body['landing.hero.title'], 'Editado ES');
  const def = catalog.find(e => e.key === 'landing.hero.subtitle').es;
  assert.equal(es.body['landing.hero.subtitle'], def, 'el valor en blanco no debe pisar el default');
  const en = await request('GET', '/api/landing-content?lang=en');
  assert.equal(en.status, 200);
  assert.equal(en.body['landing.hero.title'], catalog.find(e => e.key === 'landing.hero.title').en);
  for (const e of catalog) assert.ok(es.body[e.key] && en.body[e.key], `falta ${e.key}`);
  models.LandingContent.findAll = async () => { throw new Error('db caída'); };
  const down = await request('GET', '/api/landing-content?lang=es');
  assert.equal(down.status, 200, 'sin 500 si la base falla');
  assert.equal(down.body['landing.hero.title'], catalog.find(e => e.key === 'landing.hero.title').es);
  models.LandingContent.findAll = async opts => rows.filter(r => !opts?.where?.lang || r.lang === opts.where.lang);
});

test('ES66-S01: PUT solo superadmin; sin escritura al denegar', async t => {
  const request = await startApp(t);
  const body = { key: 'landing.hero.title', lang: 'es', value: 'Texto sintético' };
  upserts.length = 0;
  const seen = {};
  for (const role of [undefined, 'user', 'therapist', 'admin', 'board']) {
    seen[role || 'anónimo'] = (await request('PUT', '/api/landing-content', { role, body })).status;
  }
  assert.deepEqual(Object.values(seen), [403, 403, 403, 403, 403]);
  for (const bad of ['Bearer invalid', 'Bearer ']) {
    const r = await request('PUT', '/api/landing-content', { body, headers: { Authorization: bad } });
    assert.ok([401, 403].includes(r.status), 'token inválido: ' + r.status);
  }
  assert.equal(upserts.length, 0, 'no debe escribir al denegar');
  const ok = await request('PUT', '/api/landing-content', { role: 'superadmin', body });
  assert.equal(ok.status, 200);
  assert.equal(upserts.length, 1);
});

test('ES66-S02/S03: entradas inválidas y contenido hostil (nunca 500)', async t => {
  const request = await startApp(t);
  const ok = { key: 'landing.hero.title', lang: 'es', value: 'x' };
  const cases = {
    'key numérica': { ...ok, key: 123 },
    'key objeto': { ...ok, key: { a: 1 } },
    'key arreglo': { ...ok, key: ['landing.hero.title'] },
    'key null': { ...ok, key: null },
    'value numérico': { ...ok, value: 42 },
    'value objeto': { ...ok, value: { a: 1 } },
    'value arreglo': { ...ok, value: ['x'] },
    'value null': { ...ok, value: null },
    'lang inválido': { ...ok, lang: 'fr' },
    'lang objeto': { ...ok, lang: { a: 1 } },
    'clave landing desconocida': { ...ok, key: 'landing.nope' },
    'key > 255': { ...ok, key: 'k'.repeat(256) },
    'value > 5000': { ...ok, value: 'v'.repeat(5001) },
    'cuerpo vacío': {},
  };
  const results = {};
  for (const [name, body] of Object.entries(cases)) {
    upserts.length = 0;
    const r = await request('PUT', '/api/landing-content', { role: 'superadmin', body });
    results[name] = { status: r.status, escribió: upserts.length };
  }
  console.log(JSON.stringify(results));
  const bad = Object.entries(results).filter(([, v]) => v.status !== 400 || v.escribió !== 0);
  assert.deepEqual(bad, [], 'Esperado 400 y sin escritura; fallan: ' + JSON.stringify(bad));
  // contenido hostil: se acepta como texto (no se interpreta) y se devuelve como JSON
  upserts.length = 0;
  const xss = '<img src=x onerror=alert(1)>"\'<script>1</script>';
  const r = await request('PUT', '/api/landing-content', { role: 'superadmin', body: { ...ok, value: xss } });
  assert.equal(r.status, 200);
  assert.equal(upserts[0].value, xss, 'se guarda tal cual (texto); el render escapa en React');
});

test('ES66-P01: latencia del GET con 6 usuarios virtuales (DB simulada)', async t => {
  rows = [];
  const request = await startApp(t);
  const secs = Number(process.env.QA_LOAD_SECS || 30);
  const end = Date.now() + secs * 1000;
  const lat = []; let err = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (Date.now() < end) {
      const s = performance.now();
      const r = await request('GET', '/api/landing-content?lang=' + (lat.length % 2 ? 'en' : 'es'));
      lat.push(performance.now() - s); if (r.status !== 200) err++;
    }
  }));
  lat.sort((a, b) => a - b);
  const p95 = lat[Math.floor(lat.length * 0.95)];
  console.log(JSON.stringify({ peticiones: lat.length, errores: err, p50: +lat[Math.floor(lat.length / 2)].toFixed(1), p95: +p95.toFixed(1), max: +lat[lat.length - 1].toFixed(1) }));
  assert.equal(err, 0);
  assert.ok(p95 <= 300, 'p95 propuesto ≤ 300 ms');
});
