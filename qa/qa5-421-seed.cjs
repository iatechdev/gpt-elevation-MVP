// [QA-Claude-5] PR #421 (ES-303 PR B): siembra sintética contra el backend real: 2 revisores (therapist), 3 personas (A con evidencias, B sin evidencias, C con una evidencia), consentimiento del puente y evidencias confirmadas.
// Uso: DATABASE_URL=... API=http://127.0.0.1:8402 NODE_PATH=<backend/node_modules> node qa/qa5-421-seed.cjs  → escribe $QA_TOOLS/qa5/cred421.json
const crypto = require('crypto'); const fs = require('fs'); const { Client } = require('pg')
const API = process.env.API || 'http://127.0.0.1:8402'
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const mk = async (key, name, role) => {
  const email = `qa5-${key}-${crypto.randomBytes(3).toString('hex')}@example.test`
  const r = await call(null, 'POST', '/api/register', { name, email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }); if (r.status !== 201) console.log('registro', key, r.status, JSON.stringify(r.body).slice(0, 200))
  const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); await c.query('UPDATE "Users" SET "onboardingCompleted"=true' + (role ? `, role='${role}'` : '') + ' WHERE email=$1', [email]); await c.end()
  const l = (await call(null, 'POST', '/api/login', { email, password: pass })).body; return { key, email, name, token: l.token, role: role || 'user' }
}
const ev = (title) => ({ payload: { title, situation: 'Situación sintética de prueba.', responsibility: { text: 'Mi parte sintética.' }, actions: [{ text: 'Acción sintética' }], delivered: { text: 'Entregable sintético.' }, observedEffect: { known: false } }, status: 'confirmed', requestId: crypto.randomUUID() })
;(async () => {
  const out = { pass, users: {} }
  out.users.rev1 = await mk('rev1', 'Ana Revisora', 'therapist'); out.users.rev2 = await mk('rev2', 'Beto Revisor', 'therapist')
  out.users.pA = await mk('pA', 'Persona A'); out.users.pB = await mk('pB', 'Persona B'); out.users.pC = await mk('pC', 'Persona C')
  for (const k of ['pA', 'pC']) { const u = out.users[k]; const c = await call(u.token, 'PUT', '/api/consents/professional_bridge', { status: 'granted' }); console.log(k, 'consent puente', c.status, JSON.stringify(c.body).slice(0, 120)) }
  const titles = { pA: ['Primera evidencia sintética', 'Segunda evidencia con un título bastante más largo para comprobar el ajuste de línea en pantallas angostas', 'Tercera evidencia'], pC: ['Única evidencia'] }
  for (const k of Object.keys(titles)) for (const t of titles[k]) { const r = await call(out.users[k].token, 'POST', '/api/evidence', ev(t)); console.log(k, 'evidencia', r.status, JSON.stringify(r.body).slice(0, 100)) }
  fs.writeFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred421.json', JSON.stringify(out)); console.log('listo', Object.keys(out.users).join(','))
})().catch(e => { console.error('ABORTA', e); process.exit(2) })
