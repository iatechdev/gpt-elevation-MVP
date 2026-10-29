// ES-109: contrato del contexto v2 (campos que puede respaldar una hoja de vida). Todo lo nuevo es opcional y nunca se completa por deducción.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, database, record, startApp } = require('./support.cjs');
const { validateContextRequest, upgradeContext, emptyV2, SCHEMA_VERSION } = require('../utils/participantContext');
const { encriptarV2 } = require('../utils/crypto');

const req = (context = {}, extra = {}) => ({ schemaVersion: 2, expectedVersion: 0, action: 'save_draft', context: { ...emptyV2(), ...context }, ...extra });
const bad = (context, field) => { const r = validateContextRequest(req(context)); assert.equal(r.error, 'invalid_context', JSON.stringify(context).slice(0, 80)); assert.ok(r.fields.includes(field), `${field} en ${JSON.stringify(r.fields)}`); };
const ok = context => { const r = validateContextRequest(req(context)); assert.equal(r.error, undefined, JSON.stringify(r)); return r.context; };
const YEAR = new Date().getUTCFullYear();
const job = (extra = {}) => ({ role: 'Líder de diseño', organization: 'Estudio Norte', startYear: 2021, endYear: 2026 > YEAR ? null : 2026, isCurrent: false, ...extra });

test('ES-109: un contexto vacío v2 es válido y todo lo nuevo acepta null o lista vacía', () => {
  const context = ok({});
  assert.deepEqual([context.sector, context.totalYearsExperience, context.experience, context.education, context.declaredSkills, context.languages], [null, null, [], [], [], []]);
  assert.equal(SCHEMA_VERSION, 2);
});

test('ES-109: experiencia — límites de texto, años, periodo coherente y tope de 15', () => {
  assert.equal(ok({ experience: [job()] }).experience.length, 1);
  assert.equal(ok({ experience: [job({ organization: null, startYear: null, endYear: null })] }).experience[0].organization, null);
  assert.equal(ok({ experience: [job({ isCurrent: true, endYear: null })] }).experience[0].isCurrent, true);
  assert.equal(ok({ experience: Array.from({ length: 15 }, () => job()) }).experience.length, 15);
  bad({ experience: Array.from({ length: 16 }, () => job()) }, 'experience');
  bad({ experience: [job({ role: '' })] }, 'experience'); bad({ experience: [job({ role: '   ' })] }, 'experience');
  bad({ experience: [job({ role: 'x'.repeat(121) })] }, 'experience'); bad({ experience: [job({ organization: 'x'.repeat(121) })] }, 'experience');
  bad({ experience: [job({ startYear: 1949 })] }, 'experience'); bad({ experience: [job({ startYear: YEAR + 1, endYear: null })] }, 'experience');
  bad({ experience: [job({ startYear: 2026.5 })] }, 'experience'); bad({ experience: [job({ startYear: '2021' })] }, 'experience');
  bad({ experience: [job({ startYear: 2024, endYear: 2020 })] }, 'experience'); // el fin no puede ser anterior al inicio
  bad({ experience: [job({ isCurrent: true, endYear: 2024 })] }, 'experience'); // «actual» no tiene año de fin
  bad({ experience: [job({ isCurrent: 'yes' })] }, 'experience');
  bad({ experience: [{ ...job(), email: 'a@b.co' }] }, 'experience'); // ninguna clave de contacto ni desconocida
  bad({ experience: [{ role: 'x' }] }, 'experience'); // faltan claves
  bad({ experience: 'texto' }, 'experience'); bad({ experience: [null] }, 'experience');
});

test('ES-109: educación y certificaciones — tipo cerrado, límites y tope de 15', () => {
  const e = (extra = {}) => ({ kind: 'education', title: 'Diseño Industrial', institution: 'Universidad Nacional', year: 2016, ...extra });
  assert.equal(ok({ education: [e(), e({ kind: 'certification', title: 'UX Design Certificate', institution: null, year: null })] }).education.length, 2);
  assert.equal(ok({ education: Array.from({ length: 15 }, () => e()) }).education.length, 15);
  bad({ education: Array.from({ length: 16 }, () => e()) }, 'education');
  bad({ education: [e({ kind: 'course' })] }, 'education'); bad({ education: [e({ title: '' })] }, 'education');
  bad({ education: [e({ title: 'x'.repeat(161) })] }, 'education'); bad({ education: [e({ institution: 'x'.repeat(121) })] }, 'education');
  bad({ education: [e({ year: 1900 })] }, 'education'); bad({ education: [e({ year: YEAR + 1 })] }, 'education');
});

test('ES-109: habilidades declaradas — sin repetidos (sin distinguir mayúsculas), límites y tope de 40', () => {
  const k = (name, extra = {}) => ({ name, support: null, resumeVersion: null, ...extra });
  assert.equal(ok({ declaredSkills: [k('SQL', { support: 'Consultas SQL para reportes semanales', resumeVersion: 3 }), k('Power BI')] }).declaredSkills.length, 2);
  assert.equal(ok({ declaredSkills: Array.from({ length: 40 }, (_, i) => k('Habilidad ' + i)) }).declaredSkills.length, 40);
  bad({ declaredSkills: Array.from({ length: 41 }, (_, i) => k('Habilidad ' + i)) }, 'declaredSkills');
  bad({ declaredSkills: [k('SQL'), k('sql')] }, 'declaredSkills'); bad({ declaredSkills: [k('SQL'), k(' SQL ')] }, 'declaredSkills');
  bad({ declaredSkills: [k('')] }, 'declaredSkills'); bad({ declaredSkills: [k('x'.repeat(61))] }, 'declaredSkills');
  bad({ declaredSkills: [k('SQL', { support: 'x'.repeat(201) })] }, 'declaredSkills');
  bad({ declaredSkills: [k('SQL', { resumeVersion: 0 })] }, 'declaredSkills'); bad({ declaredSkills: [k('SQL', { resumeVersion: 1.5 })] }, 'declaredSkills');
  bad({ declaredSkills: [{ name: 'SQL', level: 'avanzado' }] }, 'declaredSkills'); // el nivel NO existe: una habilidad declarada no tiene nivel
});

test('ES-109: idiomas, sector y años totales — límites y null', () => {
  assert.equal(ok({ languages: [{ name: 'Español', level: 'nativo' }, { name: 'Inglés', level: null }] }).languages.length, 2);
  assert.equal(ok({ languages: Array.from({ length: 10 }, (_, i) => ({ name: 'L' + i, level: null })) }).languages.length, 10);
  bad({ languages: Array.from({ length: 11 }, (_, i) => ({ name: 'L' + i, level: null })) }, 'languages');
  bad({ languages: [{ name: 'x'.repeat(41), level: null }] }, 'languages'); bad({ languages: [{ name: 'Inglés', level: 'x'.repeat(41) }] }, 'languages');
  assert.equal(ok({ sector: 'Tecnología' }).sector, 'Tecnología'); assert.equal(ok({ sector: '   ' }).sector, null);
  bad({ sector: 'x'.repeat(81) }, 'sector'); bad({ sector: 5 }, 'sector');
  assert.equal(ok({ totalYearsExperience: 0 }).totalYearsExperience, 0); assert.equal(ok({ totalYearsExperience: 60 }).totalYearsExperience, 60);
  for (const value of [-1, 61, 2.5, '8']) bad({ totalYearsExperience: value }, 'totalYearsExperience');
});

test('ES-109: los textos se normalizan (invisibles y controles fuera) y los nuevos campos no aceptan claves ajenas ni ausentes', () => {
  assert.equal(ok({ sector: '  Tecno​logía\u0007 ' }).sector, 'Tecnología');
  const withMissing = req(); delete withMissing.context.experience;
  assert.deepEqual(validateContextRequest(withMissing), { error: 'invalid_context', fields: ['experience'] });
});

test('ES-109: upgradeContext presenta un contexto v1 como v2 sin inventar nada', () => {
  const v1 = { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: null, timeZone: 'America/Bogota', profession: 'Diseñadora', interests: null, availabilityMinutesPerWeek: 120, careerGoal: null, careerConstraints: null };
  const v2 = upgradeContext(v1);
  assert.deepEqual({ ...v2, experience: undefined, education: undefined, declaredSkills: undefined, languages: undefined, sector: undefined, totalYearsExperience: undefined }, { ...v1, experience: undefined, education: undefined, declaredSkills: undefined, languages: undefined, sector: undefined, totalYearsExperience: undefined });
  assert.deepEqual([v2.sector, v2.totalYearsExperience, v2.experience, v2.education, v2.declaredSkills, v2.languages], [null, null, [], [], [], []]);
  assert.deepEqual(upgradeContext(null), emptyV2());
});

test('ES-109 ruta: GET presenta v1 como v2; PUT v1 responde 400 schema_outdated y no guarda; PUT v2 guarda y devuelve lo nuevo', async t => {
  const rows = new Map(); const users = new Map([[101, { id: 101, active: true, role: 'user' }]]);
  models.DerivedInvalidation.create = async values => values;
  models.User.findOne = async ({ where }) => { const u = users.get(where.id); return u && u.active === where.active && u.role === where.role ? record({ id: u.id }) : null; };
  models.ParticipantContext.findOne = async ({ where }) => rows.get(where.UserId) ?? null;
  models.ParticipantContext.create = async values => { const row = record({ id: 1, createdAt: new Date(), updatedAt: new Date(), ...values }); row.update = async next => { Object.assign(row, next, { updatedAt: new Date() }); return row; }; rows.set(values.UserId, row); return row; };
  const v1 = { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: null, timeZone: 'America/Bogota', profession: 'Diseñadora', interests: null, availabilityMinutesPerWeek: 120, careerGoal: null, careerConstraints: null };
  const old = record({ id: 1, UserId: 101, version: 1, content: encriptarV2(JSON.stringify(v1)), completedAt: new Date(), updatedAt: new Date() });
  rows.set(101, old);
  const request = await startApp(t); const as = { role: 'user', id: 101 };
  const got = await request('GET', '/api/user/context', as);
  assert.equal(got.status, 200); assert.equal(got.body.schemaVersion, 2);
  assert.equal(got.body.context.profession, 'Diseñadora'); assert.deepEqual(got.body.context.experience, []); assert.equal(got.body.context.sector, null);
  const stale = await request('PUT', '/api/user/context', { ...as, body: { schemaVersion: 1, expectedVersion: 1, action: 'save_draft', context: v1 } });
  assert.deepEqual([stale.status, stale.body], [400, { error: 'schema_outdated' }]);
  const unchanged = await request('GET', '/api/user/context', as); assert.equal(unchanged.body.version, 1);
  const saved = await request('PUT', '/api/user/context', { ...as, body: req({ ...v1, sector: 'Tecnología', experience: [job()], declaredSkills: [{ name: 'SQL', support: 'Consultas SQL', resumeVersion: 2 }] }, { expectedVersion: 1 }) });
  assert.equal(saved.status, 200); assert.equal(saved.body.version, 2); assert.equal(saved.body.context.experience[0].role, 'Líder de diseño');
  assert.deepEqual(saved.body.context.declaredSkills, [{ name: 'SQL', support: 'Consultas SQL', resumeVersion: 2 }]);
  const foreign = await request('PUT', '/api/user/context', { ...as, body: req({ resume: 'x' }, { expectedVersion: 2 }) });
  assert.equal(foreign.status, 400); // claves ajenas
  void database;
});
