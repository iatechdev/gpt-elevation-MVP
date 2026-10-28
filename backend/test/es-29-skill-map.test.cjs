// ES-29: Skill Map trazable y catálogo administrable. Modelos y crypto en memoria (ver es-29-store.cjs); cifrado real y concurrencia en
// test/integration/es-29-postgres.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startApp } = require('./support.cjs');
const { install } = require('./es-29-store.cjs');
const evidence = require('../utils/evidence');
const skillMap = require('../utils/skillMap');

const U = { role: 'user', id: 101 };
const V = { role: 'user', id: 202 };
const ADMIN = { role: 'admin', id: 900 };
const SUPER = { role: 'superadmin', id: 901 };
let counter = 0;
const rid = () => `req-${String(++counter).padStart(6, '0')}`;

const levels = (prefix) => Object.fromEntries([1, 2, 3, 4].map((n) => [n, { es: `${prefix} nivel ${n}`, en: `${prefix} level ${n}` }]));
const skillBody = (name, over = {}) => ({
  type: 'transversal', labels: { es: `Habilidad ${name}`, en: `Skill ${name}` },
  rubric: { levels: levels(name), source: 'Rúbrica sintética de prueba', verifiedBy: 'Revisor sintético', verifiedAt: '2026-10-01' }, ...over,
});
const claim = (text) => ({ text });
const evBody = (over = {}, status = 'confirmed') => ({
  payload: {
    title: 'Evidencia sintética', situation: 'Situación sintética', responsibility: claim('Mi parte'), actions: [claim('Hice algo')],
    delivered: claim('Entregué algo'), observedEffect: { known: false }, autonomy: 'autonomous', ...over,
  },
  status, requestId: rid(),
});

async function publishCatalog(request, names = ['comunicacion', 'planificacion']) {
  const draft = await request('POST', '/api/admin/skill-catalog', ADMIN);
  assert.equal(draft.status, 201);
  for (const name of names) assert.equal((await request('PUT', `/api/admin/skill-catalog/${draft.body.id}/skills/${name}`, { ...ADMIN, body: skillBody(name) })).status, 200);
  const published = await request('POST', `/api/admin/skill-catalog/${draft.body.id}/publish`, ADMIN);
  assert.equal(published.status, 200, JSON.stringify(published.body));
  return published.body;
}
async function addEvidence(userId, over, status = 'confirmed') {
  return evidence.create(userId, evBody(over, status));
}
const self = (request, actor, body) => request('POST', '/api/skill-map/self', { ...actor, body: { requestId: rid(), ...body } });

test('ES-29 catálogo: sin publicar el mapa no evalúa nada; publicar exige todo completo; lo publicado es inmutable', async (t) => {
  const { state } = install();
  const request = await startApp(t);
  assert.deepEqual([(await request('GET', '/api/skill-map', U)).status, (await request('GET', '/api/skill-map', U)).body.code], [503, 'catalog_unavailable']);
  assert.equal((await self(request, U, { skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: 1, version: 1 }] })).status, 503);

  const draft = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  assert.deepEqual([draft.version, draft.status], [1, 'draft']);
  assert.equal((await request('POST', '/api/admin/skill-catalog', ADMIN)).body.code, 'draft_exists'); // un solo borrador abierto
  const incomplete = skillBody('comunicacion', { rubric: { levels: { 1: { es: 'solo es' } }, source: 'fuente' } });
  assert.equal((await request('PUT', `/api/admin/skill-catalog/${draft.id}/skills/comunicacion`, { ...ADMIN, body: incomplete })).status, 200); // el borrador admite incompleto
  const blocked = await request('POST', `/api/admin/skill-catalog/${draft.id}/publish`, ADMIN);
  assert.deepEqual([blocked.status, blocked.body.code], [422, 'incomplete_catalog']);
  assert.ok(blocked.body.missing.comunicacion.includes('rubric.verifiedBy') && blocked.body.missing.comunicacion.includes('rubric.levels.4.en'));
  assert.equal((await request('GET', '/api/skill-map', U)).status, 503); // incompleto: sigue sin catálogo vigente

  await request('PUT', `/api/admin/skill-catalog/${draft.id}/skills/comunicacion`, { ...ADMIN, body: skillBody('comunicacion') });
  const published = await request('POST', `/api/admin/skill-catalog/${draft.id}/publish`, SUPER);
  assert.deepEqual([published.status, published.body.status], [200, 'published']);
  assert.equal(state.tables.SkillCatalog[0].publishedBy, 901);
  // inmutable
  for (const call of [
    () => request('PUT', `/api/admin/skill-catalog/${draft.id}/skills/otra`, { ...ADMIN, body: skillBody('otra') }),
    () => request('DELETE', `/api/admin/skill-catalog/${draft.id}/skills/comunicacion`, ADMIN),
    () => request('POST', `/api/admin/skill-catalog/${draft.id}/publish`, ADMIN),
  ]) assert.deepEqual((await call()).body.code, 'catalog_not_editable');
  // nueva versión: copia el vigente, al publicar archiva el anterior
  const v2 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  assert.deepEqual([v2.version, v2.skillCount], [2, 1]);
  await request('PUT', `/api/admin/skill-catalog/${v2.id}/skills/planificacion`, { ...ADMIN, body: skillBody('planificacion') });
  await request('POST', `/api/admin/skill-catalog/${v2.id}/publish`, ADMIN);
  assert.deepEqual(state.tables.SkillCatalog.map((c) => [c.version, c.status]), [[1, 'archived'], [2, 'published']]);
  assert.equal((await request('GET', '/api/skill-map', U)).body.skills.length, 2);
});

test('ES-29 catálogo: solo administración lo edita y las entradas inválidas dan 400 controlado', async (t) => {
  install();
  const request = await startApp(t);
  for (const actor of [U, { role: 'therapist', id: 5 }, { role: 'facilitator', id: 6 }]) {
    assert.equal((await request('GET', '/api/admin/skill-catalog', actor)).status, 403);
    assert.equal((await request('POST', '/api/admin/skill-catalog', actor)).status, 403);
  }
  assert.equal((await request('GET', '/api/admin/skill-catalog')).status, 403);
  const draft = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  const put = (key, body) => request('PUT', `/api/admin/skill-catalog/${draft.id}/skills/${key}`, { ...ADMIN, body });
  const bad = [
    ['Mala-Clave', skillBody('x')], ['ab', skillBody('x')], ['x'.repeat(49), skillBody('x')],
    ['okey', {}], ['okey', { ...skillBody('x'), type: 'otro' }], ['okey', { ...skillBody('x'), extra: 1 }],
    ['okey', skillBody('x', { labels: { es: 'a', fr: 'b' } })], ['okey', skillBody('x', { labels: { es: 'x'.repeat(81) } })],
    ['okey', skillBody('x', { rubric: { levels: { 5: { es: 'a' } } } })], ['okey', skillBody('x', { rubric: { verifiedAt: '2999-01-01' } })],
    ['okey', skillBody('x', { rubric: { verifiedAt: 'ayer' } })], ['okey', skillBody('x', { rubric: { levels: { 1: { es: 'x'.repeat(301) } } } })],
  ];
  for (const [key, body] of bad) assert.equal((await put(key, body)).status, 400, `${key} ${JSON.stringify(body).slice(0, 60)}`);
  assert.equal((await request('GET', '/api/admin/skill-catalog/abc', ADMIN)).status, 404);
  assert.equal((await request('GET', '/api/admin/skill-catalog/999', ADMIN)).status, 404);
});

test('ES-29 mapa: sin evidencia el nivel es null; con evidencia vigente se guarda y la confianza sale de reglas', async (t) => {
  const { state } = install();
  const request = await startApp(t);
  await publishCatalog(request);
  const empty = (await request('GET', '/api/skill-map', U)).body;
  assert.ok(empty.skills.every((s) => s.state === 'no_evidence' && s.self === null && s.review === null));
  const e1 = await addEvidence(101);
  const r1 = await self(request, U, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e1.id, version: 1 }], rationale: 'Coordiné al equipo' });
  assert.deepEqual([r1.status, r1.body.assessment.level, r1.body.assessment.confidence, r1.body.assessment.state], [201, 3, 'low', 'initial']);
  assert.ok(r1.body.assessment.confidenceReason.es && r1.body.assessment.confidenceReason.en);
  const e2 = await addEvidence(101, { title: 'Otra' });
  const r2 = await self(request, U, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e1.id, version: 1 }, { evidenceId: e2.id, version: 1 }] });
  assert.equal(r2.body.assessment.confidence, 'medium'); // alta es inalcanzable mientras solo exista autorreporte
  const map = (await request('GET', '/api/skill-map', U)).body;
  const entry = map.skills.find((s) => s.skillKey === 'comunicacion');
  assert.deepEqual([entry.self.level, entry.self.confidence, entry.self.evidenceCount, entry.state, entry.review], [3, 'medium', 2, 'initial', null]);
  assert.equal(map.skills.find((s) => s.skillKey === 'planificacion').self, null);
  assert.deepEqual(state.tables.SkillAssessment.map((r) => [r.version ?? r.skillKey, r.status]), [['comunicacion', 'superseded'], ['comunicacion', 'current']]);
  // sin porcentajes, agregados ni comparaciones numéricas
  assert.doesNotMatch(JSON.stringify(map), /percent|porcentaje|score|empleabilidad|employab|average|promedio|total|overall/i);
  assert.deepEqual(Object.keys(map).sort(), ['catalogVersion', 'skills']);
  // la nota privada de la persona va en el almacén, no en claro fuera de rationale
  assert.equal(entry.self.rationale, null);
  const withNote = await self(request, U, { skillKey: 'planificacion', level: 2, evidenceRefs: [{ evidenceId: e1.id, version: 1 }], rationale: 'mi nota' });
  assert.equal(withNote.status, 201);
  assert.equal((await request('GET', '/api/skill-map', U)).body.skills.find((s) => s.skillKey === 'planificacion').self.rationale, 'mi nota');
});

test('ES-29 reglas del servidor: nivel sin evidencia, evidencia ajena, en borrador, de otra versión o inexistente se rechazan sin 500', async (t) => {
  const { state } = install();
  const request = await startApp(t);
  await publishCatalog(request);
  const mine = await addEvidence(101);
  const draft = await addEvidence(101, { title: 'Borrador' }, 'draft');
  const theirs = await addEvidence(202);
  const cases = [
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [] }, 422, 'evidence_required'],
    [{ skillKey: 'comunicacion', level: 3 }, 422, 'evidence_required'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: theirs.id, version: 1 }] }, 422, 'evidence_not_valid'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: draft.id, version: 1 }] }, 422, 'evidence_not_valid'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: mine.id, version: 2 }] }, 422, 'evidence_not_valid'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: 99999, version: 1 }] }, 422, 'evidence_not_valid'],
    [{ skillKey: 'no_existe', level: 3, evidenceRefs: [{ evidenceId: mine.id, version: 1 }] }, 400, 'unknown_skill'],
    [{ skillKey: 'comunicacion', level: 5, evidenceRefs: [{ evidenceId: mine.id, version: 1 }] }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 0, evidenceRefs: [{ evidenceId: mine.id, version: 1 }] }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 2.5, evidenceRefs: [{ evidenceId: mine.id, version: 1 }] }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 'alto', evidenceRefs: [{ evidenceId: mine.id, version: 1 }] }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: mine.id, version: 1 }, { evidenceId: mine.id, version: 1 }] }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: mine.id, version: 1, extra: 1 }] }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: mine.id, version: 1 }], confidence: 'high' }, 400, 'invalid_input'], // la confianza no se declara
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: mine.id, version: 1 }], UserId: 202 }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: Array.from({ length: 9 }, (_, i) => ({ evidenceId: i + 1, version: 1 })) }, 400, 'invalid_input'],
    [{ skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: mine.id, version: 1 }], rationale: 'x'.repeat(501) }, 400, 'invalid_input'],
  ];
  for (const [body, status, code] of cases) {
    const r = await self(request, U, body);
    assert.deepEqual([r.status, r.body.code], [status, code], JSON.stringify(body).slice(0, 80));
  }
  assert.equal(state.tables.SkillAssessment.length, 0);
});

test('ES-29 confirmación atómica e idempotente por requestId; level null retira la vigente', async (t) => {
  const { state } = install();
  const request = await startApp(t);
  await publishCatalog(request);
  const e = await addEvidence(101);
  const body = { requestId: 'req-idem-0001', skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: e.id, version: 1 }] };
  const a = await request('POST', '/api/skill-map/self', { ...U, body });
  const b = await request('POST', '/api/skill-map/self', { ...U, body });
  assert.deepEqual([a.status, b.status], [201, 200]);
  assert.equal(state.tables.SkillAssessment.length, 1);
  const cleared = await self(request, U, { skillKey: 'comunicacion', level: null });
  assert.deepEqual([cleared.status, cleared.body.cleared], [200, true]);
  assert.equal((await request('GET', '/api/skill-map', U)).body.skills.find((s) => s.skillKey === 'comunicacion').self, null); // vuelve a null
});

test('ES-29 si una evidencia citada cambia, se borra o deja de estar vigente, el nivel deja de mostrarse y se procesa la invalidación', async (t) => {
  const { state } = install();
  const request = await startApp(t);
  await publishCatalog(request);
  const e = await addEvidence(101);
  await self(request, U, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }] });
  assert.equal((await request('GET', '/api/skill-map', U)).body.skills[0].self.level, 3);
  // editar la evidencia: la versión citada ya no es la vigente
  const edit = await evidence.update(101, e.id, { ...evBody({ learning: 'cambio' }), baseVersion: 1 });
  assert.equal(edit.version, 2);
  assert.ok(state.tables.DerivedInvalidation.some((r) => r.sourceType === 'evidence' && r.handledAt == null));
  const stale = (await request('GET', '/api/skill-map', U)).body.skills[0];
  assert.deepEqual([stale.self.level, stale.self.stale, stale.self.state, stale.state], [null, true, 'stale', 'stale']); // no se muestra un nivel sin sustento
  assert.ok(state.tables.DerivedInvalidation.every((r) => r.handledAt)); // el evento se procesó
  assert.equal(state.tables.SkillAssessment[0].level, 3); // la fila histórica no se reescribe
  // recalcular con la versión nueva
  const again = await self(request, U, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 2 }] });
  assert.equal(again.status, 201);
  assert.equal((await request('GET', '/api/skill-map', U)).body.skills[0].self.level, 3);
  // borrar la evidencia
  await evidence.remove(101, e.id);
  assert.deepEqual([(await request('GET', '/api/skill-map', U)).body.skills[0].self.level, (await request('GET', '/api/skill-map', U)).body.skills[0].self.stale], [null, true]);
});

test('ES-29 revocar el puente invalida la evaluación que dependía de evidencia del chat', async (t) => {
  const { state, add } = install();
  const request = await startApp(t);
  await publishCatalog(request);
  const turn = add('ChatTurn', { UserId: 101, requestId: 'turn-1', status: 'completed', userContent: 'Dirigí el proyecto de migración con mi equipo', replyContent: 'r' });
  await request('PUT', '/api/consents/professional_bridge', { ...U, body: { status: 'granted' } });
  const fromChat = await evidence.create(101, { ...evBody(), origins: [{ type: 'chat_turn', id: turn.id }] });
  await self(request, U, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: fromChat.id, version: 1 }] });
  assert.equal((await request('GET', '/api/skill-map', U)).body.skills[0].self.level, 3);
  await request('PUT', '/api/consents/professional_bridge', { ...U, body: { status: 'revoked' } });
  const after = (await request('GET', '/api/skill-map', U)).body.skills[0];
  assert.deepEqual([after.self.level, after.self.stale], [null, true]);
  assert.ok(state.tables.DerivedInvalidation.some((r) => r.reason === 'revoked'));
});

test('ES-29 discrepancia con la autonomía declarada en la evidencia: queda contradictory para revisión humana y no se resuelve sola', async (t) => {
  install();
  const request = await startApp(t);
  await publishCatalog(request);
  const low = await addEvidence(101, { autonomy: 'conceptual' });
  const r = await self(request, U, { skillKey: 'comunicacion', level: 4, evidenceRefs: [{ evidenceId: low.id, version: 1 }] });
  assert.equal(r.status, 201); // se guarda, pero marcada
  assert.equal(r.body.assessment.state, 'contradictory');
  const entry = (await request('GET', '/api/skill-map', U)).body.skills[0];
  assert.deepEqual([entry.self.level, entry.self.needsReview, entry.state], [4, true, 'contradictory']);
  const ok = await self(request, U, { skillKey: 'planificacion', level: 2, evidenceRefs: [{ evidenceId: low.id, version: 1 }] });
  assert.equal(ok.body.assessment.state, 'initial'); // 1 vs 2: sin discrepancia
});

test('ES-29 la nueva versión de una rúbrica marca catalogOutdated pero no recalcula ni borra', async (t) => {
  install();
  const request = await startApp(t);
  await publishCatalog(request);
  const e = await addEvidence(101);
  await self(request, U, { skillKey: 'comunicacion', level: 3, evidenceRefs: [{ evidenceId: e.id, version: 1 }] });
  assert.equal((await request('GET', '/api/skill-map', U)).body.skills[0].self.catalogOutdated, false);
  const v2 = (await request('POST', '/api/admin/skill-catalog', ADMIN)).body;
  await request('PUT', `/api/admin/skill-catalog/${v2.id}/skills/comunicacion`, { ...ADMIN, body: skillBody('comunicacion', { labels: { es: 'Comunicación revisada', en: 'Revised communication' } }) });
  await request('POST', `/api/admin/skill-catalog/${v2.id}/publish`, ADMIN);
  const entry = (await request('GET', '/api/skill-map', U)).body.skills.find((s) => s.skillKey === 'comunicacion');
  assert.deepEqual([entry.self.level, entry.self.catalogOutdated, entry.labels.es], [3, true, 'Comunicación revisada']);
});

test('ES-29 aislamiento: cada persona ve solo su mapa y las evidencias ajenas no sirven', async (t) => {
  install();
  const request = await startApp(t);
  await publishCatalog(request);
  const e = await addEvidence(101);
  await self(request, U, { skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: e.id, version: 1 }] });
  assert.equal((await request('GET', '/api/skill-map', V)).body.skills[0].self, null);
  for (const role of ['admin', 'superadmin', 'therapist', 'facilitator']) {
    assert.equal((await request('GET', '/api/skill-map', { role, id: 303 })).body.skills[0].self, null);
  }
  assert.equal((await request('GET', '/api/skill-map')).status, 403);
  const stolen = await self(request, V, { skillKey: 'comunicacion', level: 2, evidenceRefs: [{ evidenceId: e.id, version: 1 }] });
  assert.equal(stolen.body.code, 'evidence_not_valid');
});

test('ES-29 validador de la salida de un modelo: descarta lo inválido y nunca acepta una confianza declarada', () => {
  const skillKeys = new Set(['comunicacion', 'planificacion']);
  const ev = new Map([[7, { version: 2, payload: { title: 't', situation: 'Coordiné a cuatro personas', delivered: { text: 'Entregué el informe', source: 'self_report' } } }]]);
  const ref = (over = {}) => ({ evidenceId: 7, version: 2, ...over });
  const item = (over = {}) => ({ skillKey: 'comunicacion', level: 2, evidenceRefs: [ref()], rationale: 'Porque coordinó al equipo', ...over });
  const run = (output) => skillMap.validateAssessmentOutput(output, { skillKeys, evidence: ev });
  assert.equal(run([item(), item({ skillKey: 'planificacion', level: null, evidenceRefs: [] })]).valid.length, 2);
  const reasons = (over) => run([item(over)]).rejected[0]?.reason;
  assert.equal(reasons({ skillKey: 'inventada' }), 'unknown_skill');
  assert.equal(reasons({ level: 5 }), 'level');
  assert.equal(reasons({ level: 2, evidenceRefs: [] }), 'level_without_evidence');
  assert.equal(reasons({ evidenceRefs: [ref({ evidenceId: 8 })] }), 'evidence_not_owned_or_stale'); // evidencia ajena o inexistente
  assert.equal(reasons({ evidenceRefs: [ref({ version: 1 })] }), 'evidence_not_owned_or_stale'); // versión no vigente
  assert.equal(reasons({ evidenceRefs: [ref({ quote: 'esto nunca se dijo' })] }), 'quote_not_found'); // cita inventada
  assert.equal(run([item({ evidenceRefs: [ref({ quote: 'coordiné a CUATRO personas' })] })]).valid.length, 1); // cita real (normalizada)
  assert.equal(reasons({ confidence: 'high' }), 'schema'); // la confianza del modelo no se acepta
  assert.equal(reasons({ extra: 1 }), 'schema');
  assert.equal(reasons({ rationale: '' }), 'rationale');
  assert.equal(run([item(), item()]).rejected[0].reason, 'duplicate_skill');
  assert.equal(run('no es una lista').rejected[0].reason, 'schema');
  assert.equal(run(Array.from({ length: 21 }, () => item())).valid.length, 0);
  const clean = run([item({ rationale: 'clave sk-abcdefghijklmnopqrstuvwxyz‮' })]).valid[0].rationale;
  assert.doesNotMatch(clean, /sk-abcdef|‮/);
});

test('ES-29 frontera en el código: el Skill Map solo lee evidencias confirmadas y ningún módulo toca ánimo, diario, chat ni crisis', () => {
  const read = (...p) => fs.readFileSync(path.resolve(__dirname, '..', ...p), 'utf8');
  const code = read('utils', 'skillMap.js').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  for (const forbidden of ['MoodLog', 'SessionRating', 'DiaryEntry', 'ChatTurn', "'../message'", "'./safety'", 'detectRisk', 'mood', 'ánimo']) {
    assert.ok(!code.toLowerCase().includes(forbidden.toLowerCase()), 'no debe usar ' + forbidden);
  }
  assert.match(code, /getConfirmedEvidence/);
  const routes = ['skillMap.js', 'skillCatalog.js'].map((f) => read('routes', f).split('\n').filter((l) => !l.startsWith('//')).join('\n')).join('\n');
  assert.doesNotMatch(routes, /MoodLog|DiaryEntry|ChatTurn/);
  // el nivel nunca se calcula con una fórmula: solo se guarda lo que la persona fijó con evidencia
  assert.doesNotMatch(code, /Math\.(round|floor|ceil)|reduce\(/);
});

test('ES-29 borrador de catálogo inicial: válido para el backoffice, sin fuente ni verificador y por tanto NO publicable', () => {
  const catalog = require('../utils/skillCatalog');
  const seed = require('../seeds/skillCatalogDraft.json');
  assert.match(seed.notice, /BORRADOR SIN VERIFICAR/);
  assert.equal(seed.skills.length, 8);
  const keys = new Set();
  for (const skill of seed.skills) {
    assert.ok(catalog.KEY_RE.test(skill.skillKey) && !keys.has(skill.skillKey));
    keys.add(skill.skillKey);
    const def = catalog.normalizeDefinition({ type: skill.type, labels: skill.labels, rubric: { levels: skill.levels } });
    assert.deepEqual(catalog.missingFor(def), ['rubric.source', 'rubric.verifiedBy', 'rubric.verifiedAt']); // solo faltan los datos que debe poner el cliente
  }
});
