// [QA-Claude] Humo desplegado de ES-18, ES-19 y ES-20 en staging (Supabase real). Solo HTTP.
// Uso: QA_BASE=https://<staging> QA_SUT=<clon de main para listar rutas> QA_EXPECT_COMMIT=6b17291 node qa/smoke/es18-20-staging.mjs
// Solo datos sintéticos (@example.test, contraseña aleatoria nunca impresa). UNA llamada real a Claude (muestra mínima).
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = (process.env.QA_BASE || '').replace(/\/$/, '');
const sut = process.env.QA_SUT; const expect = process.env.QA_EXPECT_COMMIT;
if (!base.startsWith('https://') || !sut) throw new Error('Defina QA_BASE (https) y QA_SUT.');
const out = []; let failed = 0;
const check = (id, ok, detail = '') => { out.push({ id, ok }); if (!ok) failed++; console.log(JSON.stringify({ id, ok, detail })); };
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const call = async (method, url, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now();
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { /* no JSON */ }
  return { status: r.status, json: j, ms: performance.now() - t0, headers: r.headers };
};
const stamp = Date.now();
const mk = async tag => {
  const email = `qa-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const reg = await call('POST', '/api/register', { body: { name: 'QA ' + tag, email, password } });
  if (reg.status !== 201) throw new Error(`registro ${tag}: ${reg.status}`);
  const login = async () => (await call('POST', '/api/login', { body: { email, password } }));
  return { tag, email, login, tok: async () => (await login()).json.token };
};
const decode = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
const rid = () => 'qa' + randomBytes(8).toString('hex');

// ── Despliegue ────────────────────────────────────────────────────────────────
const h = await call('GET', '/api/health');
check('DEP-01 salud 200 y commit desplegado = main', h.status === 200 && (!expect || h.json?.commit === expect), JSON.stringify(h.json));
const hd = await call('GET', '/api/health');
const want = ['x-content-type-options', 'strict-transport-security', 'content-security-policy', 'x-frame-options', 'referrer-policy'];
check('DEP-02 cabeceras de seguridad siguen presentes', want.every(k => hd.headers.get(k)) && !hd.headers.get('x-powered-by'));

// ── Sesiones (ES-18) ─────────────────────────────────────────────────────────
const A = await mk('A'), B = await mk('B');
const a1 = await A.tok(), a2 = await A.tok();
const c1 = decode(a1);
check('S18-01 el login desplegado emite jti e iatMs', typeof c1.jti === 'string' && c1.jti.length === 32 && Number.isFinite(c1.iatMs), `jti=${typeof c1.jti}`);
check('S18-02 token válido accede', (await call('GET', '/api/mood/history', { token: a1 })).status === 200);
check('S18-03 logout revoca solo ese token', (await call('POST', '/api/logout', { token: a1 })).status === 200 && (await call('GET', '/api/mood/history', { token: a1 })).status === 401 && (await call('GET', '/api/mood/history', { token: a2 })).status === 200);
check('S18-04 logout-all corta todo y un login inmediato vale', (await call('POST', '/api/logout-all', { token: a2 })).status === 200 && (await call('GET', '/api/mood/history', { token: a2 })).status === 401 && (await call('GET', '/api/mood/history', { token: await A.tok() })).status === 200);
const a = await A.tok(), b = await B.tok();
check('S18-05 token sin jti (legado) y firma ajena → 401', await (async () => {
  const none = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.' + Buffer.from(JSON.stringify({ id: 1, role: 'superadmin', jti: 'x'.repeat(32) })).toString('base64url') + '.';
  return (await call('GET', '/api/admin/usuarios', { token: none })).status === 401 && (await call('GET', '/api/mood/history', { token: a.slice(0, -4) + 'AAAA' })).status === 401;
})());
check('S18-06 rutas de terapeuta y de admin con usuario común → 403', (await call('GET', '/api/therapist/pacientes', { token: a })).status === 403 && (await call('GET', '/api/admin/usuarios', { token: a })).status === 403);

// ── Aislamiento A/B ──────────────────────────────────────────────────────────
await call('POST', '/api/mood/checkin', { token: a, body: { mood: 4 } });
const bh = await call('GET', '/api/mood/history', { token: b });
check('AB-01 B no ve el ánimo de A', bh.status === 200 && bh.json.length === 0);
const d1 = await call('POST', '/api/diary', { token: a, body: { date: '2026-10-20', content: 'Entrada sintética de A ñandú 😀' } });
const dB = [await call('GET', `/api/diary/${d1.json?.id}`, { token: b }), await call('PUT', `/api/diary/${d1.json?.id}`, { token: b, body: { content: 'x' } }), await call('DELETE', `/api/diary/${d1.json?.id}`, { token: b })];
const dList = await call('GET', '/api/diary', { token: b });
check('AB-02 diario: crear 201 con acentos/emoji; B no lee, edita ni borra (404) y su lista está vacía', d1.status === 201 && dB.every(x => x.status === 404) && dList.json.entries.length === 0, `crear=${d1.status} B=${dB.map(x => x.status)}`);
check('AB-03 A relee su entrada intacta (UTF-8 en Supabase)', (await call('GET', `/api/diary/${d1.json?.id}`, { token: a })).json?.content === 'Entrada sintética de A ñandú 😀');
const e = await call('PUT', `/api/diary/${d1.json?.id}`, { token: a, body: { content: 'editada' } }); const del = await call('DELETE', `/api/diary/${d1.json?.id}`, { token: a });
check('AB-04 editar y borrar propios; lo borrado ya no se lee', e.status === 200 && del.status === 200 && (await call('GET', `/api/diary/${d1.json?.id}`, { token: a })).status === 404);

// ── Consentimiento (ES-19) con concurrencia real en Supabase ────────────────
await call('PUT', '/api/consents/research', { token: a, body: { status: 'granted' } });
const cb = await call('GET', '/api/consents', { token: b });
check('C19-01 B no ve el consentimiento de A; el historial de B está vacío', cb.json.consents.find(x => x.purpose === 'research').status === 'undecided' && (await call('GET', '/api/consents/history', { token: b })).json.history.length === 0);
const C = await mk('C'); const cT = await C.tok();
const par = await Promise.all(Array.from({ length: 20 }, () => call('PUT', '/api/consents/professional_bridge', { token: cT, body: { status: 'granted' } })));
const hist = await call('GET', '/api/consents/history', { token: cT });
const cons = (await call('GET', '/api/consents', { token: cT })).json.consents.find(x => x.purpose === 'professional_bridge');
check('C19-02 20 primeras decisiones simultáneas en Supabase: 200 todas, un solo evento y estado `granted`', par.every(x => x.status === 200) && hist.json.history.filter(x => x.purpose === 'professional_bridge').length === 1 && cons.status === 'granted', `códigos=${[...new Set(par.map(x => x.status))]} eventos=${hist.json.history.length}`);
const mix = await Promise.all(Array.from({ length: 20 }, (_, i) => call('PUT', '/api/consents/facilitator_sharing', { token: cT, body: { status: i % 2 ? 'revoked' : 'granted' } })));
const hh = (await call('GET', '/api/consents/history', { token: cT })).json.history.filter(x => x.purpose === 'facilitator_sharing');
const fin = (await call('GET', '/api/consents', { token: cT })).json.consents.find(x => x.purpose === 'facilitator_sharing');
check('C19-03 20 decisiones contradictorias simultáneas: sin 5xx y el estado final coincide con el último evento', mix.every(x => x.status === 200) && hh[0]?.status === fin.status, `códigos=${[...new Set(mix.map(x => x.status))]} eventos=${hh.length} final=${fin.status} último=${hh[0]?.status}`);
check('C19-04 `necessary` no se revoca (409)', (await call('PUT', '/api/consents/necessary', { token: a, body: { status: 'revoked' } })).status === 409);

// ── Chat y diario (ES-20): UNA llamada real a Claude ─────────────────────────
const R = rid();
const ch = await call('POST', '/api/chat', { token: a, body: { message: 'Hola, responde con una sola frase corta.', requestId: R } });
check('E20-01 chat con Claude real: 200 y respuesta de texto', ch.status === 200 && typeof ch.json?.reply === 'string' && ch.json.reply.length > 0, `status=${ch.status} ${ch.ms.toFixed(0)}ms`);
const rp = await call('POST', '/api/chat', { token: a, body: { message: 'Hola, responde con una sola frase corta.', requestId: R } });
check('E20-02 repetir el requestId: respuesta repetida sin segunda llamada (rápida) y sin duplicados', rp.status === 200 && rp.json?.replayed === true && rp.json?.reply === ch.json?.reply && rp.ms < ch.ms, `repetida=${rp.ms.toFixed(0)}ms original=${ch.ms.toFixed(0)}ms`);
const turn = await call('GET', `/api/chat/turns/${R}`, { token: a }); const msgs = await call('GET', '/api/messages', { token: a });
check('E20-03 el turno consta `completed` y el historial tiene exactamente un par', turn.json?.status === 'completed' && msgs.json.length === 2, `mensajes=${msgs.json?.length}`);
check('E20-04 otro usuario no ve el turno ni los mensajes (404 / lista vacía)', (await call('GET', `/api/chat/turns/${R}`, { token: b })).status === 404 && (await call('GET', '/api/messages', { token: b })).json.length === 0);
const d2 = await call('POST', '/api/diary', { token: b, body: { date: '2026-10-21', content: 'privado de B' } });
const fx = await call('POST', '/api/chat', { token: a, body: { message: 'x', contextEntryIds: [d2.json?.id] } });
check('E20-05 usar como contexto la entrada de otra persona → 404 (sin llamar a Claude)', fx.status === 404 && fx.ms < 1500, `status=${fx.status} ${fx.ms.toFixed(0)}ms`);
const inv = await Promise.all([call('POST', '/api/chat', { token: a, body: { message: 'x', requestId: 'abc' } }), call('POST', '/api/chat', { token: a, body: { message: 5 } }), call('POST', '/api/diary', { token: a, body: { date: '2026-02-30', content: 'x' } }), call('GET', '/api/diary/abc', { token: a })]);
check('E20-06 entradas inválidas → 400/404, nunca 500', inv.every(x => [400, 404].includes(x.status)), `estados=${inv.map(x => x.status)}`);

// ── Barrido de mutaciones sin sesión (rutas de main) ─────────────────────────
const mounts = [['/api', 'auth'], ['/api/landing-content', 'landingContent'], ['/api/pricing', 'pricing'], ['/api/plans', 'plans'], ['/api/manifest', 'board'], ['/api', 'chat'], ['/api', 'session'], ['/api/consents', 'consents'], ['/api/diary', 'diary'],
  ['/api/mood', 'mood'], ['/api', 'ratings'], ['/api/recommendations', 'recommendations'], ['/api/user', 'progress'], ['/api/user/plan', 'plans'], ['/api/plan-requests', 'planRequests'], ['/api/matching', 'matching'], ['/api/sessions', 'sessions'],
  ['/api/therapist/validation', 'validation'], ['/api/therapist', 'therapistRoutes'], ['/api/admin/usuarios', 'adminUsers'], ['/api/admin/metrics', 'adminMetrics'], ['/api/admin/matching', 'matching'], ['/api/admin/pricing', 'pricing'],
  ['/api/admin/plan-requests', 'planRequests'], ['/api/admin', 'adminPrompts'], ['/api/superadmin', 'adminPrompts'], ['/api/board', 'board'], ['/api/junta', 'validation']];
const skip = new Set(['POST /api/register', 'POST /api/login']); const seen = new Set(); const open = []; let n = 0;
for (const [prefix, file] of mounts) {
  const src = readFileSync(`${sut}/backend/routes/${file}.js`, 'utf8');
  for (const m of src.matchAll(/router\.(post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g)) {
    const method = m[1].toUpperCase(), url = prefix + (m[2] === '/' ? '' : m[2]).replace(/:[A-Za-z_]+/g, '1'); const k = method + ' ' + url;
    if (skip.has(k) || seen.has(k)) continue; seen.add(k);
    const r = await call(method, url, { body: {} }); n++; if (![401, 403].includes(r.status)) open.push(`${k}→${r.status}`);
  }
}
check('SWP-01 todas las mutaciones sin sesión → 401/403', open.length === 0, open.length ? JSON.stringify(open) : `${n} mutaciones sondeadas`);

// ── Latencias de muestra (informativo, contra umbrales propuestos) ───────────
const lat = {}; const sample = async (name, fn, k = 15) => { const xs = []; for (let i = 0; i < k; i++) xs.push((await fn()).ms); xs.sort((x, y) => x - y); lat[name] = { p50: Math.round(xs[Math.floor(k * 0.5)]), p95: Math.round(xs[Math.min(k - 1, Math.floor(k * 0.95))]) }; };
await sample('health', () => call('GET', '/api/health')); await sample('GET /api/diary', () => call('GET', '/api/diary', { token: a })); await sample('GET /api/consents', () => call('GET', '/api/consents', { token: a })); await sample('GET /api/messages', () => call('GET', '/api/messages', { token: a })); await sample('login', () => A.login(), 8);
info('LAT-01 latencias de muestra (ms)', JSON.stringify(lat));
check('LAT-02 login p95 ≤ 1500 ms y lecturas simples p95 ≤ 1500 ms (umbrales propuestos)', lat.login.p95 <= 1500 && lat['GET /api/diary'].p95 <= 1500 && lat['GET /api/messages'].p95 <= 1500, JSON.stringify(lat));

console.log(JSON.stringify({ resumen: { total: out.length, fallos: failed }, usuariosSinteticos: ['A', 'B', 'C'].map(t => `qa-${t}-${stamp}@example.test`) }));
process.exit(failed ? 1 : 0);
