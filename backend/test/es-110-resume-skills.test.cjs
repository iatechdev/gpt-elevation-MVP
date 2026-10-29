// ES-110: habilidades declaradas en la hoja de vida → «Mis evidencias», solo las que la persona acepta. Express real; persistencia simulada en memoria.
// Una habilidad declarada NO es evidencia verificada: borrador, sin nivel, con origen y con el texto exacto que la respalda.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, record, startApp } = require('./support.cjs');
const evidence = require('../utils/evidence');
const { desencriptar } = require('../utils/crypto');

const ME = { role: 'user', id: 101 }; const OTHER = { role: 'user', id: 202 };
const SKILLS = [
  { name: 'Power BI', support: 'Construí tableros en Power BI para el equipo comercial', resumeVersion: 3 },
  { name: 'SQL', support: 'Consultas SQL para reportes semanales', resumeVersion: 3 },
  { name: 'Gestión de proyectos', support: 'Coordiné lanzamientos con 4 equipos', resumeVersion: 3 },
  { name: 'Storytelling con datos', support: 'Presentaciones ejecutivas con datos', resumeVersion: 3 }, // no está en el catálogo
  { name: 'Excel', support: null, resumeVersion: 3 }, // sin cita de respaldo
  { name: 'Python', support: 'Scripts de Python', resumeVersion: null }, // escrita a mano, no viene de una hoja de vida
  { name: 'Inglés técnico', support: 'Documentación en inglés', resumeVersion: 9 }, // su hoja de vida ya no existe
];
const CATALOG = [['analisis_datos', 'Análisis de datos', 'Data analysis'], ['gestion_proyectos', 'Gestión de proyectos', 'Project management'], ['power_bi', 'Power BI', 'Power BI'], ['sql', 'SQL', 'SQL'], ['excel', 'Excel', 'Excel']];

function install({ catalog = true, skills = SKILLS } = {}) {
  const state = { evidences: [], versions: [], assessments: 0, resumes: [{ id: 31, version: 3, createdAt: new Date('2026-10-12T12:00:00Z') }], nextId: 1 };
  const context = (userId) => (userId === 101 ? { preferredLanguage: 'es', residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null,
    sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: skills, languages: [] } : null);
  models.ParticipantContext.findOne = async ({ where }) => { const c = context(where.UserId); return c ? record({ UserId: where.UserId, content: JSON.stringify(c) }) : null; };
  models.ParticipantResume.findAll = async ({ where }) => (where.UserId === 101 ? state.resumes : []);
  models.User.findOne = async () => record({ id: 101 });
  models.SkillCatalog.findOne = async () => (catalog ? record({ id: 1, version: 2 }) : null);
  models.SkillDefinition.findAll = async () => CATALOG.map(([skillKey, es, en]) => record({ skillKey, type: 'domain', labels: { es, en }, rubric: { levels: { 1: { es: 'a', en: 'a' } } } }));
  models.SkillAssessment.create = async () => { state.assessments++; return {}; };
  models.Evidence.create = async (v) => { const row = record({ id: state.nextId++, ...v, deletedAt: null }); row.update = async (u) => Object.assign(row, u); state.evidences.push(row); return row; };
  models.Evidence.findAll = async ({ where }) => state.evidences.filter((e) => e.UserId === where.UserId && e.deletedAt === null);
  models.Evidence.findOne = async ({ where }) => state.evidences.find((e) => e.id === where.id && e.UserId === where.UserId && e.deletedAt === null) ?? null;
  models.EvidenceVersion.create = async (v) => { const row = record({ createdAt: new Date('2026-10-29T12:00:00Z'), ...v }); row.update = async (u) => Object.assign(row, u); state.versions.push(row); return row; };
  models.EvidenceVersion.findAll = async ({ where }) => state.versions.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));
  models.EvidenceVersion.findOne = async ({ where }) => state.versions.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) ?? null;
  models.DerivedInvalidation.create = async (v) => v;
  return state;
}
const post = (request, body, as = ME) => request('POST', '/api/user/resume-skills/promote', { ...as, body });
const payloadOf = (row) => JSON.parse(desencriptar(row.payload));

test('ES-110 lista: solo habilidades de una hoja de vida que existe, clasificadas con el catálogo vigente (ES/EN, sin acentos ni mayúsculas) y las demás «sin clasificar»', async (t) => {
  install(); const request = await startApp(t);
  const res = await request('GET', '/api/user/resume-skills', ME);
  assert.equal(res.status, 200); assert.equal(res.body.skills.some((s) => s.name === 'Python'), false, 'una habilidad escrita a mano no es de la hoja de vida');
  assert.equal(res.body.skills.some((s) => s.name === 'Inglés técnico'), false, 'si la versión de origen se borró, no hay de dónde sacarla');
  const by = Object.fromEntries(res.body.skills.map((s) => [s.name, s]));
  assert.deepEqual(by['Power BI'].classified, { skillKey: 'power_bi', labels: { es: 'Power BI', en: 'Power BI' } });
  assert.equal(by['Gestión de proyectos'].classified.skillKey, 'gestion_proyectos'); assert.equal(by['Storytelling con datos'].classified, null);
  assert.deepEqual(by.SQL.resume, { id: 31, version: 3, createdAt: '2026-10-12T12:00:00.000Z' }); assert.equal(by.SQL.added, false);
  assert.equal(JSON.stringify(res.body).includes('level'), false, 'ninguna habilidad declarada trae nivel');
  // Sin catálogo publicado no se clasifica nada.
  install({ catalog: false }); assert.equal((await request('GET', '/api/user/resume-skills', ME)).body.skills.every((s) => s.classified === null), true);
  // Coincidencia sin acentos ni mayúsculas.
  install({ skills: [{ name: 'ANALISIS DE DATOS', support: 'Análisis semanal', resumeVersion: 3 }] }); assert.equal((await request('GET', '/api/user/resume-skills', ME)).body.skills[0].classified.skillKey, 'analisis_datos');
  // Otra persona no ve ni usa el contexto ajeno.
  install(); assert.deepEqual((await request('GET', '/api/user/resume-skills', OTHER)).body.skills, []);
});

test('ES-110 elegir: ninguna por defecto; solo lo elegido pasa; borrador sin nivel, con origen y con el texto que la respalda; sin clasificar, sin cita y ajenas se saltan', async (t) => {
  const state = install(); const request = await startApp(t);
  assert.equal((await post(request, { requestId: 'abcdefgh1', names: [] })).status, 400); // por defecto nada: sin elegir no se añade
  assert.equal((await request('GET', '/api/evidence', ME)).body.evidence.length, 0);
  const res = await post(request, { requestId: 'req-0001-abcdef', names: ['Power BI', 'SQL', 'Storytelling con datos', 'Excel', 'Inventada', 'Python'] });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.created.map((c) => [c.name, c.skillKey]), [['Power BI', 'power_bi'], ['SQL', 'sql']]);
  assert.deepEqual(Object.fromEntries(res.body.skipped.map((s) => [s.name, s.reason])), { 'Storytelling con datos': 'unclassified', Excel: 'no_support', Inventada: 'not_declared', Python: 'not_declared' });
  assert.equal(state.versions.length, 2); assert.equal(state.assessments, 0, 'no se crea ninguna evaluación: sin nivel');
  const row = state.versions.find((v) => payloadOf(v).title === 'Power BI');
  assert.deepEqual([row.status, row.authoring, row.hasChatOrigin, row.consentVersion], ['draft', 'person', false, null]); // nunca confirmada
  assert.deepEqual(payloadOf(row), { title: 'Power BI', artifactRefs: [{ kind: 'text', excerpt: 'Construí tableros en Power BI para el equipo comercial' }] });
  assert.deepEqual(row.origins, [{ type: 'resume', id: 31, version: 3, stamp: '2026-10-12T12:00:00.000Z', skillKey: 'power_bi' }]);
  // La lista de evidencias muestra el origen y que no falta nada; la de habilidades marca lo ya añadido.
  const list = await request('GET', '/api/evidence', ME);
  assert.deepEqual(list.body.evidence.map((e) => e.origin), [{ kind: 'resume', version: 3, date: '2026-10-12T12:00:00.000Z', needsReview: false }, { kind: 'resume', version: 3, date: '2026-10-12T12:00:00.000Z', needsReview: false }]);
  assert.equal(JSON.stringify(list.body).includes('"level"'), false); assert.equal(list.body.evidence.every((e) => e.status === 'draft'), true);
  const skills = Object.fromEntries((await request('GET', '/api/user/resume-skills', ME)).body.skills.map((s) => [s.name, s.added])); assert.deepEqual([skills['Power BI'], skills.SQL, skills['Gestión de proyectos']], [true, true, false]);
  // El motor solo lee evidencia CONFIRMADA: una habilidad declarada nunca cuenta como validada.
  assert.deepEqual(await evidence.getConfirmedEvidence(101, 'engine'), []);
});

test('ES-110 idempotencia: confirmar dos veces con el mismo requestId no duplica; otra confirmación de lo ya añadido se salta', async (t) => {
  const state = install(); const request = await startApp(t);
  const first = await post(request, { requestId: 'same-request-01', names: ['SQL'] }); const again = await post(request, { requestId: 'same-request-01', names: ['SQL'] });
  assert.deepEqual([first.body.created[0].replayed, again.body.created[0].replayed, again.body.created[0].id], [false, true, first.body.created[0].id]); assert.equal(state.versions.length, 1);
  const other = await post(request, { requestId: 'other-request-02', names: ['SQL'] });
  assert.deepEqual([other.body.created, other.body.skipped], [[], [{ name: 'SQL', reason: 'already_added' }]]); assert.equal(state.versions.length, 1);
  // Al borrar la evidencia, la habilidad vuelve a poder añadirse.
  await request('DELETE', `/api/evidence/${first.body.created[0].id}`, ME);
  const readded = await post(request, { requestId: 'third-request-03', names: ['SQL'] }); assert.equal(readded.body.created.length, 1); assert.equal(readded.body.created[0].replayed, false);
});

test('ES-110 entradas: forma exacta, requestId, tope y roles; sin sesión o con otro rol responde 403 y nunca crea', async (t) => {
  const state = install(); const request = await startApp(t);
  for (const body of [null, [], {}, { names: ['SQL'] }, { requestId: 'x', names: ['SQL'] }, { requestId: 'req-ok-123456', names: 'SQL' }, { requestId: 'req-ok-123456', names: [5] }, { requestId: 'req-ok-123456', names: [''] },
    { requestId: 'req-ok-123456', names: ['x'.repeat(61)] }, { requestId: 'req-ok-123456', names: Array.from({ length: 41 }, (_, i) => `H${i}`) }, { requestId: 'req-ok-123456', names: ['SQL'], userId: 202 }, { requestId: 'req ok 123456', names: ['SQL'] }]) {
    assert.equal((await post(request, body)).status, 400, JSON.stringify(body)?.slice(0, 60));
  }
  for (const as of [{ role: 'therapist', id: 301 }, { role: 'admin', id: 9 }, {}]) { assert.equal((await post(request, { requestId: 'req-ok-123456', names: ['SQL'] }, as)).status, 403); assert.equal((await request('GET', '/api/user/resume-skills', as)).status, 403); }
  assert.equal(state.versions.length, 0);
  const own = await post(request, { requestId: 'req-ok-123456', names: ['SQL'], }, OTHER); assert.deepEqual(own.body.skipped, [{ name: 'SQL', reason: 'not_declared' }]); assert.equal(state.versions.length, 0, 'el contexto de otra persona no se usa');
});

test('ES-110 origen: se conserva al editar (el cliente no puede crearlo ni quitarlo), «para revisión» si la hoja de vida se borró y el chat solo informa que existe', async (t) => {
  const state = install(); const request = await startApp(t);
  const created = (await post(request, { requestId: 'req-origin-0001', names: ['Power BI'] })).body.created[0];
  const forged = await request('POST', '/api/evidence', { ...ME, body: { payload: { title: 'Mía', situation: 'x' }, status: 'draft', requestId: 'forged-0001', origins: [{ type: 'resume', id: 31 }] } });
  assert.equal(forged.status, 400); // el origen «hoja de vida» es del servidor
  // Editar (sin enviar origen) NO lo pierde, y la versión nueva sigue apuntando a la misma hoja de vida.
  const edit = await request('PUT', `/api/evidence/${created.id}`, { ...ME, body: { payload: { title: 'Power BI', situation: 'Tableros para ventas', artifactRefs: [{ kind: 'text', excerpt: 'Construí tableros en Power BI para el equipo comercial' }] }, status: 'draft', baseVersion: 1, requestId: 'edit-0001-abcd' } });
  assert.equal(edit.status, 201, JSON.stringify(edit.body)); // una versión nueva = 201
  const v2 = state.versions.find((v) => v.version === 2); assert.deepEqual(v2.origins, [{ type: 'resume', id: 31, version: 3, stamp: '2026-10-12T12:00:00.000Z', skillKey: 'power_bi' }]); assert.equal(v2.hasChatOrigin, false);
  assert.equal((await request('GET', `/api/evidence/${created.id}`, ME)).body.versions.every((v) => v.origin && v.origin.needsReview === false), true);
  // Se borra la hoja de vida de origen: la evidencia sigue ahí y pasa a «para revisión»; nada se borra solo.
  state.resumes = [];
  const list = await request('GET', '/api/evidence', ME); assert.equal(list.body.evidence.length, 1); assert.equal(list.body.evidence[0].origin.needsReview, true); assert.equal(list.body.evidence[0].payload.title, 'Power BI');
  assert.equal((await request('GET', `/api/evidence/${created.id}`, ME)).body.versions.every((v) => v.origin.needsReview === true), true);
  assert.equal((await request('GET', '/api/user/resume-skills', ME)).body.skills.length, 0, 'sin hoja de vida de origen no hay habilidades para añadir');
  // Del chat solo se informa que lo hay (sin ids ni citas).
  const current = state.versions.find((v) => v.version === 2); current.hasChatOrigin = true; current.origins = [{ type: 'chat_turn', id: 77, stamp: 'x', quoteHash: 'h' }];
  const chat = await request('GET', '/api/evidence', ME); assert.equal(chat.body.evidence[0].fromChat, true); assert.equal('origin' in chat.body.evidence[0], false); assert.equal(JSON.stringify(chat.body).includes('77'), false);
});
