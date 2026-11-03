// QA-Claude-2 — crea (idempotente) los 4 usuarios sintéticos de prueba en STAGING, uno por rol, y asigna la persona al terapeuta.
// Lo ejecuta una persona con credenciales de superadmin (Mauricio/Infra); QA no maneja secretos ni las pide.
// Env obligatorias (NO se imprimen ni se guardan): STAGING_URL, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, TEST_PASSWORD (12+ caracteres, con mayúscula, minúscula, número y especial).
// Uso:  STAGING_URL=https://backend-staging-e3a6.up.railway.app SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... TEST_PASSWORD=... node qa/staging-usuarios.cjs
const BASE = (process.env.STAGING_URL || '').replace(/\/$/, '')
if (!/^https:\/\/backend-staging-/.test(BASE)) { console.error('STAGING_URL debe ser el staging (https://backend-staging-...). Se niega a tocar otro entorno.'); process.exit(2) }
const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, TEST_PASSWORD } = process.env
if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD || !TEST_PASSWORD) { console.error('Faltan SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD o TEST_PASSWORD.'); process.exit(2) }
const call = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
const USERS = [
  { name: 'QA Persona', email: 'qa.persona@example.test', role: 'user' },
  { name: 'QA Terapeuta', email: 'qa.terapeuta@example.test', role: 'therapist' },
  { name: 'QA Administrador', email: 'qa.admin@example.test', role: 'admin' },
  { name: 'QA Superadmin', email: 'qa.superadmin@example.test', role: 'superadmin' },
]
;(async () => {
  const login = await call('POST', '/api/login', null, { email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD })
  const token = login.j?.token; if (!token || login.j?.role !== 'superadmin') { console.error('Inicio de sesión del superadmin falló o la cuenta no es superadmin (' + login.s + ').'); process.exit(1) }
  const existing = (await call('GET', '/api/admin/usuarios', token)).j; const list = Array.isArray(existing) ? existing : existing?.users || existing?.usuarios || []
  const ids = {}
  for (const u of USERS) {
    const found = list.find(x => x.email === u.email)
    if (found) { ids[u.role] = found.id; console.log(`= ya existe  ${u.role.padEnd(10)} ${u.email} (id ${found.id}, rol ${found.role}) — su contraseña NO se cambia`); continue }
    const r = await call('POST', '/api/admin/usuarios', token, { ...u, password: TEST_PASSWORD })
    ids[u.role] = r.j?.id || r.j?.user?.id || r.j?.usuario?.id
    console.log(`${r.s === 201 || r.s === 200 ? '+ creado    ' : '! error ' + r.s} ${u.role.padEnd(10)} ${u.email}`, r.s >= 400 ? JSON.stringify(r.j).slice(0, 120) : '')
  }
  if (ids.user && ids.therapist) { const r = await call('PUT', `/api/admin/usuarios/${ids.user}/asignar-terapeuta`, token, { therapistId: ids.therapist }); console.log(`${r.s < 300 ? '+' : '!'} persona asignada al terapeuta (${r.s})`) }
  console.log('Listo. Entrega la contraseña TEST_PASSWORD a las personas probadoras por un canal privado (no por Jira, GitHub ni el repositorio).')
})().catch(e => { console.error('EXCEPCIÓN', e.message); process.exit(3) })
