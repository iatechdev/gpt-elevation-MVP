// QA-Claude-2 — ES-45 C15: pantallas de la cadena (Mapa de competencias, Siguiente paso, evidencia, catálogo de rutas) con una persona DESECHABLE sembrada por API.
// Sin IA. No imprime claves ni tokens. Env: STAGING_URL, CRED_FILE, PLAYWRIGHT_MODULE, OUT.
const fs = require('fs'), crypto = require('crypto'); const pw = require(process.env.PLAYWRIGHT_MODULE); const BASE = process.env.STAGING_URL.replace(/\/$/, ''), OUT = process.env.OUT || '.'
if (!/^https:\/\/backend-staging-/.test(BASE)) process.exit(2)
const lines = fs.readFileSync(process.env.CRED_FILE, 'utf8').split(/\r?\n/); const sec = e => { const l = lines.find(x => x.includes(e)); return l.slice(l.indexOf(e) + e.length).replace(/^[\s:=|,;\-–>]+/, '').replace(/^(?:clave|contraseña|password)\s*[:=]\s*/i, '').split(/\s{2,}/)[0].trim() }
let f = 0; const ck = (n, ok, x = '') => { if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
const sleep = ms => new Promise(r => setTimeout(r, ms)); const rid = () => 'qa2' + crypto.randomBytes(8).toString('hex')
const call = async (m, p, t, b) => { const r = await fetch(BASE + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { s: r.status, j } }
;(async () => {
  fs.mkdirSync(OUT, { recursive: true }); const tag = Date.now().toString(36), email = `qa2-cadenaui-${tag}@example.test`, pass = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, 'x') + 'aB3!'
  await call('POST', '/api/register', null, { name: 'QA2 cadenaui', email, password: pass }); await sleep(600); const login = async () => { const r = await call('POST', '/api/login', null, { email, password: pass }); await sleep(700); return r.j.token }
  const tk = await login()
  const rc = await call('GET', '/api/route-catalog', tk); const ctxs = (rc.j?.contexts || []).map(c => c.contextKey)
  await call('PUT', '/api/user/context', tk, { schemaVersion: 2, expectedVersion: 0, action: 'continue', context: { preferredLanguage: 'es', residenceCountry: 'CO', targetMarket: 'CO', timeZone: 'America/Bogota', profession: 'Analista QA2', interests: 'datos', availabilityMinutesPerWeek: 240, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: 3, experience: [], education: [], declaredSkills: [], languages: [] } })
  await call('PUT', '/api/routes/constraints', tk, { baseVersion: 0, requestId: rid(), payload: { targetMarkets: ['CO'], languages: ['es'], modalities: ['remote'], acceptRegulated: 'no', originContextKey: null, interestContextKeys: ctxs.slice(0, 1), preferredModalities: ['remote'] } })
  const full = n => ({ title: `QA2 evidencia ${n}`, situation: 'Armé un tablero con datos ficticios.', responsibility: { text: 'Yo lo diseñé.', source: 'self_report' }, actions: [{ text: 'Limpié los datos.', source: 'self_report' }], delivered: { text: 'Un tablero.', source: 'self_report' }, observedEffect: { known: false }, autonomy: 'autonomous' })
  const e1 = await call('POST', '/api/evidence', tk, { payload: full(1), status: 'confirmed', requestId: rid() }); const sk = ((await call('GET', '/api/skill-map', tk)).j?.skills || [])[0]?.skillKey
  await call('POST', '/api/skill-map/self', tk, { skillKey: sk, level: 3, evidenceRefs: [{ evidenceId: e1.j.id, version: e1.j.version }], requestId: rid() })
  const rts = await call('GET', '/api/routes', tk); const r0 = rts.j?.routes?.[0]; const ch = r0 && await call('POST', '/api/routes/choices', tk, { requestId: rid(), roleKey: r0.roleKey, slot: r0.slot, decision: 'accepted', basisHash: rts.j.basisHash })
  const pp = ch && await call('POST', '/api/experiments/proposals', tk, { choiceId: ch.j.choice.id, taskIndex: 0, minutes: 30 }); const ex = pp && await call('POST', '/api/experiments', tk, { requestId: rid(), proposal: pp.j.proposal, token: pp.j.token })
  ck('Preparación: cadena sembrada por API (evidencia, nivel, ruta elegida, experimento)', !!ex?.j?.experimentId, `exp=${ex?.j?.experimentId}`)
  const pages = ['/app/skill-map', '/app/next-step', '/app/evidence', '/app/evidence/new', '/app/route-catalog', '/app/professional-reviews']
  const RAW = /\b[a-z][A-Za-z]+(?:\.[a-z][A-Za-z0-9]+){2,}\b/ // claves i18n crudas tipo skillMap.title.x
  const b = await pw.chromium.launch()
  for (const [lang, w] of [['es', 1440], ['es', 390], ['en', 1440], ['en', 390]]) {
    const token = await login(); const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 500 }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [token, lang])
    const p = await c.newPage(); const errs = [], api5 = []; p.on('pageerror', x => errs.push(x.message.slice(0, 80))); p.on('response', r => { if (r.status() >= 500 && /\/api\//.test(r.url())) api5.push(r.status() + ' ' + new URL(r.url()).pathname) })
    for (const path of pages) {
      const tag2 = `${lang} ${w}px ${path}`; await p.goto(BASE + path, { waitUntil: 'networkidle' }).catch(() => {}); await p.waitForTimeout(1200)
      const txt = await p.locator('body').innerText(); const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); const h1 = await p.locator('h1').count(); const url = new URL(p.url()).pathname
      ck(`C15 ${tag2}: carga con contenido, sin desborde horizontal`, txt.length > 200 && !ov && url.startsWith('/app'), `ruta=${url} ${txt.length} car. desborde=${ov}`)
      ck(`C15 ${tag2}: sin claves de traducción crudas`, !RAW.test(txt), RAW.test(txt) ? txt.match(RAW)[0] : '')
      if (!h1) console.log('INFO ' + tag2 + ': sin <h1> (ya conocido en ES-206 para dashboard/chat; aquí es nuevo)')
      await p.keyboard.press('Tab'); await p.keyboard.press('Tab'); const foc = await p.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return 'body'; const s = getComputedStyle(e); return `${e.tagName}:${s.outlineStyle}:${s.outlineWidth}:${s.boxShadow !== 'none'}` }); console.log('INFO foco tras 2 Tab ' + tag2 + ':', foc)
      if (path === '/app/skill-map' || path === '/app/next-step') await p.screenshot({ path: `${OUT}/cadena-${lang}-${w}-${path.split('/').pop()}.png` })
    }
    ck(`C15 ${lang} ${w}px: sin errores de página ni 5xx en las 6 pantallas`, errs.length === 0 && api5.length === 0, errs.concat(api5).join(' | ')); await c.close()
  }
  await b.close()
  const A = (await call('POST', '/api/login', null, { email: 'qa.admin@example.test', password: sec('qa.admin@example.test') })).j?.token; const us = (await call('GET', '/api/admin/usuarios', A)).j || []; const me = us.find(u => u.email === email); if (me) await call('PUT', '/api/admin/usuarios/' + me.id, A, { active: false })
  console.log(f ? `\nFALLAS ${f}` : '\nTODO OK'); process.exit(f ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.stack?.slice(0, 300)); process.exit(3) })
