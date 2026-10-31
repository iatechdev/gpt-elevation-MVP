// ES-137: las respuestas de la API con datos de la persona llevan Cache-Control: no-store; los recursos públicos de lectura no se ven afectados.
const test = require('node:test');
const assert = require('node:assert/strict');
const { models, startApp } = require('./support.cjs');

const user = { role: 'user', id: 7 };

test('ES-137: una lectura autenticada de datos privados no se guarda en caché y varía por Authorization', async t => {
  models.Consent.findAll = async () => [];
  models.DiaryEntry.findAll = async () => [];
  const request = await startApp(t);
  for (const url of ['/api/consents', '/api/diary']) {
    const response = await request('GET', url, user);
    assert.equal(response.headers.get('cache-control'), 'no-store', url);
    assert.match(response.headers.get('vary') || '', /Authorization/i, url);
  }
});

test('ES-137: también el rechazo sin sesión y las rutas de autenticación llevan no-store', async t => {
  const request = await startApp(t);
  const noSession = await request('GET', '/api/consents');
  assert.ok([401, 403].includes(noSession.status));
  assert.equal(noSession.headers.get('cache-control'), 'no-store');
  const login = await request('POST', '/api/login', { body: {} });
  assert.equal(login.headers.get('cache-control'), 'no-store');
});

test('ES-137: los recursos públicos de lectura (precios y contenido de la landing; los planes fijan el suyo) no reciben no-store del middleware global', async t => {
  models.PricingPlan.findAll = async () => [];
  models.LandingContent.findAll = async () => [];
  models.LandingContent.findOne = async () => null;
  const request = await startApp(t);
  for (const url of ['/api/pricing', '/api/landing-content']) {
    const response = await request('GET', url);
    assert.notEqual(response.headers.get('cache-control'), 'no-store', url + ' -> ' + response.status);
  }
});
