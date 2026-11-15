// ES-278 (E216-4) · Planes de precio: el servidor valida identificador, precio y rangos. HTTP REAL contra el server.js real, PostgreSQL REAL.
//   ES278_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54391/postgres node --test test/integration/es-278-postgres.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startRealApi } = require('../support/realApi.cjs');

const FIXED = /^(Datos de entrada inválidos|Datos inválidos|Datos del plan inválidos|El identificador|El nombre|La descripción|El precio|La moneda|El período|Las características|El orden)/;

test('ES-278 PostgreSQL + HTTP: planes de precio, validación del servidor', { timeout: 300000 }, async (t) => {
  const { q, mkUser, http } = await startRealApi(t, { envVar: 'ES278_TEST_DATABASE_URL', prefix: 'es278' });
  const admin = await mkUser('admin');
  const base = { slug: 'valido', name_es: 'Válido', name_en: 'Valid', price: 10 };
  const plans = async () => q('SELECT * FROM "PricingPlans" ORDER BY id');
  const post = (body) => http(admin, 'POST', '/api/admin/pricing', body);

  await t.test('crear: toda entrada inválida es 400 con cuerpo fijo ES/EN, sin 5xx y sin fila nueva', async () => {
    const INVALID = [
      ['precio negativo', { price: -5 }], ['precio negativo en texto', { price: '-5' }], ['precio 1e15', { price: 1e15 }], ['precio 1e3 en texto', { price: '1e3' }],
      ['precio con 3 decimales', { price: 1.234 }], ['precio texto', { price: 'abc' }], ['precio null', { price: null }], ['precio sobre el máximo', { price: 100000000 }], ['precio Infinity', { price: 'Infinity' }],
      ['slug con ruta y emoji', { slug: '../etc/😀' }], ['slug en mayúsculas', { slug: 'UPPER' }], ['slug vacío', { slug: '' }], ['slug de 21 caracteres', { slug: 'a'.repeat(21) }],
      ['slug con espacio', { slug: 'a b' }], ['slug numérico', { slug: 5 }], ['slug con guion bajo', { slug: 'a_b' }],
      ['nombre de 10 000 caracteres', { name_es: 'x'.repeat(10000) }], ['nombre vacío', { name_en: '   ' }], ['nombre no texto', { name_es: 7 }],
      ['descripción enorme', { description_es: 'x'.repeat(5000) }], ['características no lista', { features_es: 'a' }], ['demasiadas características', { features_en: Array(21).fill('a') }], ['característica larga', { features_es: ['x'.repeat(201)] }],
      ['orden decimal', { order: 1.5 }], ['orden fuera de rango', { order: 2147483648 }], ['orden texto', { order: 'x' }], ['orden negativo', { order: -1 }],
      ['moneda corta', { currency: 'US' }], ['moneda con número', { currency: 'USD1' }], ['período con mayúscula', { period: 'Month' }], ['destacado texto', { isHighlighted: 'si' }],
    ];
    const before = (await plans()).length;
    for (const [name, patch] of INVALID) {
      const out = await post({ ...base, ...patch });
      assert.equal(out.status, 400, `${name}: ${out.status} ${JSON.stringify(out.body).slice(0, 80)}`);
      assert.match(out.body.error, FIXED, name);
      assert.ok(['invalid_plan', 'invalid_input'].includes(out.body.code), out.body.code); // invalid_input: el esquema genérico de validateBody ya rechazó el tipo
      assert.ok(out.body.error.includes(' / '), 'bilingüe: ' + name);
    }
    const { price, ...withoutPrice } = base;
    const missing = await post(withoutPrice);
    assert.equal(missing.status, 400, 'sin precio: no se inventa 0,00');
    assert.equal(missing.body.field, 'price');
    assert.equal((await plans()).length, before, 'ninguna entrada inválida creó una fila');
  });

  await t.test('crear: entradas válidas en los bordes (precio 0 explícito, decimal en texto, máximo, slug de 20)', async () => {
    const cases = [{ slug: 'cero', price: 0 }, { slug: 'doce-con-medio', price: '12.50' }, { slug: 'maximo', price: 99999999.99 }, { slug: 'a'.repeat(20), price: 1 },
      { slug: 'con-guion-1', price: 3, currency: 'eur', period: 'year', order: 5, features_es: ['a'], features_en: ['b'] }];
    for (const c of cases) {
      const out = await post({ ...base, ...c });
      assert.equal(out.status, 201, JSON.stringify(c) + ' ' + JSON.stringify(out.body).slice(0, 100));
    }
    const rows = Object.fromEntries((await plans()).map((p) => [p.slug, p]));
    assert.equal(Number(rows.cero.price), 0);
    assert.equal(Number(rows['doce-con-medio'].price), 12.5);
    assert.equal(Number(rows.maximo.price), 99999999.99);
    assert.equal(rows['con-guion-1'].currency, 'EUR');
  });

  await t.test('slug repetido: 409 con cuerpo fijo (antes 500), en crear y en editar; ninguna fila cambia', async () => {
    const dup = await post({ ...base, slug: 'cero' });
    assert.equal(dup.status, 409);
    assert.deepEqual(dup.body, { code: 'slug_taken', field: 'slug', error: 'Ya existe un plan con ese identificador. / A plan with that identifier already exists.' });
    const rows = await plans();
    const one = rows.find((p) => p.slug === 'maximo');
    const before = JSON.stringify(await plans());
    const clash = await http(admin, 'PUT', `/api/admin/pricing/${one.id}`, { slug: 'cero' });
    assert.equal(clash.status, 409);
    assert.equal(JSON.stringify(await plans()), before);
  });

  await t.test('editar: entradas inválidas son 400 y la fila no cambia; una edición parcial válida sí se aplica; ids malformados siguen siendo 404', async () => {
    const row = (await plans()).find((p) => p.slug === 'doce-con-medio');
    const before = JSON.stringify(await plans());
    for (const patch of [{ price: -1 }, { price: 1e15 }, { slug: '../x' }, { slug: 'b'.repeat(21) }, { name_es: 'x'.repeat(10000) }, { order: 1.5 }, { price: 'abc' }, { price: null }, { isActive: 'no' }]) {
      const out = await http(admin, 'PUT', `/api/admin/pricing/${row.id}`, patch);
      assert.equal(out.status, 400, JSON.stringify(patch) + ' ' + out.status);
      assert.match(out.body.error, FIXED);
    }
    assert.equal(JSON.stringify(await plans()), before, 'ninguna edición inválida cambió la base');
    const ok = await http(admin, 'PUT', `/api/admin/pricing/${row.id}`, { price: '15.75', name_es: ' Renombrado ' });
    assert.equal(ok.status, 200);
    const after = (await plans()).find((p) => p.id === row.id);
    assert.equal(Number(after.price), 15.75);
    assert.equal(after.name_es, 'Renombrado');
    assert.equal(after.slug, 'doce-con-medio');
    for (const id of ['abc', '1.5', '2147483648', '-1']) {
      assert.equal((await http(admin, 'PUT', `/api/admin/pricing/${id}`, { price: 1 })).status, 404, 'PUT ' + id);
      assert.equal((await http(admin, 'DELETE', `/api/admin/pricing/${id}`)).status, 404, 'DELETE ' + id);
    }
  });

  await t.test('solo administración muta: la persona y el profesional reciben 403 y no se crea nada', async () => {
    const before = (await plans()).length;
    for (const role of ['user', 'therapist']) assert.equal((await http(await mkUser(role), 'POST', '/api/admin/pricing', { ...base, slug: 'otro' })).status, 403);
    assert.equal((await plans()).length, before);
  });
});
