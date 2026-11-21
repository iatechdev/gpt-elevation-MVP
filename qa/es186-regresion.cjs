// QA-Claude-2 — ES-186 parche (PR #186) U10: regresión de /admin/users fuera de los dos botones. Mismo script contra `main` y contra el PR (LABEL); se comparan las líneas «R…».
// Acciones reales contra el backend real + Postgres: filtro de rol, desactivar/activar, asignar profesional, eliminar con nombre exacto. Datos sintéticos. Env: PLAYWRIGHT_MODULE, BACKEND, DATABASE_URL, LABEL.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const crypto = require('crypto'), { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const API = 'http://localhost:8090', UI = 'http://localhost:5173'; const PASS = crypto.randomBytes(9).toString('hex') + 'Aa1!', tag = Date.now().toString(36); let n = 0
const sleep = ms => new Promise(r => setTimeout(r, ms)); const out = (k, v) => console.log(`R ${k}: ${v}`)
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
let DB; const dbq = async (q, a) => (await DB.query(q, a)).rows
const mk = async (role, name) => { n++; const email = `qa2-reg-${tag}-${n}@example.test`; await call('POST', '/api/register', null, { name, email, password: PASS }); const id = (await dbq('SELECT id FROM "Users" WHERE email=$1', [email]))[0].id; await dbq('UPDATE "Users" SET "onboardingCompleted"=true, role=$2 WHERE id=$1', [id, role]); const tk = (await call('POST', '/api/login', null, { email, password: PASS })).j?.token; return { id, name, email, token: tk } }
;(async () => {
  DB = new Client({ connectionString: process.env.DATABASE_URL }); await DB.connect(); const SA = await mk('superadmin', 'Admin Regresion'), X = await mk('user', 'Persona Regresion Equis'), T = await mk('therapist', 'Profesional Regresion')
  const B = await chromium.launch(); const c = await B.newContext({ viewport: { width: 1360, height: 900 } }); await c.addInitScript(([t]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'superadmin'); localStorage.setItem('elv_lang', 'es') }, [SA.token]); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message.slice(0, 80)))
  await p.goto(UI + '/admin/users', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('table'); await sleep(1500)
  const rows = () => p.locator('table tbody tr').count()
  const total = await rows(); const dbTotal = (await dbq('SELECT count(*)::int n FROM "Users"'))[0].n; out('lista: filas = usuarios en la base', total === dbTotal)
  await p.locator('select').first().selectOption('therapist'); await sleep(600); const th = await rows(); out('filtro rol=therapist: filas = terapeutas en la base', th === (await dbq(`SELECT count(*)::int n FROM "Users" WHERE role='therapist'`))[0].n); await p.locator('select').first().selectOption(''); await sleep(400)
  await p.locator('tr', { hasText: X.email }).getByRole('button', { name: '···' }).first().click(); await sleep(600)
  out('gestionar: abre con nombre y correo', (await p.locator('body').innerText()).includes(X.email))
  await p.getByRole('button', { name: 'Desactivar usuario' }).click(); await sleep(1000); out('desactivar: en la base active=false', (await dbq('SELECT active FROM "Users" WHERE id=$1', [X.id]))[0].active === false)
  await p.getByRole('button', { name: 'Activar usuario' }).click(); await sleep(1000); out('activar: en la base active=true', (await dbq('SELECT active FROM "Users" WHERE id=$1', [X.id]))[0].active === true)
  await p.locator('select', { has: p.locator('option', { hasText: 'Sin asignar' }) }).selectOption(String(T.id)); await sleep(1000); out('asignar profesional: en la base therapistId = el elegido', String((await dbq('SELECT "therapistId" t FROM "Users" WHERE id=$1', [X.id]))[0].t) === String(T.id))
  await p.getByRole('button', { name: 'Eliminar permanentemente' }).click(); await sleep(400); const del = p.getByRole('button', { name: 'Eliminar definitivamente' }); out('eliminar: botón deshabilitado sin nombre', await del.isDisabled())
  await p.locator('input[type=text]').last().fill('otro nombre'); out('eliminar: deshabilitado con nombre distinto', await del.isDisabled()); await p.locator('input[type=text]').last().fill(X.name); out('eliminar: habilitado con el nombre exacto', !(await del.isDisabled()))
  await del.click(); await sleep(1500); out('eliminar: la fila desaparece de la base', (await dbq('SELECT 1 FROM "Users" WHERE id=$1', [X.id])).length === 0); out('eliminar: la fila desaparece de la lista', (await p.locator('tr', { hasText: X.email }).count()) === 0)
  out('errores de página', errs.length === 0 ? 'ninguno' : errs.join('|')); await B.close(); await DB.end()
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 600)); process.exit(3) })
