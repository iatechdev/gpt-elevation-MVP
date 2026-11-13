// [QA-Claude] Humo desplegado de ES-21 a ES-27 en staging (Supabase real). Solo HTTP, datos sintéticos, acotado.
// Uso: QA_BASE=https://<staging> QA_EXPECT_COMMIT=<sha corto> node qa/smoke/es21-23-staging.mjs
// Contraseñas aleatorias que nunca se imprimen. A lo sumo UNA llamada real a Claude (mensaje mínimo) y ninguna otra.
import { randomBytes } from 'node:crypto';

const base = (process.env.QA_BASE || '').replace(/\/$/, ''); const expect = process.env.QA_EXPECT_COMMIT;
if (!base.startsWith('https://')) throw new Error('Defina QA_BASE (https).');
const check = (id, ok, detail = '') => console.log(JSON.stringify({ id, ok: !!ok, detail }));
const info = (id, detail) => console.log(JSON.stringify({ id, info: detail }));
const call = async (method, url, { token, body } = {}) => {
  const h = {}; if (token) h.Authorization = 'Bearer ' + token; if (body !== undefined) h['Content-Type'] = 'application/json';
  const t0 = performance.now();
  const r = await fetch(base + url, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch { /* no JSON */ }
  return { status: r.status, json, text, ms: performance.now() - t0, headers: r.headers };
};
const stamp = Date.now();
const mk = async (tag) => {
  const email = `qa-smoke21-${tag}-${stamp}@example.test`, password = randomBytes(14).toString('base64url') + 'aA1!';
  const reg = await call('POST', '/api/register', { body: { name: 'QA smoke ' + tag, email, password } });
  if (reg.status !== 201) throw new Error('registro ' + tag + ' ' + reg.status);
  const lg = await call('POST', '/api/login', { body: { email, password } });
  return { tag, email, token: lg.json?.token };
};
const rid = () => 'qa' + randomBytes(8).toString('hex');
const pct = (x, p) => { const s = [...x].sort((m, n) => m - n); return s[Math.min(s.length - 1, Math.ceil(s.length * p) - 1)].toFixed(0); };

const h = await call('GET', '/api/health');
check('DEP-01 salud 200 y commit desplegado = el esperado', h.status === 200 && (!expect || h.json?.commit === expect), JSON.stringify(h.json));
const A = await mk('A');
check('DEP-02 registro y login con datos sintéticos', !!A.token);
const a = A.token;

// ── ES-21 · límites y frontera (sin llamar a la IA)
const crisis = await call('POST', '/api/chat', { token: a, body: { message: 'Quiero quitarme la vida', requestId: rid() } });
info('ES21-crisis', `status=${crisis.status} claves=${Object.keys(crisis.json ?? {}).join(',')}`);
check('ES21-S01 mensaje de crisis: respuesta de seguridad inmediata (200), sin 5xx y sin llamar a la IA', crisis.status === 200 && typeof crisis.json?.reply === 'string' && crisis.json.reply.length > 20 && crisis.ms < 3000, `status=${crisis.status} ms=${crisis.ms.toFixed(0)}`);
check('ES21-S01b la respuesta de crisis no inventa teléfonos ni recursos', !/\b\d{3}[ -]?\d{3}[ -]?\d{3,4}\b/.test(crisis.json?.reply || '') && !/https?:\/\//.test(crisis.json?.reply || ''), '');
for (const [label, extra] of [['country con SQL', { country: "CO'; drop table \"Users\";--" }], ['lang desconocido', { lang: 'xx' }], ['country como objeto', { country: { a: 1 } }]]) {
  const x = await call('POST', '/api/chat', { token: a, body: { message: 'Quiero quitarme la vida', requestId: rid(), ...extra } });
  check(`ES21-S02 ${label} no da 400 ni 5xx en una respuesta de seguridad`, x.status === 200, `status=${x.status}`);
}
check('ES21-S03 chat sin token → rechazado', [401, 403].includes((await call('POST', '/api/chat', { body: { message: 'hola' } })).status));

// ── ES-22 · presupuesto (una sola llamada real, mínima)
const real = await call('POST', '/api/chat', { token: a, body: { message: 'Hola, responde solo con la palabra "ok".', requestId: rid() } });
info('ES22-chat', `status=${real.status} code=${real.json?.code} ms=${real.ms.toFixed(0)}`);
check('ES22-C01 el chat responde 200 (presupuesto cargado), o 503 ai_budget_not_configured; nunca 500', real.status === 200 || (real.status === 503 && real.json?.code === 'ai_budget_not_configured'), `status=${real.status} code=${real.json?.code}`);

// ── ES-23 · derechos sobre los datos: apagados por defecto
const pv = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
const del = await call('POST', '/api/account/deletion-requests', { token: a, body: { confirm: true } });
info('ES23-estado', `preview=${pv.status} borrado=${del.status}`);
check('ES23-D01 exportación y eliminación apagadas (503 data_rights_unavailable)', pv.status === 503 && pv.json?.code === 'data_rights_unavailable' && del.status === 503, `preview=${pv.status} code=${pv.json?.code} borrado=${del.status}`);
check('ES23-D02 sin token no se llega al contenido (401/403/503, nunca 200)', [401, 403, 503].includes((await call('POST', '/api/exports/preview', { body: { type: 'personal', locale: 'es' } })).status));

// ── ES-25 y ES-27 desplegados (desde e66fa5d): lectura, escritura mínima y aislamiento con datos sintéticos
const B2 = await mk('B');
const cc = await call('GET', '/api/career-context', { token: a }), cc0 = await call('GET', '/api/career-context');
const ev = await call('GET', '/api/evidence', { token: a }), ev0 = await call('GET', '/api/evidence');
check('ES25-D01 /api/career-context: 200 JSON con sesión y rechazo sin sesión', cc.status === 200 && !!cc.json && [401, 403].includes(cc0.status), `con=${cc.status} sin=${cc0.status}`);
check('ES27-D01 /api/evidence: 200 JSON con sesión y rechazo sin sesión', ev.status === 200 && !!ev.json && [401, 403].includes(ev0.status), `con=${ev.status} sin=${ev0.status}`);
const fields = [{ key: 'values', text: 'Honestidad (humo QA)' }];
const pvw = await call('POST', '/api/career-context/preview', { token: a, body: { fields } });
const cfm = await call('POST', '/api/career-context/confirm', { token: a, body: { fields, token: pvw.json?.token, requestId: rid() } });
check('ES25-D02 puente por el camino directo: vista previa 200 y confirmación 201 (versión 1)', pvw.status === 200 && cfm.status === 201 && cfm.json?.version === 1, `preview=${pvw.status} confirm=${cfm.status}`);
const evBody = { payload: { title: 'Humo QA', situation: 'Situación sintética', responsibility: { text: 'Mi parte' }, actions: [{ text: 'Hice algo' }], delivered: { text: 'Entregué algo' }, observedEffect: { known: false }, autonomy: 'assisted' }, status: 'confirmed', requestId: rid() };
const evc = await call('POST', '/api/evidence', { token: a, body: evBody });
check('ES27-D02 evidencia directa confirmada: 201 y versión 1', evc.status === 201 && evc.json?.version === 1, `status=${evc.status}`);
const evBad = await call('POST', '/api/evidence', { token: a, body: { ...evBody, requestId: rid(), payload: { ...evBody.payload, responsibility: { text: 'x', source: 'artifact_examined' } } } });
check('ES27-D03 la persona no puede declarar procedencia «artifact_examined» (4xx, nunca 5xx)', evBad.status >= 400 && evBad.status < 500, `status=${evBad.status}`);
const isoB1 = await call('GET', '/api/career-context', { token: B2.token }), isoB2 = await call('GET', '/api/evidence', { token: B2.token });
check('ES25-D03 aislamiento: otra persona no ve el puente ni la evidencia de A', !isoB1.text.includes('Honestidad') && !isoB2.text.includes('Humo QA'), `status=${isoB1.status}/${isoB2.status}`);
check('ES27-D04 el ID de evidencia de A pedido por B → 404', (await call('GET', '/api/evidence/' + evc.json?.id, { token: B2.token })).status === 404);
check('ES25-D04 revocar el puente → 200', (await call('POST', '/api/career-context/revoke', { token: a, body: {} })).status === 200);
const del2 = await call('DELETE', '/api/evidence/' + evc.json?.id, { token: a });
check('ES27-D05 borrar la evidencia propia → 200 y luego 404', del2.status === 200 && (await call('GET', '/api/evidence/' + evc.json?.id, { token: a })).status === 404, `status=${del2.status}`);

// ── Latencias de muestra (20 lecturas de una cuenta)
const lat = {};
for (const [k, u] of [['career_context', '/api/career-context'], ['evidence', '/api/evidence'], ['consents', '/api/consents'], ['messages', '/api/messages'], ['diary', '/api/diary']]) {
  const xs = []; for (let i = 0; i < 20; i++) xs.push((await call('GET', u, { token: a })).ms);
  lat[k] = { p50: pct(xs, 0.5), p95: pct(xs, 0.95) };
}
info('LAT-staging (ms)', JSON.stringify(lat));
check('LAT-01 lecturas autenticadas con p95 menor a 1000 ms (umbral propuesto; mide región y pool, no código)', Object.values(lat).every(v => Number(v.p95) < 1000), JSON.stringify(lat));

// ── Rutas de historias que siguen sin desplegar o respuesta a rutas inexistentes
for (const [label, url] of [['Skill Map (ES-29)', '/api/skill-map'], ['catálogo de rutas (ES-31)', '/api/route-catalog'], ['contexto del participante (ES-14)', '/api/user/context'], ['ruta inexistente', '/api/no-existe']]) {
  const x = await call('GET', url, { token: a });
  const html = /<html/i.test(x.text); const json404 = x.status === 404 && !!x.json;
  info('NOVEDAD-' + label, `status=${x.status} html=${html}`);
  check(`NOVEDAD ${label}: sin datos y sin 5xx (HTML 200 de la SPA o 404 JSON)`, x.status < 500 && (html || json404), `status=${x.status}`);
}

// ── Cabeceras y errores
const bad = await call('POST', '/api/login', { body: '[]' });
check('SEG-01 cuerpo inválido en login → 4xx controlado, sin pila ni SQL', bad.status >= 400 && bad.status < 500 && !/at \w|SequelizeDatabaseError|select |insert /i.test(bad.text.slice(0, 600)), `status=${bad.status}`);
check('SEG-02 cabeceras de seguridad y sin x-powered-by', ['x-content-type-options', 'strict-transport-security', 'content-security-policy'].every(k => h.headers.get(k)) && !h.headers.get('x-powered-by'));
console.log(JSON.stringify({ fin: true, usuarios_sinteticos: [A.email.replace(/^[^@]+/, 'qa-smoke21-…')] }));
