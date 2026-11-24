// QA-Claude-2 — PR #379 (ES-194): mutaciones del backend contra la SUBPRUEBA NUEVA («ES-194 runbook») de es-194-postgres.cjs y, aparte, contra todo el archivo; la subprueba debe detectar cada una que rompa el recorrido del runbook.
// Uso: CLONE=<clon en la cabeza del PR> ES194_TEST_DATABASE_URL=postgres://u:p@127.0.0.1:54331/postgres node qa/mut379.cjs
const fs = require('fs'); const path = require('path'); const { spawnSync } = require('child_process'); const R = process.env.CLONE; const F = 'backend/routes/exercises.js'
const run = () => { const r = spawnSync('node', ['--test', 'test/integration/es-194-postgres.cjs'], { cwd: path.join(R, 'backend'), encoding: 'utf8', maxBuffer: 1 << 26, env: process.env }); const f = /ℹ fail ([0-9]+)/.exec(r.stdout); const sub = /([✔✖]) ES-194 runbook/.exec(r.stdout); return { fail: f ? Number(f[1]) : -1, sub: sub ? sub[1] : '?' } }
const M = [
  ['M1 importar publica en vez de dejar borrador', "{ key: item.key, status: 'draft', version: 1,", "{ key: item.key, status: 'published', version: 1,"],
  ['M2 importar vuelve a crear los que ya existen (sin omitir)', "if (await Exercise.findOne({ where: { key: item.key }, transaction })) { skipped.push(item.key); continue; }", ""],
  ['M3 registrar la revisión «done» cambia la publicación', "? { reviewStatus: 'done', reviewedBy: actor, reviewedAt: new Date(), updatedBy: actor }", "? { reviewStatus: 'done', status: 'withdrawn', reviewedBy: actor, reviewedAt: new Date(), updatedBy: actor }"],
  ['M4 publicar marca la revisión del especialista como hecha (por trámite)', "await row.update({ status: 'published', publishedBy: actor, publishedAt: new Date(), withdrawnBy: null, withdrawnAt: null, updatedBy: actor }", "await row.update({ status: 'published', reviewStatus: 'done', publishedBy: actor, publishedAt: new Date(), withdrawnBy: null, withdrawnAt: null, updatedBy: actor }"],
  ['M5 la persona ve también los borradores', "const rows = await Exercise.findAll({ where: { status: 'published' }, order: [['key', 'ASC']] });", "const rows = await Exercise.findAll({ order: [['key', 'ASC']] });"],
  ['M6 admin puede operar (no solo superadmin)', "req.user && req.user.role === 'superadmin' ? next()", "req.user && ['admin', 'superadmin'].includes(req.user.role) ? next()"],
  ['M7 publicar dos veces no es idempotente (sin «unchanged»)', "if (row.status === 'published') return { rollback: true, status: 200, body: { ...present(row), unchanged: true } };", "if (row.status === 'published') return { rollback: true, status: 200, body: { ...present(row) } };"],
  ['M8 publicar ignora la versión esperada', "row.version !== expected ? changed(row) : work(row, transaction)", "work(row, transaction)"],
  ['M9 publicar sin confirm:true', "req.body && req.body.confirm === true ? true", "true ? true"],
  ['M10 la persona recibe un campo de administración (quién publicó)', "const shape = (row) => ({ key: row.key,", "const shape = (row) => ({ publishedBy: row.publishedBy, key: row.key,"],
  ['M11 el reviewStatus «pending» se muestra como «done» a la persona', "reviewStatus: row.reviewStatus, version: row.version });\nconst NOT_FOUND", "reviewStatus: 'done', version: row.version });\nconst NOT_FOUND"],
]
const file = path.join(R, F); const orig = fs.readFileSync(file, 'utf8'); const o = orig.split('\r\n').join('\n')
const base = run(); console.log('línea base (archivo completo):', JSON.stringify(base)); if (base.fail !== 0 || base.sub !== '✔') { console.log('LA LÍNEA BASE NO ESTÁ VERDE: se detiene'); process.exit(2) }
let detSub = 0, detAny = 0; for (const [name, from, to] of M) { if (!o.includes(from)) { console.log('NO APLICA  ', name); continue }
  fs.writeFileSync(file, o.split(from).join(to)); let all; try { all = run() } finally { fs.writeFileSync(file, orig) }
  const s = all.sub === '✖', a = all.fail !== 0; if (s) detSub++; if (a) detAny++; console.log(s ? 'SUBPRUEBA DETECTA ' : (a ? 'solo otras pruebas ' : 'SOBREVIVE         '), name, `(subprueba nueva: ${all.sub === '✖' ? 'FALLA' : all.sub === '✔' ? 'pasa' : 'no se ejecutó'}; archivo completo fallos=${all.fail})`) }
console.log(`${detSub}/${M.length} detectadas por la subprueba nueva; ${detAny}/${M.length} por el archivo completo`)
