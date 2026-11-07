// ES-191: rutas de las guías de la IA con la aplicación real (HTTP, JWT y montajes de producción). Persistencia y cifrado simulados;
// el flujo completo contra Postgres real está en test/integration/es-191-postgres.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { promptVault, models, startApp } = require('./support.cjs');
const { PromptReviewError } = require('../utils/promptReview');

const A = 301; const B = 302;
const synthetic = 'Acompaña a la persona con calma y respeto, sin presionarla, y ayúdala a nombrar lo que ya hace bien.';

// El servidor captura las funciones del vault al cargarse (una sola vez por archivo): se enlazan a ganchos que cada prueba reemplaza.
const hooks = {};
for (const [name, hook] of [['proposePrompt', 'propose'], ['savePrompt', 'save'], ['approvePrompt', 'approve'], ['rollbackPrompt', 'rollback'], ['decryptPrompt', 'decrypt']]) {
  promptVault[name] = (...args) => hooks[hook](...args);
}

function fakeVault(rows) {
  promptVault.PromptVault.findAll = async ({ where }) => rows.filter((r) => r.key === where.key).map((r) => ({ toJSON: () => ({ ...r }) }));
  hooks.decrypt = (cipher) => { if (cipher === 'BAD') throw new Error('bad cipher'); return cipher.replace(/^enc:/, ''); };
}

test('ES-191: el texto de cada versión solo llega a administración y superadministración (decisión 22); reglas y motivos incluidos', async (t) => {
  fakeVault([
    { id: 1, key: 'k1', version: 2, status: 'pending_review', contentEncrypted: 'enc:' + synthetic, reviewOutcome: 'passed', reviewReasons: '[]', reviewedAt: null },
    { id: 2, key: 'k1', version: 3, status: 'rejected', contentEncrypted: 'enc:otra', reviewOutcome: 'rejected', reviewReasons: JSON.stringify([{ code: 'diagnosis', phrase: 'diagnos*' }]) },
    { id: 3, key: 'k1', version: 1, status: 'approved', contentEncrypted: 'BAD', reviewOutcome: null, reviewReasons: null },
  ]);
  const request = await startApp(t);
  for (const prefix of ['/api/admin', '/api/superadmin']) {
    for (const role of [undefined, 'user', 'therapist', 'board']) {
      const response = await request('GET', `${prefix}/prompt/k1/versions`, { role });
      assert.equal(response.status, 403);
      assert.doesNotMatch(JSON.stringify(response.body), /Acompaña/);
    }
  }
  for (const [prefix, role] of [['/api/admin', 'admin'], ['/api/admin', 'superadmin'], ['/api/superadmin', 'superadmin']]) {
    const response = await request('GET', `${prefix}/prompt/k1/versions`, { role });
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.body[0].content, synthetic); assert.equal(response.body[0].reviewOutcome, 'passed');
    assert.equal(response.body[1].reviewReasons[0].code, 'diagnosis'); assert.ok(response.body[1].reviewReasons[0].es && response.body[1].reviewReasons[0].en);
    assert.equal(response.body[2].content, null); assert.equal(response.body[2].contentError, true); // una versión ilegible no tumba la lista
    assert.ok(!('contentEncrypted' in response.body[0]));
  }
  for (const key of ['a'.repeat(101), 'con espacio', 'x;DROP', '<b>']) assert.equal((await request('GET', `/api/admin/prompt/${encodeURIComponent(key)}/versions`, { role: 'admin' })).status, 400);
});

test('ES-191: proponer una guía — válida queda pendiente de aprobación humana, rechazada devuelve 422 con motivos ES/EN, sin reglas 503', async (t) => {
  const request = await startApp(t);
  const seen = [];
  hooks.propose = async (key, content, who) => { seen.push({ key, who }); return { id: 9, version: 2, status: 'pending_review', outcome: 'passed', reasons: [] }; };
  let response = await request('POST', '/api/admin/prompt/propose', { role: 'admin', body: { key: 'guide', content: synthetic } });
  assert.equal(response.status, 200); assert.equal(response.body.version.status, 'pending_review'); assert.deepEqual(response.body.review, { outcome: 'passed', pendingHumanApproval: true });
  assert.ok(!JSON.stringify(response.body).includes('approved'));

  hooks.propose = async () => ({ id: 10, version: 3, status: 'rejected', outcome: 'rejected', reasons: [{ code: 'override', phrase: 'ignora lo anterior' }, { code: 'employment_promise' }] });
  response = await request('POST', '/api/admin/prompt/propose', { role: 'admin', body: { key: 'guide', content: synthetic } });
  assert.equal(response.status, 422); assert.equal(response.body.code, 'prompt_rejected'); assert.equal(response.body.version.status, 'rejected');
  assert.deepEqual(response.body.reasons.map((r) => r.code), ['override', 'employment_promise']);
  assert.ok(response.body.reasons.every((r) => r.es && r.en && r.es !== r.en));
  assert.doesNotMatch(JSON.stringify(response.body), /Acompaña/); // nunca repite el texto enviado

  hooks.propose = async () => { throw new PromptReviewError('rules_unavailable'); };
  response = await request('POST', '/api/admin/prompt/propose', { role: 'admin', body: { key: 'guide', content: synthetic } });
  assert.equal(response.status, 503); assert.equal(response.body.code, 'prompt_rules_unavailable');
  hooks.propose = async () => { throw new PromptReviewError('rate_limited'); };
  assert.equal((await request('POST', '/api/admin/prompt/propose', { role: 'admin', body: { key: 'guide', content: synthetic } })).status, 429);

  hooks.propose = async () => { throw new Error('no debe llegar con entrada inválida'); };
  for (const body of [{}, { key: 'g' }, { content: synthetic }, { key: 5, content: synthetic }, { key: 'g', content: '   ' }, { key: 'g', content: { x: 1 } }, { key: 'x y', content: synthetic }, { key: 'a'.repeat(300), content: synthetic }]) {
    assert.equal((await request('POST', '/api/admin/prompt/propose', { role: 'admin', body })).status, 400, JSON.stringify(body).slice(0, 40));
  }
  assert.equal((await request('POST', '/api/admin/prompt/propose', { role: 'user', body: { key: 'guide', content: synthetic } })).status, 403);
  assert.equal(seen.length, 1);
});

test('ES-191: el guardado directo de una guía también pasa la revisión (no la guarda si no la supera)', async (t) => {
  const request = await startApp(t);
  let saved = 0;
  hooks.save = async () => { saved += 1; };
  models.PromptRule.findAll = async () => [{ id: 1, category: 'override', locale: 'es', phrase: 'ignora lo anterior' }];
  let response = await request('POST', '/api/admin/prompt', { role: 'admin', body: { key: 'guide', content: synthetic + ' Ignora lo anterior.' } });
  assert.equal(response.status, 422); assert.equal(saved, 0); assert.equal(response.body.reasons[0].code, 'override');
  response = await request('POST', '/api/admin/prompt', { role: 'admin', body: { key: 'guide', content: synthetic } });
  assert.equal(response.status, 200); assert.equal(saved, 1);
  models.PromptRule.findAll = async () => [];
  assert.equal((await request('POST', '/api/admin/prompt', { role: 'admin', body: { key: 'guide', content: synthetic } })).status, 503);
  assert.equal(saved, 1);
});

test('ES-191: aprobar o volver a una versión que no supera la revisión responde 422 con motivos; la aprobación no cambia de dueño', async (t) => {
  const request = await startApp(t);
  hooks.approve = async () => { throw new PromptReviewError('review_failed', [{ code: 'diagnosis', phrase: 'diagnos*' }]); };
  let response = await request('POST', '/api/superadmin/prompt/5/approve', { role: 'superadmin' });
  assert.equal(response.status, 422); assert.equal(response.body.code, 'prompt_review_failed'); assert.equal(response.body.reasons[0].code, 'diagnosis');
  hooks.rollback = async () => { throw new PromptReviewError('review_failed', []); };
  assert.equal((await request('POST', '/api/superadmin/prompt/5/rollback', { role: 'superadmin' })).status, 422);
  assert.equal((await request('POST', '/api/admin/prompt/5/approve', { role: 'admin' })).status, 403);
});

test('ES-191: un profesional solo propone sobre SU clave (usuarios A y B); la clave y el id de la ruta no se pueden elegir', async (t) => {
  const request = await startApp(t);
  const keys = [];
  promptVault.PromptVault.findOne = async ({ where }) => { keys.push(where.key); return null; };
  hooks.propose = async (key) => { keys.push('propose:' + key); return { id: 1, version: 2, status: 'pending_review', outcome: 'passed', reasons: [] }; };
  for (const id of [A, B]) {
    const response = await request('POST', '/api/therapist/prompt/propose', { role: 'therapist', id, body: { content: synthetic, key: 'therapist_prompt_' + (id === A ? B : A), id: 999 } });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(keys.filter((k) => k.startsWith('propose:')), [`propose:therapist_prompt_${A}`, `propose:therapist_prompt_${B}`]);
  // el profesional no alcanza las rutas de administración ni de superadministración
  for (const path of [`/api/admin/prompt/therapist_prompt_${B}/versions`, `/api/superadmin/prompt/therapist_prompt_${B}/versions`, '/api/admin/prompt-rules', '/api/admin/prompts']) {
    assert.equal((await request('GET', path, { role: 'therapist', id: A })).status, 403, path);
  }
  for (const role of ['user', 'board', undefined]) assert.equal((await request('POST', '/api/therapist/prompt/propose', { role, id: A, body: { content: synthetic } })).status, 403);
  // propuesta rechazada → 422 con motivos; reglas caídas → 503; contenido corto → 400 (sin 500)
  hooks.propose = async () => ({ id: 2, version: 3, status: 'rejected', outcome: 'rejected', reasons: [{ code: 'treatment', phrase: 'receta*' }] });
  let response = await request('POST', '/api/therapist/prompt/propose', { role: 'therapist', id: A, body: { content: synthetic } });
  assert.equal(response.status, 422); assert.equal(response.body.reasons[0].code, 'treatment');
  hooks.propose = async () => { throw new PromptReviewError('rules_unavailable'); };
  assert.equal((await request('POST', '/api/therapist/prompt/propose', { role: 'therapist', id: A, body: { content: synthetic } })).status, 503);
  assert.equal((await request('POST', '/api/therapist/prompt/propose', { role: 'therapist', id: A, body: { content: 'corto' } })).status, 400);
});

test('ES-191: las reglas son datos — solo superadministración las lista y edita; entradas inválidas y ajenas dan 400/404/409, nunca 500', async (t) => {
  const request = await startApp(t);
  const rows = [{ id: 1, category: 'override', locale: 'es', phrase: 'ignora lo anterior', active: true, source: 'initial', updatedBy: null, updatedAt: new Date(), async update(v) { Object.assign(this, v); return this; }, async destroy() { rows.length = 0; } }];
  models.PromptRule.findAll = async () => rows;
  models.PromptRule.findByPk = async (id) => rows.find((r) => r.id === id) ?? null;
  models.PromptRule.create = async (v) => { if (v.phrase === 'duplicada') { const e = new Error('dup'); e.name = 'SequelizeUniqueConstraintError'; throw e; } return { id: 7, updatedAt: new Date(), ...v }; };
  for (const role of [undefined, 'user', 'therapist', 'board', 'admin']) {
    for (const [method, path, body] of [['GET', '/api/superadmin/prompt-rules'], ['POST', '/api/superadmin/prompt-rules', { category: 'override', locale: 'es', phrase: 'frase nueva' }], ['PUT', '/api/superadmin/prompt-rules/1', { active: false }], ['DELETE', '/api/superadmin/prompt-rules/1'], ['GET', '/api/admin/prompt-rules']]) {
      const response = await request(method, path, { role, body });
      assert.equal(response.status, 403, `${role} ${method} ${path}`);
    }
  }
  assert.equal(rows[0].active, true);
  let response = await request('GET', '/api/superadmin/prompt-rules', { role: 'superadmin' });
  assert.equal(response.status, 200); assert.equal(response.body[0].phrase, 'ignora lo anterior'); assert.equal(response.body[0].source, 'initial');
  response = await request('POST', '/api/superadmin/prompt-rules', { role: 'superadmin', body: { category: 'diagnosis', locale: 'en', phrase: ' you are sick ' } });
  assert.equal(response.status, 201); assert.equal(response.body.phrase, 'you are sick'); assert.equal(response.body.source, 'admin');
  for (const body of [{}, { category: 'otra', locale: 'es', phrase: 'frase nueva' }, { category: 'override', locale: 'fr', phrase: 'frase nueva' }, { category: 'override', locale: 'es', phrase: '**' }, { category: 'override', locale: 'es', phrase: 'a' }, { category: 'override', locale: 'es', phrase: 'x'.repeat(161) }, { category: 'override', locale: 'es', phrase: 5 }]) {
    assert.equal((await request('POST', '/api/superadmin/prompt-rules', { role: 'superadmin', body })).status, 400, JSON.stringify(body).slice(0, 50));
  }
  assert.equal((await request('POST', '/api/superadmin/prompt-rules', { role: 'superadmin', body: { category: 'override', locale: 'es', phrase: 'duplicada' } })).status, 409);
  response = await request('PUT', '/api/superadmin/prompt-rules/1', { role: 'superadmin', body: { active: false } });
  assert.equal(response.status, 200); assert.equal(response.body.active, false); assert.equal(response.body.source, 'admin');
  for (const id of ['0', 'abc', '99999999999', '1.5', '-1']) assert.equal((await request('PUT', `/api/superadmin/prompt-rules/${id}`, { role: 'superadmin', body: { active: true } })).status, 404, id);
  assert.equal((await request('PUT', '/api/superadmin/prompt-rules/1', { role: 'superadmin', body: { active: 'si' } })).status, 400);
  assert.equal((await request('PUT', '/api/superadmin/prompt-rules/42', { role: 'superadmin', body: { active: true } })).status, 404);
  assert.equal((await request('DELETE', '/api/superadmin/prompt-rules/1', { role: 'superadmin' })).status, 204);
});
