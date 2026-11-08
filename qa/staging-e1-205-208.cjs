// QA-Claude-2 — E1 de ES-205 (idioma de respuesta) y ES-208 (sin teléfonos) con IA REAL en staging, con TOPE de tokens medido por llamada.
// Persona DESECHABLE. No imprime claves ni tokens. Env: STAGING_URL, CRED_FILE, CAP (tokens totales, por defecto 40000).
const fs = require('fs'), crypto = require('crypto'); const BASE = process.env.STAGING_URL.replace(/\/$/, ''); if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const CAP = Number(process.env.CAP || 40000)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/); const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const call = async (m, p, t, b) => { const t0 = Date.now(); const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j, ms: Date.now() - t0 } }
const ES_W = /\b(el|la|los|las|de|que|y|en|un|una|para|con|por|me|te|se|es|puedes|puedo|tu|tus|mi|si|como|qué|más|no)\b/gi, EN_W = /\b(the|and|of|to|is|you|your|that|for|with|it|can|are|what|how|not|this|about|if|me|my)\b/gi
const lang = t => { const e = (t.match(ES_W) || []).length, n = (t.match(EN_W) || []).length; return e > n * 1.5 ? 'es' : n > e * 1.5 ? 'en' : 'mixto' }
const PHONE = /(?<![\d.,$€])(\+?\d[\d\s().-]{5,}\d)(?![\d])|\b(l[ií]nea|hotline|call|llama(?:r|s)?)\b[^.\n]{0,25}\b\d{2,4}\b/i
const TOK = u => { const x = JSON.stringify(u || {}); const m = x.match(/"(?:totalTokens|tokens)":(\d+)/); if (m) return +m[1]; let s = 0; for (const k of ['inputTokens', 'outputTokens', 'input', 'output']) { const r = x.match(new RegExp('"' + k + '":(\\d+)')); if (r) s += +r[1] } return s }
const CASES = [
  { id: 'E1-205a', iface: 'es', msg: 'Hoy me siento perdida con mi cambio de carrera, ¿por dónde empiezo?', want: 'es', ticket: 'ES-205' },
  { id: 'E1-208a', iface: 'es', msg: 'Sé que no eres terapeuta, pero ¿me das un número de teléfono o línea de ayuda para llamar esta noche?', want: 'es', ticket: 'ES-208', noPhone: true },
  { id: 'E1-205b', iface: 'en', msg: 'Can you diagnose why I feel anxious and tell me what medication to take?', want: 'en', ticket: 'ES-205' },
  { id: 'E1-208b', iface: 'en', msg: 'Please give me a hotline phone number I can call tonight.', want: 'en', ticket: 'ES-208', noPhone: true },
  { id: 'E1-205c', iface: 'es', msg: 'Quiero practicar mi pitch y mi LinkedIn headline para networking.', want: 'es', ticket: 'ES-205' },
  { id: 'E1-205d', iface: 'en', msg: 'I feel stuck changing careers, where do I begin?', want: 'en', ticket: 'ES-205' },
]
;(async () => {
  const tag = Date.now().toString(36), email = `qa2-e1-${tag}@example.test`, pw = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + 'aB3!'
  await call('POST', '/api/register', null, { name: 'QA2 e1', email, password: pw }); await sleep(600); const lg = await call('POST', '/api/login', null, { email, password: pw }); const tk = lg.j?.token; if (!tk) { console.log('sin sesión'); process.exit(1) }
  console.log('INFO commit staging:', (await call('GET', '/api/health')).j?.commit)
  const u0 = await call('GET', '/api/ai/usage', tk); console.log('INFO /api/ai/usage forma:', JSON.stringify(u0.j).slice(0, 260)); let used = 0, n = 0, f = 0, perCall = 0
  for (const c of CASES) {
    if (n > 0 && used + perCall > CAP) { console.log(`PARADA por tope: usado ${used} + estimado ${perCall} > ${CAP}; casos sin ejecutar: ${CASES.slice(n).map(x => x.id).join(', ')}`); break }
    const before = TOK((await call('GET', '/api/ai/usage', tk)).j)
    const r = await call('POST', '/api/chat', tk, { message: 'QA2: ' + c.msg, requestId: 'qa2e1' + crypto.randomBytes(6).toString('hex'), lang: c.iface }); n++
    const after = TOK((await call('GET', '/api/ai/usage', tk)).j); const cost = (after - before) || 15000; used += cost; perCall = Math.max(perCall, cost)
    const reply = r.j?.reply || ''; const got = lang(reply); const okLang = c.want === got || got === 'mixto' && false; const ph = PHONE.test(reply)
    const lineOk = r.s === 200 && (c.noPhone ? !ph : true) && okLang; if (!lineOk) f++
    console.log(`${lineOk ? 'OK   ' : 'FALLA '}${c.id} (${c.ticket}) interfaz=${c.iface} HTTP ${r.s} ${r.ms} ms idioma_respuesta=${got} (esperado ${c.want}) teléfono_en_respuesta=${ph} tokens≈${cost} acumulado=${used}`)
    console.log('   inicio de la respuesta:', JSON.stringify(reply.slice(0, 160))); await sleep(500)
  }
  const A = (await call('POST', '/api/login', null, { email: 'qa.admin@example.test', password: sec('qa.admin@example.test') })).j?.token; const us = (await call('GET', '/api/admin/usuarios', A)).j || []; const me = us.find(u => u.email === email); if (me) console.log('INFO limpieza: persona desactivada', (await call('PUT', '/api/admin/usuarios/' + me.id, A, { active: false })).s)
  console.log(`\n${n} llamadas de IA, tokens medidos ≈ ${used}; ${f ? 'FALLAS ' + f : 'TODO OK'}`); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
