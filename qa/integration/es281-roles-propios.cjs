// [QA-Claude] ES-281 (PR #239) · Matriz de roles PROPIA, independiente de la del PR. Diferencias con la del PR: mira también las guardas puestas
// DENTRO de la ruta (p. ej. router.post('/:id/confirm', verificarAdmin, ...) bajo un montaje que solo tiene verificarToken), calcula el conjunto
// de roles permitidos de cada guarda (incluida verificarBoard) y mide los estados 401/403 de «sin sesión», token inválido, vencido y revocado.
//   QA_SUT=<carpeta del repo> QA239_DB=postgres://usuario:clave@127.0.0.1:puerto/postgres node qa/integration/es281-roles-propios.cjs
// Solo loopback, base desechable propia, datos sintéticos, 0 IA.
const fs = require('fs');
const path = require('path');
const SUT = path.join(process.env.QA_SUT || 'C:/Users/Usuario/Documents/qa-pr-221', 'backend');
const OUT = process.env.QA_OUT || '.';
const { startRealApi } = require(SUT + '/test/support/realApi.cjs');
process.chdir(SUT);
process.env.DATA_RIGHTS_ENABLED = 'true'; // las rutas de exportación están detrás de este interruptor
const hooks = []; const t = { after: (fn) => hooks.push(fn) };
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok, detail }); console.log(JSON.stringify({ id, ok, detail: String(detail).slice(0, 900) })); };
const info = (id, detail) => { results.push({ id, info: detail }); console.log(JSON.stringify({ id, info: String(detail).slice(0, 900) })); };

(async () => {
  const { MOUNTS, api, mkUser, base, q, issueToken } = await startRealApi(t, { envVar: 'QA239_DB', prefix: 'qa239r' });
  const auth = require(SUT + '/middlewares/auth');
  const jwt = require(SUT + '/node_modules/jsonwebtoken');
  const secret = require(SUT + '/config/jwt');
  const ALLOWED = new Map([[auth.verificarToken, null], [auth.verificarTokenParaBorrado, null], [auth.verificarAdmin, ['admin', 'superadmin']], [auth.verificarSuperAdmin, ['superadmin']],
    [auth.verificarTerapeuta, ['therapist']], [auth.verificarBoard, ['board', 'superadmin']], [auth.verificarEditorManifiesto, ['admin', 'superadmin']]]);
  const ROLES = ['user', 'therapist', 'admin', 'superadmin', 'board'];
  const actors = {}; for (const r of ROLES) actors[r] = await mkUser(r);
  const fp = async () => { const out = {}; const tabs = (await q("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1")).map((x) => x.table_name); for (const tb of tabs) { if (tb === 'SequelizeMeta') continue; out[tb] = (await q(`SELECT md5(coalesce(string_agg(x::text,'|' ORDER BY x::text),'')) h FROM "${tb}" x`))[0].h; } return out; };

  // 1) árbol de rutas con TODAS sus guardas (montaje + ruta)
  const routes = [];
  for (const m of MOUNTS) { const useGuards = []; for (const layer of m.router.stack) {
    if (!layer.route) { if (ALLOWED.has(layer.handle)) useGuards.push(layer.handle); continue; } // router.use(guarda): vale para las rutas declaradas DESPUÉS
    const routeGuards = [...useGuards, ...layer.route.stack.map((s) => s.handle).filter((h) => ALLOWED.has(h))];
    const mountGuards = m.guardFns.filter((h) => ALLOWED.has(h));
    for (const method of Object.keys(layer.route.methods)) routes.push({ method: method.toUpperCase(), path: (m.prefix === '/' ? '' : m.prefix) + layer.route.path, mountGuards, routeGuards });
  } }
  const NONEXISTENT = '2147483000';
  const fill = (p) => p.replace(/:[A-Za-z]+/g, NONEXISTENT);
  const allow = (r) => { let set = null; for (const g of [...r.mountGuards, ...r.routeGuards]) { const a = ALLOWED.get(g); if (a) set = set ? set.filter((x) => a.includes(x)) : a; } return set; };
  const guarded = routes.filter((r) => r.mountGuards.length || r.routeGuards.length);
  const open = routes.filter((r) => !r.mountGuards.length && !r.routeGuards.length);
  const onlyRouteLevel = routes.filter((r) => allow(r) && !r.mountGuards.some((g) => ALLOWED.get(g)));
  info('inventario', `rutas ${routes.length}; con guarda ${guarded.length}; con restricción de rol ${routes.filter((r) => allow(r)).length}; la restricción de rol está SOLO dentro de la ruta (no en el montaje): ${onlyRouteLevel.length}; sin guarda alguna (públicas): ${open.length}`);
  info('sin guarda (públicas)', open.map((r) => `${r.method} ${r.path}`).join(' ; '));
  info('rol solo en la ruta', onlyRouteLevel.map((r) => `${r.method} ${r.path}`).join(' ; '));
  const SKIP = /\/(logout|logout-all|deletion-requests)$/;
  if (process.env.QA_DUMP) { // inventario independiente de guardas (montaje + router.use + ruta) para compararlo con una política escrita
    const dump = {}; for (const r of routes) { const a = allow(r); dump[r.method + ' ' + r.path] = { denied: ['user', 'therapist', 'admin', 'superadmin'].filter((x) => a && !a.includes(x)), session: !!(r.mountGuards.length || r.routeGuards.length) }; }
    fs.writeFileSync(path.join(OUT, 'ES-281-inventario-guardas.json'), JSON.stringify(dump, null, 1));
  }

  // 2) roles: cada rol NO permitido recibe 403; la base no cambia
  const before = await fp(); const problems = []; let probes = 0; const unexpected2xx = [];
  const call = async (token, r) => {
    const res = await fetch(base + fill(r.path), { method: r.method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' }, ...(['GET', 'HEAD', 'DELETE'].includes(r.method) ? {} : { body: '{}' }) });
    const text = await res.text(); return { status: res.status, text };
  };
  for (const r of guarded) {
    if (SKIP.test(r.path)) continue;
    const allowed = allow(r); if (!allowed) continue;
    for (const role of ROLES.filter((x) => !allowed.includes(x))) {
      const out = await call(actors[role].token, r); probes += 1;
      if (out.status !== 403) problems.push(`${role} ${r.method} ${r.path}: ${out.status} ${out.text.slice(0, 60)}`);
    }
  }
  const after = await fp(); const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
  check('R1 cada rol no permitido (por montaje Y por ruta) recibe 403 en toda ruta con restricción de rol', problems.length === 0, `${probes} solicitudes; ${problems.length} fallos: ${problems.slice(0, 12).join(' | ')}`);
  check('R1b la base no cambia con esas solicitudes', changed.length === 0, `tablas cambiadas: ${changed.join(',')}`);

  // 3) estados de «sin sesión» y token malo en TODA ruta con guarda
  const tally = { sinSesion: {}, basura: {}, vencido: {}, revocado: {} };
  const add = (k, s) => { tally[k][s] = (tally[k][s] || 0) + 1; };
  const expired = jwt.sign({ id: actors.user.id, role: 'user' }, secret, { expiresIn: -60 });
  const revoked = (await mkUser('user')).token;
  const lo = await fetch(base + '/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + revoked, 'Content-Type': 'application/json' }, body: '{}' });
  info('logout para revocar', `estado ${lo.status}`);
  const stale = []; const mixed = [];
  for (const r of guarded) {
    if (SKIP.test(r.path)) continue;
    const a = await call(null, r); add('sinSesion', a.status);
    const b = await call('basura.no.jwt', r); add('basura', b.status);
    const c = await call(expired, r); add('vencido', c.status);
    const d = await call(revoked, r); add('revocado', d.status);
    if (a.status !== 403) stale.push(`sin sesión ${r.method} ${r.path}: ${a.status}`);
    if (b.status !== 401 || c.status !== 401 || d.status !== 401) mixed.push(`${r.method} ${r.path}: basura ${b.status}, vencido ${c.status}, revocado ${d.status}`);
  }
  info('estados', JSON.stringify(tally));
  check('R2 sin cabecera Authorization → 403 en TODA ruta con guarda (uniforme)', stale.length === 0, stale.slice(0, 10).join(' | ') || 'uniforme');
  check('R3 token basura, vencido o revocado → 401 en TODA ruta con guarda (uniforme)', mixed.length === 0, mixed.slice(0, 10).join(' | ') || 'uniforme');

  // 4) rutas públicas: ninguna da 5xx sin sesión (con id inexistente) y ninguna devuelve datos de personas
  const bad = [];
  for (const r of open) { const out = await call(null, r); if (out.status >= 500 && !/catalog_unavailable/.test(out.text)) bad.push(`${r.method} ${r.path}: ${out.status}`); if (/@example\.test|canario|Sintético/i.test(out.text)) bad.push(`${r.method} ${r.path}: datos de personas`); }
  check('R4 las rutas sin guarda no dan 5xx ni devuelven datos de personas sin sesión', bad.length === 0, bad.slice(0, 8).join(' | ') || `${open.length} rutas públicas revisadas`);

  fs.writeFileSync(path.join(OUT, `ES-281-roles-propios-${process.env.TAG || 'pr'}.json`), JSON.stringify({ results, tally }, null, 1));
  console.log('RESUMEN ' + results.filter((r) => r.ok).length + '/' + results.filter((r) => 'ok' in r).length);
  for (const h of hooks.reverse()) await h();
  process.exit(0);
})().catch((e) => { console.error('FATAL', e.stack); process.exit(1); });
