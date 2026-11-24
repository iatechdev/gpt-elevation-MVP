// QA-Claude-2 — #96 (ES-30 radar): R-1 a R-6 en navegador con backend REAL (:8090, catálogo sembrado) y vite (:5173). Solo local, datos sintéticos.
// Env: OUT, PLAYWRIGHT_MODULE, BACKEND (carpeta backend del worktree, para `pg`), DATABASE_URL (la base local; se niega si no es loopback).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const { createRequire } = require('module'); const { Client } = createRequire(process.env.BACKEND + '/package.json')('pg')
const path = require('path'), fs = require('fs'); const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true })
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(process.env.DATABASE_URL || '')) { console.error('Solo base local'); process.exit(2) }
const API = 'http://localhost:8090', UI = 'http://localhost:5173', PASS = require('crypto').randomBytes(12).toString('hex') + 'Aa1!'
let fails = 0; const ck = (n, ok, x = '') => { if (!ok) fails++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${n} ${x}`) }
const call = async (m, p, t, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); return { s: r.status, j: await r.json().catch(() => null) } }
let k = 0; const person = async (tag) => { const email = `qa-${tag}-${Date.now()}${Math.floor(Math.random() * 1e3)}@example.test`; await call('POST', '/api/register', null, { name: 'QA ' + tag, email, password: PASS }); return (await call('POST', '/api/login', null, { email, password: PASS })).j.token }
const ev = (title, autonomy) => ({ requestId: `rd-${Date.now()}-${++k}`, status: 'confirmed', payload: { title, situation: 'Situación sintética.', responsibility: { text: 'Mi parte.' }, actions: [{ text: 'Acción.' }], delivered: { text: 'Entregable.' }, observedEffect: { known: false }, autonomy } })
const setLevel = (t, key, level, evId) => call('POST', '/api/skill-map/self', t, { requestId: `rl-${key}-${Date.now()}-${++k}`, skillKey: key, level, evidenceRefs: [{ evidenceId: evId, version: 1 }], rationale: 'n' })
const FLATTER = /excelente|incre[ií]ble|fant[aá]stic|genial|brillante|extraordinari|impresionante|excellent|amazing|fantastic|brilliant|outstanding|impressive|great job/i
const DEFICIT = /d[eé]ficit|brecha|d[eé]bil|debilidad|carencia|te falta|you lack|weakness|deficit|gap\b/i
;(async () => {
  const pg = new Client({ connectionString: process.env.DATABASE_URL }); await pg.connect()
  const tA = await person('radarA'); const map0 = (await call('GET', '/api/skill-map', tA)).j; const skills = map0.skills
  const rub = (key, n) => skills.find(s => s.skillKey === key).rubric.levels[String(n)]
  const e1 = (await call('POST', '/api/evidence', tA, ev('Evidencia sintética radar', 'autonomous'))).j.id
  ck('R setup: 3 niveles propios con evidencia', (await setLevel(tA, 'comunicacion', 3, e1)).s === 201 && (await setLevel(tA, 'trabajo_en_equipo', 1, e1)).s === 201 && (await setLevel(tA, 'adaptabilidad', 4, e1)).s === 201)
  const b = await chromium.launch()
  const open = async (tk, route, { lang = 'es', w = 1280, scheme = 'light', mock } = {}) => { const c = await b.newContext({ viewport: { width: w, height: 1000 }, colorScheme: scheme }); await c.addInitScript(([t, l]) => { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [tk, lang]); const p = await c.newPage(); p.errs = []; p.on('console', m => m.type() === 'error' && p.errs.push(m.text().slice(0, 140))); p.on('pageerror', e => p.errs.push(e.message.slice(0, 140)))
    if (mock) await p.route('**/api/skill-map', r => r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(mock) }) : r.continue())
    await p.goto(UI + route, { waitUntil: 'networkidle' }); await p.waitForTimeout(900); return p }
  const noErr = (p) => p.errs.filter(x => !/403|Failed to load resource/.test(x)).length === 0
  // ---------- R-1 forma del radar ----------
  let p = await open(tA, '/app/skill-map'); const body = () => p.locator('body').innerText()
  ck('R-1 el radar es la vista inicial (Radar pulsado)', (await p.locator('.skill-map-views button').first().getAttribute('aria-pressed')) === 'true')
  const wedges = p.locator('.radar-wedge'); ck('R-1 una cuña por capacidad (8)', await wedges.count() === skills.length, `${await wedges.count()} cuñas`)
  const geo = await wedges.evaluateAll(ws => ws.map(w => { const path = w.querySelector('path'); const d = path.getAttribute('d'); const r = Number((d.match(/A([\d.]+),/) || [])[1]); return { label: w.getAttribute('aria-label'), cls: path.getAttribute('class'), r, dash: getComputedStyle(path).strokeDasharray, num: w.querySelector('.radar-num')?.textContent ?? null } }))
  const want = { 'Comunicación': 3, 'Trabajo en equipo': 1, 'Adaptabilidad': 4 }
  for (const [nm, lv] of Object.entries(want)) { const g = geo.find(x => x.label.startsWith(nm + ':')); ck(`R-1 «${nm}»: nivel ${lv} → largo ${(165 * lv / 4).toFixed(2)}, relleno h${lv} y número visible`, !!g && Math.abs(g.r - 165 * lv / 4) < 0.6 && g.cls.includes('h' + lv) && g.num === String(lv), JSON.stringify(g)) }
  const none = geo.filter(g => /Sin evaluar/.test(g.label)); ck('R-1 sin nivel = hueco punteado a largo completo, sin número y NUNCA cero', none.length === 5 && none.every(g => g.cls.includes('radar-none') && g.dash !== 'none' && g.num === null && Math.abs(g.r - 165) < 0.6), `${none.length} huecos; trazo ${none[0]?.dash}`)
  let txt = await body(); ck('R-1 sin porcentajes ni puntaje global ni «0 de 4»', !/\d\s*%|puntaje|puntuaci[oó]n total|promedio|nivel 0|0 de 4/i.test(txt))
  ck('R-1 leyenda 1-4 con número y «Sin evaluar» (el color no va solo)', (await p.locator('.radar-legend li').allInnerTexts()).join('|').replace(/\n/g, '') .includes('Sin evaluar') && (await p.locator('.radar-legend .radar-swatch').allInnerTexts()).join('') === '1234')
  ck('R-1 etiquetas del gráfico presentes (≤12 capacidades)', await p.locator('.radar-label').count() >= skills.length)
  await p.screenshot({ path: path.join(OUT, 'radar-es-1280.png'), fullPage: true })
  // ---------- R-3 puntos fuertes / mejora (con 3 niveles propios) ----------
  const strong = await p.locator('#radar-strong-title').locator('..').innerText()
  const order = [...strong.matchAll(/^(Adaptabilidad|Comunicación|Trabajo en equipo)$/gm)].map(m => m[1])
  ck('R-3 «Tus puntos más fuertes»: solo capacidades con nivel, de mayor a menor, sin rellenar', order.join('>') === 'Adaptabilidad>Comunicación>Trabajo en equipo' && !/por ahora/i.test(strong), order.join('>'))
  ck('R-3 el criterio mostrado es el real del catálogo para ese nivel', strong.includes(rub('adaptabilidad', 4).es) && strong.includes(rub('comunicacion', 3).es) && strong.includes(rub('trabajo_en_equipo', 1).es))
  const improve = await p.locator('#radar-improve-title').locator('..').innerText()
  ck('R-3 «Un punto donde puedes mejorar»: la de nivel más bajo y el criterio real del SIGUIENTE nivel', /Trabajo en equipo/.test(improve) && improve.includes('Para pasar al nivel 2') && improve.includes(rub('trabajo_en_equipo', 2).es), improve.replace(/\n/g, ' ').slice(0, 160))
  ck('R-3 sin adjetivos halagadores ni déficits / brechas', !FLATTER.test(txt) && !DEFICIT.test(txt), (txt.match(FLATTER) || txt.match(DEFICIT) || [''])[0])
  ck('R-3 aviso «no certifica / no se compara con otras personas»', /no certifica/.test(txt) && /No se compara con otras personas/.test(txt))
  // ---------- R-2 dos pistas: se dibuja la MÁS BAJA ----------
  const cols = (await pg.query(`SELECT column_name FROM information_schema.columns WHERE table_name='SkillAssessments' AND column_name NOT IN ('id')`)).rows.map(r => '"' + r.column_name + '"')
  const uid = (await call('GET', '/api/session', tA)).j?.user?.id ?? (await pg.query(`SELECT "UserId" FROM "SkillAssessments" WHERE "skillKey"='comunicacion' AND status='current' ORDER BY id DESC LIMIT 1`)).rows[0].UserId
  const sel = cols.map(c => c === '"track"' ? `'review'` : c === '"level"' ? '2' : c === '"requestId"' ? `'qa-review-${Date.now()}'` : (c === '"createdAt"' || c === '"updatedAt"') ? 'NOW()' : c).join(',')
  await pg.query(`INSERT INTO "SkillAssessments" (${cols.join(',')}) SELECT ${sel} FROM "SkillAssessments" WHERE "UserId"=$1 AND "skillKey"='comunicacion' AND track='self' AND status='current' LIMIT 1`, [uid])
  await p.context().close(); p = await open(tA, '/app/skill-map'); txt = await body()
  const com = await p.locator('.radar-wedge', { hasText: '' }).evaluateAll(ws => ws.map(w => ({ label: w.getAttribute('aria-label'), num: w.querySelector('.radar-num')?.textContent })).find(x => x.label.startsWith('Comunicación:')))
  ck('R-2 autoevaluación 3 y revisión 2 → el radar dibuja 2 (el MÁS BAJO)', /Nivel 2 de 4/.test(com.label) && com.num === '2', JSON.stringify(com))
  await p.locator('.radar-wedge', { hasText: '' }).filter({ has: p.locator('title', { hasText: 'Comunicación' }) }).first().click(); await p.waitForTimeout(700)
  const det = await p.locator('.skill-map-detail').innerText(); ck('R-2 el detalle sigue mostrando CADA pista por separado', /Autoevaluaci[oó]n|Tu nivel/i.test(det) && /Revisi[oó]n/i.test(det), det.replace(/\n/g, ' ').slice(0, 140))
  console.log('   OBSERVACIÓN PO: el radar muestra el nivel más bajo entre pistas (decisión de diseño); los «puntos fuertes» se ordenan por nivel (HU12 superada por el PO).')
  // ---------- R-1 estado vacío, R-6 «Conviene revisar» ----------
  const tE = await person('radarE'); let pe = await open(tE, '/app/skill-map'); const te = await pe.locator('body').innerText()
  ck('R-1 persona sin nivel: aviso «Todavía no hay evidencia suficiente» + enlace a evidencias, sin tarjetas de puntos fuertes', /Todavía no hay evidencia suficiente/.test(te) && await pe.locator('.radar-empty a[href="/app/evidence"]').count() === 1 && await pe.locator('#radar-strong-title').count() === 0)
  ck('R-1 persona sin nivel: 8 huecos y ninguna cuña con relleno', await pe.locator('.radar-none').count() === 8 && await pe.locator('.radar-fill').count() === 0)
  await pe.screenshot({ path: path.join(OUT, 'radar-empty-375.png'), fullPage: true }); await pe.context().close()
  const tC = await person('radarC'); const eC = (await call('POST', '/api/evidence', tC, ev('Evidencia con autonomía alta', 'autonomous'))).j.id; await setLevel(tC, 'comunicacion', 1, eC)
  const pc = await open(tC, '/app/skill-map'); const rowC = await pc.locator('.radar-row', { hasText: 'Comunicación' }).innerText()
  ck('R-6 contradicción de autonomía: el radar rotula «Conviene revisar» (no «Requiere revisión humana»)', /Conviene revisar/.test(rowC) && !/Requiere revisión humana/.test(await pc.locator('body').innerText()), rowC.replace(/\n/g, ' '))
  await pc.locator('.radar-row', { hasText: 'Comunicación' }).click(); await pc.waitForTimeout(600); const dc = await pc.locator('.skill-map-detail').innerText()
  ck('R-6 el detalle explica la regla y es accionable', /Conviene revisar/.test(dc) && /(autonom[ií]a|nivel)/i.test(dc) && /(registrar|Retirar|Cambiar|evidencia)/i.test(dc), dc.replace(/\n/g, ' ').slice(0, 260))
  ck('R-6 sin consola de errores', noErr(pc)); await pc.context().close()
  // ---------- teclado, vistas, ES/EN ----------
  await p.context().close(); p = await open(tA, '/app/skill-map', { w: 1280 })
  await p.locator('.radar-wedge').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(500)
  ck('R-4 teclado: Enter en una cuña la selecciona (aria-pressed) y abre el detalle', (await p.locator('.radar-wedge').first().getAttribute('aria-pressed')) === 'true' && await p.locator('.skill-map-detail').count() === 1)
  await p.locator('.radar-wedge').nth(1).focus(); await p.keyboard.press('Space'); await p.waitForTimeout(400); ck('R-4 teclado: Espacio también selecciona', (await p.locator('.radar-wedge').nth(1).getAttribute('aria-pressed')) === 'true')
  ck('R-4 foco visible en la cuña (anillo/contorno)', await p.evaluate(() => { const w = document.querySelectorAll('.radar-wedge')[1]; w.focus(); const s = getComputedStyle(w); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2 || !!w.matches(':focus-visible') }))
  await p.getByRole('button', { name: 'Registrar mi nivel' }).first().isVisible().catch(() => false)
  const imp = p.locator('.radar-improve button'); await imp.click(); await p.waitForTimeout(700); ck('R-4 «Registrar mi nivel» de la tarjeta de mejora lleva el foco al detalle', await p.evaluate(() => document.activeElement?.classList.contains('skill-map-detail-wrap')))
  await p.locator('.skill-map-views button').nth(1).click(); await p.waitForTimeout(500); ck('R-4 la vista Territorios sigue disponible', (await p.locator('.skill-map-views button').nth(1).getAttribute('aria-pressed')) === 'true' && await p.locator('.radar-board').count() === 0)
  ck('R-4 consola sin errores (1280)', noErr(p)); await p.context().close()
  for (const [lang, w] of [['en', 1280], ['es', 375], ['en', 320], ['es', 768]]) {
    const q = await open(tA, '/app/skill-map', { lang, w }); const m = await q.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth })); const t2 = await q.locator('body').innerText()
    ck(`R-4 ${lang}/${w}px sin desborde horizontal`, m.s <= m.i, `${m.s}/${m.i}`)
    if (lang === 'en') ck(`R-4 EN ${w}px: textos del radar traducidos (sin restos en español)`, /Your skills at a glance/.test(t2) && /Your strongest points/.test(t2) && /Not assessed/.test(t2) && !/Tus puntos|Sin evaluar|Un punto donde|Todas tus|Nivel \d de/.test(t2) && !FLATTER.test(t2))
    const tgt = await q.evaluate(() => [...document.querySelectorAll('.skill-map-views button, .radar-row, .radar-improve button')].map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h > 0)); ck(`R-4 ${lang}/${w}px controles ≥44 px de alto`, tgt.every(h => h >= 44), `mín ${Math.min(...tgt)}`)
    await q.screenshot({ path: path.join(OUT, `radar-${lang}-${w}.png`), fullPage: true }); ck(`R-4 ${lang}/${w}px consola`, noErr(q)); await q.context().close()
  }
  // ---------- R-4 muchas capacidades (12, 13 y 40) con mock ----------
  const mk = (i, lv) => ({ skillKey: 'skill_' + String(i).padStart(2, '0'), type: 'transversal', labels: { es: `Capacidad número ${i} con un nombre bastante largo para envolver`, en: `Skill number ${i} with a fairly long name that must wrap` }, territories: [], rubric: { levels: { 1: { es: 'Criterio uno', en: 'Criterion one' }, 2: { es: 'Criterio dos', en: 'Criterion two' }, 3: { es: 'Criterio tres', en: 'Criterion three' }, 4: { es: 'Criterio cuatro', en: 'Criterion four' } }, source: 's', verifiedAt: '2026-10-01T00:00:00Z' }, state: lv ? 'initial' : 'no_evidence', self: lv ? { level: lv, state: 'initial', stale: false, catalogOutdated: false, confidence: 'low', confidenceReason: { es: 'x', en: 'x' }, evidenceCount: 1, authoring: 'person', rationale: 'n', needsReview: false } : null, review: null })
  for (const n of [12, 13, 40]) for (const w of [1280, 375, 320]) {
    const mock = { catalogVersion: 9, skills: Array.from({ length: n }, (_, i) => mk(i + 1, i % 3 === 0 ? (i % 4) + 1 : 0)) }
    const q = await open(tA, '/app/skill-map', { w, mock }); const m = await q.evaluate(() => ({ s: document.documentElement.scrollWidth, i: innerWidth, wedges: document.querySelectorAll('.radar-wedge').length, labels: document.querySelectorAll('.radar-label').length, rows: document.querySelectorAll('.radar-row').length }))
    ck(`R-4 ${n} capacidades a ${w}px: ${n} cuñas, ${n} filas en la lista de texto, sin desborde`, m.wedges === n && m.rows === n && m.s <= m.i, JSON.stringify(m))
    ck(`R-4 ${n} capacidades: etiquetas ${n <= 12 ? 'visibles' : 'omitidas (la lista las lleva)'}`, n <= 12 ? m.labels > 0 : m.labels === 0, `${m.labels} etiquetas`)
    if (n === 12 && w === 1280) { const ov = await q.evaluate(() => { const ts = [...document.querySelectorAll('.radar-label')].map(t => t.getBoundingClientRect()); let o = 0; for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) { const a = ts[i], c = ts[j]; if (a.left < c.right - 1 && a.right > c.left + 1 && a.top < c.bottom - 1 && a.bottom > c.top + 1) o++ } const svg = document.querySelector('.radar-svg').getBoundingClientRect(); const out = [...document.querySelectorAll('.radar-label')].filter(t => { const r = t.getBoundingClientRect(); return r.left < svg.left - 1 || r.right > svg.right + 1 }).length; return { o, out } }); ck('R-4 12 capacidades a 1280: sin solapes de etiquetas y ninguna recortada por el borde del gráfico', ov.o === 0 && ov.out === 0, JSON.stringify(ov)) }
    if (n === 40 && w === 1280) await q.screenshot({ path: path.join(OUT, 'radar-40-1280.png'), fullPage: true })
    ck(`R-4 ${n}/${w}px consola`, noErr(q)); await q.context().close()
  }
  await pg.end(); await b.close(); console.log(fails ? `\nFALLAS: ${fails}` : '\nTODO OK'); process.exit(fails ? 1 : 0)
})().catch(e => { console.error('EXCEPCIÓN', e.message, e.stack?.split('\n')[1]); process.exit(3) })
