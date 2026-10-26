// ES-22: correcciones de QA (QA-22-01 a QA-22-04)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { classifyError } = require('../utils/aiClient');
const { redactSecrets } = require('../utils/promptSafety');

test('QA-22-02: un error de tiempo de espera del SDK se clasifica como timeout', () => {
  class APIConnectionTimeoutError extends Error {}
  assert.equal(classifyError(new APIConnectionTimeoutError('Request timed out.')), 'timeout');
  assert.equal(classifyError(Object.assign(new Error('x'), { status: 529 })), 'provider_unavailable');
  assert.equal(classifyError(new Error('otra cosa')), 'unknown');
});

test('QA-22-04: se enmascara una llave privada PEM, completa o truncada', () => {
  const body = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASC';
  const pem = `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----`;
  const out = redactSecrets(`antes ${pem} despues`);
  assert.ok(!out.includes(body));
  assert.match(out, /antes \[secreto omitido\] despues/);
  assert.ok(!redactSecrets(`-----BEGIN RSA PRIVATE KEY-----\n${body}`).includes(body)); // sin cierre
});
