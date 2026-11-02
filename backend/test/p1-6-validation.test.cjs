const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, storage, record, startApp } = require('./support.cjs');

test('P1-6: review uses the existing superadmin role; therapists keep their own upload/status', async t => {
  let calls = 0;
  let reviewed;
  let uploaded;
  let ownerFilter;
  models.TherapistValidation.findAll = async options => {
    calls++;
    if (options.where.therapistId) ownerFilter = options.where.therapistId;
    return [];
  };
  models.TherapistValidation.findByPk = async () => {
    calls++;
    reviewed = record({ id: 7, therapistId: 303, documentPath: 'synthetic.pdf', status: 'pending' });
    return reviewed;
  };
  models.TherapistValidation.create = async values => {
    calls++; uploaded = values; return record({ id: 8, ...values });
  };
  models.User.update = async () => { calls++; };
  storage.getSignedUrl = async () => { calls++; return 'https://storage.example.invalid/synthetic'; };
  storage.uploadFile = async () => { calls++; };
  const request = await startApp(t);
  for (const [method, suffix, body] of [
    ['GET', '/pending', undefined], ['GET', '/7/download', undefined],
    ['POST', '/7/approve', {}], ['POST', '/7/reject', { note: 'Synthetic review' }],
  ]) await t.test(method + ' ' + suffix, async () => {
    for (const prefix of ['/api/therapist/validation', '/api/junta']) {
      for (const role of [undefined, 'user', 'therapist', 'admin', 'board']) {
        const before = calls;
        assert.equal((await request(method, prefix + suffix, { role, body })).status, 403);
        assert.equal(calls, before, 'Denied requests cannot read DB or sign a download');
      }
      assert.equal((await request(method, prefix + suffix, {
        body, headers: { Authorization: 'Bearer invalid' },
      })).status, 401);
      const allowed = await request(method, prefix + suffix, { role: 'superadmin', body });
      assert.equal(allowed.status, 200);
      if (suffix.endsWith('/download')) assert.equal(allowed.body.url, 'https://storage.example.invalid/synthetic');
      if (suffix.endsWith('/approve')) assert.equal(reviewed.status, 'approved');
      if (suffix.endsWith('/reject')) assert.equal(reviewed.status, 'rejected');
    }
  });
  assert.equal((await request('GET', '/api/therapist/validation/status', { role: 'therapist' })).status, 200);
  assert.equal(ownerFilter, 101);
  assert.equal((await request('GET', '/api/therapist/validation/status', { role: 'user' })).status, 403);
  const body = new FormData();
  // ES-99: el contenido debe ser de verdad del tipo declarado (firma «%PDF-»)
  body.set('document', new Blob(['%PDF-1.4 synthetic document'], { type: 'application/pdf' }), 'synthetic.pdf');
  body.set('therapistId', '999');
  assert.equal((await request('POST', '/api/therapist/validation/upload', { role: 'therapist', body })).status, 201);
  assert.equal(uploaded.therapistId, 101);
  assert.match(uploaded.documentPath, /^therapist-docs\/101\//);
});
