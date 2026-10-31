// QA-Claude-2 — B-6 (#97 «Analizar con IA») en STAGING con Claude REAL. Máximo 3 llamadas a /api/skill-map/proposals (tope duro en el script).
// Solo cuentas sintéticas @example.test. No lee ni imprime secretos. No confirma propuestas (solo lee). Env: OUT (carpeta de salida).
const fs = require('fs'), path = require('path'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
const API = 'https://backend-staging-e3a6.up.railway.app', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
const MAX_CALLS = 3; let calls = 0; let k = 0; const rid = (x) => `${x}-${Date.now()}-${++k}`
const call = async (m, p, t, b) => { const t0 = Date.now(); const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, ms: Date.now() - t0, j: await r.json().catch(() => null) } }
const person = async (tag) => { const email = `qa-b6-${tag}-${Date.now()}@example.test`; await call('POST', '/api/register', null, { name: 'QA B6 ' + tag, email, password: PASS }); const l = await call('POST', '/api/login', null, { email, password: PASS }); return { email, token: l.j?.token } }
const ev = (title, autonomy, situation, resp, actions, delivered) => ({ requestId: rid('ev'), status: 'confirmed', payload: { title, situation, responsibility: { text: resp }, actions: actions.map(text => ({ text })), delivered: { text: delivered }, observedEffect: { known: false }, ...(autonomy ? { autonomy } : {}) } })
const used = async (t) => (await call('GET', '/api/ai/usage', t)).j
const propose = async (name, t, skillKeys, locale) => {
  if (++calls > MAX_CALLS) throw new Error('tope de 3 llamadas')
  const before = await used(t); const r = await call('POST', '/api/skill-map/proposals', t, { skillKeys, locale }); const after = await used(t)
  const rec = { name, status: r.s, ms: r.ms, code: r.j?.code, proposals: r.j?.proposals, warnings: r.j?.warnings, usageBefore: before, usageAfter: after }
  fs.writeFileSync(path.join(OUT, `b6-${name}.json`), JSON.stringify(rec, null, 2)); console.log(JSON.stringify(rec, null, 2)); return rec
}
;(async () => {
  console.log('salud:', (await call('GET', '/api/health')).s)
  const A = await person('es'); if (!A.token) { console.error('no se pudo crear la persona A'); process.exit(2) }
  await call('POST', '/api/evidence', A.token, ev('Informe semanal a clientes', 'autonomous', 'Los clientes recibían informes confusos y llamaban cada lunes a preguntar.', 'Yo redactaba y enviaba el informe semanal.', ['Rehice la plantilla con un resumen de tres líneas arriba.', 'Llamé a tres clientes para preguntarles qué les resultaba claro.'], 'Plantilla nueva usada durante un mes.'))
  await call('POST', '/api/evidence', A.token, ev('Cambio de herramienta de tickets', 'assisted', 'El equipo migró de una hoja de cálculo a una herramienta de tickets a mitad de trimestre.', 'Aprender la herramienta y ayudar a dos compañeros a migrar sus pendientes.', ['Probé la herramienta una tarde con casos reales.', 'Escribí una guía de una página para mis compañeros.'], 'Guía de una página y pendientes migrados.'))
  await propose('A-es-comunicacion-adaptabilidad', A.token, ['comunicacion', 'adaptabilidad'], 'es')
  const B = await person('en'); if (!B.token) { console.error('no se pudo crear la persona B'); process.exit(2) }
  await call('POST', '/api/evidence', B.token, ev('Onboarding a new teammate', 'assisted', 'A new teammate joined and kept asking the same questions in chat.', 'I was the buddy for her first two weeks.', ['I wrote a short checklist of the first-week tasks.', 'I paired with her twice and asked what was still unclear.'], 'A checklist the team reused for the next hire.'))
  await propose('B-en-comunicacion', B.token, ['comunicacion'], 'en')
  // Tercera llamada: capacidad SIN relación con la evidencia → debe quedar sin nivel (no inventar).
  const keys = ((await call('GET', '/api/skill-map', A.token)).j?.skills || []).map(s => s.skillKey); console.log('catálogo staging:', keys.join(','))
  const unrelated = keys.find(x => !['comunicacion', 'adaptabilidad'].includes(x) && /lider|negoci|estrateg|program|dato|ventas/.test(x)) || keys.find(x => !['comunicacion', 'adaptabilidad'].includes(x))
  console.log('tercera capacidad:', unrelated)
  await propose('A-es-capacidad-sin-evidencia', A.token, [unrelated], 'es')
  console.log(`\nLlamadas hechas: ${calls}/${MAX_CALLS}`)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
