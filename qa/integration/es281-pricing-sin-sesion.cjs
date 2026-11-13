// [QA-Claude] ES-281 (PR #239) · ¿Las rutas de escritura de pricing montadas en /api/pricing exigen sesión y rol? (hallazgo de mi matriz de roles propia)
//   QA_SUT=<carpeta del repo> QA239_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es281-pricing-sin-sesion.cjs
// Base desechable propia, datos sintéticos, 0 IA. Se compara con la ruta de administración /api/admin/pricing (que sí exige rol).
const path = require('path');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
process.chdir(SUT);
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
(async () => {
  const { base, mkUser, q } = await startRealApi(t, { envVar: 'QA239_DB', prefix: 'qa239p' });
  const user = await mkUser('user');
  const call = async (label, token, method, route, body) => {
    const res = await fetch(base + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const text = await res.text(); console.log(JSON.stringify({ label, method, route, status: res.status, body: text.slice(0, 140) })); return { status: res.status, text };
  };
  const count = async () => (await q('SELECT count(*)::int n, coalesce(sum(CASE WHEN "isActive" THEN 1 ELSE 0 END),0)::int activos FROM "PricingPlans"'))[0];
  console.log('ANTES', JSON.stringify(await count()));
  // 1) sin sesión: sembrar, crear, editar, desactivar
  await call('sin sesión', null, 'POST', '/api/pricing/seed', {});
  console.log('TRAS seed sin sesión', JSON.stringify(await count()));
  const plans = await q('SELECT id, slug, name_es, price, "isActive" FROM "PricingPlans" ORDER BY id LIMIT 1');
  const id = plans[0] && plans[0].id;
  await call('sin sesión', null, 'POST', '/api/pricing', { slug: 'qa-sin-sesion', name_es: 'Creado sin sesión', name_en: 'Created without session', price: 1 });
  console.log('TRAS crear sin sesión', JSON.stringify(await count()));
  if (id) {
    const antes = (await q('SELECT name_es, price FROM "PricingPlans" WHERE id=$1', [id]))[0];
    await call('sin sesión', null, 'PUT', `/api/pricing/${id}`, { name_es: 'Cambiado sin sesión', price: 1 });
    const despues = (await q('SELECT name_es, price, "isActive" FROM "PricingPlans" WHERE id=$1', [id]))[0];
    console.log('PLAN antes/después PUT', JSON.stringify({ antes, despues }));
    await call('sin sesión', null, 'DELETE', `/api/pricing/${id}`);
    console.log('PLAN tras DELETE', JSON.stringify((await q('SELECT "isActive" FROM "PricingPlans" WHERE id=$1', [id]))[0]));
    // 2) una persona común (rol user) también
    await call('persona', user.token, 'PUT', `/api/pricing/${id}`, { price: 2 });
    // 3) control: la ruta de administración rechaza
    await call('control sin sesión (admin)', null, 'PUT', `/api/admin/pricing/${id}`, { price: 3 });
    await call('control persona (admin)', user.token, 'PUT', `/api/admin/pricing/${id}`, { price: 3 });
  }
  console.log('FIN', JSON.stringify(await count()));
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
