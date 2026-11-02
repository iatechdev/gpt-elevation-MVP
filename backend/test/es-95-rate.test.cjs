// ES-95: límite de intentos del formulario público (archivo aparte: el contador vive en memoria del proceso).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');

process.env.PRO_APP_RATE_MAX = '3';
const PDF = Buffer.from('%PDF-1.4\n% synthetic test document\n%%EOF\n');
const body = (email) => {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: 'Persona Sintética', email, country: 'Colombia', profession: 'Psicología', consent: 'true' })) data.append(key, value);
  data.append('cv', new Blob([PDF], { type: 'application/pdf' }), 'cv.pdf');
  return data;
};

test('ES-95: pasado el límite por IP el formulario responde 429 y no guarda ni siquiera las solicitudes válidas', async t => {
  const created = [];
  models.ProfessionalApplication.findOne = async () => null;
  models.ProfessionalApplication.create = async (values) => { created.push(values); return { id: created.length, ...values }; };
  models.ProfessionalApplicationFile.create = async (values) => values;
  models.ProfessionalApplication.count = async () => 0; models.ProfessionalApplicationFile.sum = async () => 0;
  const request = await startApp(t);
  const statuses = [];
  for (let i = 0; i < 5; i++) statuses.push((await request('POST', '/api/professional-applications', { body: body(`n${i}@example.test`) })).status);
  assert.deepEqual(statuses, [201, 201, 201, 429, 429]);
  assert.equal(created.length, 3);
  const blocked = await request('POST', '/api/professional-applications', { body: body('late@example.test') });
  assert.equal(blocked.body.code, 'rate_limited');
});
