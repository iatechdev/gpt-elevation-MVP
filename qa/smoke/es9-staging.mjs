// [QA-Claude] ES-9 · pruebas en staging (plan corto aprobado por Mauricio).
// Uso: QA_BASE=https://<staging> node qa/smoke/es9-staging.mjs <health|smoke|anon|headers|load> [segundos]
// Solo datos sintéticos (@example.test, contraseña aleatoria generada en ejecución, nunca impresa).
// No imprime tokens ni valores de secretos. Las llamadas a Claude son una sola, mínima.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const base = (process.env.QA_BASE || '').replace(/\/$/, '');
if (!base.startsWith('https://')) throw new Error('Defina QA_BASE con la URL https de staging.');
const [, , mode = 'health', arg] = process.argv;

const t0 = () => performance.now();
const ms = s => Math.round(performance.now() - s);
async function call(method, path, { token, body, headers = {} } = {}) {
  const s = t0();
  const h = { ...headers };
  if (token) h.Authorization = 'Bearer ' + token;
  if (body !== undefined) h['Content-Type'] = 'application/json';
  const r = await fetch(base + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, ms: ms(s), text, json, headers: r.headers };
}
const row = (id, esperado, obtenido, ok, extra = '') => console.log(JSON.stringify({ id, esperado, obtenido, ok, extra }));

if (mode === 'health') {
  for (const p of ['/api/health', '/api/health', '/', '/login']) {
    const r = await call('GET', p);
    const spa = p === '/' || p === '/login' ? r.text.includes('id="root"') : null;
    row('ES9-01 ' + p, 200, r.status, r.status === 200 && spa !== false, `${r.ms}ms ` + (p === '/api/health' ? JSON.stringify(r.json) : `root=${spa}`));
  }
}

if (mode === 'smoke') {
  const email = `smoke-qa-${Date.now()}@example.test`;
  const password = randomBytes(18).toString('base64url') + 'aA1!';
  let r = await call('POST', '/api/register', { body: { name: 'QA sintetico', email, password } });
  row('ES9-02 registro', 201, r.status, r.status === 201, r.ms + 'ms');
  r = await call('POST', '/api/login', { body: { email, password } });
  const token = r.json?.token;
  row('ES9-02 login', '200 + token', r.status, r.status === 200 && !!token, `${r.ms}ms rol=${r.json?.user?.role ?? r.json?.role ?? '?'}`);
  r = await call('GET', '/api/messages');
  row('ES9-02 historial sin token', 'denegado', r.status, [401, 403].includes(r.status), r.ms + 'ms');
  r = await call('GET', '/api/admin/users', { token });
  row('ES9-02 admin con usuario común', 'denegado', r.status, [401, 403, 404].includes(r.status), r.ms + 'ms');
  r = await call('POST', '/api/pricing', { body: {} });
  row('ES9-02 POST pricing sin token', 'denegado', r.status, [401, 403].includes(r.status), r.ms + 'ms');
  r = await call('POST', '/api/chat', { token, body: { message: 'Hola, ¿puedes responder con una sola frase corta?', lang: 'es' } });
  row('ES9-02 chat (Claude real, 1 llamada)', 200, r.status, r.status === 200, `${r.ms}ms respuesta_texto=${typeof (r.json?.reply ?? r.json?.response ?? r.json?.message) === 'string'}`);
  r = await call('GET', '/api/messages', { token });
  row('ES9-02 historial propio', 200, r.status, r.status === 200, `${r.ms}ms n=${Array.isArray(r.json) ? r.json.length : '?'}`);
  console.log(JSON.stringify({ nota: 'Usuario sintético creado en staging; no hay ruta pública de borrado. Pedir a Mauricio/Infra que lo elimine.', email }));
}

if (mode === 'anon') {
  // Mutaciones declaradas en los archivos de rutas del clon local (QA_SUT), disparadas SIN sesión contra staging.
  const sut = process.env.QA_SUT; if (!sut) throw new Error('Defina QA_SUT (clon del commit a comparar).');
  const mounts = [
    ['/api', 'auth'], ['/api/landing-content', 'landingContent'], ['/api/pricing', 'pricing'], ['/api/plans', 'plans'],
    ['/api/manifest', 'board'], ['/api', 'chat'], ['/api/mood', 'mood'], ['/api', 'ratings'],
    ['/api/recommendations', 'recommendations'], ['/api/user', 'progress'], ['/api/user/plan', 'plans'],
    ['/api/plan-requests', 'planRequests'], ['/api/matching', 'matching'], ['/api/sessions', 'sessions'],
    ['/api/therapist', 'therapistRoutes'], ['/api/therapist/validation', 'validation'],
    ['/api/admin/usuarios', 'adminUsers'], ['/api/admin/metrics', 'adminMetrics'], ['/api/admin/matching', 'matching'],
    ['/api/admin/pricing', 'pricing'], ['/api/admin/plan-requests', 'planRequests'], ['/api/admin', 'adminPrompts'],
    ['/api/superadmin', 'adminPrompts'], ['/api/board', 'board'], ['/api/junta', 'validation'],
  ];
  const skip = new Set(['POST /api/register', 'POST /api/login']);
  const seen = new Set(); const open = []; let n = 0;
  for (const [prefix, file] of mounts) {
    const src = readFileSync(`${sut}/backend/routes/${file}.js`, 'utf8');
    for (const m of src.matchAll(/router\.(post|put|patch|delete)\(\s*['"`]([^'"`]*)['"`]/g)) {
      const method = m[1].toUpperCase(); const url = prefix + (m[2] === '/' ? '' : m[2]).replace(/:[A-Za-z_]+/g, '1');
      const k = method + ' ' + url; if (skip.has(k) || seen.has(k)) continue; seen.add(k);
      const r = await call(method, url, { body: {} }); n++;
      if (![401, 403].includes(r.status)) open.push({ method, url, status: r.status });
    }
  }
  row('ES9-03 mutaciones sin sesión', 'todas 401/403', `${n - open.length}/${n}`, open.length === 0, JSON.stringify(open));
}

if (mode === 'headers') {
  let r = await call('GET', '/api/health');
  const want = ['x-content-type-options', 'strict-transport-security', 'content-security-policy', 'x-frame-options', 'referrer-policy'];
  const got = Object.fromEntries(want.map(h => [h, r.headers.get(h) ?? null]));
  row('ES9-05 cabeceras de seguridad', 'presentes', JSON.stringify(got), want.every(h => got[h]), `x-powered-by=${r.headers.get('x-powered-by')}`);
  r = await call('GET', '/api/pricing', { headers: { Origin: 'https://evil.example.test' } });
  const acao = r.headers.get('access-control-allow-origin');
  row('ES9-05 CORS origen ajeno', 'no reflejado ni *', String(acao), !acao || (acao !== '*' && !acao.includes('evil')), '');
  r = await call('OPTIONS', '/api/pricing', { headers: { Origin: 'https://evil.example.test', 'Access-Control-Request-Method': 'GET' } });
  row('ES9-05 CORS preflight ajeno', 'no permitido', String(r.headers.get('access-control-allow-origin')), !(r.headers.get('access-control-allow-origin') || '').includes('evil'), '');
  const html = (await call('GET', '/')).text;
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
  const pat = /(sk-ant-[A-Za-z0-9_-]{10,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.|localhost:8080|postgres(ql)?:\/\/)/;
  let hits = [];
  for (const a of assets) { const t = (await call('GET', a)).text; const m = t.match(pat); if (m) hits.push(a + ' -> patrón ' + m[1].slice(0, 12) + '…'); }
  row('ES9-05 bundle sin secretos/localhost', 0, hits.length, hits.length === 0, `${assets.length} bundle(s) revisados; ${JSON.stringify(hits)}`);
  r = await call('POST', '/api/chat', { body: 'x' }).catch(e => ({ status: 'ERR', text: String(e) }));
  row('ES9-05 error sin traza', 'sin stack', r.status, !/at .*\.js:\d+/.test(r.text || ''), '');
  r = await call('POST', '/api/login', { body: { email: { $ne: null }, password: { $ne: null } } });
  row('ES9-05 login con objeto (NoSQL/tipos)', '4xx, no 500', r.status, r.status >= 400 && r.status < 500, '');
}

if (mode === 'load') {
  const secs = Number(arg || 300); const vus = 6; const end = Date.now() + secs * 1000;
  const paths = ['/api/health', '/api/pricing', '/'];
  const lat = []; let err5 = 0, errNet = 0, total = 0;
  await Promise.all(Array.from({ length: vus }, async (_, i) => {
    while (Date.now() < end) {
      const p = paths[(total + i) % paths.length];
      try { const r = await call('GET', p); lat.push(r.ms); total++; if (r.status >= 500) err5++; }
      catch { errNet++; }
      await new Promise(r => setTimeout(r, 400));
    }
  }));
  lat.sort((a, b) => a - b); const q = x => lat[Math.min(lat.length - 1, Math.floor(lat.length * x))];
  row('ES9-06 carga acotada', `${vus} VU, ${secs}s, 0 5xx`, `${total} peticiones`, err5 === 0 && errNet === 0,
    `5xx=${err5} red=${errNet} p50=${q(0.5)}ms p95=${q(0.95)}ms max=${lat[lat.length - 1]}ms`);
}
