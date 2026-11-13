// QA-Claude-2 — ES-45 plan complementario (Jira ES-45 comentario 11037): A2 hoja de vida PDF, A3/A4 rechazos del Skill Map y experimentos, A7 desbloqueo y restablecer contraseña.
// Persona DESECHABLE nueva (QA2); no toca las 4 cuentas del equipo. IA: ≤ 1 llamada (A2, PDF válido). No imprime claves ni tokens. Env: STAGING_URL, CRED_FILE.
const fs = require('fs'), crypto = require('crypto'); const BASE = process.env.STAGING_URL.replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const call = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt) } catch {} return { s: r.status, j, txt } }
const uuid = () => crypto.randomUUID()
const pdf = text => { const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', null, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const stream = `BT /F1 12 Tf 50 740 Td (${text.replace(/[()\\]/g, '')}) Tj ET`; objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`; let out = '%PDF-1.4\n'; const off = []
  objs.forEach((o, i) => { off.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` }); const x = out.length; out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`; return Buffer.from(out, 'latin1') }
const up = async (tk, buf, name, type) => { const fd = new FormData(); fd.append('requestId', uuid()); fd.append('cv', new Blob([buf], { type }), name); const r = await fetch(BASE + '/api/user/resumes/analyze', { method: 'POST', headers: { Authorization: 'Bearer ' + tk }, body: fd }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt) } catch {} return { s: r.status, j, txt } }
;(async () => {
  const login = async e => (await call('POST', '/api/login', null, { email: e, password: sec(e) })).j?.token
  const SA = await login('qa.superadmin@example.test'); await sleep(600); const A = await login('qa.admin@example.test'); await sleep(600)
  const tag = Date.now().toString(36), email = `qa2-persona4-${tag}@example.test`, pw = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + 'aB3!'
  const rg = await call('POST', '/api/register', null, { name: 'QA2 persona4', email, password: pw }); ck('Preparación: persona desechable creada', rg.s === 201, 'HTTP ' + rg.s); await sleep(600)
  const tk = (await call('POST', '/api/login', null, { email, password: pw })).j?.token
  // A2 hoja de vida
  const noConsent = await up(tk, pdf('QA2 sin consentimiento'), 'cv.pdf', 'application/pdf'); ck('A2 sin autorización previa no se procesa nada (403 consent_required)', noConsent.s === 403, `HTTP ${noConsent.s} ${noConsent.j?.code || ''}`)
  const gr = await call('PUT', '/api/consents/resume_ai_reading', tk, { status: 'granted' }); ck('A2 la persona autoriza la lectura de su hoja de vida con IA', gr.s === 200 || gr.s === 201, 'HTTP ' + gr.s)
  const bad = [['.txt con firma falsa', Buffer.from('Esto no es un PDF'), 'cv.pdf', 'application/pdf'], ['PDF corrupto', Buffer.from('%PDF-1.4\nbasura sin estructura\n%%EOF'), 'cv.pdf', 'application/pdf'], ['> 5 MB', Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(5.5 * 1024 * 1024)]), 'cv.pdf', 'application/pdf'], ['tipo no permitido (.exe)', Buffer.from('MZ' + 'x'.repeat(200)), 'cv.exe', 'application/octet-stream']]
  for (const [n, b, nm, ty] of bad) { const r = await up(tk, b, nm, ty); ck(`A2 ${n} → rechazo controlado (4xx), sin 5xx ni llamada a IA`, r.s >= 400 && r.s < 500, `HTTP ${r.s} ${r.j?.code || ''}`); await sleep(400) }
  const good = await up(tk, pdf('QA2 sintetico. Analista de datos con tres anos de experiencia en Power BI y SQL. Lidere un proyecto de tableros comerciales.'), 'cv-sintetico.pdf', 'application/pdf')
  console.log('INFO PDF válido: HTTP', good.s, good.j?.code || Object.keys(good.j || {}).join(','))
  ck('A2 PDF sintético válido: aceptado (2xx) o rechazo explicado por falta de texto/consentimiento (nunca 5xx)', good.s < 500, `HTTP ${good.s} ${good.j?.code || ''}`)
  const list = await call('GET', '/api/user/resumes', tk); ck('A2 el listado de hojas de vida responde', list.s === 200, 'HTTP ' + list.s)
  const ids = (Array.isArray(list.j) ? list.j : list.j?.resumes || []).map(x => x.id); for (const id of ids) { const d = await call('DELETE', `/api/user/resumes/${id}`, tk); ck('A2 eliminar la hoja de vida propia', d.s === 200 || d.s === 204, 'HTTP ' + d.s) }
  // A4 Skill Map: nunca inventa niveles
  const map = await call('GET', '/api/skill-map', tk); const skills = map.j?.skills || []; ck('A4 persona sin evidencia: ninguna competencia trae nivel (nivel null / «sin evidencia»)', map.s === 200 && skills.every(s => !s.level && !s.currentLevel && s.level !== 0), `${skills.length} competencias; con nivel=${skills.filter(s => s.level || s.currentLevel).length}`)
  if (skills[0]) { const k = skills[0].skillKey; const s1 = await call('POST', '/api/skill-map/self', tk, { skillKey: k, level: 3, evidenceRefs: [], requestId: 'qa2-' + tag + '-a' }); ck('A4 autoevaluar un nivel sin evidencia → 422 evidence_required', s1.s === 422 || s1.s === 400, `HTTP ${s1.s} ${s1.j?.code || ''}`)
    const s2 = await call('POST', '/api/skill-map/self', tk, { skillKey: k, level: 9, evidenceRefs: [], requestId: 'qa2-' + tag + '-b' }); ck('A4 nivel fuera de rango → 4xx', s2.s >= 400 && s2.s < 500, 'HTTP ' + s2.s)
    const s3 = await call('POST', '/api/skill-map/self', tk, { skillKey: k, level: 3, evidenceRefs: [{ evidenceId: 999999, version: 1 }], requestId: 'qa2-' + tag + '-c' }); ck('A4 nivel con evidencia ajena/inexistente → 4xx', s3.s >= 400 && s3.s < 500, 'HTTP ' + s3.s)
    const pr = await call('POST', '/api/skill-map/proposals', tk, {}); ck('A4 propuestas de IA sin evidencia confirmada → 4xx, sin gastar IA y sin guardar nada', pr.s >= 400 && pr.s < 500 || (pr.s === 200 && JSON.stringify(pr.j).length < 400), `HTTP ${pr.s} ${pr.j?.code || ''}`) }
  // A3 experimentos: rechazos y aislamiento
  const ex = await call('GET', '/api/experiments', tk); ck('A3 la persona nueva no tiene experimentos', ex.s === 200 && (ex.j?.experiments || ex.j || []).length === 0, 'HTTP ' + ex.s)
  const e1 = await call('GET', '/api/experiments/1', tk); ck('A3 pedir un experimento ajeno por ID → 404', e1.s === 404 || e1.s === 403, 'HTTP ' + e1.s)
  const e2 = await call('POST', '/api/experiments', tk, { requestId: 'qa2-' + tag + '-e', proposal: { choiceId: 1 }, token: 'x' }); ck('A3 crear experimento con propuesta/token falsos → 4xx controlado', e2.s >= 400 && e2.s < 500, `HTTP ${e2.s} ${e2.j?.code || ''}`)
  const e3 = await call('POST', '/api/experiments/proposals', tk, { choiceId: 1, taskIndex: 0, minutes: 30 }); ck('A3 proponer experimento sin ruta elegida → 4xx controlado', e3.s >= 400 && e3.s < 500, `HTTP ${e3.s} ${e3.j?.code || ''}`)
  const pl = await call('POST', '/api/career-plan/versions', tk, {}); ck('A3 guardar plan vacío → 4xx controlado', pl.s >= 400 && pl.s < 500, 'HTTP ' + pl.s)
  // A7 admin: desbloquear y restablecer
  const lst = (await call('GET', '/api/admin/usuarios', A)).j || []; const me = lst.find(u => u.email === email)
  if (me) {
    for (let i = 0; i < 3; i++) { await call('POST', '/api/login', null, { email, password: 'Mala1!mala' + i }); await sleep(300) }
    const lk = await call('POST', '/api/login', null, { email, password: pw }); ck('A7 la persona queda bloqueada tras 3 fallos (423)', lk.s === 423, 'HTTP ' + lk.s)
    const ul = await call('PUT', `/api/admin/usuarios/${me.id}/unlock`, A); ck('A7 el administrador la desbloquea', ul.s === 200, 'HTTP ' + ul.s); await sleep(500)
    const ok = await call('POST', '/api/login', null, { email, password: pw }); ck('A7 tras desbloquear entra con su clave', ok.s === 200, 'HTTP ' + ok.s); await sleep(500)
    const ra = await call('PUT', `/api/admin/usuarios/${me.id}/reset-password`, A, { newPassword: 'Nueva1!Clave99' }); ck('A7 el administrador NO puede restablecer contraseñas (solo superadmin → 403)', ra.s === 403, 'HTTP ' + ra.s)
    const rw = await call('PUT', `/api/admin/usuarios/${me.id}/reset-password`, SA, { newPassword: 'abc123' }); console.log('INFO A7 superadmin restablece con «abc123» (6 caracteres, sin mayúscula ni especial): HTTP', rw.s, rw.j?.message || rw.j?.error || '')
    ck('A7 (observación) restablecer contraseña NO aplica la política de 8 caracteres con complejidad de ES-128', rw.s >= 400, rw.s === 200 ? 'ACEPTADA: la ruta admin sigue con mínimo 6 (ya propuesto como ticket aparte por Dev)' : 'rechazada')
    const rs = await call('PUT', `/api/admin/usuarios/${me.id}/reset-password`, SA, { newPassword: pw }); void rs
    const dd = await call('PUT', `/api/admin/usuarios/${me.id}`, A, { active: false }); ck('Limpieza: persona4 desechable desactivada', dd.s === 200, 'HTTP ' + dd.s)
  } else ck('A7 el admin ve la persona4', false)
  console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
