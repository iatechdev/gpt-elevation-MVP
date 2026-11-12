// [QA-Claude] SONDA PROPIA de ids hostiles (ES-280 / ES-189a). Independiente de la de Dev: enumera las rutas REALES registrando el árbol de Express al cargar server.js
// (no parsea código), prueba cada ruta con parámetro con ids hostiles × 4 roles (+ sin sesión) y mide: 5xx, fuga de texto de PostgreSQL/stack, y que el 4xx no repita el id.
// Opcional: cuerpo/consulta hostiles sobre las rutas con 5xx. Base DESECHABLE local; 0 IA; datos sintéticos.
// Uso: QA_SUT=<clon> PGADMIN=postgres://u:p@127.0.0.1:54459/postgres [QA_OUT=<carpeta>] node qa/integration/sonda-ids-hostiles.cjs
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const crypto = require('node:crypto'); const { spawnSync } = require('node:child_process'); const { once } = require('node:events');
const E = process.env; const B = path.join(E.QA_SUT, 'backend'); const req = createRequire(path.join(B, 'package.json'));
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(E.PGADMIN || '')) throw new Error('PGADMIN debe ser local');
const { Client } = req('pg'); const { Sequelize } = req('sequelize');
// ---- registro del árbol de rutas ANTES de cargar la aplicación
const RouterCls = req('router'); const proto = RouterCls.prototype; const children = new Map(); const routesOf = new Map(); const paramHandlers = new Map();
const origUse = proto.use; proto.use = function (...a) { const p = typeof a[0] === 'string' ? a[0] : '/'; for (const f of a.flat()) if (f && typeof f === 'function' && f.stack && typeof f.handle === 'function') { if (!children.has(this)) children.set(this, []); children.get(this).push({ path: p, child: f }); } return origUse.apply(this, a); };
const origRoute = proto.route; proto.route = function (p) { const r = origRoute.call(this, p); if (!routesOf.has(this)) routesOf.set(this, []); routesOf.get(this).push(r); return r; };
const origParam = proto.param; proto.param = function (name, fn) { if (typeof name === 'string') { if (!paramHandlers.has(this)) paramHandlers.set(this, []); paramHandlers.get(this).push(name); } return origParam.call(this, name, fn); };
const results = []; const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 1200) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 1200) })); };
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 4000) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 4000) })); };
const LEAK = /sequelize|postgres|invalid input syntax|out of range|SQLSTATE|relation "|column "|syntax error|violates|at [^\n]*\.js:\d+|node_modules|ECONN|\bpg\b.*error/i;
(async () => {
  const DBN = 'qa280_' + crypto.randomBytes(5).toString('hex'); const adm = new Client({ connectionString: E.PGADMIN }); await adm.connect(); await adm.query(`CREATE DATABASE "${DBN}"`);
  const u = new URL(E.PGADMIN); u.pathname = '/' + DBN; const URL_ = u.toString(); const keys = { jwt: crypto.randomBytes(32).toString('hex'), dek: crypto.randomBytes(32).toString('hex') };
  const mig = spawnSync(process.execPath, ['node_modules/sequelize-cli/lib/sequelize', 'db:migrate'], { cwd: B, encoding: 'utf8', timeout: 300000, env: { ...process.env, DATABASE_URL: URL_, DB_SSL: 'false', NODE_ENV: 'test', JWT_SECRET: keys.jwt, DATA_ENCRYPTION_KEY: keys.dek } }); if (mig.status !== 0) throw new Error('migraciones');
  const app = new Sequelize(URL_, { logging: false, dialectOptions: { ssl: false }, pool: { max: 5, min: 0, acquire: 15000 } });
  Object.assign(process.env, { JWT_SECRET: keys.jwt, DATA_ENCRYPTION_KEY: keys.dek, NODE_ENV: E.PROBE_ENV || 'test', DATA_RIGHTS_ENABLED: 'true', AI_BUDGET_TOKENS_PER_USER: '1000000000', ALLOW_SYNTHETIC_CATALOG: 'true', PRO_APP_RATE_MAX: '1000000', LOGIN_RATE_MAX: '1000000', REGISTER_RATE_MAX: '1000000', PASSWORD_RESET_IP_LIMIT: '1000000', INVITATION_PER_INVITER_HOUR: '1000000' });
  const mod = (p, exp) => { const id = req.resolve(p); require.cache[id] = { id, filename: id, loaded: true, exports: exp }; };
  mod('./database', { sequelize: app, connectDB: async () => {} });
  const realMailer = req('./utils/mailer'); mod('./utils/mailer', { ...realMailer, sendInvitation: async () => ({ sent: true }), sendPasswordReset: async () => ({ sent: true }) });
  mod('./utils/anthropic', { MODEL: 'sintetico', messages: { create: async () => ({ content: [{ type: 'text', text: '{}' }], usage: { input_tokens: 1, output_tokens: 1 } }) } });
  const consoleErr = console.error; console.error = () => {}; const appx = req('./server'); console.error = consoleErr;
  const { issueToken } = req('./utils/sessions');
  // ---- árbol → rutas con parámetro
  const found = []; const walk = (router, prefix, guards) => { for (const r of routesOf.get(router) || []) for (const m of Object.keys(r.methods || {})) found.push({ method: m.toUpperCase(), path: (prefix + (r.path === '/' ? '' : r.path)).replace(/\/+/g, '/'), hasParam: /:/.test(prefix + r.path), params: ((prefix + r.path).match(/:\w+/g) || []) }); for (const c of children.get(router) || []) walk(c.child, (prefix + (c.path === '/' ? '' : c.path)).replace(/\/+/g, '/'), guards); };
  walk(appx.router, '', []);
  const uniq = new Map(); for (const r of found) uniq.set(r.method + ' ' + r.path, r); const all = [...uniq.values()]; const withParam = all.filter(r => r.hasParam && r.path.startsWith('/api'));
  info('inventario', `rutas /api registradas: ${all.filter(r => r.path.startsWith('/api')).length}; con parámetro: ${withParam.length} (Dev reporta 92 con parámetro)`);
  const db = new Client({ connectionString: URL_, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows;
  const ucols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Users' AND is_nullable='NO' AND column_default IS NULL AND column_name <> 'id'`);
  let seq = 0; const mkUser = async (role) => { seq++; const names = [], vals = []; for (const c of ucols) { let v; if (c.column_name === 'role') v = role; else if (c.column_name === 'name') v = 'Sonda ' + role; else if (c.column_name === 'email') v = `sonda-${role}-${DBN}@example.test`; else if (c.data_type.includes('char') || c.data_type === 'text') v = `s-${seq}-${c.column_name}`; else if (c.data_type === 'integer') v = 0; else if (c.data_type === 'boolean') v = true; else if (c.data_type.startsWith('timestamp')) v = new Date(); else v = '{}'; names.push(`"${c.column_name}"`); vals.push(v); } const id = (await q(`INSERT INTO "Users" (${names.join(',')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(',')}) RETURNING id`, vals))[0].id; await q('UPDATE "Users" SET role=$2, active=true WHERE id=$1', [id, role]); return { id, role, token: issueToken({ id, role }) }; };
  const roles = [await mkUser('user'), await mkUser('therapist'), await mkUser('admin'), await mkUser('superadmin'), null];
  const server = appx.listen(0, '127.0.0.1'); await once(server, 'listening'); const base = `http://127.0.0.1:${server.address().port}`;
  const HOSTILE = ['abc', '0', '-1', '1.5', '00', '1e3', '99999999999', '2147483648', '9223372036854775808', 'NaN', '%20', '1%3BDROP%20TABLE', '%D9%A3', 'x'.repeat(200), '%00', '..%2f..%2fetc', 'null', 'undefined', '%E0%A4%A', '1%27%20OR%201%3D1'];
  const hit = []; let total = 0; const leaks = []; const echo = [];
  const call = async (r, role, val, body, qs = '') => { const url = base + r.path.replace(/:\w+/g, val) + qs; const res = await fetch(url, { method: r.method, headers: { ...(role ? { Authorization: 'Bearer ' + role.token } : {}), 'Content-Type': 'application/json' }, ...(['GET', 'HEAD'].includes(r.method) ? {} : { body: JSON.stringify(body ?? {}) }) }).catch(e => ({ status: 0, text: async () => String(e) })); const text = await res.text(); return { status: res.status, text }; };
  for (const r of withParam) for (const role of roles) for (const v of HOSTILE) {
    total++; const out = await call(r, role, v);
    if (out.status >= 500 || out.status === 0) hit.push({ k: r.method + ' ' + r.path, role: role ? role.role : 'anon', v: v.slice(0, 20), s: out.status, leak: LEAK.test(out.text) });
    if (LEAK.test(out.text)) { leaks.push(r.method + ' ' + r.path + ' [' + (role ? role.role : 'anon') + '] ' + v.slice(0, 12) + ' → ' + out.status + ' ' + out.text.replace(/s+/g, ' ').slice(0, 110)); }
    if (out.status >= 400 && out.status < 500 && v.length > 8 && v !== 'undefined' && out.text.includes(v)) echo.push(r.method + ' ' + r.path + ' ' + v.slice(0, 12));
  }
  const byRoute = {}; for (const h of hit) { (byRoute[h.k] ||= { n: 0, ids: new Set(), roles: new Set(), statuses: new Set(), leak: false }); const b = byRoute[h.k]; b.n++; b.ids.add(h.v); b.roles.add(h.role); b.statuses.add(h.s); if (h.leak) b.leak = true; }
  const list = Object.entries(byRoute).map(([k, b]) => `${k} → ${[...b.statuses].join('/')} (${b.n}; roles ${[...b.roles].join(',')}; ids ${[...b.ids].slice(0, 4).join(' ')})${b.leak ? ' FUGA' : ''}`);
  info('sonda-ids', `${total} solicitudes (${withParam.length} rutas × ${roles.length} perfiles × ${HOSTILE.length} ids). 5xx: ${hit.length} en ${Object.keys(byRoute).length} rutas. Rutas: ${list.join(' ;; ')}`);
  check('S1 (bloqueante) ningún id hostil produce 5xx en ninguna ruta con parámetro, con ningún perfil (persona, profesional, administración, superadministración, sin sesión)', hit.length === 0, `${hit.length} respuestas 5xx en ${Object.keys(byRoute).length} rutas: ${list.slice(0, 20).join(' ;; ')}`);
  check('S2 (bloqueante) ninguna respuesta (ni 4xx ni 5xx) deja ver texto de PostgreSQL, Sequelize, rutas de archivo o trazas', leaks.length === 0, `${leaks.length}: ${[...new Set(leaks)].slice(0, 12).join(' | ')}`);
  info('S3 eco', `4xx que repiten el id enviado (≥9 caracteres): ${echo.length} ${[...new Set(echo)].slice(0, 6).join(' | ')}`);
  // ---- cuerpo y consulta hostiles sobre TODAS las rutas con 5xx de la sonda y sobre las rutas con cuerpo
  const bodies = [null, [], 'x', 5, { id: 'abc' }, { id: 2147483648 }, { id: [1] }, { name: 'x'.repeat(20000) }, { __proto__: { admin: true } }, JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}}}'), { content: { $ne: null } }, { isActive: 'yes', price: 'NaN', slug: '../x', sortOrder: 1e999 }, { title: { es: 1 }, es: 'x' }, { reason: '\u0000\ud800' }];
  const queries = ['?limit=abc', '?limit=-1&page=0', '?limit=99999999999', '?sort=%00', '?lang=%E0%A4%A', '?id=1&id=2', '?q=' + 'x'.repeat(5000), '?[]=1&a[b][c]=2', '?lang=xx&since=9999-99-99'];
  const hitBody = []; const hitKeys = new Set(hit.map(h => h.k)); const bodyRoutes = all.filter(r => r.path.startsWith('/api') && (hitKeys.has(r.method + ' ' + r.path) || (r.hasParam && !['GET', 'HEAD'].includes(r.method))));
  let nb = 0; for (const r of bodyRoutes) for (const role of roles.slice(2, 4)) { for (const b of bodies) { nb++; const out = await call(r, role, '1', b); if (out.status >= 500) hitBody.push(`${r.method} ${r.path} [${role.role}] body ${JSON.stringify(b)?.slice(0, 24)} → ${out.status}${LEAK.test(out.text) ? ' FUGA' : ''}`); } for (const qs of queries) { nb++; const out = await call(r, role, '1', {}, qs); if (out.status >= 500) hitBody.push(`${r.method} ${r.path} [${role.role}] query ${qs.slice(0, 24)} → ${out.status}${LEAK.test(out.text) ? ' FUGA' : ''}`); } }
  check('S4 cuerpo y consulta hostiles (14 cuerpos × 9 consultas, id válido «1», perfiles administración y superadministración) sobre las rutas con 5xx y las de escritura con parámetro: ningún 5xx ni fuga', hitBody.length === 0, `${nb} solicitudes; ${hitBody.length} 5xx: ${[...new Set(hitBody)].slice(0, 12).join(' | ')}`);
  // ---- rutas sin parámetro: ¿hay alguna que dé 5xx con consulta/cuerpo hostil?
  const noParam = all.filter(r => !r.hasParam && r.path.startsWith('/api')); const hitNP = []; let nnp = 0;
  for (const r of noParam) for (const role of [roles[0], roles[3], null]) { for (const b of [{ id: 'abc' }, { content: 'x'.repeat(50000) }, []]) { if (['GET', 'HEAD'].includes(r.method)) break; nnp++; const out = await call(r, role, '1', b); if (out.status >= 500) hitNP.push(`${r.method} ${r.path} [${role ? role.role : 'anon'}] → ${out.status}`); } for (const qs of queries.slice(0, 5)) { nnp++; const out = await call(r, role, '1', {}, qs); if (out.status >= 500) hitNP.push(`${r.method} ${r.path} [${role ? role.role : 'anon'}] ${qs.slice(0, 14)} → ${out.status}`); } }
  info('S5 rutas sin parámetro', `${noParam.length} rutas, ${nnp} solicitudes con cuerpo/consulta hostil: ${hitNP.length} respuestas 5xx. ${[...new Set(hitNP)].slice(0, 15).join(' | ')}`);
  info('catalogo-param', [...new Set(withParam.map(r => r.method + ' ' + r.path))].join(' ; '));
  info('router.param', `routers con router.param declarado: ${[...paramHandlers.entries()].map(([, v]) => v.join('+')).join(', ') || 'ninguno'}`);
  server.close(); await db.end(); await app.close().catch(() => {}); await adm.query(`DROP DATABASE IF EXISTS "${DBN}" WITH (FORCE)`); await adm.end();
  fs.writeFileSync(path.join(E.QA_OUT || '.', 'ES-280-sonda-ids-' + (E.TAG || 'main') + '.json'), JSON.stringify(results, null, 1)); console.log('RESUMEN ' + results.filter(r => r.ok).length + '/' + results.filter(r => 'ok' in r).length); process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
