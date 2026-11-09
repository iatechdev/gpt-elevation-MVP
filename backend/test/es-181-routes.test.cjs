// ES-181: lista de guías por clave, publicar y crear (solo superadministración). Aplicación real por HTTP; persistencia simulada.
// El flujo contra Postgres real está en test/integration/es-181-postgres.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { promptVault, startApp } = require('./support.cjs');

const synthetic = 'Acompaña a la persona con calma y respeto, sin presionarla, y ayúdala a nombrar lo que ya hace bien.';
const hooks = {};
for (const [name, hook] of [['proposePrompt', 'propose'], ['approvePrompt', 'approve']]) promptVault[name] = (...args) => hooks[hook](...args);
const calls = [];
const existing = new Set();
promptVault.PromptVault.count = async ({ where }) => (existing.has(where.key) ? 1 : 0);

test('ES-181: la lista trae una fila por guía, sin texto, con versión activa y pendientes', async (t) => {
  const row = (r) => ({ toJSON: () => ({ updatedBy: null, proposed_by: null, approved_by: null, approved_at: null, isActive: false, ...r }) });
  promptVault.PromptVault.findAll = async () => [
    row({ key: 'b_guia', version: 1, status: 'approved', updatedAt: '2026-11-01T10:00:00Z' }),
    row({ key: 'b_guia', version: 2, status: 'active', isActive: true, updatedBy: 'Ana', approved_by: 'Sup', approved_at: '2026-11-02T10:00:00Z', updatedAt: '2026-11-02T10:00:00Z' }),
    row({ key: 'b_guia', version: 3, status: 'pending_review', updatedAt: '2026-11-03T10:00:00Z' }),
    row({ key: 'a_guia', version: 1, status: 'active', isActive: true, proposed_by: 'Luz', updatedAt: '2026-11-04T10:00:00Z' }),
  ];
  const request = await startApp(t);
  for (const role of [undefined, 'user', 'therapist', 'board']) assert.equal((await request('GET', '/api/admin/prompts', { role })).status, 403);
  const response = await request('GET', '/api/admin/prompts', { role: 'admin' });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual(response.body.map((g) => g.key), ['a_guia', 'b_guia']);
  const b = response.body[1];
  assert.equal(b.activeVersion, 2); assert.equal(b.approvedBy, 'Sup'); assert.equal(b.pendingCount, 1); assert.equal(b.versionCount, 3); assert.equal(b.lastChangeAt, '2026-11-03T10:00:00Z');
  assert.equal(response.body[0].activeBy, 'Luz');
  assert.ok(!JSON.stringify(response.body).includes('content'), 'la lista nunca lleva texto');
});

test('ES-181: publicar y crear solo los hace superadministración; admin recibe 403 y nada se guarda', async (t) => {
  hooks.propose = async () => { calls.push('propose'); return { id: 9, version: 2, status: 'pending_review', reasons: [] }; };
  hooks.approve = async () => { calls.push('approve'); };
  existing.add('guia_a');
  const request = await startApp(t);
  for (const path of ['publish', 'create']) {
    for (const role of [undefined, 'user', 'therapist', 'board', 'admin']) {
      const response = await request('POST', `/api/superadmin/prompt/${path}`, { role, body: { key: 'guia_a', content: synthetic } });
      assert.ok([401, 403].includes(response.status), `${path} ${role}`);
    }
    // por el montaje de administración también: ahí lo para verificarSuperAdmin de la ruta
    assert.equal((await request('POST', `/api/admin/prompt/${path}`, { role: 'admin', body: { key: 'guia_a', content: synthetic } })).status, 403);
  }
  assert.deepEqual(calls, []);
});

test('ES-181: publicar propone y aprueba; una guía rechazada por la revisión no se activa; clave inexistente 404', async (t) => {
  calls.length = 0; existing.clear(); existing.add('guia_a');
  hooks.propose = async (key, content, actor) => { calls.push(['propose', key, actor]); return { id: 9, version: 4, status: 'pending_review', reasons: [] }; };
  hooks.approve = async (id, actor) => { calls.push(['approve', id, actor]); };
  const request = await startApp(t);
  const ok = await request('POST', '/api/superadmin/prompt/publish', { role: 'superadmin', body: { key: 'guia_a', content: synthetic } });
  assert.equal(ok.status, 200); assert.equal(ok.body.version.status, 'active'); assert.equal(ok.body.version.version, 4);
  assert.deepEqual(calls.map((c) => c[0]), ['propose', 'approve']); assert.equal(calls[1][1], 9);
  assert.equal((await request('POST', '/api/superadmin/prompt/publish', { role: 'superadmin', body: { key: 'no_existe', content: synthetic } })).status, 404);
  assert.equal((await request('POST', '/api/superadmin/prompt/publish', { role: 'superadmin', body: { key: 'a b', content: synthetic } })).status, 400);
  calls.length = 0;
  hooks.propose = async () => { calls.push(['propose']); return { id: 10, version: 5, status: 'rejected', reasons: [{ code: 'diagnosis' }] }; };
  const rejected = await request('POST', '/api/superadmin/prompt/publish', { role: 'superadmin', body: { key: 'guia_a', content: synthetic } });
  assert.equal(rejected.status, 422); assert.equal(rejected.body.code, 'prompt_rejected');
  assert.deepEqual(calls.map((c) => c[0]), ['propose'], 'rechazada por la revisión: no se aprueba');
});

test('ES-181: crear exige identificador [a-z][a-z0-9_]* único; un cuerpo mal formado nunca da 500', async (t) => {
  calls.length = 0; existing.clear(); existing.add('ya_existe');
  hooks.propose = async (key) => { calls.push(['propose', key]); return { id: 11, version: 2, status: 'pending_review', reasons: [] }; };
  hooks.approve = async () => { calls.push(['approve']); };
  const request = await startApp(t);
  const create = (body) => request('POST', '/api/superadmin/prompt/create', { role: 'superadmin', body });
  for (const key of ['Mayuscula', '1empieza', 'con-guion', 'con espacio', '', 'x'.repeat(101), '../etc']) assert.equal((await create({ key, content: synthetic })).status, 400, key);
  assert.equal((await create({ key: 'ya_existe', content: synthetic })).body.code, 'key_exists');
  assert.equal((await create({ key: 'ya_existe', content: synthetic })).status, 409);
  for (const body of [undefined, [], { key: 'nueva' }, { key: { $ne: 1 }, content: synthetic }, { key: 'nueva', content: 5 }]) assert.equal((await create(body)).status, 400);
  assert.deepEqual(calls, []);
  const ok = await create({ key: 'guia_nueva', content: synthetic });
  assert.equal(ok.status, 200); assert.deepEqual(calls.map((c) => c[0]), ['propose', 'approve']);
});
