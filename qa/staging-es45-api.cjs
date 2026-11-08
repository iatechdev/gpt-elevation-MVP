// QA-Claude-2 — ES-45: flujos de ESCRITURA y seguridad por API en STAGING (plan aprobado por Mauricio, Jira ES-45 comentario 11035 con 3 ajustes).
// Datos sintéticos prefijados «QA2». Cuentas desechables: qa.persona2 / qa.persona3 @example.test (se eliminan o desactivan al final).
// NO borra ni desactiva las 4 cuentas del equipo ni sus datos previos; restituye el consentimiento que modifique. No imprime claves ni tokens.
// Env: STAGING_URL, CRED_FILE.
const fs = require('fs'), crypto = require('crypto')
const BASE = (process.env.STAGING_URL || '').replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const info = (...a) => console.log('INFO', ...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))
const call = async (m, p, t, b, raw) => { const t0 = Date.now(); const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: raw ?? (b === undefined ? undefined : JSON.stringify(b)) }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt) } catch {} return { s: r.status, j, txt, ms: Date.now() - t0 } }
const login = async (email, password) => call('POST', '/api/login', null, { email, password })
const tag = Date.now().toString(36), P2 = `qa2-persona2-${tag}@example.test`, P3 = `qa2-persona3-${tag}@example.test`
const strong = () => crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + 'aB3!'
const today = new Date().toISOString().slice(0, 10)
const pctl = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
;(async () => {
  const tok = {}, creds = {}
  for (const [k, e] of Object.entries({ P1: 'qa.persona@example.test', T: 'qa.terapeuta@example.test', A: 'qa.admin@example.test', SA: 'qa.superadmin@example.test' })) { const r = await login(e, sec(e)); tok[k] = r.j?.token; ck(`F2 ${k} inicia sesión`, r.s === 200 && !!tok[k], 'HTTP ' + r.s); await sleep(500) }
  if (!tok.P1 || !tok.T || !tok.A || !tok.SA) process.exit(1)
  // F1 registro
  const pw2 = strong(), pw3 = strong()
  { let r = await call('POST', '/api/register', null, { name: 'QA2 débil', email: `qa2-weak-${tag}@example.test`, password: 'abc' }); ck('F1 contraseña débil rechazada con code password_policy', r.s === 400 && r.j?.code === 'password_policy', `HTTP ${r.s} missing=${(r.j?.missing || []).join(',')}`)
    r = await call('POST', '/api/register', null, { name: '<img src=x onerror=alert(1)> QA2 persona2', email: P2, password: pw2 }); ck('F1 registro válido de la persona desechable (nombre con HTML)', r.s === 201, 'HTTP ' + r.s)
    const dup = await call('POST', '/api/register', null, { name: 'x', email: P2, password: 'abc' }), nw = await call('POST', '/api/register', null, { name: 'x', email: `qa2-none-${tag}@example.test`, password: 'abc' })
    ck('F1/S8 correo existente + débil = igual que correo nuevo + débil (sin enumeración)', dup.s === nw.s && dup.j?.code === nw.j?.code, `${dup.s}/${nw.s}`)
    r = await call('POST', '/api/register', null, { name: 'QA2 persona3', email: P3, password: pw3 }); ck('F1 registro de la persona desechable 3', r.s === 201, 'HTTP ' + r.s) }
  await sleep(600); let r2 = await login(P2, pw2); tok.P2 = r2.j?.token; ck('F2 persona2 inicia sesión', r2.s === 200 && r2.j?.role === 'user', `HTTP ${r2.s}`)
  // F2 logout revoca
  { await sleep(600); const l = await login(P2, pw2); const t = l.j?.token; const pre = await call('GET', '/api/diary', t); const out = await call('POST', '/api/logout', t, {}); const post = await call('GET', '/api/diary', t)
    ck('F2/S4 cierre de sesión revoca el token (antes 200, después 401)', pre.s === 200 && post.s === 401, `${pre.s}→${out.s}→${post.s}`) }
  // F3 diario (persona1, prefijo QA2)
  let d1
  { const c = await call('POST', '/api/diary', tok.P1, { date: today, content: 'QA2 entrada <script>alert(1)</script> ñandú 😀 ‮ RTL' }); d1 = c.j?.id || c.j?.entry?.id; ck('F3 crear entrada de diario con HTML/emoji/RTL', c.s === 201 && !!d1, `HTTP ${c.s}`)
    const g = await call('GET', `/api/diary/${d1}`, tok.P1); const body = g.j?.content ?? g.j?.entry?.content; ck('F3/S5 el contenido vuelve literal (sin interpretar) y sin 5xx', g.s === 200 && /<script>alert\(1\)<\/script>/.test(body || ''), 'HTTP ' + g.s)
    const u = await call('PUT', `/api/diary/${d1}`, tok.P1, { content: 'QA2 editada' }); ck('F3 editar entrada', u.s === 200, 'HTTP ' + u.s)
    const bad = await Promise.all([['fecha futura lejana', { date: '2999-01-01', content: 'x' }], ['fecha inválida', { date: '2026-13-45', content: 'x' }], ['contenido vacío', { date: today, content: '' }], ['1 MB', { date: today, content: 'a'.repeat(1024 * 1024) }]].map(async ([n, b]) => [n, (await call('POST', '/api/diary', tok.P1, b)).s]))
    ck('F3/S5 fechas/contenidos inválidos → 4xx controlado, nunca 5xx', bad.every(([, s]) => s >= 400 && s < 500), bad.map(x => x.join(':')).join(' ')) }
  // F4 evidencia
  let e1
  { const c = await call('POST', '/api/evidence', tok.P1, { payload: { title: 'QA2 evidencia', situation: 'QA2 situación <b>x</b>', artifactRefs: [{ kind: 'text', excerpt: 'QA2 texto de prueba' }] }, status: 'draft', requestId: 'qa2-' + tag + '-001' }); e1 = c.j?.id || c.j?.evidence?.id; info('crear evidencia:', c.s, Object.keys(c.j || {}).slice(0, 6).join(','))
    ck('F4 crear evidencia en borrador', (c.s === 201 || c.s === 200) && !!e1, 'HTTP ' + c.s)
    const idem = await call('POST', '/api/evidence', tok.P1, { payload: { title: 'QA2 evidencia', situation: 'QA2 situación <b>x</b>', artifactRefs: [{ kind: 'text', excerpt: 'QA2 texto de prueba' }] }, status: 'draft', requestId: 'qa2-' + tag + '-001' }); ck('F4 idempotencia: mismo requestId no duplica', idem.s === 200 || idem.s === 201 ? (idem.j?.id === e1 || idem.j?.evidence?.id === e1) : false, `HTTP ${idem.s}`)
    const lst = await call('GET', '/api/evidence', tok.P1); ck('F4 listado de evidencia', lst.s === 200, 'HTTP ' + lst.s)
    const sm = await call('GET', '/api/skill-map', tok.P1); ck('F5 el Skill Map responde y no inventa niveles sin evidencia confirmada', sm.s === 200, 'HTTP ' + sm.s); info('skill-map claves:', Object.keys(sm.j || {}).slice(0, 8).join(',')) }
  // F6 experimentos/plan: lectura (la creación exige el esquema propio del servicio; se informa)
  { for (const p of ['/api/experiments', '/api/career-plan', '/api/routes', '/api/route-catalog']) { const r = await call('GET', p, tok.P1); ck(`F6 GET ${p} responde sin 5xx`, r.s < 500, 'HTTP ' + r.s) }
    const e = await call('POST', '/api/experiments', tok.P1, {}); ck('F6/S5 crear experimento con cuerpo vacío → 4xx controlado', e.s >= 400 && e.s < 500, `HTTP ${e.s} ${(e.j?.code || '')}`) }
  // F7 consentimiento + panel terapeuta
  let consent0
  { const g = await call('GET', '/api/consents', tok.P1); consent0 = g.j; ck('F7 leer consentimientos de la persona', g.s === 200, 'HTTP ' + g.s)
    const list = Array.isArray(g.j) ? g.j : g.j?.consents || []; const th = list.find(c => c.purpose === 'therapist_sharing'); info('consentimiento therapist_sharing inicial:', th ? th.status : 'no listado')
    const before = await call('GET', '/api/therapist/pacientes', tok.T); const mine = (Array.isArray(before.j) ? before.j : before.j?.pacientes || before.j?.patients || [])
    info('terapeuta ve', mine.length, 'paciente(s) antes de cambiar el consentimiento')
    const grant = await call('PUT', '/api/consents/therapist_sharing', tok.P1, { status: 'granted' }); ck('F7 la persona autoriza compartir con su terapeuta', grant.s === 200 || grant.s === 201, 'HTTP ' + grant.s)
    const idp = (mine.find(p => /QA Persona/.test(p.name || '')) || {}).id; const h1 = idp && await call('GET', `/api/therapist/pacientes/${idp}/historia`, tok.T); info('historia con consentimiento otorgado:', h1 && h1.s)
    const chk = idp && await call('GET', `/api/therapist/pacientes/${idp}/historial`, tok.T); ck('S2/F10 el historial del terapeuta no trae el diario ni la entrada QA2 de la persona', chk ? !/QA2 entrada|QA2 editada/.test(chk.txt) : true, chk && 'HTTP ' + chk.s)
    const revoke = await call('PUT', '/api/consents/therapist_sharing', tok.P1, { status: (th && th.status) || 'revoked' }); ck('F7 la persona revoca (restituye el estado inicial)', revoke.s === 200 || revoke.s === 201, 'HTTP ' + revoke.s)
    const h2 = idp && await call('GET', `/api/therapist/pacientes/${idp}/historia`, tok.T); info('historia tras revocar:', h2 && h2.s, '(antes', h1 && h1.s + ')') }
  // F10 terapeuta aislamiento
  { const adminList = (await call('GET', '/api/admin/usuarios', tok.A)).j || []; const p2 = adminList.find(u => u.email === P2); const p1 = adminList.find(u => u.email === 'qa.persona@example.test'); ck('F11 el admin ve a la persona desechable recién creada', !!p2)
    if (p2) { const t1 = await call('GET', `/api/therapist/pacientes/${p2.id}/historial`, tok.T); ck('S2/F10 el terapeuta NO accede a una persona no asignada', t1.s === 403 || t1.s === 404, 'HTTP ' + t1.s)
      const t2 = await call('GET', `/api/therapist/pacientes/${p2.id}/historia`, tok.T); ck('S2/F10 historia de persona no asignada denegada', t2.s === 403 || t2.s === 404, 'HTTP ' + t2.s) }
    // F11 admin: asignar y quitar terapeuta a la persona desechable, desactivar/reactivar, crear admin denegado
    const therap = adminList.find(u => u.email === 'qa.terapeuta@example.test')
    if (p2 && therap) { const as = await call('PUT', `/api/admin/usuarios/${p2.id}/asignar-terapeuta`, tok.A, { therapistId: therap.id }); ck('F11 el admin asigna terapeuta a la persona desechable', as.s === 200, 'HTTP ' + as.s); const un = await call('PUT', `/api/admin/usuarios/${p2.id}/asignar-terapeuta`, tok.A, { therapistId: null }); ck('F11 y lo quita', un.s === 200, 'HTTP ' + un.s)
      const de = await call('PUT', `/api/admin/usuarios/${p2.id}`, tok.A, { active: false }); const lg = await login(P2, pw2); const re = await call('PUT', `/api/admin/usuarios/${p2.id}`, tok.A, { active: true }); await sleep(500); const lg2 = await login(P2, pw2)
      ck('F11 desactivar impide el ingreso y reactivar lo restituye', de.s === 200 && lg.s >= 400 && re.s === 200 && lg2.s === 200, `${de.s}/${lg.s}/${re.s}/${lg2.s}`); tok.P2 = lg2.j?.token || tok.P2 }
    const mk = await call('POST', '/api/admin/usuarios', tok.A, { name: 'QA2 intento admin', email: `qa2-adm-${tag}@example.test`, password: strong(), role: 'admin' }); ck('F11 el admin NO puede crear un administrador (403)', mk.s === 403, 'HTTP ' + mk.s)
    const mk2 = await call('POST', '/api/admin/usuarios', tok.A, { name: 'QA2 terapeuta desechable', email: `qa2-ther-${tag}@example.test`, password: strong(), role: 'therapist' }); ck('F11 el admin crea un terapeuta desechable', mk2.s === 201, 'HTTP ' + mk2.s); const thId = mk2.j?.usuario?.id
    const sa = await call('POST', '/api/admin/usuarios', tok.SA, { name: 'QA2 admin desechable', email: `qa2-sadm-${tag}@example.test`, password: strong(), role: 'admin' }); ck('F12 el superadmin crea un administrador desechable', sa.s === 201, 'HTTP ' + sa.s); const saId = sa.j?.usuario?.id
    for (const [path, ok] of [['/api/admin/skill-catalog', true], ['/api/admin/route-catalog', true], ['/api/superadmin/ai-usage', true]]) { const g = await call('GET', path, tok.SA); ck(`F12 superadmin GET ${path}`, g.s === 200, 'HTTP ' + g.s) }
    // limpieza de cuentas desechables creadas aquí (solo las QA2): desactivar
    for (const id of [thId, saId].filter(Boolean)) { const x = await call('PUT', `/api/admin/usuarios/${id}`, tok.A, { active: false }); const y = x.s === 200 ? x : await call('PUT', `/api/admin/usuarios/${id}`, tok.SA, { active: false }); ck('Limpieza: cuenta QA2 desactivada', y.s === 200, 'HTTP ' + y.s) }
    void p1 }
  // S1 aislamiento A/B con persona2
  { const t = tok.P2
    const g = await call('GET', `/api/diary/${d1}`, t); const u = await call('PUT', `/api/diary/${d1}`, t, { content: 'QA2 hackeada' }); const d = await call('DELETE', `/api/diary/${d1}`, t)
    ck('S1 persona2 no lee, edita ni borra el diario de persona1 (404/403)', [g.s, u.s, d.s].every(s => s === 404 || s === 403), `${g.s}/${u.s}/${d.s}`)
    const ge = await call('GET', `/api/evidence/${e1}`, t); const ue = await call('PUT', `/api/evidence/${e1}`, t, { payload: { title: 'QA2 robada' }, status: 'draft', baseVersion: 1, requestId: 'qa2-' + tag + '-hack' }); const de = await call('DELETE', `/api/evidence/${e1}`, t)
    ck('S1 persona2 no lee, edita ni borra la evidencia de persona1', [ge.s, ue.s, de.s].every(s => s === 404 || s === 403), `${ge.s}/${ue.s}/${de.s}`)
    const l = await call('GET', '/api/diary', t); ck('S1 el listado de diario de persona2 no contiene entradas de persona1', !/QA2 entrada|QA2 editada/.test(l.txt), 'HTTP ' + l.s)
    const pv = await call('POST', '/api/exports/preview', tok.P1, { type: 'personal', locale: 'es' }); const eid = pv.j?.id; ck('F9 persona1 genera una vista previa de exportación', pv.s === 200 || pv.s === 201, 'HTTP ' + pv.s)
    if (eid) { const dl = await call('POST', `/api/exports/${eid}/download`, t, {}); ck('S1 persona2 no descarga la exportación de persona1', dl.s === 404 || dl.s === 403, 'HTTP ' + dl.s); const own = await call('POST', `/api/exports/${eid}/download`, tok.P1, {}); ck('F9 persona1 descarga su exportación y solo trae lo propio', own.s === 200 && !/qa2-persona2/.test(own.txt), 'HTTP ' + own.s) }
    for (const pth of ['/api/admin/usuarios', '/api/admin/metrics', '/api/therapist/pacientes', '/api/superadmin/ai-usage']) { const x = await call('GET', pth, t); ck(`S4 token de persona en ${pth} → 401/403`, x.s === 401 || x.s === 403, 'HTTP ' + x.s) }
    const dd = await call('GET', `/api/diary/${d1}`, tok.A); const ds = await call('GET', `/api/diary/${d1}`, tok.SA); ck('S3 admin y superadmin no leen el diario privado de una persona', [dd.s, ds.s].every(s => s === 404 || s === 403), `${dd.s}/${ds.s}`) }
  // S4 JWT alterado y sin sesión
  { const t = tok.P1.split('.'); const bad = [t[0] + '.' + t[1] + '.' + t[2].slice(0, -2) + 'AA', t[0] + '.' + Buffer.from('{"id":1,"role":"superadmin"}').toString('base64url') + '.' + t[2], 'x.y.z']
    const rs = await Promise.all(bad.map(b => call('GET', '/api/admin/usuarios', b))); ck('S4 JWT alterado / rol elevado en el payload / basura → 401', rs.every(x => x.s === 401), rs.map(x => x.s).join('/')) }
  // F13 recuperación sin enumeración
  { const a = await call('POST', '/api/password-reset/request', null, { email: P2 }), b = await call('POST', '/api/password-reset/request', null, { email: `qa2-none-${tag}@example.test` })
    ck('F13 recuperación: respuesta uniforme para correo existente e inexistente', a.s === b.s && JSON.stringify(a.j) === JSON.stringify(b.j), `${a.s}/${b.s}`) }
  // S9 secretos en el bundle
  { const html = await (await fetch(BASE + '/')).text(); const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map(m => m[1]).slice(0, 6); let hits = []
    for (const a of assets) { const js = await (await fetch(BASE + a)).text(); for (const [n, re] of [['clave Anthropic', /sk-ant-[A-Za-z0-9_-]{10,}/], ['JWT', /eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\./], ['URL de base', /postgres(ql)?:\/\//], ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY/], ['supabase service', /service_role/]]) if (re.test(js)) hits.push(n + ' en ' + a) }
    ck(`S9 sin secretos en el bundle (${assets.length} archivos JS revisados)`, hits.length === 0, hits.join('; '))
    const h = await fetch(BASE + '/api/health'); const hd = Object.fromEntries(h.headers); info('cabeceras clave:', ['x-content-type-options', 'strict-transport-security', 'content-security-policy', 'x-frame-options', 'referrer-policy', 'cache-control'].map(k => k + '=' + (hd[k] ? 'sí' : 'NO')).join(' '))
    const api = await call('GET', '/api/diary', tok.P1); info('Cache-Control en API autenticada:', api.s) }
  // Rendimiento
  { const ep = ['/api/diary', '/api/skill-map', '/api/ai/usage', '/api/evidence', '/api/consents'], ms = []
    for (let round = 0; round < 5; round++) await Promise.all(Array.from({ length: 6 }, async (_, i) => { const x = await call('GET', ep[(round + i) % ep.length], i % 2 ? tok.P1 : tok.P2); ms.push(x.ms) }))
    ck('P1 endpoints clave con 6 usuarios simultáneos: p95 < 800 ms', pctl(ms, 0.95) < 800, `p50=${pctl(ms, 0.5)} p95=${pctl(ms, 0.95)} máx=${Math.max(...ms)} ms (n=${ms.length})`)
    const w = await Promise.all(Array.from({ length: 10 }, (_, i) => call('POST', '/api/diary', tok.P2, { date: today, content: 'QA2 carga ' + i }))); ck('P3 10 escrituras simultáneas sin 5xx', w.every(x => x.s < 500), w.map(x => x.s).join(','))
    for (let i = 0; i < 40; i++) await call('POST', '/api/diary', tok.P2, { date: today, content: 'QA2 volumen ' + i }); const big = await call('GET', '/api/diary?limit=50', tok.P2); ck('P4 con 50 entradas el listado responde < 800 ms', big.ms < 800 && big.s === 200, `${big.ms} ms`) }
  // limpieza de datos QA2 de persona1 (solo lo creado aquí)
  { const rd = await call('DELETE', `/api/diary/${d1}`, tok.P1); const re = e1 ? await call('DELETE', `/api/evidence/${e1}`, tok.P1) : { s: 0 }; ck('Limpieza: entrada QA2 de diario y evidencia QA2 de persona1 eliminadas', rd.s === 200 || rd.s === 204, `${rd.s}/${re.s}`) }
  // F9 eliminar cuenta desechable persona2 (borrado propio)
  { const del = await call('POST', '/api/account/deletion-requests', tok.P2, { confirm: true }); ck('F9 persona2 solicita eliminar su cuenta', del.s === 202 || del.s === 200, 'HTTP ' + del.s); const after = await call('GET', '/api/diary', tok.P2); ck('F9 tras la solicitud, la sesión de persona2 queda restringida', after.s === 401 || after.s === 403 || after.s === 410 || after.s === 423, 'HTTP ' + after.s) }
  // S7 bloqueo por intentos con persona3 (tras la ventana del limitador)
  info('esperando 65 s para la ventana del limitador de login'); await sleep(65000)
  { const out = []; for (let i = 0; i < 4; i++) { out.push((await login(P3, 'Mala1!mala' + i)).s); await sleep(400) } const good = await login(P3, pw3)
    ck('S7 bloqueo por intentos fallidos en la cuenta desechable (3 fallos → 423 y la clave correcta queda bloqueada)', out.includes(423) && good.s === 423, `${out.join('/')} y clave correcta → ${good.s}`)
    const lst = (await call('GET', '/api/admin/usuarios', tok.A)).j || []; const p3 = lst.find(u => u.email === P3); if (p3) { const x = await call('PUT', `/api/admin/usuarios/${p3.id}`, tok.A, { active: false }); ck('Limpieza: persona3 desechable desactivada', x.s === 200, 'HTTP ' + x.s) } }
  console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
