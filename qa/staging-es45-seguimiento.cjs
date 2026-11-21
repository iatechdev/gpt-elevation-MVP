// QA-Claude-2 — ES-45 seguimiento: (1) propiedad de la evidencia con un cuerpo VÁLIDO (el intento anterior devolvió 400 antes de comprobar al propietario),
// (2) consentimiento del terapeuta otorgar → revocar y lo que ve el terapeuta en cada estado. Deja el consentimiento de qa.persona en «revoked» (el original era «undecided», que no se puede volver a fijar por API).
const fs = require('fs'), crypto = require('crypto')
const BASE = process.env.STAGING_URL.replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/)
const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const call = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); const txt = await r.text(); let j = null; try { j = JSON.parse(txt) } catch {} return { s: r.status, j, txt } }
const login = async e => { const r = await call('POST', '/api/login', null, { email: e, password: sec(e) }); await sleep(600); return r.j?.token }
const tag = Date.now().toString(36)
;(async () => {
  const P1 = await login('qa.persona@example.test'), T = await login('qa.terapeuta@example.test'), A = await login('qa.admin@example.test')
  const P2e = `qa2-p2b-${tag}@example.test`, P2pw = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + 'aB3!'
  await call('POST', '/api/register', null, { name: 'QA2 persona2b', email: P2e, password: P2pw }); await sleep(600); const P2 = (await call('POST', '/api/login', null, { email: P2e, password: P2pw })).j?.token
  // (1) evidencia con cuerpo válido
  const mk = await call('POST', '/api/evidence', P1, { payload: { title: 'QA2 evidencia B', situation: 'QA2 situación', artifactRefs: [{ kind: 'text', excerpt: 'QA2 texto' }] }, status: 'draft', requestId: 'qa2b-' + tag + '-001' }); const id = mk.j?.id
  const own = await call('PUT', `/api/evidence/${id}`, P1, { payload: { title: 'QA2 evidencia B editada', situation: 'QA2 situación', artifactRefs: [{ kind: 'text', excerpt: 'QA2 texto' }] }, status: 'draft', baseVersion: 1, requestId: 'qa2b-' + tag + '-002' })
  ck('Control: el dueño sí puede editar con el mismo cuerpo válido', own.s === 200 || own.s === 201, 'HTTP ' + own.s)
  const body = { payload: { title: 'QA2 robada', situation: 'x', artifactRefs: [{ kind: 'text', excerpt: 'x' }] }, status: 'draft', baseVersion: 2, requestId: 'qa2b-' + tag + '-hack1' }
  const g = await call('GET', `/api/evidence/${id}`, P2), u = await call('PUT', `/api/evidence/${id}`, P2, body), d = await call('DELETE', `/api/evidence/${id}`, P2)
  ck('S1 persona2 no lee, edita (cuerpo válido) ni borra la evidencia de persona1', [g.s, u.s, d.s].every(s => s === 404 || s === 403), `${g.s}/${u.s}/${d.s}`)
  const still = await call('GET', `/api/evidence/${id}`, P1); ck('S1 la evidencia sigue intacta para su dueño', still.s === 200 && !/QA2 robada/.test(still.txt), 'HTTP ' + still.s)
  const rm = await call('DELETE', `/api/evidence/${id}`, P1); ck('Limpieza: evidencia QA2 eliminada', rm.s === 200 || rm.s === 204, 'HTTP ' + rm.s)
  // (2) consentimiento
  const list0 = (await call('GET', '/api/consents', P1)).j; const cur = (Array.isArray(list0) ? list0 : list0?.consents || []).find(c => c.purpose === 'therapist_sharing'); console.log('INFO estado actual de therapist_sharing:', cur?.status)
  const see = async label => { const p = await call('GET', '/api/therapist/pacientes', T); const arr = Array.isArray(p.j) ? p.j : p.j?.pacientes || p.j?.patients || []; const me = arr.find(x => /QA Persona/.test(x.name || '')); const h = me ? await call('GET', `/api/therapist/pacientes/${me.id}/historia`, T) : { s: 0, txt: '' }; const ia = me ? await call('GET', `/api/therapist/pacientes/${me.id}/resumen-ia`, T) : { s: 0 }; console.log(`INFO ${label}: lista=${p.s} campos de la persona=${me ? Object.keys(me).join(',') : 'no aparece'} | historia=${h.s} (${h.txt.length} bytes) | resumen-ia=${ia.s}`); return { me, h, ia } }
  const rev0 = await call('PUT', '/api/consents/therapist_sharing', P1, { status: 'revoked' }); ck('F7 revocar compartir con el terapeuta', rev0.s === 200 || rev0.s === 201, 'HTTP ' + rev0.s)
  const sRev = await see('revocado'); const gr = await call('PUT', '/api/consents/therapist_sharing', P1, { status: 'granted' }); ck('F7 otorgar compartir', gr.s === 200 || gr.s === 201, 'HTTP ' + gr.s)
  const sGr = await see('otorgado'); const rev = await call('PUT', '/api/consents/therapist_sharing', P1, { status: 'revoked' }); ck('F7 revocar de nuevo (estado final)', rev.s === 200 || rev.s === 201, 'HTTP ' + rev.s)
  const sRev2 = await see('revocado otra vez')
  ck('F7 la revocación se refleja de inmediato: con consentimiento revocado el terapeuta ve menos que con otorgado', sRev.h.txt.length < sGr.h.txt.length || sRev.h.s >= 400 || sRev.h.s !== sGr.h.s, `revocado ${sRev.h.s}/${sRev.h.txt.length} B vs otorgado ${sGr.h.s}/${sGr.h.txt.length} B`)
  ck('F7 tras revocar de nuevo vuelve al nivel restringido', sRev2.h.txt.length === sRev.h.txt.length && sRev2.h.s === sRev.h.s, `${sRev2.h.s}/${sRev2.h.txt.length} B`)
  ck('S2 con consentimiento otorgado la historia del terapeuta no contiene el diario ni «crisis»', !/diario|diary|crisis|suicid/i.test(sGr.h.txt), '')
  // limpieza persona2b
  const del = await call('POST', '/api/account/deletion-requests', P2, { confirm: true }); ck('Limpieza: persona2b desechable solicita eliminar su cuenta', del.s === 202 || del.s === 200, 'HTTP ' + del.s)
  console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); void A; process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
