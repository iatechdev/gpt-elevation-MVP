// [QA-Claude] ES-184 · PR #284 (SERVIDOR): `minimized: boolean` en GET /api/admin/professional-applications · servidor REAL + Postgres con migraciones · datos sintéticos · 0 IA.
// Uso: QA_SUT=<clon> QA_API=<servidor> DATABASE_URL=<base> QA_JWT_SECRET=<clave> [MODE=main] OUT=<carpeta> node qa/integration/es184-servidor-pr284.cjs
// MODE=main: control contra main (el campo no existe; las comprobaciones que dependen de él deben fallar).
process.env.DB_SSL = 'false'
const { createRequire } = require('node:module'); const path = require('node:path'); const fs = require('node:fs'); const { randomBytes } = require('node:crypto')
const E = process.env; const req = createRequire(path.join(E.QA_SUT, 'backend', 'package.json')); const jwt = req('jsonwebtoken'); const { Client } = req('pg')
const API = E.QA_API, MODE = E.MODE || 'pr'; const results = []
const check = (id, ok, d = '') => { results.push({ id, ok: !!ok, detail: String(d).slice(0, 1500) }); console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 1500) })) }
const info = (id, d) => { results.push({ id, info: String(d).slice(0, 1500) }); console.log(JSON.stringify({ id, info: String(d).slice(0, 1500) })) }
;(async () => {
  const db = new Client({ connectionString: E.DATABASE_URL, ssl: false }); await db.connect(); const q = async (s, p = []) => (await db.query(s, p)).rows; const stamp = Date.now()
  const { makeSeeder } = req(path.join(E.QA_SUT, 'backend', 'test', 'support', 'seedRow.cjs')); const seed = makeSeeder(q)
  const sign = (u, secret = E.QA_JWT_SECRET, opts = { expiresIn: '3h' }) => jwt.sign({ id: u.id, name: u.name, role: u.role, iatMs: Date.now() }, secret, { ...opts, jwtid: randomBytes(8).toString('hex') })
  const mk = async (tag, role = 'user') => { const email = `qa184-${tag}-${stamp}@example.test`; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA184 ' + tag, email, password: randomBytes(12).toString('base64url') + 'aA1!' }) }); if (role !== 'user') await q('update "Users" set role=$1 where email=$2', [role, email]); const u = (await q('select id,name,role from "Users" where email=$1', [email]))[0]; return { ...u, email, token: sign(u) } }
  const call = async (u, m, p, body, hdr = {}) => { const r = await fetch(API + p, { method: m, headers: { ...(u ? { Authorization: 'Bearer ' + u.token } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...hdr }, body: body === undefined ? undefined : JSON.stringify(body) }); const text = await r.text(); let json = null; try { json = JSON.parse(text) } catch { /* */ } return { status: r.status, json, text } }
  const SU = await mk('su', 'superadmin'), AD = await mk('ad', 'admin'), TH = await mk('th', 'therapist'), BO = await mk('bo', 'board'), PE = await mk('pe')
  const L = '/api/admin/professional-applications'
  const CANARY = { name: 'Nombre Canario Solicitante', license: 'LIC-CANARIO-777', message: 'Mensaje canario de la solicitud', profile: 'https://canario.example.test/perfil', reviewer: 'Revisor Canario', note: 'Nota canaria de revisión', country: 'Canarilandia', profession: 'Profesión canaria' }
  const app = (extra = {}) => seed('ProfessionalApplications', { name: CANARY.name, email: `solicitante-canario-${randomBytes(4).toString('hex')}@example.test`, country: CANARY.country, profession: CANARY.profession, licenseNumber: CANARY.license, profileUrl: CANARY.profile, message: CANARY.message, status: 'approved', reviewedBy: CANARY.reviewer, reviewNote: CANARY.note, reviewedAt: new Date('2026-10-10T10:00:00Z'), consentAt: new Date('2026-10-01T09:00:00Z'), ...extra })
  const file = (a, size = 4096) => seed('ProfessionalApplicationFiles', { ApplicationId: a.id, size, sha256: 'a'.repeat(64) })

  // ---------- lista vacía
  const empty = await call(AD, 'GET', L)
  check('S1a lista vacía → 200 y arreglo vacío', empty.status === 200 && Array.isArray(empty.json) && empty.json.length === 0, `${empty.status} ${empty.text.slice(0, 40)}`)

  // ---------- siembra: viva (3 estados), depurada por purga REAL, minimizedAt por SQL, correo @deleted.invalid sin marca, y 200 filas
  const pend = await app({ status: 'pending', reviewedAt: null, reviewedBy: null, reviewNote: null }); const appr = await app({ status: 'approved' }); const rej = await app({ status: 'rejected', reviewNote: 'no cumple' })
  await file(pend); await file(appr)
  const person = await mk('purga'); await seed('MoodLogs', { UserId: person.id, date: '2026-10-02', checkin_mood: 3 })
  const purged = await app({ userId: person.id, status: 'approved' }); await file(purged)
  const bySql = await app({ status: 'approved' }); await q('update "ProfessionalApplications" set "minimizedAt"=now() where id=$1', [bySql.id])
  const fake = await app({ status: 'approved', email: `app-9999@deleted.invalid` })
  let purgeOk = true; try { const { requestDeletion } = req(path.join(E.QA_SUT, 'backend', 'utils', 'dataRights')); const { processDeletion } = req(path.join(E.QA_SUT, 'backend', 'utils', 'deletionProcessor')); await requestDeletion(person.id); const rid = (await q('SELECT id FROM "DeletionRequests" WHERE "UserId"=$1', [person.id]))[0].id; await processDeletion(rid, { quiescent: true }) } catch (e) { purgeOk = false; info('purga-error', e.message) }
  const row = async (id) => (await q('select "minimizedAt", name, email, status from "ProfessionalApplications" where id=$1', [id]))[0]
  const rp = await row(purged.id); info('estado en base tras la purga real', JSON.stringify({ purgeOk, minimizedAt: !!rp.minimizedAt, name: rp.name, email: rp.email, status: rp.status }))

  const r1 = await call(AD, 'GET', L); const byId = new Map((r1.json || []).map(x => [x.id, x]))
  const mini = (id) => byId.get(id)?.minimized
  info('S1-detalle', `[${MODE}] filas ${r1.json?.length}; pendiente ${mini(pend.id)}, aprobada ${mini(appr.id)}, rechazada ${mini(rej.id)}, purgada ${mini(purged.id)}, minimizedAt por SQL ${mini(bySql.id)}, correo @deleted.invalid sin marca ${mini(fake.id)}`)
  check('S1 (bloqueante) `minimized`: pendiente, aprobada y rechazada vivas → false; persona PURGADA (purga real de ES-293) → true; `minimizedAt` fijado por SQL → true; un correo `@deleted.invalid` SIN marca → false (se decide por la marca, no por el correo)', purgeOk && mini(pend.id) === false && mini(appr.id) === false && mini(rej.id) === false && mini(purged.id) === true && mini(bySql.id) === true && mini(fake.id) === false, JSON.stringify([...byId.entries()].map(([k, v]) => [k, v.minimized])))
  check('S1b el campo es un booleano estricto en TODAS las filas (nunca null, undefined ni fecha)', (r1.json || []).length > 0 && r1.json.every(x => typeof x.minimized === 'boolean'), JSON.stringify((r1.json || []).map(x => typeof x.minimized)))

  // ---------- S2 privacidad: claves, sin fecha, sin datos reales en la fila depurada
  const keysLive = Object.keys(byId.get(appr.id) || {}).sort(); const keysMini = Object.keys(byId.get(purged.id) || {}).sort(); const outFile = path.join(E.OUT || '.', 'ES-184-claves-' + MODE + '.json')
  fs.writeFileSync(outFile, JSON.stringify({ mode: MODE, keysLive, keysMini }, null, 1))
  const mainKeysFile = path.join(E.OUT || '.', 'ES-184-claves-main.json'); const mainKeys = MODE !== 'main' && fs.existsSync(mainKeysFile) ? JSON.parse(fs.readFileSync(mainKeysFile, 'utf8')) : null
  info('S2-claves', `[${MODE}] viva: ${keysLive.join(',')} · depurada: ${keysMini.join(',')}`)
  if (MODE === 'main') check('S2 (control) en main la vista NO trae `minimized`', !keysLive.includes('minimized'), keysLive.join(','))
  else check('S2 (bloqueante) la vista añade EXACTAMENTE una clave (`minimized`) respecto a main, la misma en filas vivas y depuradas, y no expone `minimizedAt` ni ninguna fecha nueva', !!mainKeys && JSON.stringify(keysLive.filter(k => k !== 'minimized')) === JSON.stringify(mainKeys.keysLive) && keysLive.includes('minimized') && JSON.stringify(keysLive) === JSON.stringify(keysMini) && !keysLive.includes('minimizedAt'), `PR ${keysLive.join(',')} · main ${mainKeys ? mainKeys.keysLive.join(',') : '(ejecuta primero MODE=main)'}`)
  const pj = byId.get(purged.id); const text = JSON.stringify(pj || {}); const leaked = Object.values(CANARY).filter(v => text.includes(v)).concat(/solicitante-canario/i.test(text) ? ['correo'] : [])
  check('S2b (bloqueante) la fila depurada no conserva nombre, correo, país, profesión, licencia, perfil, mensaje, revisor ni nota (centinelas) y su `/cv` no responde 200 ni 2xx', leaked.length === 0 && (await call(AD, 'GET', `${L}/${purged.id}/cv`)).status >= 400, `fugas: ${leaked.join('|') || 'ninguna'} · fila ${text.slice(0, 220)}`)
  const rAdminSU = await call(SU, 'GET', L); const shapeSame = JSON.stringify((rAdminSU.json || []).map(x => Object.keys(x).sort())) === JSON.stringify((r1.json || []).map(x => Object.keys(x).sort()))
  check('S2c la forma de la lista es la misma para `admin` y `superadmin`', rAdminSU.status === 200 && shapeSame, `${rAdminSU.status}`)

  // ---------- S3 permisos
  const expired = { ...AD, token: sign(AD, E.QA_JWT_SECRET, { expiresIn: -60 }) }, otherKey = { ...AD, token: sign(AD, 'otra-clave-que-no-es-la-del-servidor-1234567890') }
  const deny = []; for (const [n, u] of [['persona', PE], ['profesional', TH], ['junta', BO], ['sin sesión', null], ['vencido', expired], ['otra clave', otherKey]]) { const r = await call(u, 'GET', L); if (!(r.status === 401 || r.status === 403) || /minimized/.test(r.text)) deny.push(`${n}→${r.status}`) }
  const odd = []; for (const [n, h] of [['Authorization vacío', { Authorization: '' }], ['Bearer sin token', { Authorization: 'Bearer ' }], ['basura', { Authorization: 'Bearer abc.def.ghi' }], ['x-role', { 'X-User-Role': 'admin' }]]) { const r = await call(null, 'GET', L, undefined, h); if (!(r.status === 401 || r.status === 403) || /minimized/.test(r.text)) odd.push(`${n}→${r.status}`) }
  check('S3 (bloqueante) el GET administrativo solo responde a `admin`/`superadmin`; persona, profesional, junta, sin sesión, token vencido o de otra clave y cabeceras raras → 401/403 sin el campo en el cuerpo', deny.length === 0 && odd.length === 0, `${deny.join(' ') || 'roles ok'} · ${odd.join(' ') || 'cabeceras ok'}`)
  const ap = await call(AD, 'PUT', `${L}/${pend.id}/approve`, { note: 'ok' }); const rj = await call(AD, 'PUT', `${L}/${(await app({ status: 'pending', reviewedAt: null })).id}/reject`, { note: 'motivo' }); const trap = await fetch(API + '/api/professional-applications', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ bot_trap: 'x' }) }); const trapText = await trap.text()
  check('S3b aprobar, rechazar y el alta pública NO traen `minimized` y se comportan como antes', ap.status === 200 && rj.status === 200 && !/minimized/.test(ap.text + rj.text + trapText) && trap.status === 201, `aprobar ${ap.status} ${ap.text.slice(0, 60)} · rechazar ${rj.status} · pública ${trap.status}`)
  const rp2 = await call(AD, 'PUT', `${L}/${pend.id}/approve`, { note: 'otra vez' }); check('S3c aprobar de nuevo una solicitud ya revisada → 409 `already_reviewed` (sin cambios)', rp2.status === 409 && rp2.json?.code === 'already_reviewed', `${rp2.status} ${rp2.text.slice(0, 80)}`)

  // ---------- S1c 200 filas
  const t0 = Date.now(); for (let i = 0; i < 200; i++) await app({ status: i % 2 ? 'pending' : 'rejected', name: 'Masa ' + i, email: `masa-${i}-${stamp}@example.test` })
  const big = await call(AD, 'GET', L); const t1 = Date.now() - t0
  check('S1c con 200+ filas la lista sigue en 200, limitada a 200, con `minimized` booleano en todas', big.status === 200 && big.json.length === 200 && big.json.every(x => typeof x.minimized === 'boolean'), `${big.status} filas ${big.json?.length} (siembra+lectura ${t1} ms)`)
  const filt = await call(AD, 'GET', L + '?status=approved'); const bad = await call(AD, 'GET', L + '?status=zzz')
  check('S1d el filtro por estado y el estado inválido (400) siguen igual', filt.status === 200 && filt.json.every(x => x.status === 'approved' && typeof x.minimized === 'boolean') && bad.status === 400, `${filt.status}/${bad.status}`)

  console.log('RESUMEN ' + results.filter(r => 'ok' in r && r.ok).length + '/' + results.filter(r => 'ok' in r).length + ' ok; fallos: ' + results.filter(r => 'ok' in r && !r.ok).map(r => r.id.split(' ')[0]).join(', '))
  fs.writeFileSync(path.join(E.OUT || '.', MODE === 'main' ? 'ES-184-servidor-main.json' : 'ES-184-servidor-pr284.json'), JSON.stringify({ mode: MODE, head: E.QA_HEAD || null, results }, null, 1))
  await db.end(); process.exit(0)
})().catch(e => { console.error('FATAL', e); process.exit(2) })
