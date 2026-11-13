// [QA-Claude] ES-142 · PR #131 · API contra el servidor del merge local con Postgres real y proveedor SIMULADO (0 tokens reales).
// Uso: QA_API=http://127.0.0.1:9941 QA_MOCK=http://127.0.0.1:9940 node qa/integration/es142-api.cjs   (datos sintéticos; no imprime contraseñas)
const crypto = require('crypto');
const API = process.env.QA_API, MOCK = process.env.QA_MOCK; const out = [];
const R = (id, ok, d = '') => { out.push({ id, ok: !!ok, detail: String(d).slice(0, 400) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 400) })); };
const j = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { ...(t ? { Authorization: 'Bearer ' + t } : {}), ...(b !== undefined ? { 'content-type': 'application/json' } : {}) }, body: b !== undefined ? JSON.stringify(b) : undefined }); let body = null; try { body = await r.json(); } catch { /* */ } return { s: r.status, j: body }; };
const cfg = (stop, text) => fetch(`${MOCK}/_cfg?stop=${encodeURIComponent(stop)}${text !== undefined ? '&text=' + encodeURIComponent(text) : ''}`);
const mockLog = async () => (await fetch(MOCK + '/_log')).json();
const persona = async tag => { const stamp = Date.now() + Math.floor(Math.random() * 1000); const email = `qa142-${tag}-${stamp}@example.test`, password = 'Qa142-' + stamp + 'aA!x'; const r = await j('POST', '/api/register', null, { name: 'QA ' + tag, email, password }); const l = await j('POST', '/api/login', null, { email, password }); return { token: l.j?.token, reg: r.s }; };
const usage = async t => (await j('GET', '/api/ai/usage', t)).j?.used ?? 0;
const LARGO = 'Esta respuesta de prueba es larga y termina a mitad de una idea porque el modelo se quedó sin espacio para seguir escribiendo y por eso la última frase queda sin cerrar, con tildes ñ y «comillas», y con una línea\nnueva en medio y una última palabra cort';
(async () => {
  const A = await persona('a'), B = await persona('b'); if (!A.token || !B.token) { console.log('ERROR sin sesión', A.reg, B.reg); process.exit(1); }
  // T2 — corte por max_tokens
  await cfg('max_tokens', LARGO); const rid1 = crypto.randomUUID(); const u0 = await usage(A.token);
  const r1 = await j('POST', '/api/chat', A.token, { message: 'Hola, cuéntame algo largo.', requestId: rid1 });
  R('T2a max_tokens: 200, truncated:true y texto tal cual (sin recorte)', r1.s === 200 && r1.j?.truncated === true && r1.j?.reply === LARGO, `http=${r1.s} truncated=${r1.j?.truncated} igual=${r1.j?.reply === LARGO} len=${r1.j?.reply?.length}/${LARGO.length}`);
  const ml = await mockLog(); R('T5a la petición al proveedor usa max_tokens=3000', ml.length >= 1 && ml.every(x => x.max_tokens === 3000), JSON.stringify(ml.map(x => x.max_tokens)));
  const u1 = await usage(A.token); R('T5b el gasto se descuenta (usage.used sube)', u1 > u0, `antes=${u0} después=${u1}`);
  await cfg('end_turn', 'Respuesta completa.'); const rid2 = crypto.randomUUID();
  const r2 = await j('POST', '/api/chat', A.token, { message: 'Otra pregunta corta.', requestId: rid2 });
  R('T2b end_turn: 200 y sin truncated', r2.s === 200 && r2.j?.truncated === undefined && r2.j?.reply === 'Respuesta completa.', `http=${r2.s} keys=${Object.keys(r2.j || {}).join(',')}`);
  await cfg('none', 'Sin stop_reason.'); const r2c = await j('POST', '/api/chat', A.token, { message: 'Sin campo.', requestId: crypto.randomUUID() });
  R('T2c proveedor sin stop_reason: 200 y sin truncated', r2c.s === 200 && r2c.j?.truncated === undefined, `http=${r2c.s} keys=${Object.keys(r2c.j || {}).join(',')}`);
  await cfg('refusal', 'Rechazo simulado.'); const r2d = await j('POST', '/api/chat', A.token, { message: 'Valor raro.', requestId: crypto.randomUUID() });
  R('T2d otro stop_reason (refusal): sin truncated', r2d.s === 200 && r2d.j?.truncated === undefined, `http=${r2d.s} keys=${Object.keys(r2d.j || {}).join(',')}`);
  // T3 repetición
  await cfg('end_turn'); const calls0 = (await mockLog()).length; const uA = await usage(A.token);
  const rep = await j('POST', '/api/chat', A.token, { message: 'Hola, cuéntame algo largo.', requestId: rid1 });
  R('T3 repetición con el mismo requestId: replayed, truncated:true, mismo texto, sin llamada nueva ni gasto', rep.s === 200 && rep.j?.replayed === true && rep.j?.truncated === true && rep.j?.reply === LARGO && (await mockLog()).length === calls0 && (await usage(A.token)) === uA, `http=${rep.s} replayed=${rep.j?.replayed} truncated=${rep.j?.truncated} llamadas=${(await mockLog()).length}/${calls0}`);
  const diff = await j('POST', '/api/chat', A.token, { message: 'Texto distinto con el mismo id.', requestId: rid1 }); R('T3b mismo requestId con otro mensaje: rechazado (409)', diff.s === 409, `http=${diff.s}`);
  // T4 lecturas
  const t1 = await j('GET', '/api/chat/turns/' + rid1, A.token); R('T4a GET turno cortado: completed, truncated:true, texto completo', t1.s === 200 && t1.j?.status === 'completed' && t1.j?.truncated === true && t1.j?.reply === LARGO, `http=${t1.s} ${JSON.stringify({ ...t1.j, reply: undefined })}`);
  const t2 = await j('GET', '/api/chat/turns/' + rid2, A.token); R('T4b GET turno normal: sin truncated', t2.s === 200 && t2.j?.truncated === undefined, `http=${t2.s}`);
  const msgs = await j('GET', '/api/messages', A.token); const bots = (msgs.j || []).filter(m => m.role === 'bot');
  R('T4c GET /api/messages: la respuesta cortada lleva truncated:true y las demás no', msgs.s === 200 && bots.filter(m => m.truncated === true).length === 1 && bots.find(m => m.truncated)?.text === LARGO && bots.filter(m => m.truncated === undefined).length === bots.length - 1, `http=${msgs.s} bots=${bots.length} truncated=${bots.filter(m => m.truncated).length}`);
  // T6 seguridad
  const ajeno = await j('GET', '/api/chat/turns/' + rid1, B.token); R('T6a turno ajeno (usuario B): no revela contenido ni truncated', ajeno.s === 404 && !JSON.stringify(ajeno.j).includes('cort'), `http=${ajeno.s} ${JSON.stringify(ajeno.j).slice(0, 80)}`);
  const msgB = await j('GET', '/api/messages', B.token); R('T6b mensajes de B no incluyen los de A', msgB.s === 200 && (msgB.j || []).length === 0, `http=${msgB.s} n=${(msgB.j || []).length}`);
  const sinTok = await j('GET', '/api/messages', null); R('T6c sin token: rechazado (401 o 403, comportamiento previo del middleware)', sinTok.s === 401 || sinTok.s === 403, `http=${sinTok.s}`);
  await cfg('end_turn', 'Respuesta completa.'); const inj = await j('POST', '/api/chat', A.token, { message: 'Intento de inyección.', requestId: crypto.randomUUID(), truncated: true });
  R('T6d el cliente no puede fijar truncated (campo ajeno: 200 sin truncated, o 400; nunca 500)', (inj.s === 200 && inj.j?.truncated === undefined) || inj.s === 400, `http=${inj.s} truncated=${inj.j?.truncated}`);
  for (const [n, body] of [['requestId inválido', { message: 'x', requestId: 'x y!' }], ['mensaje vacío', { message: '', requestId: crypto.randomUUID() }], ['mensaje no texto', { message: { a: 1 }, requestId: crypto.randomUUID() }], ['id de turno inválido', null]]) {
    const r = body ? await j('POST', '/api/chat', A.token, body) : await j('GET', '/api/chat/turns/%27%3B--', A.token); R(`T6e entrada inválida (${n}): 4xx, nunca 500`, r.s >= 400 && r.s < 500, `http=${r.s}`);
  }
  // T7 privacidad: el cuerpo de las respuestas de otras rutas no cambia de forma
  const me = await j('GET', '/api/ai/usage', A.token); R('T7a /api/ai/usage no expone contenido ni truncated', me.s === 200 && !JSON.stringify(me.j).includes('truncated') && !JSON.stringify(me.j).includes('Respuesta'), `http=${me.s}`);
  const exp = await j('GET', '/api/user/export', A.token); const expTxt = JSON.stringify(exp.j || {}); R('T7b exportación propia (si existe): sin romper', exp.s === 200 || exp.s === 404, `http=${exp.s} contiene truncated=${expTxt.includes('truncated')}`);
  console.log('RESUMEN-ES142 ' + JSON.stringify({ total: out.length, fallos: out.filter(o => !o.ok).length }));
  require('fs').writeFileSync(require('path').join(__dirname, '..', 'evidence', 'ES-142-pr131-resultados.json'), JSON.stringify(out, null, 1));
})().catch(e => { console.log('ERROR ' + String(e.stack).slice(0, 500)); process.exit(1); });
