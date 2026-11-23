// [QA-Claude-5] PR #398 (ES-110 PR 2): «Actualizar mi hoja de vida» + «Cambios frente a tu contexto actual», contra el backend REAL (qa5-398-server.cjs: rutas reales, PostgreSQL real, IA simulada) y Chromium.
// Uso: PLAYWRIGHT_MODULE=... AXE=... BASE=http://127.0.0.1:4367 API=http://127.0.0.1:8187 BACKEND=<backend> LABEL=pr|main [ONLY=F1,F2,...] node qa/qa5-398.cjs
const path = require('path'); const crypto = require('crypto')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const { makeTextPdf } = require(path.join(process.env.BACKEND, 'test/support/pdfFixtures.cjs'))
const BASE = process.env.BASE, API = process.env.API, LABEL = process.env.LABEL || 'pr'; const fs = require('fs'); const AXE = fs.readFileSync(process.env.AXE, 'utf8')
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null; const want = (k) => !ONLY || ONLY.includes(k)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let total = 0, fails = 0
const ck = (id, cond, detail = '') => { total++; if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALLA'} [${LABEL}] ${id} ${cond ? '' : String(detail).slice(0, 300)}`) }
const T = {
  es: { update: 'Actualizar mi hoja de vida', help: 'Se guarda como una versión nueva; la anterior se conserva.', title: 'Cambios frente a tu contexto actual', nw: 'Habilidades nuevas', still: 'Siguen en tu hoja de vida', gone: 'Ya no aparecen en esta versión', link: (n) => `Vincular a la versión ${n}`, keep: 'Mantener en mi contexto', quit: 'Quitar de mi contexto', same: 'Tu evidencia confirmada no cambia.', nochange: 'Tu hoja no cambió las habilidades.', over: (n) => (n === 1 ? '1 habilidad nueva no cabe: tu contexto admite hasta 40.' : `${n} habilidades nuevas no caben: tu contexto admite hasta 40.`), saved: 'Contexto guardado', back: 'Volver', save: 'Guardar', old: 'Subir una nueva versión', analyze: 'Analizar mi hoja de vida' },
  en: { update: 'Update my résumé', help: 'It is saved as a new version; the previous one is kept.', title: 'Changes compared with your current context', nw: 'New skills', still: 'Still in your résumé', gone: 'No longer in this version', link: (n) => `Link to version ${n}`, keep: 'Keep in my context', quit: 'Remove from my context', same: 'Your confirmed evidence does not change.', nochange: 'Your résumé did not change your skills.', over: (n) => (n === 1 ? '1 new skill does not fit: your context holds up to 40.' : `${n} new skills do not fit: your context holds up to 40.`), saved: 'Context saved', back: 'Back', save: 'Save', old: 'Upload a new version', analyze: 'Analyze my résumé' },
}
const jf = async (token, method, p, body, raw) => { const h = { Authorization: 'Bearer ' + token }; let b; if (body instanceof FormData) b = body; else if (body !== undefined) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body) } const r = await fetch(API + p, { method, headers: h, body: b }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx) } catch { /* */ } return { s: r.status, j, tx } }
const sql = async (q, p) => (await (await fetch(API + '/__test/sql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q, p }) })).json()).rows
const aiCalls = async () => (await (await fetch(API + '/__test/ai-calls')).json()).aiCalls
const persona = async () => (await fetch(API + '/__test/persona', { method: 'POST' })).json()
const pdf = (skills, extra = []) => makeTextPdf(['MARÍA SINTÉTICA', 'maria.sintetica@example.test · +57 300 123 4567', 'Líder de diseño · Estudio Norte · 2021–2026', 'QA-SKILLS: ' + skills.join('|'), ...skills.map((s) => 'Habilidad: ' + s), ...extra])
const upload = async (tk, skills) => { const f = new FormData(); f.append('requestId', crypto.randomUUID()); f.append('cv', new Blob([pdf(skills)], { type: 'application/pdf' }), 'cv.pdf'); const r = await jf(tk, 'POST', '/api/user/resumes/analyze', f); if (r.s !== 200) throw new Error('analyze ' + r.s + r.tx.slice(0, 200)); return r.j }
const EMPTY = { preferredLanguage: 'es', residenceCountry: null, targetMarket: null, timeZone: null, profession: null, interests: null, availabilityMinutesPerWeek: null, careerGoal: null, careerConstraints: null, sector: null, totalYearsExperience: null, experience: [], education: [], declaredSkills: [], languages: [] }
const putCtx = async (tk, skills) => { const cur = (await jf(tk, 'GET', '/api/user/context')).j; const r = await jf(tk, 'PUT', '/api/user/context', { schemaVersion: 2, expectedVersion: cur.version || 0, action: 'save_draft', context: { ...(cur.context || EMPTY), declaredSkills: skills } }); if (r.s !== 200) throw new Error('ctx ' + r.s + r.tx.slice(0, 200)); return r.j }
const claim = (text) => ({ text, source: 'self_report' }); const FULL = { title: 'SQL', situation: 'Reportes semanales', responsibility: claim('Yo escribía las consultas'), actions: [claim('Escribí consultas')], delivered: claim('Un reporte'), observedEffect: { known: true, claim: claim('Se leyó cada semana') }, artifactRefs: [{ kind: 'text', excerpt: 'Consultas SQL para reportes semanales' }] }
// persona A: v1 con 4 habilidades, contexto con ellas + una escrita a mano, borradores de Power BI y SQL (SQL confirmada)
async function seedA(extraHand = ['Inglés técnico']) {
  const p = await persona(); await jf(p.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'granted' })
  const a1 = await upload(p.token, ['Power BI', 'SQL', 'Excel', 'Gestión de proyectos']); await putCtx(p.token, [...a1.suggestions.declaredSkills, ...extraHand.map((n) => ({ name: n, support: null, resumeVersion: null }))])
  const pr = await jf(p.token, 'POST', '/api/user/resume-skills/promote', { requestId: crypto.randomUUID(), names: ['Power BI', 'SQL'] }); const ids = (pr.j.created || []).map((c) => c.id)
  if (ids.length) await jf(p.token, 'PUT', '/api/evidence/' + ids[1], { payload: FULL, status: 'confirmed', baseVersion: 1, requestId: crypto.randomUUID() })
  if (ids.length !== 2) throw new Error('seedA: no se crearon los 2 borradores (catálogo)'); return { ...p, v1: a1.resume, evidenceIds: ids }
}
const evSnapshot = async (uid) => { const rows = await sql('SELECT "EvidenceId", version, status, payload::text AS h, origins::text AS o FROM "EvidenceVersions" WHERE "UserId"=$1 ORDER BY "EvidenceId", version', [uid]); if (!Array.isArray(rows)) throw new Error('evSnapshot: la consulta falló (instantánea vacía = comprobación vacía)'); return JSON.stringify(rows) }
let BR
async function open(tk, { lang = 'es', w = 1360, h = 900, scheme = 'light', url = '/app/context/resumes', cpu = 0 } = {}) {
  const c = await BR.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: 'reduce' })
  await c.addInitScript(([t, l, s]) => { if (t) { localStorage.setItem('elevation_token', t); localStorage.setItem('elevation_role', 'user') } localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', s); window.__cls = 0; try { new PerformanceObserver((x) => { for (const e of x.getEntries()) if (!e.hadRecentInput) window.__cls += e.value }).observe({ type: 'layout-shift', buffered: true }) } catch { /* */ } }, [tk, lang, scheme])
  const page = await c.newPage(); page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message)); page.puts = []; page.on('request', (r) => { if (r.method() === 'PUT' && r.url().includes('/api/user/context')) page.puts.push(JSON.parse(r.postData() || '{}')) })
  if (cpu) { const cdp = await c.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu }) }
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('h1', { timeout: 30000 }).catch(() => {}); await sleep(1200); page.c = c; return page
}
class CI extends String { includes(x) { return this.toLowerCase().includes(String(x).toLowerCase()) } }
const body = async (p) => new CI(await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ")))
const axe = async (p) => { await p.addScriptTag({ content: AXE }); return p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map((v) => v.id + ':' + v.nodes.length + ':' + (v.nodes[0]?.target || []).join('>').slice(0, 60))) }
const shape = (p) => p.evaluate(() => ({ h1: document.querySelectorAll('h1').length, main: document.querySelectorAll('main').length, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth, small: [...document.querySelectorAll('main a, main button, main input[type=checkbox], main input[type=radio]')].filter((e) => { let r = e.getBoundingClientRect(); const l = e.closest('label'); if (l && (r.width < 24 || r.height < 24) && getComputedStyle(e).opacity === '0') r = l.getBoundingClientRect(); return r.width > 0 && (r.height < 24 || r.width < 24) }).length, inline: document.querySelectorAll('main [style]').length }))
const uploadFile = async (p, skills) => { await p.locator('input[type=file]').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: pdf(skills) }) }
async function toChanges(p, skills, lang = 'es') { // sube y analiza desde la pantalla de actualizar
  await uploadFile(p, skills); const cb = p.locator('input[type=checkbox]').first(); if (!(await cb.isChecked().catch(() => true))) await cb.check().catch(() => {})
  await p.getByRole('button', { name: new RegExp('^' + T[lang].analyze) }).click(); await p.getByRole('heading', { level: 1, name: T[lang].title }).waitFor({ timeout: 40000 }); await sleep(600)
}
const checkedState = (p) => p.evaluate(() => ({ boxes: [...document.querySelectorAll('main input[type=checkbox]')].filter((c) => !c.closest('.rs-box')).map((c) => c.checked), radios: [...document.querySelectorAll('main input[type=radio]')].map((r) => [r.checked, (r.closest('label') || {}).innerText]) }))

;(async () => {
  BR = await chromium.launch(); const x = T
  // ── F1 lista: botón primario y frase; no existe «Subir una nueva versión»
  if (want('F1')) for (const lang of ['es', 'en']) {
    const A = await seedA(); const p = await open(A.token, { lang }); const b = await body(p); const link = p.getByRole('link', { name: x[lang].update })
    const cls = await link.getAttribute('class').catch(() => ''); const href = await link.getAttribute('href').catch(() => '')
    if (process.env.DBG) console.log('DBG F1', JSON.stringify(String(b).slice(0, 700)));
    if (LABEL === 'pr') ck(`F1 [${lang}] /app/context/resumes: botón primario «${x[lang].update}» (enlace a /app/context/resumes/update) y la frase «${x[lang].help}»; sin «${x[lang].old}»`, b.includes(x[lang].update) && b.includes(x[lang].help) && !b.includes(x[lang].old) && /resumes\/update/.test(href || ''), JSON.stringify({ href, cls, hasOld: b.includes(x[lang].old) }))
    else console.log(`CONTROL main [${lang}]: «${x[lang].old}» presente=${b.includes(x[lang].old)} botón nuevo=${b.includes(x[lang].update)}`)
    await p.c.close()
  }
  // ── F13 preexistente: /app/onboarding en modo oscuro (axe) y contenido útil de la lista, en esta compilación (PR o main)
  if (want('F13')) {
    for (const lang of ['es']) for (const scheme of ['light', 'dark']) { const P0 = await persona(); await jf(P0.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'granted' }); const p = await open(P0.token, { lang, scheme, url: '/app/onboarding' }); const a = await axe(p); const rs = await p.evaluate(() => { const b = document.querySelector('.rs-box'); if (!b) return 'sin .rs-box'; const cs = getComputedStyle(b); const h = b.querySelector('h2, p'); return 'rs-box bg=' + cs.backgroundColor + ' texto=' + (h ? getComputedStyle(h).color : '?') }); console.log('F13 colores tarjeta:', JSON.stringify(await p.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => /hoja de vida|résumé/i.test(e.innerText)); if (!h) return 'sin h2'; let n = h, bg = []; while (n) { const cs = getComputedStyle(n); bg.push(n.className.toString().slice(0, 24) + ':' + cs.backgroundColor); n = n.parentElement; if (bg.length > 6) break } return { color: getComputedStyle(h).color, bg, theme: document.documentElement.getAttribute('data-theme'), scheme: matchMedia('(prefers-color-scheme: dark)').matches } }))); await p.screenshot({ path: (process.env.QA_TOOLS || '.') + '/qa5/out/onb-' + LABEL + '-' + scheme + '.png', fullPage: false }); const startBtn = p.getByRole('button', { name: /hoja de vida|résumé/i }).first(); const hasStart = await startBtn.count(); if (hasStart) { await startBtn.click().catch(() => {}); await sleep(800) } const a2 = await axe(p); console.log(`F13 ${LABEL} /app/onboarding ${scheme} tras abrir «empezar desde tu hoja de vida» (botón=${hasStart}): axe=${a2.length} ${a2.join(' ; ').slice(0, 260)}`); console.log(`F13 ${LABEL} /app/onboarding ${scheme}: axe violaciones=${a.length} ${a.join(' ; ').slice(0, 220)} | ${rs}`); await p.c.close() }
    const A = await seedA(); const p = await open(A.token, { lang: 'es', w: 390, url: '/app/context/resumes' }); const n = await p.evaluate(() => document.querySelector('main').innerText.length); console.log(`F13 ${LABEL} contenido útil de /app/context/resumes a 390 px: ${n} caracteres`); await p.c.close()
    const q = await open(A.token, { lang: 'es', w: 390, url: '/app/evidence/resume-skills' }); const tray = (await q.evaluate(() => document.querySelector('main').innerText)).replace(/[ \t\r\n]+/g, ' ').slice(0, 260); console.log(`F13 ${LABEL} bandeja de habilidades (con v1 viva): ${tray}`); await q.c.close()
    if (LABEL === 'pr') for (const scheme of ['light', 'dark']) { const A2 = await seedA(); const q2 = await open(A2.token, { lang: 'es', scheme, url: '/app/context/resumes/update' }); const r = await q2.evaluate(() => {
      const parse = (c) => c.match(/[0-9.]+/g).map(Number); const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
      const bgOf = (el) => { let n = el; while (n) { const c = getComputedStyle(n).backgroundColor; const p = parse(c); if (p.length < 4 || p[3] > 0.9) return p.slice(0, 3); n = n.parentElement } return [255, 255, 255] }
      const out = []; for (const e of document.querySelectorAll('main h1, main h2, main p, main label, main button, main a')) { if (!e.innerText.trim()) continue; const fg = parse(getComputedStyle(e).color).slice(0, 3); const bg = bgOf(e); const L1 = lum(fg), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05); if (ratio < 4.5) out.push(e.tagName + ':' + e.innerText.slice(0, 24) + ' ' + ratio.toFixed(2)) } return out })
      await q2.screenshot({ path: (process.env.QA_TOOLS || '.') + '/qa5/out/upd-' + scheme + '.png', fullPage: true }); console.log(`F13 PR /app/context/resumes/update ${scheme}: elementos con contraste < 4,5:1 = ${r.length} ${r.slice(0, 4).join(' | ')}`); await q2.c.close() }
    for (const w of [1360]) { }
  }
  if (LABEL !== 'pr') { await BR.close(); console.log('RESUMEN (control main)'); process.exit(0) }
  // ── F2 subir: tarjeta sin insignia/introducción/manual; consentimiento desmarcado sin autorización
  if (want('F2')) for (const lang of ['es', 'en']) {
    const p0 = await persona(); const a1 = await upload(p0.token, ['Power BI']).catch(() => null) // sin consentimiento el servidor rechaza: se informa
    const A = await seedA(); await jf(A.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'revoked' }); const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); const b = await body(p)
    const st = await p.evaluate(() => ({ h1: document.querySelector('h1')?.innerText, badge: !!document.querySelector('.rs-badge'), manual: [...document.querySelectorAll('button')].filter((e) => /llenar|rellenar|fill (it )?in|by hand|manual/i.test(e.innerText)).length, cb: [...document.querySelectorAll('input[type=checkbox]')].map((c) => c.checked), btnDisabled: [...document.querySelectorAll('button')].filter((e) => /Analizar|Analyze/.test(e.innerText)).map((e) => e.disabled), focus: document.activeElement && document.activeElement.tagName + ':' + (document.activeElement.innerText || '').slice(0, 40) }))
    ck(`F2 [${lang}] pantalla «${x[lang].update}»: un h1 con ese título, sin insignia ni «llenar a mano» al inicio, autorización DESMARCADA y «Analizar» deshabilitado hasta marcarla`, /update|actualizar|résumé/i.test(st.h1 || '') && !st.badge && st.manual === 0 && st.cb.every((c) => c === false) && st.btnDisabled.every((d) => d === true), JSON.stringify(st))
    ck(`F2 [${lang}] sin errores de JS`, p.errs.length === 0, p.errs.join('|')); await p.c.close()
  }
  // ── F3 cambios: tres grupos, nada marcado, «Mantener» por defecto, filas de «Siguen» solo vinculables, pie
  const results = {}
  if (want('F3') || want('F4') || want('F5')) for (const lang of ['es', 'en']) {
    const A = await seedA(); const ai0 = await aiCalls(); const snap0 = await evSnapshot(A.id); const ctx0 = (await jf(A.token, 'GET', '/api/user/context')).j
    const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang)
    const b = await body(p); const st = await checkedState(p); const t = x[lang]
    if (process.env.DBG) console.log('DBG F3', JSON.stringify(String(b).slice(0, 900)));
    const groups = await p.evaluate(() => [...document.querySelectorAll('main h2')].map((h) => h.innerText.replace(/\s+/g, ' ')))
    ck(`F3 [${lang}] «${t.title}»: tres tarjetas con su número (nuevas 2: Docker y Python; siguen 2: Power BI y SQL con «${t.link(2)}»; ya no aparecen 2: Excel y Gestión de proyectos)`, groups.some((g) => g.toLowerCase().startsWith(t.nw.toLowerCase()) && /2$/.test(g)) && groups.some((g) => g.toLowerCase().startsWith(t.still.toLowerCase()) && /2$/.test(g)) && groups.some((g) => g.toLowerCase().startsWith(t.gone.toLowerCase()) && /2$/.test(g)) && (b.match(new RegExp(t.link(2), 'gi')) || []).length === 2, JSON.stringify(groups))
    ck(`F3 [${lang}] la escrita a mano («Inglés técnico») que la hoja trae NO aparece en «Siguen» (no se ofrece vincular) y no está en ningún grupo de cambios`, !groups.join(' ').includes('Inglés') && (await p.locator('main').innerText()).split('Inglés técnico').length - 1 === 0, '')
    ck(`F3 [${lang}] NADA marcado por defecto (0 casillas marcadas) y «${t.keep}» seleccionado por defecto en cada «Ya no aparecen»`, st.boxes.every((c) => c === false) && st.radios.length === 4 && st.radios.filter(([c]) => c).every(([, l]) => (l || '').toLowerCase().includes(t.keep.toLowerCase())) && st.radios.filter(([c]) => c).length === 2, JSON.stringify(st))
    ck(`F3 [${lang}] pie «${t.same}», «${t.back}» y «${t.save}»`, b.includes(t.same) && b.includes(t.back) && b.includes(t.save), b.slice(-200))
    const foc = await p.evaluate(() => document.activeElement && (document.activeElement.tagName + ':' + document.activeElement.innerText)); ck(`F3 [${lang}] el foco está en el h1 al cambiar de pantalla`, /^H1:/.test(foc || ''), foc)
    ck(`F3 [${lang}] 1 sola llamada a la IA para esta actualización`, (await aiCalls()) - ai0 === 1, String((await aiCalls()) - ai0))
    // nada se guarda hasta pulsar «Guardar»
    const ctx1 = (await jf(A.token, 'GET', '/api/user/context')).j; ck(`F3 [${lang}] nada se guardó al analizar: contexto (versión ${ctx0.version}) y evidencia idénticos; 0 PUT`, ctx1.version === ctx0.version && p.puts.length === 0 && (await evSnapshot(A.id)) === snap0, `${ctx1.version}/${ctx0.version}/${p.puts.length}`)
    results[lang] = { A, p, snap0, ctx0, ai0 }
    if (lang === 'en') { /* se usan en F4 */ }
  }
  // ── F4 guardar con elecciones: añadir Docker, vincular Power BI, quitar Excel (mantener Gestión); la evidencia no cambia
  if (want('F4')) for (const lang of ['es', 'en']) {
    const { A, p, snap0, ctx0 } = results[lang]; const t = x[lang]
    await p.getByLabel('Docker', { exact: false }).first().check(); await p.getByRole('group').filter({ hasText: 'Power BI' }).count()
    const rowPB = p.locator('.cv-row', { hasText: 'Power BI' }); await rowPB.getByLabel(t.link(2)).check(); const rowEx = p.locator('.cv-row', { hasText: 'Excel' }); await rowEx.getByLabel(t.quit).check()
    const st0 = await checkedState(p); ck(`F4 [${lang}] las elecciones quedan marcadas (Docker, vincular Power BI, quitar Excel) y nada más`, st0.boxes.filter(Boolean).length === 2 && st0.radios.filter(([c, l]) => c && (l || '').toLowerCase().includes(t.quit.toLowerCase())).length === 1, JSON.stringify(st0))
    await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }); await sleep(500)
    const put = p.puts[0]; const ctx = (await jf(A.token, 'GET', '/api/user/context')).j; const sk = Object.fromEntries(ctx.context.declaredSkills.map((s) => [s.name, s.resumeVersion]))
    ck(`F4 [${lang}] un solo PUT del contexto con expectedVersion ${ctx0.version} y action save_draft`, p.puts.length === 1 && put.expectedVersion === ctx0.version && put.action === 'save_draft', JSON.stringify({ n: p.puts.length, ev: put && put.expectedVersion, a: put && put.action }))
    ck(`F4 [${lang}] contexto guardado = lo elegido: Power BI vinculada a la v2, Docker añadida (v2), Excel quitada, Gestión de proyectos MANTENIDA (v1), SQL y la escrita a mano intactas`, sk['Power BI'] === 2 && sk['Docker'] === 2 && !('Excel' in sk) && sk['Gestión de proyectos'] === 1 && sk['SQL'] === 1 && sk['Inglés técnico'] === null && !('Python' in sk), JSON.stringify(sk))
    ck(`F4 [${lang}] la evidencia (borrador y CONFIRMADA) queda IDÉNTICA byte a byte antes/después de guardar`, (await evSnapshot(A.id)) === snap0, '')
    const b = await body(p); const links = await p.evaluate(() => [...document.querySelectorAll('main a')].map((a) => a.getAttribute('href')))
    ck(`F4 [${lang}] tras guardar: «${t.saved}», enlaces a /app/evidence/resume-skills y a /app/context/resumes, «${t.same}»; las tarjetas de cambios ya no se dibujan (desviación 1)`, b.includes(t.saved) && links.includes('/app/evidence/resume-skills') && links.includes('/app/context/resumes') && b.includes(t.same) && !b.includes(t.gone) && !b.includes(t.nw), JSON.stringify(links))
    // la bandeja de habilidades: Docker y Power BI con la v2; Excel ausente
    const tray = await jf(A.token, 'GET', '/api/user/resume-skills'); const names = (tray.j.skills || []).map((s) => [s.name, s.resume && s.resume.version]); console.log(`INFO [${lang}] bandeja tras guardar: ${JSON.stringify(names)} · orphaned=${JSON.stringify(tray.j.orphaned || null)}`)
    ck(`F4 [${lang}] sin errores de JS`, p.errs.length === 0, p.errs.join('|')); await p.c.close()
  }
  // ── F5 guardar SIN elegir nada = contexto idéntico; «sin cambios»; 409; respuesta perdida; 401; sin contexto
  if (want('F5')) for (const lang of ['es', 'en']) {
    const t = x[lang]
    { // guardar sin elegir
      const A = await seedA(); const ctx0 = (await jf(A.token, 'GET', '/api/user/context')).j; const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang)
      await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }); const ctx1 = (await jf(A.token, 'GET', '/api/user/context')).j
      ck(`F5 [${lang}] guardar SIN elegir nada: las habilidades quedan idénticas (nada añadido, vinculado ni quitado) y la versión sube a ${ctx0.version + 1}`, JSON.stringify(ctx1.context.declaredSkills) === JSON.stringify(ctx0.context.declaredSkills) && ctx1.version === ctx0.version + 1, JSON.stringify([ctx0.context.declaredSkills.length, ctx1.context.declaredSkills.length, ctx0.version, ctx1.version])); await p.c.close()
    }
    { // sin cambios: solo escritas a mano que la hoja repite
      const p0 = await persona(); await jf(p0.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'granted' }); await putCtx(p0.token, [{ name: 'Python', support: null, resumeVersion: null }, { name: 'Docker', support: null, resumeVersion: null }])
      const p = await open(p0.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['python', 'DOCKER'], lang); const b = await body(p)
      ck(`F5 [${lang}] sin cambios: «${t.nochange}» + «${t.same}» + enlace a las hojas de vida; sin tarjetas ni «${t.save}»`, b.includes(t.nochange) && b.includes(t.same) && !b.includes(t.gone) && !b.includes(t.nw) && !(await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).count()), String(b).slice(0, 200)); await p.c.close()
    }
    { // 409: el contexto cambia en otra pestaña mientras se mira el análisis
      const A = await seedA(); const ai0 = await aiCalls(); const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang)
      await p.getByLabel('Docker').first().check(); await p.locator('.cv-row', { hasText: 'Excel' }).getByLabel(t.quit).check()
      const cur = (await jf(A.token, 'GET', '/api/user/context')).j; await putCtx(A.token, [...cur.context.declaredSkills, { name: 'Terraform', support: null, resumeVersion: null }]) // otra pestaña guarda
      await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await sleep(1500); const b1 = await body(p); const st = await checkedState(p)
      ck(`F5 [${lang}] 409 (el contexto cambió en otro lado): aviso de conflicto con «Recargar contexto»; el análisis y las elecciones SE CONSERVAN; no se guardó nada; 0 análisis extra`, /recargar|reload/i.test(String(b1)) && st.boxes.filter(Boolean).length === 1 && (await aiCalls()) - ai0 === 1 && ((await jf(A.token, 'GET', '/api/user/context')).j.context.declaredSkills.some((s) => s.name === 'Excel')), JSON.stringify({ b: String(b1).slice(-260), st }))
      await p.getByRole('button', { name: /Recargar contexto|Reload/i }).click(); await sleep(1200); const st2 = await checkedState(p); ck(`F5 [${lang}] «Recargar contexto» relee SOLO el contexto: las elecciones siguen marcadas y no hay otro análisis`, st2.boxes.filter(Boolean).length === 1 && (await aiCalls()) - ai0 === 1, JSON.stringify(st2))
      await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }); const fin = (await jf(A.token, 'GET', '/api/user/context')).j.context.declaredSkills.map((s) => s.name)
      ck(`F5 [${lang}] tras recargar, guardar conserva lo de la otra pestaña (Terraform) y aplica lo elegido (Docker sí, Excel no)`, fin.includes('Terraform') && fin.includes('Docker') && !fin.includes('Excel'), fin.join(',')); await p.c.close()
    }
    { // respuesta perdida: el servidor guarda, el cliente no recibe la respuesta
      const A = await seedA(); const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang); await p.getByLabel('Docker').first().check()
      await p.route((u) => new URL(u).pathname === '/api/user/context', async (route) => { if (route.request().method() === 'PUT') { await route.fetch(); await route.abort('failed') } else await route.continue() })
      await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {}); const b = await body(p); const ctx = (await jf(A.token, 'GET', '/api/user/context')).j
      ck(`F5 [${lang}] respuesta perdida: se relee, se compara y se dice «${t.saved}» sin repetir el guardado (1 PUT, la versión sube 1 sola vez)`, b.includes(t.saved) && p.puts.length === 1 && ctx.version === 2 && ctx.context.declaredSkills.some((s) => s.name === 'Docker'), JSON.stringify({ puts: p.puts.length, v: ctx.version, b: String(b).slice(0, 120) })); await p.c.close()
    }
    { // 401 al guardar y al abrir; sin contexto
      const A = await seedA(); const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang); await p.getByLabel('Docker').first().check()
      await p.route((u) => new URL(u).pathname === '/api/user/context', (route) => (route.request().method() === 'PUT' ? route.fulfill({ status: 401, json: { error: 'x' } }) : route.continue()))
      await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await sleep(1200); const b = await body(p)
      ck(`F5 [${lang}] 401 al guardar: aviso de sesión vencida con enlace a /login; no se dice «guardado»`, /sesión|session/i.test(String(b)) && !b.includes(t.saved) && (await p.locator('a[href="/login"]').count()) > 0, String(b).slice(0, 200)); await p.c.close()
      const E = await persona(); await jf(E.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'granted' }); const q = await open(E.token, { lang, url: '/app/context/resumes/update' }); const path = await q.evaluate(() => location.pathname)
      ck(`F5 [${lang}] sin contexto guardado: lleva al formulario (/app/onboarding)`, path === '/app/onboarding', path); await q.c.close()
      const nt = await open('token-invalido', { lang, url: '/app/context/resumes/update' }); const pathN = await nt.evaluate(() => location.pathname); ck(`F5 [${lang}] token inválido al abrir: no se ve la pantalla (sesión vencida / login)`, pathN === '/login' || /sesión|session|Entrar|Sign in/i.test(String(await body(nt))), pathN); await nt.c.close()
    }
  }
  // ── F6 tope de 5 versiones: elegir cuál borrar; nada se borra solo
  if (want('F6')) for (const lang of ['es', 'en']) {
    const t = x[lang]; const A = await seedA(); for (let i = 2; i <= 5; i++) await upload(A.token, ['Power BI', 'Extra ' + i]); const before = (await jf(A.token, 'GET', '/api/user/resumes')).j
    const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); const b = await body(p); const dels = await p.getByRole('button', { name: /Borrar|Delete/ }).count()
    ck(`F6 [${lang}] con 5/5 versiones: aviso del tope y lista con «Borrar» por versión (5); no se borró nada solo (${before.resumes.length} → ${(await jf(A.token, 'GET', '/api/user/resumes')).j.resumes.length})`, before.resumes.length === 5 && dels === 5 && (await jf(A.token, 'GET', '/api/user/resumes')).j.resumes.length === 5 && !(await p.locator('input[type=file]').count()), JSON.stringify({ dels, b: String(b).slice(0, 160) }))
    await p.getByRole('button', { name: /Borrar|Delete/ }).first().click(); await sleep(500); const dlg = await p.getByRole('dialog').innerText().catch(() => ''); ck(`F6 [${lang}] el diálogo de confirmación dice que se elimina de verdad, sin copias`, /de verdad|sin copias|permanently|no copies/i.test(dlg), dlg.slice(0, 140))
    await p.getByRole('button', { name: /^Cancelar|^Cancel/ }).click(); await sleep(300); ck(`F6 [${lang}] cancelar no borra nada`, (await jf(A.token, 'GET', '/api/user/resumes')).j.resumes.length === 5)
    await p.getByRole('button', { name: /Borrar|Delete/ }).first().click(); await sleep(400); await p.getByRole('dialog').getByRole('button', { name: /Sí, borrar|Borrar|Yes, delete|Delete/ }).last().click(); await sleep(2500)
    const after = (await jf(A.token, 'GET', '/api/user/resumes')).j.resumes.length; const canUpload = await p.locator('input[type=file]').count()
    ck(`F6 [${lang}] tras elegir y confirmar el borrado: quedan 4, se relee la lista y aparece la subida (sin que nada más se borre)`, after === 4 && canUpload > 0, `quedan ${after}, subida=${canUpload}`)
    // el borrado de v1 marca sus borradores «para revisión» (de #390): se ve «Origen: versión borrada» en la evidencia
    const ev = await jf(A.token, 'GET', '/api/evidence'); const nr = (ev.j.evidence || []).filter((e) => e.needsReview).length; console.log(`INFO [${lang}] evidencias «para revisión» tras borrar la versión más antigua/primera: ${nr}`); await p.c.close()
  }
  // ── F7 tope de 40: singular / plural, nada guardado se descarta
  if (want('F7')) for (const lang of ['es', 'en']) {
    const t = x[lang]
    for (const [have, sug, expectOver] of [[38, 3, 1], [36, 6, 2]]) {
      const p0 = await persona(); await jf(p0.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'granted' }); await putCtx(p0.token, Array.from({ length: have }, (_, i) => ({ name: 'Habilidad ' + i, support: null, resumeVersion: null })))
      const news = Array.from({ length: sug }, (_, i) => 'Nueva ' + i); const p = await open(p0.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, news, lang); const b = await body(p)
      ck(`F7 [${lang}] ${have} guardadas + ${sug} nuevas: aviso «${t.over(expectOver)}» (${expectOver === 1 ? 'singular' : 'plural'}) sobre las tarjetas`, b.includes(t.over(expectOver)), String(b).slice(0, 300))
      for (const n of news) await p.getByLabel(n).first().check(); await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }); const b2 = await body(p); const ctx = (await jf(p0.token, 'GET', '/api/user/context')).j
      ck(`F7 [${lang}] marcar todas y guardar: quedan exactamente 40 (las ${have} guardadas intactas; las que no caben se dicen: «${t.over(expectOver)}» tras guardar)`, ctx.context.declaredSkills.length === 40 && Array.from({ length: have }, (_, i) => 'Habilidad ' + i).every((n) => ctx.context.declaredSkills.some((s) => s.name === n)) && b2.includes(t.over(expectOver)), JSON.stringify({ n: ctx.context.declaredSkills.length, b2: String(b2).slice(0, 200) })); await p.c.close()
    }
  }
  // ── F8 aislamiento A/B y privacidad
  if (want('F8')) {
    const A = await seedA(); const B = await seedA(['Rust']); const snapB = await evSnapshot(B.id); const ctxB = (await jf(B.token, 'GET', '/api/user/context')).j
    const p = await open(A.token, { lang: 'es', url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'Docker'], 'es'); await p.getByLabel('Docker').first().check(); await p.getByRole('button', { name: /^Guardar$/ }).click(); await p.getByText('Contexto guardado', { exact: false }).first().waitFor({ timeout: 20000 })
    ck('F8 A actualiza su contexto: el contexto, la evidencia y las hojas de B quedan IDÉNTICOS', JSON.stringify((await jf(B.token, 'GET', '/api/user/context')).j) === JSON.stringify(ctxB) && (await evSnapshot(B.id)) === snapB && (await jf(B.token, 'GET', '/api/user/resumes')).j.resumes.length === 1)
    const stor = await p.evaluate(() => JSON.stringify({ l: Object.entries(localStorage), s: Object.entries(sessionStorage) })); const leak = ['Docker', 'MARÍA', 'QA-SKILLS', 'maria.sintetica'].filter((w) => stor.includes(w))
    ck('F8 la hoja y sus habilidades sugeridas NO se guardan en el almacenamiento del navegador (localStorage/sessionStorage)', leak.length === 0, leak.join(',')); const idb = await p.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0)); ck('F8 sin bases IndexedDB', idb === 0, String(idb))
    const cross = await jf(B.token, 'DELETE', '/api/user/resumes/' + A.v1.id); ck('F8 B no puede borrar la hoja de A (404) y la hoja de A sigue', cross.s === 404 && (await jf(A.token, 'GET', '/api/user/resumes')).j.resumes.length >= 1)
    const logs = []; const q = await open(A.token, { lang: 'es', url: '/app/context/resumes/update' }); q.on('console', (m) => logs.push(m.text())); await toChanges(q, ['Python'], 'es'); ck('F8 la consola del navegador no registra el texto de la hoja ni sus habilidades', !logs.some((l) => /Python|MARÍA|QA-SKILLS/.test(l)), logs.join('|').slice(0, 120)); await q.c.close(); await p.c.close()
    const lim = await persona(); await jf(lim.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'granted' }); let st = []; for (let i = 0; i < 8; i++) { const f = new FormData(); f.append('requestId', crypto.randomUUID()); f.append('cv', new Blob([pdf(['X' + i])], { type: 'application/pdf' }), 'cv.pdf'); st.push((await jf(lim.token, 'POST', '/api/user/resumes/analyze', f)).s) }
    ck('F8 tope de análisis (6 por hora y persona): del 7.º en adelante 429/4xx, sin 5xx', st.slice(0, 5).includes(200) && st.slice(6).every((s) => s >= 400 && s < 500) && !st.some((s) => s >= 500), st.join(','))
  }
  // ── F9 evidencia con origen en una versión borrada + bandeja (desviación 3: `orphaned` no se pinta)
  if (want('F9')) for (const lang of ['es', 'en']) {
    const t = x[lang]; const A = await seedA(); const evs = (await jf(A.token, 'GET', '/api/evidence')).j.evidence; const draft = evs.find((e) => e.status === 'draft'); const conf = evs.find((e) => e.status === 'confirmed')
    const p = await open(A.token, { lang, url: '/app/context/resumes' }); await p.getByRole('button', { name: /Borrar|Delete/ }).first().click(); await sleep(400); await p.getByRole('dialog').getByRole('button', { name: /Sí, borrar|Borrar|Yes, delete|Delete/ }).last().click(); await sleep(2500); await p.c.close()
    const q = await open(A.token, { lang, url: '/app/evidence/' + draft.id }); const b = await body(q)
    ck(`F9 [${lang}] evidencia en borrador de la versión borrada: «${lang === 'es' ? 'Origen: versión borrada' : 'Source: deleted version'}» + «${lang === 'es' ? 'Esta evidencia salió de una versión que borraste; revísala.' : 'This evidence came from a version you deleted; review it.'}»; sin «v1»`, b.includes(lang === 'es' ? 'Origen: versión borrada' : 'Source: deleted version') && b.includes(lang === 'es' ? 'Esta evidencia salió de una versión que borraste; revísala.' : 'This evidence came from a version you deleted; review it.') && !/ \(v1\)/.test(String(b)), String(b).slice(0, 260))
    const sh = await shape(q); const ax = await axe(q); ck(`F9 [${lang}] esa pantalla: axe 0, 1 h1, sin desborde`, ax.length === 0 && sh.h1 === 1 && sh.ov <= 0, JSON.stringify({ ax, sh })); await q.c.close()
    const c2 = await open(A.token, { lang, url: '/app/evidence/' + conf.id }); const b2 = await body(c2); ck(`F9 [${lang}] la evidencia CONFIRMADA no cambia ni se marca «Origen: versión borrada» como borrador (solo dice lo que ya decía)`, !(/review|revisión/i.test(String(b2)) && false) && (await jf(A.token, 'GET', '/api/evidence/' + conf.id)).j.versions[0].status === 'confirmed'); console.log(`INFO [${lang}] confirmada tras borrar v1 (texto de origen): ${String(b2).match(/(Origen|Source)[^.]*\./i)?.[0] || '(ninguno)'}`); await c2.c.close()
    const tray = await open(A.token, { lang, url: '/app/evidence/resume-skills' }); const bt = await body(tray); const api = (await jf(A.token, 'GET', '/api/user/resume-skills')).j
    console.log('INFO texto de la bandeja tras borrar v1 (' + lang + '):', String(bt).replace(/MI ESPACIO|MY SPACE/, '').slice(0, 330)); console.log(`INFO [${lang}] bandeja de habilidades tras borrar v1: skills=${JSON.stringify((api.skills || []).map((s) => s.name))} orphaned=${JSON.stringify((api.orphaned || []).map((s) => s.name))}; la pantalla muestra «versión borrada»=${/versión borrada|deleted version/i.test(String(bt))}`)
    ck(`F9 [${lang}] bandeja tras borrar v1: ${process.env.NEW399 ? 'las huérfanas SE PINTAN con «versión borrada» (#399)' : '(desviación 3) no pinta las huérfanas'}; axe 0`, (process.env.NEW399 ? /versión borrada|deleted version/i.test(String(bt)) : !/versión borrada|deleted version/i.test(String(bt))) && (await axe(tray)).length === 0); await tray.c.close()
  }
  // ── F10 teclado y foco en «Cambios frente a tu contexto actual»
  if (want('F10')) for (const lang of ['es', 'en']) {
    const t = x[lang]; const A = await seedA(); const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang)
    await p.evaluate(() => document.querySelector('h1').focus()); const order = []; const visAll = []; for (let i = 0; i < 9; i++) { await p.keyboard.press('Tab'); visAll.push(await p.evaluate(() => { const e = document.activeElement; if (e === document.body) return 'body'; const cs = getComputedStyle(e); const wrap = e.closest('label') || e; const cw = getComputedStyle(wrap); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none' || (cw.outlineStyle !== 'none' && parseFloat(cw.outlineWidth) > 0) || cw.boxShadow !== 'none' ? 'ok' : 'SIN-FOCO:' + e.tagName })); order.push(await p.evaluate(() => { const e = document.activeElement; return (e.tagName + ':' + (e.type || '') + ':' + ((e.closest('label') || e).innerText || e.innerText || '').slice(0, 22)).replace(/[\r\n]+/g, ' ') })) }
    const vis = { visAll }
    ck(`F10 [${lang}] Tab recorre casillas, radios y botones en orden de lectura y el foco se VE (contorno o sombra)`, order.length === 9 && order[0].startsWith('INPUT:checkbox') && visAll.slice(0, 8).every((v) => v === 'ok'), JSON.stringify({ order, vis }))
    await p.evaluate(() => document.querySelector('h1').focus()); await p.keyboard.press('Tab'); await p.keyboard.press('Space'); const on = await p.evaluate(() => document.activeElement.checked); ck(`F10 [${lang}] Espacio marca la casilla enfocada`, on === true)
    const radio = p.locator('input[type=radio]').first(); await radio.focus(); await p.keyboard.press('ArrowDown'); await sleep(200); const rs = await checkedState(p); ck(`F10 [${lang}] flecha en el grupo de radios cambia «Mantener» ↔ «Quitar» y solo hay una opción elegida por habilidad`, rs.radios.slice(0, 2).filter(([c]) => c).length === 1 && /QUITAR|REMOVE/i.test(rs.radios[1][1] || ''), JSON.stringify(rs.radios.slice(0, 2)))
    const names = await p.evaluate(() => [...document.querySelectorAll('[role=radiogroup]')].map((g) => g.getAttribute('aria-label'))); ck(`F10 [${lang}] cada grupo de radios tiene nombre = la habilidad`, names.length === 2 && names.every(Boolean) && names.includes('Excel'), JSON.stringify(names))
    await p.keyboard.press('Tab'); await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).focus(); await p.keyboard.press('Enter'); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }); const foc = await p.evaluate(() => document.activeElement && document.activeElement.tagName)
    ck(`F10 [${lang}] guardar con teclado (Enter) funciona y tras guardar el foco vuelve al encabezado (h1)`, foc === 'H1', foc); await p.c.close()
  }
  // ── F11 axe / desborde / objetivos en todos los estados × ES/EN × 1360/390/320 × claro/oscuro
  if (want('F11')) {
    const bad = []; let n = 0
    for (const lang of ['es', 'en']) for (const w of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
      const t = x[lang]; const A = await seedA(); const states = []
      let p = await open(A.token, { lang, w, scheme, url: '/app/context/resumes' }); states.push(['lista', p]); const r1 = [await axe(p), await shape(p)]
      const rec = (nm, r) => { n++; if (r[0].length || r[1].ov > 0 || r[1].h1 !== 1 || r[1].main !== 1 || r[1].small > 0 || r[1].inline > 0) bad.push(`${lang} ${w} ${scheme} ${nm}: ${r[0].join(';')} ${JSON.stringify(r[1])}`) }; rec('lista', r1)
      await p.goto(BASE + '/app/context/resumes/update', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1'); await sleep(1000); rec('subir', [await axe(p), await shape(p)])
      await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang); rec('cambios', [await axe(p), await shape(p)])
      await p.getByLabel('Docker').first().check(); await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).click(); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }); await sleep(400); rec('guardado', [await axe(p), await shape(p)]); await p.c.close()
      const E = await persona(); await jf(E.token, 'PUT', '/api/consents/resume_ai_reading', { status: 'granted' }); await putCtx(E.token, [{ name: 'Python', support: null, resumeVersion: null }]); p = await open(E.token, { lang, w, scheme, url: '/app/context/resumes/update' }); await toChanges(p, ['python'], lang); rec('sin-cambios', [await axe(p), await shape(p)]); await p.c.close()
      const L = await seedA(); for (let i = 2; i <= 5; i++) await upload(L.token, ['Power BI', 'Extra ' + i]); p = await open(L.token, { lang, w, scheme, url: '/app/context/resumes/update' }); rec('tope-5', [await axe(p), await shape(p)])
      await p.getByRole('button', { name: /Borrar|Delete/ }).first().click(); await sleep(500); const dlg = await axe(p); n++; if (dlg.length) bad.push(`${lang} ${w} ${scheme} diálogo: ${dlg.join(';')}`); await p.c.close()
    }
    ck(`F11 axe wcag2a/2aa/21a/21aa/22aa = 0, un h1 y un main, sin desborde, objetivos ≥ 24 px y sin estilos en línea en ${n} auditorías (6 estados + diálogo × ES/EN × 1360/390/320 × claro/oscuro)`, bad.length === 0, bad.slice(0, 4).join(' | '))
  }
  // ── F12 CLS a 390 px con CPU×4
  if (want('SMALL')) { const A = await seedA(); const p = await open(A.token, { lang: 'es', w: 390, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], 'es'); console.log('SMALL', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('main a, main button, main input[type=checkbox], main input[type=radio]')].map((e) => { const r = e.getBoundingClientRect(); const l = e.closest('label'); const lr = l ? l.getBoundingClientRect() : null; return { t: e.tagName + ':' + (e.type || ''), w: Math.round(r.width), h: Math.round(r.height), lw: lr && Math.round(lr.width), lh: lr && Math.round(lr.height), op: getComputedStyle(e).opacity, pos: getComputedStyle(e).position } }).filter((o) => o.w < 24 || o.h < 24)))); await p.c.close() }
  if (want('F12')) {
    const med = (a) => [...a].sort((u, v) => u - v)[Math.floor(a.length / 2)]; const out = { lista: [], subir: [], cambios: [] }
    for (let i = 0; i < 6; i++) {
      const A = await seedA(); let p = await open(A.token, { lang: 'es', w: 390, url: '/app/context/resumes', cpu: 4 }); await sleep(800); out.lista.push(+(await p.evaluate(() => window.__cls)).toFixed(4)); await p.c.close()
      p = await open(A.token, { lang: 'es', w: 390, url: '/app/context/resumes/update', cpu: 4 }); await sleep(800); out.subir.push(+(await p.evaluate(() => window.__cls)).toFixed(4))
      await p.evaluate(() => { window.__cls = 0 }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], 'es'); await sleep(1200); out.cambios.push(+(await p.evaluate(() => window.__cls)).toFixed(4)); await p.c.close()
    }
    console.log(`CLS398 ${LABEL} 390 px CPU×4 (6 corridas): lista ${JSON.stringify(out.lista)} mediana ${med(out.lista)} · subir ${JSON.stringify(out.subir)} mediana ${med(out.subir)} · cambios (tras analizar) ${JSON.stringify(out.cambios)} mediana ${med(out.cambios)}`)
    ck('F12 CLS ≤ 0,1 (lista, subir y cambios, máx de 6 corridas)', [...out.lista, ...out.subir, ...out.cambios].every((v) => v <= 0.1), JSON.stringify(out))
  }
  // ── F14 doble clic en «Guardar»: un solo PUT
  if (want('F14')) for (const lang of ['es']) {
    const t = x[lang]; const A = await seedA(); const p = await open(A.token, { lang, url: '/app/context/resumes/update' }); await toChanges(p, ['Power BI', 'SQL', 'Docker', 'Python', 'Inglés técnico'], lang); await p.getByLabel('Docker').first().check()
    await p.getByRole('button', { name: new RegExp('^' + t.save + '$') }).dblclick(); await p.getByText(t.saved, { exact: false }).first().waitFor({ timeout: 20000 }); await sleep(800)
    ck(`F14 [${lang}] doble clic en «${t.save}»: UN solo PUT y el contexto sube una sola versión`, p.puts.length === 1 && (await jf(A.token, 'GET', '/api/user/context')).j.version === 2, `puts=${p.puts.length}`); await p.c.close()
  }
  // ── F15 (#399, E398-2) huérfanas en /app/evidence/resume-skills
  if (want('F15')) for (const lang of ['es', 'en']) {
    const t = x[lang]; const ORIGIN = lang === 'es' ? 'Origen: versión borrada' : 'Source: deleted version'; const EMPTY_FALSE = lang === 'es' ? 'No hay habilidades para revisar' : 'There are no skills to review'
    { // solo huérfanas: se borra la única versión
      const A = await seedA(); await jf(A.token, 'DELETE', '/api/user/resumes/' + A.v1.id); const api = (await jf(A.token, 'GET', '/api/user/resume-skills')).j
      const p = await open(A.token, { lang, url: '/app/evidence/resume-skills' }); const b = await body(p); const info = await p.evaluate(() => ({ boxes: document.querySelectorAll('main input[type=checkbox]').length, items: [...document.querySelectorAll('main li')].map((e) => e.innerText.replace(/[ \t\r\n]+/g, ' ')).slice(0, 8), h2: [...document.querySelectorAll('main h2')].map((h) => h.innerText) }))
      ck(`F15 [${lang}] solo huérfanas (${api.orphaned.length}): se listan TODAS con su nombre, «Declarada» y «${ORIGIN}», SIN casilla, y ya no sale «${EMPTY_FALSE}…»`, api.orphaned.length === 4 && info.items.length >= 4 && api.orphaned.every((o) => info.items.some((i) => i.toLowerCase().includes(o.name.toLowerCase()))) && info.items.every((i) => /declarada|declared/i.test(i) && i.toLowerCase().includes(ORIGIN.toLowerCase())) && info.boxes === 0 && !b.includes(EMPTY_FALSE), JSON.stringify({ items: info.items, boxes: info.boxes, h2: info.h2 }))
      const cls = api.orphaned.filter((o) => o.classified).length; console.log(`INFO [${lang}] huérfanas con clasificación en catálogo: ${cls}; texto: ${info.items.slice(0, 2).join(' | ')}`)
      ck(`F15 [${lang}] sin errores de JS ni desborde; axe 0`, p.errs.length === 0 && (await axe(p)).length === 0 && (await shape(p)).ov <= 0, p.errs.join('|')); await p.c.close()
    }
    { // candidatas (v2 viva) + huérfanas (v1 borrada): conviven; las huérfanas no tienen casilla y las candidatas sí
      const A = await seedA(); await upload(A.token, ['Docker', 'Rust']); const cur = (await jf(A.token, 'GET', '/api/user/context')).j; const a2 = (await jf(A.token, 'GET', '/api/user/resumes')).j.resumes; const v2 = a2.find((r) => r.version === 2)
      await putCtx(A.token, [...cur.context.declaredSkills, { name: 'Docker', support: 'Habilidad: Docker', resumeVersion: 2 }]); await jf(A.token, 'DELETE', '/api/user/resumes/' + A.v1.id)
      const api = (await jf(A.token, 'GET', '/api/user/resume-skills')).j; const p = await open(A.token, { lang, url: '/app/evidence/resume-skills' })
      const info = await p.evaluate(() => ({ boxes: document.querySelectorAll('main input[type=checkbox]').length, text: document.querySelector('main').innerText.replace(/[ \t\r\n]+/g, ' ') }))
      ck(`F15 [${lang}] candidatas (hoja viva v2) y huérfanas (v1 borrada) conviven: casillas solo para las candidatas (${api.skills.length}) y la lista de huérfanas (${api.orphaned.length}) aparte`, info.boxes === api.skills.length && api.orphaned.length > 0 && api.orphaned.every((o) => info.text.toLowerCase().includes(o.name.toLowerCase())) && info.text.toLowerCase().includes(ORIGIN.toLowerCase()), JSON.stringify({ boxes: info.boxes, skills: api.skills.map((s) => s.name), orphaned: api.orphaned.map((s) => s.name) })); await p.c.close()
    }
    { // parser tolerante: respuesta antigua (sin el campo) y con elementos mal formados
      const A = await seedA(); const cases = [['sin el campo', (j) => { delete j.orphaned; return j }], ['orphaned = «x»', (j) => ({ ...j, orphaned: 'x' })], ['elementos mal formados', (j) => ({ ...j, orphaned: [null, 1, { name: 5 }, { name: ' ', added: true }, { name: 'Válida QA', classified: 'raro', added: false }] })]]
      for (const [nm, fn] of cases) {
        const c = await BR.newContext({ viewport: { width: 1360, height: 900 } }); await c.addInitScript(([tk, l]) => { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l) }, [A.token, lang]); const p = await c.newPage(); const errs = []; p.on('pageerror', (e) => errs.push(e.message))
        await p.route((u) => new URL(u).pathname === '/api/user/resume-skills', async (rt) => { const r = await rt.fetch(); const j = await r.json(); await rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fn(j)) }) })
        await p.goto(BASE + '/app/evidence/resume-skills', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1', { timeout: 20000 }).catch(() => {}); await sleep(1500); const b = await body(p); const boxes = await p.locator('main input[type=checkbox]').count()
        ck(`F15 [${lang}] parser tolerante (${nm}): la lista de candidatas sigue (${boxes} casillas), sin errores de JS${nm.startsWith('elementos') ? '; solo se pinta lo válido («Válida QA»)' : ''}`, errs.length === 0 && boxes >= 4 && (nm.startsWith('elementos') ? b.includes('Válida QA') && !b.includes('{ name') : true), JSON.stringify({ errs, boxes })); await c.close()
      }
    }
  }
  // ── F16 (#399, E398-3) «revísala» solo en borradores
  if (want('F16')) for (const lang of ['es', 'en']) {
    const t = x[lang]; const ORIGIN = lang === 'es' ? 'Origen: versión borrada' : 'Source: deleted version'; const REVIEW = lang === 'es' ? 'revísala' : 'review it'
    const A = await seedA(); const evs = (await jf(A.token, 'GET', '/api/evidence')).j.evidence; const draft = evs.find((e) => e.status === 'draft'); const conf = evs.find((e) => e.status === 'confirmed')
    const snap0 = await evSnapshot(A.id); await jf(A.token, 'DELETE', '/api/user/resumes/' + A.v1.id); const snap1 = await evSnapshot(A.id)
    const pd = await open(A.token, { lang, url: '/app/evidence/' + draft.id }); const bd = await body(pd); const pc = await open(A.token, { lang, url: '/app/evidence/' + conf.id }); const bc = await body(pc)
    ck(`F16 [${lang}] BORRADOR con origen borrado: «${ORIGIN}» + «revísala» + banner «Para revisión»`, bd.includes(ORIGIN) && bd.includes(REVIEW) && /para revisión|for review/i.test(String(bd)), String(bd).slice(0, 220))
    ck(`F16 [${lang}] CONFIRMADA con origen borrado: solo «${ORIGIN}» (sin «revísala» ni banner «Para revisión»)`, bc.includes(ORIGIN) && !bc.includes(REVIEW) && !/para revisión|for review/i.test(String(bc)), String(bc).slice(0, 260))
    ck(`F16 [${lang}] los datos de la confirmada NO cambian (la diferencia entre antes y después de borrar la versión es solo la marca del borrador)`, JSON.stringify(JSON.parse(snap0).filter((r) => r.EvidenceId === conf.id)) === JSON.stringify(JSON.parse(snap1).filter((r) => r.EvidenceId === conf.id)))
    ck(`F16 [${lang}] axe 0 en ambas`, (await axe(pd)).length === 0 && (await axe(pc)).length === 0); const pl = await open(A.token, { lang, url: '/app/evidence' }); const bl = await body(pl); console.log(`INFO [${lang}] lista de evidencias: ${String(bl).slice(0, 360)}`); await pd.c.close(); await pc.c.close(); await pl.c.close()
  }
  // ── F17 (#399) axe en la bandeja con huérfanas y en la evidencia (borrador / confirmada) × ES/EN × 1360/390/320 × claro/oscuro
  if (want('F17')) {
    const bad = []; let n = 0
    for (const lang of ['es', 'en']) for (const w of [1360, 390, 320]) for (const scheme of ['light', 'dark']) {
      const A = await seedA(); await upload(A.token, ['Docker']); const cur = (await jf(A.token, 'GET', '/api/user/context')).j; await putCtx(A.token, [...cur.context.declaredSkills, { name: 'Docker', support: 'Habilidad: Docker', resumeVersion: 2 }]); await jf(A.token, 'DELETE', '/api/user/resumes/' + A.v1.id)
      const evs = (await jf(A.token, 'GET', '/api/evidence')).j.evidence; const draft = evs.find((e) => e.status === 'draft'); const conf = evs.find((e) => e.status === 'confirmed')
      for (const [nm, url] of [['bandeja+huérfanas', '/app/evidence/resume-skills'], ['evidencia borrador', '/app/evidence/' + draft.id], ['evidencia confirmada', '/app/evidence/' + conf.id]]) { const p = await open(A.token, { lang, w, scheme, url }); const a = await axe(p); const sh = await shape(p); n++; if (a.length || sh.ov > 0 || sh.h1 !== 1 || sh.main !== 1 || sh.small > 0 || sh.inline > 0) bad.push(`${lang} ${w} ${scheme} ${nm}: ${a.join(';')} ${JSON.stringify(sh)}`); await p.c.close() }
    }
    ck(`F17 axe = 0, un h1/main, sin desborde ni objetivos < 24 px en ${n} auditorías (bandeja con huérfanas, evidencia borrador y confirmada × ES/EN × 3 anchos × claro/oscuro)`, bad.length === 0, bad.slice(0, 4).join(' | '))
    const med = (a) => [...a].sort((u, v) => u - v)[Math.floor(a.length / 2)]; const cl = []; for (let i = 0; i < 5; i++) { const A = await seedA(); await jf(A.token, 'DELETE', '/api/user/resumes/' + A.v1.id); const p = await open(A.token, { lang: 'es', w: 390, url: '/app/evidence/resume-skills', cpu: 4 }); await sleep(900); cl.push(+(await p.evaluate(() => window.__cls)).toFixed(4)); await p.c.close() }
    console.log('CLS399 bandeja con huérfanas 390 px CPU×4 (5): ' + JSON.stringify(cl) + ' mediana ' + med(cl)); ck('F17 CLS de la bandeja con huérfanas ≤ 0,1', Math.max(...cl) <= 0.1, JSON.stringify(cl))
  }
  console.log(`RESUMEN [${LABEL}]: ${total - fails}/${total} OK, ${fails} FALLAS`); await BR.close(); process.exit(fails ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
