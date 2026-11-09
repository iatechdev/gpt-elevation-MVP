// ES-223: solicitar el plan que la persona ya tiene responde 409 already_on_plan y no crea solicitud; con almacén simulado (la prueba con Postgres real está aparte).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { models, record, startApp } = require('./support.cjs');

test('ES-223: el plan actual se rechaza (409, sin fila); otro plan, y una persona sin plan, siguen funcionando', async t => {
  let created = 0;
  let owner = record({ id: 101, active: true, planId: 5 });
  models.User.findByPk = async () => owner;
  models.PricingPlan.findOne = async ({ where }) => (where.id === 5 || where.id === 6 ? { id: where.id, name_es: `Plan ${where.id}` } : null);
  models.PlanRequest.findOne = async () => null;
  models.PlanRequest.create = async values => { created++; return record({ id: 9, createdAt: new Date(), ...values }); };
  const request = await startApp(t);
  const post = body => request('POST', '/api/plan-requests', { role: 'user', body });

  const same = await post({ planId: 5 });
  assert.equal(same.status, 409); assert.equal(same.body.code, 'already_on_plan'); assert.equal(created, 0);
  const other = await post({ planId: 6 });
  assert.equal(other.status, 201); assert.equal(created, 1);
  // Sin plan actual (null) se puede pedir cualquiera; un plan inexistente sigue siendo 404 y un userId en el cuerpo, 400.
  owner = record({ id: 101, active: true, planId: null });
  assert.equal((await post({ planId: 5 })).status, 201);
  assert.equal((await post({ planId: 77 })).status, 404);
  assert.equal((await post({ planId: 5, userId: 202 })).status, 400);
  assert.equal(created, 2);
});
