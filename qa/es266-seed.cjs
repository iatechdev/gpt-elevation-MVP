// QA-Claude-2: siembra adicional para ES-300 (PR #266) con la API REAL (:8090), sobre la semilla de qa/es258-seed.cjs: personas F (los 12 con nivel, mezclados), G (los 12 con el MISMO nivel 3 → radar relleno), H (solo 3 con nivel) y E (nada).
// Env: SEED (archivo de la semilla de es258, se amplía), DATABASE_URL.
const fs = require('fs'), crypto = require('crypto'), { createRequire } = require('module')
const { Client } = createRequire('C:/Users/Usuario/tools/qa2/t2/backend/package.json')('pg')
const API = 'http://localhost:8090', PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch {} return { s: r.status, j, tx } }
const DB = new Client({ connectionString: process.env.DATABASE_URL })
const mk = async name => { n++; const email = `qa2-p266-${tag}-${n}@example.test`; const r = await call('POST', '/api/register', null, { name: 'x' + name, email, password: PASS }); if (r.s >= 300) throw new Error('registro ' + r.s); const id = (await DB.query('SELECT id FROM "Users" WHERE email=$1', [email])).rows[0].id; await DB.query('UPDATE "Users" SET name=$2, "onboardingCompleted"=true WHERE id=$1', [id, name]); return { id, name, email, pass: PASS, token: (await call('POST', '/api/login', null, { email, password: PASS })).j?.token } }
const evid = async (U, title) => (await call('POST', '/api/evidence', U.token, { status: 'confirmed', requestId: 'ev-' + crypto.randomBytes(6).toString('hex'), payload: { title, situation: 'Situación sintética de ' + title, responsibility: { text: 'Responsable' }, actions: [{ text: 'Acción' }], delivered: { text: 'Entregable' }, observedEffect: { known: false }, autonomy: 'autonomous' } })).j
const self = async (U, key, level) => { const ref = await evid(U, 'Evidencia ' + key); const r = await call('POST', '/api/skill-map/self', U.token, { skillKey: key, level, evidenceRefs: [{ evidenceId: ref.id, version: ref.version }], rationale: 'Nota sintética de QA', requestId: 'sf-' + crypto.randomBytes(6).toString('hex') }); if (r.s >= 300) throw new Error('self ' + key + ' ' + r.s + r.tx.slice(0, 200)) }
;(async () => {
  await DB.connect(); const S = JSON.parse(fs.readFileSync(process.env.SEED, 'utf8')); const keys = (await call('GET', '/api/skill-map', S.A.token)).j.skills.map(s => s.skillKey)
  const F = await mk('PERSONA-F-266'), G = await mk('PERSONA-G-266'), H = await mk('PERSONA-H-266'), E = await mk('PERSONA-E-266')
  const mix = [4, 1, 3, 2, 4, 2, 1, 3, 4, 2, 3, 1]; for (let i = 0; i < keys.length; i++) await self(F, keys[i], mix[i % mix.length])
  for (const k of keys) await self(G, k, 3)
  for (const i of [0, 5, 9]) await self(H, keys[i], 2 + (i % 3))
  Object.assign(S, { F, G, H, E, keys }); fs.writeFileSync(process.env.SEED, JSON.stringify(S)); console.log('semilla 266 OK', keys.length, 'capacidades'); await DB.end() })().catch(e => { console.error('ERROR', e.message); process.exit(1) })
