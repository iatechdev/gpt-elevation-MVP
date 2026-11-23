// [QA-Claude-5] ES-45 Fase 0: FRONTERA DE PRIVACIDAD (diario y crisis no llegan al proveedor de IA ni al motor profesional) con backend real + PostgreSQL desechable + proveedor SIMULADO con espía.
// Uso: API=http://127.0.0.1:8410 NODE_PATH=<backend/node_modules> node qa/qa5-es45-privacidad.cjs   (el backend debe haber arrancado con AI_SPY_FILE=$QA_TOOLS/qa5/out/ai-spy.jsonl)
const fs = require('fs'); const crypto = require('crypto')
const API = process.env.API; const SPY = (process.env.QA_TOOLS || '.') + '/qa5/out/ai-spy.jsonl'
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const info = (...a) => console.log('INFO ', ...a)
const pass = 'Qa5-' + crypto.randomBytes(8).toString('hex') + 'A1!'; const rid = () => crypto.randomUUID()
const call = async (tk, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tk ? { Authorization: 'Bearer ' + tk } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const calls = () => (fs.existsSync(SPY) ? fs.readFileSync(SPY, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
const mk = async (name) => { const email = `qa5-p-${crypto.randomBytes(3).toString('hex')}@example.test`; await call(null, 'POST', '/api/register', { name, email, password: pass, acceptedTerms: true, termsVersion: '2026-11-v2' }); const l = await call(null, 'POST', '/api/login', { email, password: pass }); return l.body.token }
const Z = '\u200b', ZWNJ = '\u200c'
const CRISIS = ['me quiero morir', 'quiero suicidarme', 'I want to kill myself', 'no quiero seguir viviendo']
const variants = (p) => [p, p.split(' ').join(Z), p.split(' ').join('\u2028'), p.split(' ').join(' ' + Z), p.replace(/ /g, '\u000b'), p.split('').join(Z)]
;(async () => {
  const tk = await mk('Persona Privacidad')
  for (const p of ['professional_bridge', 'insights_chat', 'insights_diary']) await call(tk, 'PUT', `/api/consents/${p}`, { status: 'granted' })
  // P1 chat: la crisis (limpia y con variantes) no llega al proveedor
  let n0 = calls().length, tested = 0, leaked = 0, noInterrupt = []
  for (const phrase of CRISIS) for (const v of variants(phrase)) { const before = calls().length; const r = await call(tk, 'POST', '/api/chat', { message: v, requestId: rid(), lang: /kill/.test(phrase) ? 'en' : 'es' }); tested++; if (calls().length !== before) { leaked++; noInterrupt.push(JSON.stringify(v).slice(0, 40)) } else if (r.status >= 500) noInterrupt.push('5xx ' + JSON.stringify(v).slice(0, 30)) }
  check(`P1 chat: ${tested} variantes de crisis (limpia, ZWSP, U+2028, VT, intercalada) → 0 llamadas al proveedor`, leaked === 0, noInterrupt.join(' | '))
  // P2 benignos: ZWNJ persa, emoji ZWJ, tildes → el proveedor SÍ se llama
  const benign = ['Hoy trabajé en una hoja de cálculo para la clínica.', 'می‌خواهم ' + 'کار' + ZWNJ + 'م را بهتر توضیح دهم', 'Me gusta mi equipo 👩‍💻 y quiero aprender más.']
  let bn = 0; for (const b of benign) { const before = calls().length; const r = await call(tk, 'POST', '/api/chat', { message: b, requestId: rid() }); if (calls().length === before + 1 && r.status === 200) bn++ }
  check(`P2 chat: ${benign.length} mensajes benignos (incluye ZWNJ persa y emoji ZWJ) llegan al proveedor (sin falsos positivos)`, bn === benign.length, bn + '/' + benign.length)
  // P3 puente: un campo con crisis no cruza; limpio sí
  const bridge = async (text) => call(tk, 'POST', '/api/career-context/preview', { fields: [{ key: 'motivations', text }], locale: 'es' })
  const bad3 = []; for (const phrase of CRISIS.slice(0, 2)) for (const v of variants(phrase)) { const r = await bridge('Me motiva ayudar. ' + v); if (r.status !== 422) bad3.push(r.status + ' ' + JSON.stringify(v).slice(0, 30)) }
  check('P3 puente: textos con crisis (limpia y con variantes) NO cruzan (422 field_not_shareable)', bad3.length === 0, bad3.join(' | '))
  const okb = await bridge('Me motiva explicar cifras de forma clara.'); check('P3 puente: un campo limpio sí se prepara (200)', okb.status === 200, okb.status + JSON.stringify(okb.body).slice(0, 120))
  // P4 diario: la entrada con crisis no se usa como fuente de insights; el diario no llega al proveedor
  const SECRET = 'SECRETO-DIARIO-' + crypto.randomBytes(3).toString('hex')
  const d1 = await call(tk, 'POST', '/api/diary', { date: '2026-11-20', content: `${SECRET} hoy me sentí cansada pero avancé en mi trabajo.`, requestId: rid() }); check('P4 diario: entrada normal guardada', d1.status === 201, d1.status + JSON.stringify(d1.body).slice(0, 120))
  const d2 = await call(tk, 'POST', '/api/diary', { date: '2026-11-21', content: 'Hoy ' + CRISIS[0], requestId: rid() }); info('diario con crisis (guardar):', d2.status, JSON.stringify(d2.body).slice(0, 160))
  const ids = [d1.body?.id, d2.body?.id].filter(Boolean)
  for (const id of ids) { const before = calls().length; const r = await call(tk, 'POST', '/api/insights/proposals', { sources: ['diary'], entryIds: [id], locale: 'es' }); info(`insights desde diario ${id}:`, r.status, JSON.stringify(r.body).slice(0, 140), 'llamadas nuevas:', calls().length - before) }
  const d2id = d2.body?.id; if (d2id) { const before = calls().length; const r = await call(tk, 'POST', '/api/insights/proposals', { sources: ['diary'], entryIds: [d2id], locale: 'es' }); check('P4 diario con crisis como fuente de insights: se rechaza y 0 llamadas al proveedor', r.status >= 400 && calls().length === before, r.status + ' ' + (calls().length - before)) }
  // P5 en TODAS las llamadas al proveedor: ni crisis ni (salvo autorizado) texto del diario
  const all = calls(); const blob = all.map((c) => JSON.stringify(c.body)).join('\n')
  const crisisSeen = CRISIS.some((p) => blob.toLowerCase().includes(p.toLowerCase())); check(`P5 ninguna de las ${all.length} llamadas al proveedor contiene una frase de crisis limpia`, !crisisSeen, CRISIS.filter((p) => blob.toLowerCase().includes(p.toLowerCase())).join(','))
  const chatBlob = all.filter((c) => /COMPANION LIMITS/.test(JSON.stringify(c.body.system || ''))).map((c) => JSON.stringify(c.body)).join('\n'); check('P5 el CHAT no envía el texto del diario cuando no se selecciona (el diario no cruza solo)', !chatBlob.includes(SECRET))
  // P6 revocar el puente: la propuesta de evidencia ya no llama a la IA
  await call(tk, 'PUT', '/api/consents/professional_bridge', { status: 'revoked' }); const b6 = calls().length; const r6 = await call(tk, 'POST', '/api/evidence/proposals', { turnIds: [1], locale: 'es' }); check('P6 tras revocar el puente, proponer evidencia → 403 y 0 llamadas', r6.status === 403 && calls().length === b6, r6.status)
  const b7 = calls().length; await call(tk, 'PUT', '/api/consents/insights_chat', { status: 'revoked' }); const r7 = await call(tk, 'POST', '/api/insights/proposals', { sources: ['chat'], locale: 'es' }); check('P6 tras revocar insights_chat, insights del chat → rechazo y 0 llamadas', r7.status >= 400 && calls().length === b7, r7.status + JSON.stringify(r7.body).slice(0, 100))
  console.log(`PRIVACIDAD: ${ok} correctas, ${bad} fallos`); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
