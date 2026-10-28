const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./support.cjs');

test('QA-SMK-01: una ruta /api/* inexistente da 404 JSON con sesión y sigue pidiendo sesión sin ella; la salud y la SPA no cambian', async t => {
  const request = await startApp(t);
  for (const method of ['GET', 'POST', 'PUT', 'DELETE']) {
    const r = await request(method, '/api/ruta-que-no-existe', { role: 'user' });
    assert.deepEqual([r.status, r.body.code], [404, 'not_found'], method);
    assert.match(r.body.error, /Route not found/);
  }
  const nested = await request('GET', '/api/career-context/no/existe/aqui', { role: 'user' });
  assert.deepEqual([nested.status, nested.body.code], [404, 'not_found']);
  const admin = await request('GET', '/api/admin/ruta-que-no-existe', { role: 'admin', id: 900 });
  assert.equal(admin.status, 404);
  // sin sesión no se revela nada: la autenticación sigue respondiendo primero
  assert.equal((await request('GET', '/api/ruta-que-no-existe')).status, 403);
  // lo que sí existe no cambia
  assert.equal((await request('GET', '/api/health')).status, 200);
  // fuera de /api el comodín de la SPA sigue atendiendo: su respuesta es HTML (o un error de archivo si no hay compilación), nunca el JSON de
  // not_found. El ayudante de pruebas interpreta todo como JSON, así que una respuesta no JSON hace que falle con SyntaxError.
  await assert.rejects(request('GET', '/app/dashboard', { role: 'user' }), SyntaxError);
});
