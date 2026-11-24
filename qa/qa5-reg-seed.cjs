// [QA-Claude-5] Regresión local sobre main: siembra sintética de los 5 perfiles (user, therapist, admin, superadmin, board) con el backend REAL + PostgreSQL desechable.
// Uso: DATABASE_URL=... API=http://127.0.0.1:8402 NODE_PATH=<backend/node_modules> node qa/qa5-reg-seed.cjs → $QA_TOOLS/qa5/cred-reg.json
const crypto = require('crypto'); const fs = require('fs'); const { Client } = require('pg'); const API = process.env.API || 'http://127.0.0.1:8402'
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
;(async () => {
  const out = { pass, users: {} }
  for (const [key, role, name] of [['user', 'user', 'Persona Sintetica'], ['therapist', 'therapist', 'Profesional Sintetico'], ['admin', 'admin', 'Admin Sintetico'], ['superadmin', 'superadmin', 'Superadmin Sintetico'], ['board', 'board', 'Junta Sintetica']]) {
    const email = `qa5-${key}-${crypto.randomBytes(3).toString('hex')}@example.test`
    const r = await call(null, 'POST', '/api/register', { name, email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }); if (r.status !== 201) console.log('registro', key, r.status, JSON.stringify(r.body).slice(0, 200))
    const c = new Client({ connectionString: process.env.DATABASE_URL }); await c.connect(); await c.query(`UPDATE "Users" SET "onboardingCompleted"=true, role=$2 WHERE email=$1`, [email, role]); await c.end()
    const l = await call(null, 'POST', '/api/login', { email, password: pass }); out.users[key] = { key, role, name, email, token: l.body.token, loginStatus: l.status }
    console.log(key, 'login', l.status)
  }
  fs.writeFileSync((process.env.QA_TOOLS || '.') + '/qa5/cred-reg.json', JSON.stringify(out))
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
