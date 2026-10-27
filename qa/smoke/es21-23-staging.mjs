// [QA-Claude] Humo desplegado de ES-21, ES-22 y ES-23 en staging (Supabase real). Solo HTTP, datos sintéticos, acotado.
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

const h = await call('GET', '/api/health');
check('DEP-01 salud 200 y commit desplegado = el esperado', h.status === 200 && (!expect || h.json?.commit === expect), JSON.stringify(h.json));
const A = await mk('A');
check('DEP-02 registro y login con datos sintéticos', !!A.token);
const a = A.token;

// ── ES-21 · límites y frontera (sin llamar a la IA)
const crisis = await call('POST', '/api/chat', { token: a, body: { message: 'Quiero quitarme la vida', requestId: rid() } });
info('ES21-crisis', `status=${crisis.status} claves=${Object.keys(crisis.json ?? {}).join(',')}`);
check('ES21-S01 mensaje de crisis: respuesta de seguridad inmediata (200), sin 5xx y sin llamar a la IA (no gasta presupuesto)', crisis.status === 200 && typeof crisis.json?.reply === 'string' && crisis.json.reply.length > 20 && crisis.ms < 3000, `status=${crisis.status} ms=${crisis.ms.toFixed(0)}`);
check('ES21-S01b la respuesta de crisis no inventa teléfonos ni recursos (registro vacío hasta que el especialista los apruebe)', !/\b\d{3}[ -]?\d{3}[ -]?\d{3,4}\b/.test(crisis.json?.reply || '') && !/https?:\/\//.test(crisis.json?.reply || ''), '');
for (const [label, extra] of [['country con SQL', { country: "CO'; drop table \"Users\";--" }], ['lang desconocido', { lang: 'xx' }], ['country como objeto', { country: { a: 1 } }]]) {
  const x = await call('POST', '/api/chat', { token: a, body: { message: 'Quiero quitarme la vida', requestId: rid(), ...extra } });
  check(`ES21-S02 ${label} no da 400 ni 5xx en una respuesta de seguridad`, x.status === 200, `status=${x.status}`);
}
const ownRoute = await call('POST', '/api/chat', { body: { message: 'hola' } });
check('ES21-S03 chat sin token → rechazado', [401, 403].includes(ownRoute.status), `status=${ownRoute.status}`);

// ── ES-22 · presupuesto (una sola llamada real, mínima)
const real = await call('POST', '/api/chat', { token: a, body: { message: 'Hola, responde solo con la palabra "ok".', requestId: rid() } });
info('ES22-chat', `status=${real.status} code=${real.json?.code} ms=${real.ms.toFixed(0)}`);
check('ES22-C01 el chat responde 200 (variables de presupuesto cargadas), o 503 ai_budget_not_configured si faltan; nunca 500', real.status === 200 || (real.status === 503 && real.json?.code === 'ai_budget_not_configured'), `status=${real.status} code=${real.json?.code}`);
if (real.status === 503) info('ES22-C01-estado', 'Faltan los valores V-12: AI_BUDGET_TOKENS_PER_USER (y opcional COHORT/PERIOD) en el entorno desplegado');
if (real.status === 200) {
  const again = await call('POST', '/api/chat', { token: a, body: { message: 'Hola, responde solo con la palabra "ok".', requestId: JSON.parse(JSON.stringify(real.json?.requestId ?? rid())) } });
  info('ES22-chat-repetido', `status=${again.status}`);
}

// ── ES-23 · derechos sobre los datos: apagados por defecto
const pv = await call('POST', '/api/exports/preview', { token: a, body: { type: 'personal', locale: 'es' } });
const del = await call('POST', '/api/account/deletion-requests', { token: a, body: { confirm: true } });
info('ES23-estado', `preview=${pv.status} borrado=${del.status}`);
check('ES23-D01 exportación y eliminación apagadas (503 data_rights_unavailable) mientras no se aprueben QA-14-01 y la activación', pv.status === 503 && pv.json?.code === 'data_rights_unavailable' && del.status === 503, `preview=${pv.status} code=${pv.json?.code} borrado=${del.status}`);
const unauth = await call('POST', '/api/exports/preview', { body: { type: 'personal', locale: 'es' } });
check('ES23-D02 sin token no se llega al contenido (401/403/503, nunca 200)', [401, 403, 503].includes(unauth.status), `status=${unauth.status}`);

// ── Rutas que NO deben existir aún en lo desplegado (ES-25/27/29/28/31/14 sin fusionar)
for (const [label, method, url] of [['puente profesional (ES-25)', 'GET', '/api/career-context'], ['evidencia (ES-27)', 'GET', '/api/evidence'], ['Skill Map (ES-29)', 'GET', '/api/skill-map'], ['catálogo de rutas (ES-31)', 'GET', '/api/route-catalog'], ['contexto del participante (ES-14)', 'GET', '/api/user/context']]) {
  const x = await call(method, url, { token: a });
  info('NOVEDAD-' + label, `status=${x.status}`);
  check(`NOVEDAD ${label} aún no está desplegado: no responde datos (404 o rechazo, sin 5xx)`, x.status < 500 && !(x.status === 200 && x.json && !('error' in x.json) && typeof x.json === 'object' && Object.keys(x.json).length > 0 && !/<html/i.test(x.text)), `status=${x.status} ${x.text.slice(0, 60).replace(/\s+/g, ' ')}`);
}

// ── Cabeceras y errores
const bad = await call('POST', '/api/login', { body: '[]' });
check('SEG-01 cuerpo inválido en login → 4xx controlado, sin pila ni SQL', bad.status >= 400 && bad.status < 500 && !/at \w|SequelizeDatabaseError|select |insert /i.test(bad.text.slice(0, 600)), `status=${bad.status}`);
check('SEG-02 cabeceras de seguridad y sin x-powered-by', ['x-content-type-options', 'strict-transport-security', 'content-security-policy'].every(k => h.headers.get(k)) && !h.headers.get('x-powered-by'));
console.log(JSON.stringify({ fin: true, usuarios_sinteticos: [A.email.replace(/^[^@]+/, 'qa-smoke21-…')] }));
