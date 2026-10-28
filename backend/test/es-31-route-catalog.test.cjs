// ES-31: catálogo curado de rutas, fuentes y recursos. Modelos en memoria (ver es-31-store.cjs); concurrencia real en
// test/integration/es-31-postgres.cjs. Todo el contenido es SINTÉTICO.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startApp } = require('./support.cjs');
const { install } = require('./es-31-store.cjs');
const catalog = require('../utils/routeCatalog');
const policy = require('../config/routeCatalogPolicy.json');
const { build } = require('../seeds/routeCatalogSynthetic.cjs');

const U = { role: 'user', id: 101 };
const ADMIN = { role: 'admin', id: 900 };
const SUPER = { role: 'superadmin', id: 901 };
const BASE = '/api/admin/route-catalog';
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function loadSynthetic(request, mutate = (d) => d) {
  const draft = (await request('POST', BASE, ADMIN)).body;
  const data = mutate(build());
  for (const kind of catalog.KINDS) {
    for (const [key, item] of Object.entries(data[kind])) {
      const r = await request('PUT', `${BASE}/${draft.id}/${kind}/${key}`, { ...ADMIN, body: item });
      assert.equal(r.status, 200, `${kind}/${key} ${JSON.stringify(r.body)}`);
    }
  }
  return draft;
}
const publish = (request, id, actor = ADMIN) => request('POST', `${BASE}/${id}/publish`, actor);
const withSynthetic = async (fn) => {
  const keep = process.env.ALLOW_SYNTHETIC_CATALOG;
  process.env.ALLOW_SYNTHETIC_CATALOG = 'true';
  try { return await fn(); } finally { if (keep === undefined) delete process.env.ALLOW_SYNTHETIC_CATALOG; else process.env.ALLOW_SYNTHETIC_CATALOG = keep; }
};

test('ES-31 el catálogo sintético completo se publica solo con la autorización explícita de pruebas y queda inmutable', async (t) => {
  const { state } = install();
  const request = await startApp(t);
  const draft = await loadSynthetic(request);
  assert.deepEqual((await request('GET', `${BASE}/${draft.id}`, ADMIN)).body.missing, {}); // la semilla sintética está completa
  const refused = await publish(request, draft.id);
  assert.deepEqual([refused.status, refused.body.code], [422, 'synthetic_content_not_allowed']); // producción nunca lo permite
  assert.equal((await request('GET', '/api/route-catalog', U)).status, 503);
  const ok = await withSynthetic(() => publish(request, draft.id, SUPER));
  assert.deepEqual([ok.status, ok.body.status], [200, 'published']);
  assert.equal(state.tables.RouteCatalog[0].publishedBy, 901);
  for (const call of [
    () => request('PUT', `${BASE}/${draft.id}/contexts/ctx_nuevo`, { ...ADMIN, body: { labels: { es: 'x', en: 'x' } } }),
    () => request('DELETE', `${BASE}/${draft.id}/roles/formador_corporativo`, ADMIN),
    () => publish(request, draft.id),
  ]) assert.equal((await call()).body.code, 'catalog_not_editable');
  // nueva versión: copia el vigente, un solo borrador y, al publicar, archiva el anterior
  const v2 = (await request('POST', BASE, ADMIN)).body;
  assert.deepEqual([v2.version, v2.itemCount], [2, state.tables.RouteCatalogItem.filter((i) => i.catalogId === draft.id).length]);
  assert.equal((await request('POST', BASE, ADMIN)).body.code, 'draft_exists');
  await withSynthetic(() => publish(request, v2.id));
  assert.deepEqual(state.tables.RouteCatalog.map((c) => [c.version, c.status]), [[1, 'archived'], [2, 'published']]);
});

test('ES-31 lectura para participantes: solo lo publicado, con frescura calculada, sin nombres de revisores y sin demanda', async (t) => {
  install();
  const request = await startApp(t);
  assert.equal((await request('GET', '/api/route-catalog')).status, 403); // sin sesión
  assert.equal((await request('GET', '/api/route-catalog', U)).status, 503); // nada publicado
  const draft = await loadSynthetic(request);
  assert.equal((await request('GET', '/api/route-catalog', U)).status, 503); // un borrador no se ve
  await withSynthetic(() => publish(request, draft.id));
  const read = (await request('GET', '/api/route-catalog', U)).body;
  const src = Object.fromEntries(read.sources.map((s) => [s.sourceKey, s]));
  assert.deepEqual([src.src_oficial_a.stale, src.src_informe_d.stale, src.src_inaccesible_e.stale], [false, true, true]); // antigua e inaccesible no son confirmación actual
  const off = Object.fromEntries(read.offers.map((o) => [o.offerKey, o]));
  assert.deepEqual([off.oferta_formador_vigente.status, off.oferta_exito_vencida.status], ['current', 'expired']);
  assert.deepEqual(off.oferta_formador_vigente.salary, { published: false }); // «no publicado»
  assert.equal(off.oferta_analista_vigente.salary.published, true);
  const res = Object.fromEntries(read.resources.map((r) => [r.resourceKey, r]));
  assert.deepEqual([res.rec_comunicacion.price.published, res.rec_analisis.price.published], [true, false]); // precio por confirmar
  const roles = Object.fromEntries(read.roles.map((r) => [r.roleKey, r]));
  assert.equal(roles.coordinador_proyectos_salud.regulated.isRegulated, true);
  assert.equal(roles.coordinador_proyectos_salud.regulated.note.es.length > 0, true);
  assert.equal(roles.formador_corporativo.verificationTask, false);
  assert.deepEqual(roles.formador_corporativo.domainReview.present, true);
  const json = JSON.stringify(read);
  assert.doesNotMatch(json, /Revisor sintético|Revisor de dominio|consultedBy|"verification"|"review"/); // no se publican nombres
  assert.doesNotMatch(json, /demand|volume|volumen|vacancies|vacantes|percent|porcentaje/i); // sin demanda ni porcentajes
  const detail = await request('GET', '/api/route-catalog/roles/exito_cliente', U);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.offers.map((o) => o.offerKey), ['oferta_exito_vencida']);
  assert.deepEqual(detail.body.sources.map((s) => s.sourceKey).sort(), ['src_inaccesible_e', 'src_oficial_b']);
  assert.equal((await request('GET', '/api/route-catalog/roles/no_existe', U)).status, 404);
  // los parámetros de la política se pueden cambiar sin tocar código
  const strict = await catalog.getPublishedRouteCatalog({ policy: { ...policy, offerVerificationDays: 1, sourceStaleDays: 1 }, now: new Date() });
  assert.deepEqual([strict.offers.find((o) => o.offerKey === 'oferta_analista_vigente').status, strict.sources.find((s) => s.sourceKey === 'src_oficial_a').stale], ['expired', true]);
});

test('ES-31 solo la administración escribe el catálogo; las personas, terapeutas y facilitadores no', async (t) => {
  install();
  const request = await startApp(t);
  for (const actor of [U, { role: 'therapist', id: 5 }, { role: 'facilitator', id: 6 }]) {
    assert.equal((await request('GET', BASE, actor)).status, 403);
    assert.equal((await request('POST', BASE, actor)).status, 403);
  }
  assert.equal((await request('GET', BASE)).status, 403);
  assert.equal((await request('POST', BASE, ADMIN)).status, 201);
});

test('ES-31 publicar exige completitud y referencias válidas: cada regla, una por una', async (t) => {
  install();
  const request = await startApp(t);
  const cases = [
    ['rol sin fuente fechada', (d) => { d.roles.formador_corporativo.sourceKeys = []; }, 'roles/formador_corporativo', 'sourceKeys'],
    ['rol sin revisión de dominio', (d) => { delete d.roles.formador_corporativo.review; }, 'roles/formador_corporativo', 'review'],
    ['rol sin mercado', (d) => { delete d.roles.formador_corporativo.market; }, 'roles/formador_corporativo', 'market'],
    ['rol sin contexto', (d) => { d.roles.formador_corporativo.contexts = []; }, 'roles/formador_corporativo', 'contexts'],
    ['tarea sin exposición a la IA', (d) => { delete d.roles.formador_corporativo.tasks[0].aiExposure; }, 'roles/formador_corporativo', 'tasks.0.aiExposure'],
    ['exposición «con fuente» sin la fuente', (d) => { delete d.roles.formador_corporativo.tasks[0].aiExposure.sourceKey; }, 'roles/formador_corporativo', 'tasks.0.aiExposure.sourceKey'],
    ['profesión regulada sin nota de habilitación', (d) => { delete d.roles.coordinador_proyectos_salud.regulated.note; }, 'roles/coordinador_proyectos_salud', 'regulated.note'],
    ['fuente sin fecha de consulta', (d) => { delete d.sources.src_oficial_a.consultedAt; }, 'sources/src_oficial_a', 'consultedAt'],
    ['fuente sin marcar accesible', (d) => { delete d.sources.src_oficial_a.accessible; }, 'sources/src_oficial_a', 'accessible'],
    ['oferta sin salario declarado', (d) => { delete d.offers.oferta_formador_vigente.salary; }, 'offers/oferta_formador_vigente', 'salary'],
    ['salario publicado sin texto', (d) => { d.offers.oferta_analista_vigente.salary = { published: true }; }, 'offers/oferta_analista_vigente', 'salary.text'],
    ['oferta sin verificación humana', (d) => { delete d.offers.oferta_formador_vigente.verification; }, 'offers/oferta_formador_vigente', 'verification'],
    ['recurso sin precio declarado', (d) => { delete d.resources.rec_comunicacion.price; }, 'resources/rec_comunicacion', 'price'],
    ['recurso sin ejercicio', (d) => { delete d.resources.rec_comunicacion.exercise; }, 'resources/rec_comunicacion', 'exercise'],
    ['recurso sin propósito', (d) => { delete d.resources.rec_comunicacion.purpose; }, 'resources/rec_comunicacion', 'purpose'],
    ['referencia a una fuente inexistente', (d) => { d.roles.formador_corporativo.sourceKeys.push('src_no_existe'); }, 'roles/formador_corporativo', 'sourceKeys.src_no_existe'],
    ['referencia a un contexto inexistente', (d) => { d.roles.formador_corporativo.contexts.push('ctx_no_existe'); }, 'roles/formador_corporativo', 'contexts.ctx_no_existe'],
    ['oferta de un rol inexistente', (d) => { d.offers.oferta_formador_vigente.roleKey = 'rol_no_existe'; }, 'offers/oferta_formador_vigente', 'roleKey.rol_no_existe'],
  ];
  const draft = await loadSynthetic(request);
  for (const [label, mutate, itemId, fragment] of cases) {
    const [kind, key] = itemId.split('/');
    const mutated = build();
    mutate(mutated);
    assert.equal((await request('PUT', `${BASE}/${draft.id}/${kind}/${key}`, { ...ADMIN, body: mutated[kind][key] })).status, 200, label);
    const r = await withSynthetic(() => publish(request, draft.id));
    assert.deepEqual([r.status, r.body.code], [422, 'incomplete_catalog'], label);
    assert.ok((r.body.missing[itemId] || []).some((m) => m.includes(fragment)), label + ': ' + JSON.stringify(r.body.missing));
    // se restaura el elemento original para la siguiente regla
    assert.equal((await request('PUT', `${BASE}/${draft.id}/${kind}/${key}`, { ...ADMIN, body: build()[kind][key] })).status, 200);
  }
  // sin ninguna regla rota, la misma semilla sí se publica
  assert.equal((await withSynthetic(() => publish(request, draft.id))).status, 200);
});

test('ES-31 topes: más de seis contextos, de 10 ofertas por rol o de 60 en total no se publica', async (t) => {
  install();
  const request = await startApp(t);
  const draft = await loadSynthetic(request);
  for (const n of [7]) await request('PUT', `${BASE}/${draft.id}/contexts/ctx_extra_${n}`, { ...ADMIN, body: { labels: { es: 'a', en: 'a' } } });
  const over = await withSynthetic(() => publish(request, draft.id));
  assert.deepEqual([over.status, over.body.missing.contexts], [422, ['over_6']]);
  await request('DELETE', `${BASE}/${draft.id}/contexts/ctx_extra_7`, ADMIN);
  // topes de ofertas con una política más estricta (la política es configurable)
  const strict = { ...policy, maxOffersPerRole: 1, maxOffersTotal: 2 };
  const offer = build().offers.oferta_formador_vigente;
  await request('PUT', `${BASE}/${draft.id}/offers/oferta_formador_dos`, { ...ADMIN, body: offer });
  await assert.rejects(catalog.publish(draft.id, 900, { policy: strict, allowSynthetic: true }), (e) => e.code === 'incomplete_catalog' && e.missing['roles/formador_corporativo'].includes('offers_over_1') && e.missing.offers.includes('over_2'));
  // la semilla sigue pudiendo publicarse con la política vigente
  assert.equal((await withSynthetic(() => publish(request, draft.id))).status, 200);
});

test('ES-31 entradas inválidas y etiquetas prohibidas: 400/422 controlado, sin 500', async (t) => {
  install();
  const request = await startApp(t);
  const draft = (await request('POST', BASE, ADMIN)).body;
  const put = (kind, key, body) => request('PUT', `${BASE}/${draft.id}/${kind}/${key}`, { ...ADMIN, body });
  const data = build();
  const bad = [
    ['roles', 'Mala-Clave', data.roles.formador_corporativo], ['roles', 'ab', data.roles.formador_corporativo],
    ['roles', 'okey', { ...data.roles.formador_corporativo, extra: 1 }], ['roles', 'okey', { ...data.roles.formador_corporativo, market: 'colombia' }],
    ['roles', 'okey', { ...data.roles.formador_corporativo, modality: ['space'] }], ['roles', 'okey', { ...data.roles.formador_corporativo, tasks: [] }],
    ['roles', 'okey', { ...data.roles.formador_corporativo, demand: 'alta' }], // no existe ningún campo de demanda
    ['sources', 'okey', { ...data.sources.src_oficial_a, url: 'http://inseguro.example/x' }], ['sources', 'okey', { ...data.sources.src_oficial_a, url: 'https://u:p@example.org/x' }],
    ['sources', 'okey', { ...data.sources.src_oficial_a, url: 'javascript:alert(1)' }], ['sources', 'okey', { ...data.sources.src_oficial_a, consultedAt: '2999-01-01' }],
    ['sources', 'okey', { ...data.sources.src_oficial_a, type: 'blog' }], ['sources', 'okey', { ...data.sources.src_oficial_a, accessible: 'si' }],
    ['offers', 'okey', { ...data.offers.oferta_formador_vigente, salary: { published: 'no' } }], ['offers', 'okey', { ...data.offers.oferta_formador_vigente, applicants: 400 }],
    ['resources', 'okey', { ...data.resources.rec_comunicacion, level: 'experto' }], ['resources', 'okey', { ...data.resources.rec_comunicacion, price: { published: true, amount: -5, currency: 'COP' } }],
    ['resources', 'okey', { ...data.resources.rec_comunicacion, price: { published: true, amount: 5, currency: 'pesos' } }],
  ];
  for (const [kind, key, body] of bad) assert.equal((await put(kind, key, body)).status, 400, `${kind} ${key} ${JSON.stringify(body).slice(0, 70)}`);
  assert.equal((await put('rutas', 'okey', {})).status, 404); // un tipo desconocido no existe
  const forbidden = { ...data.roles.formador_corporativo, tasks: [{ text: { es: 'Esta profesión estará sin futuro', en: 'x' }, aiExposure: { status: 'unknown' } }] };
  assert.deepEqual([(await put('roles', 'okey', forbidden)).status, (await put('roles', 'okey', forbidden)).body.code], [422, 'forbidden_label']);
  const pct = { ...data.roles.formador_corporativo, tasks: [{ text: { es: 'Tarea', en: 'Task' }, aiExposure: { status: 'hypothesis', note: { es: 'Se reemplazará el 40% de esta tarea', en: 'x' } } }] };
  assert.equal((await put('roles', 'okey', pct)).body.code, 'forbidden_label'); // ningún porcentaje individual de reemplazo
  assert.equal((await request('GET', `${BASE}/abc`, ADMIN)).status, 404);
  assert.equal((await request('DELETE', `${BASE}/${draft.id}/roles/no_existe`, ADMIN)).status, 404);
  // un secreto en un texto se enmascara antes de guardar
  const secret = await put('contexts', 'ctx_secreto', { labels: { es: 'Clave sk-abcdefghijklmnopqrstuvwxyz‮', en: 'x' } });
  assert.doesNotMatch(JSON.stringify(secret.body), /sk-abcdef|‮/);
  // tope por borrador
  for (let i = 0; i < 12; i++) assert.ok([200, 409].includes((await put('contexts', `ctx_cap_${String(i).padStart(2, '0')}`, { labels: { es: 'a', en: 'a' } })).status));
  assert.equal((await put('contexts', 'ctx_cap_99', { labels: { es: 'a', en: 'a' } })).body.code, 'catalog_limit');
});

test('ES-31 la semilla sintética es completa, marca todo como sintético y no puede publicarse en producción', () => {
  const data = build();
  for (const kind of catalog.KINDS) {
    assert.ok(Object.keys(data[kind]).length >= 1);
    for (const item of Object.values(data[kind])) assert.equal(item.synthetic, true);
  }
  assert.equal(Object.keys(data.contexts).length, 6);
  assert.ok(Object.values(data.sources).every((s) => s.url === 'https://example.org/fuente-sintetica')); // dominio reservado: ninguna fuente real
  assert.ok(Object.values(data.offers).every((o) => o.url.startsWith('https://example.org/')));
  const script = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'seedRouteCatalogSynthetic.js'), 'utf8');
  assert.ok(script.indexOf("NODE_ENV === 'production'") !== -1 && script.indexOf("NODE_ENV === 'production'") < script.indexOf('authenticate'));
  assert.match(fs.readFileSync(path.resolve(__dirname, '..', 'utils', 'routeCatalog.js'), 'utf8'), /ALLOW_SYNTHETIC_CATALOG/);
});

test('ES-31 frontera en el código: el catálogo no sale a internet, no lee datos personales y no tiene campos de demanda', () => {
  const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
  const code = read('utils', 'routeCatalog.js').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const forbidden of ["require('http", "require('https", "require('net'", 'fetch(', 'axios', 'MoodLog', 'DiaryEntry', 'ChatTurn', 'EvidenceVersion', 'SkillAssessment']) {
    assert.ok(!code.includes(forbidden), `no debe usar ${forbidden}`);
  }
  assert.doesNotMatch(code, /demand|vacancies|applicants|volume/i);
  const routes = ['routeCatalog.js', 'routeCatalogAdmin.js'].map((f) => read('routes', f).split('\n').filter((l) => !l.startsWith('//')).join('\n')).join('\n');
  assert.doesNotMatch(routes, /MoodLog|DiaryEntry|ChatTurn/);
  assert.deepEqual(Object.keys(require('../config/routeCatalogPolicy.json')).filter((k) => !k.startsWith('_')).sort(), ['maxContexts', 'maxOffersPerRole', 'maxOffersTotal', 'offerVerificationDays', 'sourceStaleDays']);
});

// QA-31-01: la regla de «sin porcentajes ni lenguaje de reemplazo» (RF-17) aplica a TODOS los campos de texto descriptivos del catálogo.
const PHRASE_SAMPLES = {
  sin_futuro: 'Esta profesión no tiene futuro',
  desaparecer: 'Este oficio desaparecerá pronto',
  sera_reemplazado: 'Este puesto será reemplazado pronto',
  reemplazado_por: 'El analista es reemplazado por la inteligencia artificial',
  will_be_replaced: 'This job will be replaced soon',
  replaced_by: 'Analysts are replaced by AI',
  sera_automatizado: 'Estas tareas serán automatizadas',
  tasa_reemplazo: 'La tasa de reemplazo es alta',
  ya_no_necesaria: 'Esta función ya no será necesaria',
};
const PERCENT_SAMPLES = ['El 70 % de estas tareas son repetitivas', '40 percent replacement', 'Un 30 por ciento del trabajo', 'About 25% of the work'];
const NEUTRAL_TEXTS = ['Coordina la automatización de procesos administrativos', 'Diseña sesiones de formación para equipos', 'Prepara reportes de desempeño trimestral'];

// Cada campo de texto descriptivo: cómo meter una frase en él dentro de la semilla sintética.
const FIELDS = {
  'contexto.labels': { kind: 'contexts', key: 'ctx_educacion_formacion', set: (item, s) => { item.labels = { es: s, en: 'ok' }; } },
  'contexto.note': { kind: 'contexts', key: 'ctx_educacion_formacion', set: (item, s) => { item.note = { es: s, en: 'ok' }; } },
  'rol.labels': { kind: 'roles', key: 'formador_corporativo', set: (item, s) => { item.labels = { es: s, en: 'ok' }; } },
  'rol.industry': { kind: 'roles', key: 'formador_corporativo', set: (item, s) => { item.industry = { es: s, en: 'ok' }; } },
  'rol.tarea': { kind: 'roles', key: 'formador_corporativo', set: (item, s) => { item.tasks[0].text = { es: s, en: 'ok' }; } },
  'rol.barrera': { kind: 'roles', key: 'formador_corporativo', set: (item, s) => { item.barriers = [{ es: s, en: 'ok' }]; } },
  'rol.nota_ia': { kind: 'roles', key: 'formador_corporativo', set: (item, s) => { item.tasks[1].aiExposure.note = { es: s, en: 'ok' }; } },
  'rol.habilitacion': { kind: 'roles', key: 'coordinador_proyectos_salud', set: (item, s) => { item.regulated.note = { es: s, en: 'ok' }; } },
  'recurso.proposito': { kind: 'resources', key: 'rec_comunicacion', set: (item, s) => { item.purpose = { es: s, en: 'ok' }; } },
  'recurso.ejercicio': { kind: 'resources', key: 'rec_comunicacion', set: (item, s) => { item.exercise = { es: s, en: 'ok' }; } },
};

test('ES-31 (QA-31-01) la lista de frases prohibidas y sus muestras coinciden: cada frase tiene su prueba', () => {
  const { FORBIDDEN_PHRASES } = require('../utils/routeCatalog');
  assert.deepEqual(Object.keys(PHRASE_SAMPLES).sort(), Object.keys(FORBIDDEN_PHRASES).sort());
});

test('ES-31 (QA-31-01) cada frase y cada porcentaje se rechazan (422) en CADA campo de texto descriptivo; el texto neutro pasa en todos', async (t) => {
  install();
  const request = await startApp(t);
  const draft = (await request('POST', BASE, ADMIN)).body;
  const put = (field, text) => {
    const { kind, key, set } = FIELDS[field];
    const item = build()[kind][key];
    set(item, text);
    return request('PUT', `${BASE}/${draft.id}/${kind}/${key}`, { ...ADMIN, body: item });
  };
  for (const field of Object.keys(FIELDS)) {
    for (const [phrase, sample] of Object.entries(PHRASE_SAMPLES)) {
      const r = await put(field, sample);
      assert.deepEqual([r.status, r.body.code], [422, 'forbidden_label'], `${field}: ${phrase}`);
      assert.equal((await put(field, sample.toUpperCase())).status, 422, `${field}: ${phrase} (mayúsculas)`);
    }
    for (const sample of PERCENT_SAMPLES) assert.equal((await put(field, sample)).status, 422, `${field}: ${sample}`);
    for (const neutral of NEUTRAL_TEXTS) assert.equal((await put(field, neutral)).status, 200, `${field}: ${neutral}`);
  }
  // la sonda de QA: tres paráfrasis y «40 percent replacement»
  for (const probe of ['El 70 % de estas tareas serán automatizadas', 'Esta profesión no tiene futuro', 'Será reemplazado por la IA', '40 percent replacement']) {
    assert.equal((await put('rol.tarea', probe)).status, 422, probe);
  }
});

test('ES-31 (QA-31-01) los campos que NO son descriptivos (títulos, organización, salario) no rechazan un porcentaje legítimo, y las frases sí se siguen rechazando', async (t) => {
  install();
  const request = await startApp(t);
  const draft = (await request('POST', BASE, ADMIN)).body;
  const offer = build().offers.oferta_formador_vigente;
  const ok = await request('PUT', `${BASE}/${draft.id}/offers/oferta_a`, { ...ADMIN, body: { ...offer, title: 'Formador 100 % remoto', salary: { published: true, text: 'Incluye 10% de bono' } } });
  assert.equal(ok.status, 200); // falso positivo evitado: «100 % remoto» y un bono del 10 % son legítimos en una oferta
  const bad = await request('PUT', `${BASE}/${draft.id}/offers/oferta_b`, { ...ADMIN, body: { ...offer, title: 'Oferta: este cargo será reemplazado por la IA' } });
  assert.deepEqual([bad.status, bad.body.code], [422, 'forbidden_label']);
});
