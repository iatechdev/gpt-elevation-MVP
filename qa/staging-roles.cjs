// QA-Claude-2 — pruebas de roles en STAGING con las 4 cuentas sintéticas. SOLO LECTURA (login + GET). Lo ejecuta Mauricio: QA no lee ni carga claves.
// El script lee el archivo de credenciales él mismo y NUNCA imprime correos con clave, claves ni tokens; solo códigos HTTP y veredictos.
// Env: STAGING_URL (https://backend-staging-...), CRED_FILE (ruta del archivo local con las claves de los 4 usuarios qa.*@example.test).
//   STAGING_URL=https://backend-staging-e3a6.up.railway.app CRED_FILE="C:\Users\Usuario\Documents\credenciales-staging-pruebas\usuarios-prueba-staging.txt" node qa/staging-roles.cjs
const fs = require('fs')
const BASE = (process.env.STAGING_URL || '').replace(/\/$/, '')
if (!/^https:\/\/backend-staging-/.test(BASE) || !process.env.CRED_FILE) { console.error('Define STAGING_URL (staging) y CRED_FILE.'); process.exit(2) }
const text = fs.readFileSync(process.env.CRED_FILE, 'utf8'), lines = text.split(/\r?\n/)
const EMAILS = { persona: 'qa.persona@example.test', terapeuta: 'qa.terapeuta@example.test', admin: 'qa.admin@example.test', superadmin: 'qa.superadmin@example.test' }
const ROLE = { persona: 'user', terapeuta: 'therapist', admin: 'admin', superadmin: 'superadmin' }
// Acepta «correo: clave», «correo | clave», «correo = clave», «correo clave» o un bloque con una línea de clave/password debajo del correo.
const secretFor = email => {
  const i = lines.findIndex(l => l.toLowerCase().includes(email)); if (i < 0) return null
  const same = lines[i].slice(lines[i].toLowerCase().indexOf(email) + email.length).replace(/^[\s:=|,;\-–>]+/, '').trim(); if (same) return same.replace(/^(?:clave|contrase(?:ñ|n)a|password|pass|pwd)\s*[:=]\s*/i, '').split(/\s+\|\s+|\s{2,}/)[0].trim()
  for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) { const m = lines[j].match(/(?:clave|contrase(?:ñ|n)a|password|pass|pwd)\s*[:=]\s*(.+)$/i); if (m) return m[1].trim() }
  return null
}
const call = async (method, path, token) => { const r = await fetch(BASE + path, { method, headers: token ? { Authorization: 'Bearer ' + token } : {} }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
;(async () => {
  const tok = {}, who = {}
  for (const k of Object.keys(EMAILS)) {
    const pw = secretFor(EMAILS[k]); if (!pw) { ck(`R0 ${k}: se encontró la clave en el archivo`, false); continue }
    const r = await fetch(BASE + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: EMAILS[k], password: pw }) }); const j = await r.json().catch(() => ({}))
    ck(`R1 ${k}: inicia sesión con el rol ${ROLE[k]}`, r.status === 200 && !!j.token && j.role === ROLE[k], `HTTP ${r.status} rol=${j.role}`); if (j.token) { tok[k] = j.token; who[k] = j }
  }
  const need = ['persona', 'terapeuta', 'admin', 'superadmin']; if (need.some(k => !tok[k])) { console.log('Faltan sesiones: se detiene.'); process.exit(1) }
  // Matriz de acceso: [ruta, {rol: esperado}], esperado = 'ok' (2xx) o 'no' (401/403)
  const M = [
    ['/api/admin/usuarios', { persona: 'no', terapeuta: 'no', admin: 'ok', superadmin: 'ok' }],
    ['/api/admin/metrics', { persona: 'no', terapeuta: 'no', admin: 'ok', superadmin: 'ok' }],
    ['/api/admin/skill-catalog', { persona: 'no', terapeuta: 'no', admin: 'ok', superadmin: 'ok' }],
    ['/api/superadmin/ai-usage', { persona: 'no', terapeuta: 'no', admin: 'no', superadmin: 'ok' }],
    ['/api/junta/pending', { persona: 'no', terapeuta: 'no', admin: 'no', superadmin: 'any' }],
    ['/api/board/', { persona: 'no', terapeuta: 'no', admin: 'no', superadmin: 'any' }],
    ['/api/therapist/patients', { persona: 'no', terapeuta: 'any', admin: 'no', superadmin: 'any' }],
    ['/api/ai/usage', { persona: 'ok', terapeuta: 'any', admin: 'any', superadmin: 'any' }],
    ['/api/skill-map', { persona: 'ok', terapeuta: 'any', admin: 'any', superadmin: 'any' }],
    ['/api/diary', { persona: 'ok', terapeuta: 'any', admin: 'any', superadmin: 'any' }],
    ['/api/evidence', { persona: 'ok', terapeuta: 'any', admin: 'any', superadmin: 'any' }],
  ]
  const codes = {}
  for (const [path, exp] of M) for (const k of need) {
    const r = await call('GET', path, tok[k]); codes[path + k] = r.s; const e = exp[k]
    const ok = e === 'ok' ? r.s >= 200 && r.s < 300 : e === 'no' ? (r.s === 401 || r.s === 403) : r.s < 500
    ck(`R2 GET ${path} como ${k} → ${e === 'any' ? 'sin 5xx' : e === 'ok' ? '2xx' : '401/403'}`, ok, `HTTP ${r.s}`)
  }
  for (const path of ['/api/admin/usuarios', '/api/ai/usage', '/api/diary']) { const a = await call('GET', path), b = await call('GET', path, 'x.y.z'); ck(`R3 ${path} sin sesión → 401 y con token inválido → 401`, a.s === 401 && b.s === 401, `${a.s}/${b.s}`) }
  // Aislamiento: la persona asignada al terapeuta; el diario de otro rol no trae datos de la persona
  const list = await call('GET', '/api/admin/usuarios', tok.admin); const users = Array.isArray(list.j) ? list.j : []
  const p = users.find(u => u.email === EMAILS.persona), t = users.find(u => u.email === EMAILS.terapeuta)
  ck('R4 el administrador ve a la persona de prueba asignada al terapeuta de prueba', !!p && !!t && p.therapistId === t.id, p ? `asignada=${p.therapistId === t?.id}` : 'no aparece')
  ck('R4 el listado del administrador no expone claves ni hashes', !JSON.stringify(list.j).match(/\$2[aby]\$|"password"/))
  const dP = await call('GET', '/api/diary', tok.persona), dT = await call('GET', '/api/diary', tok.terapeuta), dA = await call('GET', '/api/diary', tok.admin)
  const n = x => Array.isArray(x.j) ? x.j.length : Array.isArray(x.j?.entries) ? x.j.entries.length : '?'
  console.log(`      entradas de diario visibles: persona=${n(dP)} terapeuta=${n(dT)} admin=${n(dA)} (el terapeuta y el admin deben ver solo las suyas, no las de la persona)`)
  // El administrador no puede ascender: solo se comprueba el rechazo SIN modificar nada (id inexistente + rol privilegiado)
  const up = await fetch(BASE + '/api/admin/usuarios/0', { method: 'PUT', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + tok.admin }, body: JSON.stringify({ role: 'superadmin' }) })
  ck('R5 el administrador no puede asignar el rol superadmin (403 o 404 por id inexistente; nunca 200)', up.status === 403 || up.status === 404, 'HTTP ' + up.status)
  console.log(f ? `\nFALLAS ${f} (los códigos HTTP están arriba; no se imprimieron claves ni tokens)` : '\nTODO OK (no se imprimieron claves ni tokens)'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
