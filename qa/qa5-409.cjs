// [QA-Claude-5] PR #409 (E45-1 / ES-182): Manifiesto ético con versión en inglés (contentEn). Backend REAL (roles reales, PostgreSQL desechable) + build fresco + Chromium. Datos sintéticos, 0 IA.
// Uso: PLAYWRIGHT_MODULE=... AXE=... BASE=http://127.0.0.1:4402 API=http://127.0.0.1:8402 CRED=<cred409.json> DATABASE_URL=<pg> NODE_PATH=<backend/node_modules> node qa/qa5-409.cjs
const fs = require('fs'); const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const axeSource = fs.readFileSync(process.env.AXE, 'utf8'); const { Client } = require('pg')
const BASE = process.env.BASE, API = process.env.API, CRED = JSON.parse(fs.readFileSync(process.env.CRED, 'utf8'))
let ok = 0, bad = 0; const check = (l, c, ev) => { if (c) { ok++; console.log('OK    ' + l) } else { bad++; console.log('FALLA ' + l + (ev !== undefined ? ' · ' + String(ev).slice(0, 400) : '')) } }
const ES = 'Manifiesto sintético de prueba en español: la IA no sustituye a una persona profesional y respeta tu decisión en todo momento.'
const EN = 'Synthetic test manifesto in English: the AI does not replace a professional and respects your decision at all times.'
const login = async (email) => (await (await fetch(API + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: CRED.pass }) })).json())
let SUP, PER
const call = async (tok, m, p, b) => { const r = await fetch(API + p, { method: m, headers: { 'content-type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok.token } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json() } catch {} return { status: r.status, body: j } }
const open = async (br, { lang = 'es', width = 1360, scheme = 'light', who = SUP } = {}) => {
  const ctx = await br.newContext({ viewport: { width, height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message))
  await page.addInitScript(([tk, role, l]) => { if (tk) { localStorage.setItem('elevation_token', tk); localStorage.setItem('elevation_role', role) } localStorage.setItem('elv_lang', l); localStorage.setItem('elevation_name', 'Super Sintetica') }, [who && who.token, who && (who.role || 'superadmin'), lang])
  return { ctx, page, errs }
}
const axe = (page) => page.addScriptTag({ content: axeSource }).then(() => page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } }).then((r) => r.violations.map((x) => x.id + ':' + x.nodes.length + ' ' + (x.nodes[0] && x.nodes[0].target.join(' '))))))
const pub = async (br, lang, width, scheme) => { const { ctx, page, errs } = await open(br, { lang, width, scheme, who: null }); await page.goto(BASE + '/manifiesto'); await page.waitForSelector('.manifesto__body', { timeout: 20000 }); await page.waitForTimeout(600)
  const s = await page.evaluate(() => ({ body: document.querySelector('.manifesto__body').innerText, lang: document.querySelector('.manifesto__body').getAttribute('lang'), banners: [...document.querySelectorAll('.cg-banner')].map((b) => b.innerText.trim()), ox: document.documentElement.scrollWidth > innerWidth + 1 })); return { ...s, errs, page, ctx } }
;(async () => {
  SUP = await login(CRED.super); PER = await login(CRED.persona)
  const br = await chromium.launch(); const db = new Client({ connectionString: process.env.DATABASE_URL }); await db.connect()
  // ── API real
  const noRole = await call(PER, 'POST', '/api/board/manifest', { content: ES, contentEn: EN }); check('API: una persona (rol user) no puede publicar (403)', noRole.status === 403, noRole.status)
  const anon = await call(null, 'GET', '/api/manifest/active'); check('API: sin manifiesto publicado, la lectura pública no falla (200/404, nunca 5xx)', anon.status < 500, anon.status + JSON.stringify(anon.body).slice(0, 80))
  const v1 = await call(SUP, 'POST', '/api/board/manifest', { content: ES, note: 'solo español' }); check('API: publicar SOLO en español sigue funcionando (compatibilidad) → 2xx', v1.status < 300, v1.status + JSON.stringify(v1.body).slice(0, 120))
  const a1 = await call(null, 'GET', '/api/manifest/active'); check('API: lectura pública de una versión sin inglés → contentEn = null', a1.status === 200 && a1.body.contentEn === null && a1.body.content === ES, JSON.stringify(a1.body).slice(0, 200))
  for (const [label, body] of [['49 caracteres', 'x'.repeat(49)], ['solo espacios más 10 letras', '   ' + 'x'.repeat(10) + '   ']]) { const r = await call(SUP, 'POST', '/api/board/manifest', { content: ES, contentEn: body }); check(`API: contentEn de ${label} → 400 invalid_input (campo contentEn)`, r.status === 400 && r.body.code === 'invalid_input' && r.body.field === 'contentEn', r.status + JSON.stringify(r.body).slice(0, 160)) }
  for (const [label, val] of [['número', 5], ['arreglo', ['a']], ['objeto', { a: 1 }], ['booleano', true]]) { const r = await call(SUP, 'POST', '/api/board/manifest', { content: ES, contentEn: val }); check(`API: contentEn tipo ${label} → 400, no 500`, r.status === 400, r.status + JSON.stringify(r.body).slice(0, 120)) }
  const cnt = Number((await db.query('SELECT count(*) n FROM "EthicManifests"')).rows[0].n); check('API: los rechazos no dejaron versiones nuevas (1 en total)', cnt === 1, cnt)
  const blank = await call(SUP, 'POST', '/api/board/manifest', { content: ES + ' (v2)', contentEn: '      ' }); const a2 = await call(null, 'GET', '/api/manifest/active'); check('API: contentEn solo con espacios = ausente (2xx y null)', blank.status < 300 && a2.body.contentEn === null, blank.status + ' ' + JSON.stringify(a2.body).slice(0, 120))
  const v3 = await call(SUP, 'POST', '/api/board/manifest', { content: ES + ' (v3)', contentEn: '   ' + EN + '   ', note: 'con inglés' }); check('API: publicar con inglés → 2xx', v3.status < 300, v3.status + JSON.stringify(v3.body).slice(0, 120))
  const a3 = await call(null, 'GET', '/api/manifest/active'); check('API: lectura pública devuelve contentEn recortado', a3.status === 200 && a3.body.contentEn === EN && a3.body.content === ES + ' (v3)', JSON.stringify(a3.body).slice(0, 220))
  check('API: la lectura pública no filtra nota ni autor', !JSON.stringify(a3.body).includes('con inglés') && !('uploader' in a3.body) && !('note' in a3.body), Object.keys(a3.body).join(','))
  const raw = (await db.query('SELECT "contentEn", content FROM "EthicManifests" ORDER BY id DESC LIMIT 1')).rows[0]; check('Base: contentEn y content están cifrados en reposo (el texto plano no aparece)', raw.contentEn && !raw.contentEn.includes('Synthetic test') && !raw.content.includes('Manifiesto sintético'), String(raw.contentEn).slice(0, 40))
  const hist = await call(SUP, 'GET', '/api/board/manifest'); const rows = Array.isArray(hist.body) ? hist.body : (hist.body && hist.body.versions) || []; check('API: el historial del editor trae contentEn por versión (EN solo en la última)', rows.length === 3 && rows.filter((r) => r.contentEn).length === 1 && rows.find((r) => r.contentEn).contentEn === EN, hist.status + ' ' + rows.length)
  const histPer = await call(PER, 'GET', '/api/board/manifest'); check('API: el historial sigue cerrado a una persona (403)', histPer.status === 403, histPer.status)
  // reactivar la versión 1 (sin inglés) y volver a la 3: contentEn sigue a su versión
  const list = rows.slice().sort((a, b) => a.id - b.id); const react = await call(SUP, 'PUT', `/api/board/manifest/${list[0].id}/activate`); const a4 = await call(null, 'GET', '/api/manifest/active')
  check('API: reactivar la versión sin inglés → la lectura pública vuelve a contentEn = null (no se arrastra el inglés de otra versión)', react.status < 300 && a4.body.contentEn === null && a4.body.content === ES, react.status + ' ' + JSON.stringify(a4.body).slice(0, 160))
  if (react.status < 300) await call(SUP, 'PUT', `/api/board/manifest/${list[2].id}/activate`)
  const a5 = await call(null, 'GET', '/api/manifest/active'); check('API: versión activa final = v3 con inglés', a5.body.contentEn === EN, JSON.stringify(a5.body).slice(0, 120))
  // ── UI pública con la versión CON inglés
  for (const lang of ['es', 'en']) { const s = await pub(br, lang, 1360, 'light')
    check(`[${lang}] /manifiesto con inglés: cuerpo en ${lang === 'en' ? 'inglés' : 'español'}, sin aviso, sin lang="es" forzado, sin errores`, (lang === 'en' ? s.body.includes('Synthetic test manifesto') && !s.body.includes('Manifiesto sintético') : s.body.includes('Manifiesto sintético') && !s.body.includes('Synthetic')) && s.banners.length === 0 && s.lang !== 'es' && s.errs.length === 0, JSON.stringify({ lang: s.lang, banners: s.banners, head: s.body.slice(0, 60), errs: s.errs })); await s.ctx.close() }
  // ── activar la versión SIN inglés y revisar el respaldo
  await call(SUP, 'PUT', `/api/board/manifest/${list[0].id}/activate`)
  for (const lang of ['es', 'en']) { const s = await pub(br, lang, 1360, 'light')
    if (lang === 'en') check('[en] sin inglés: se muestra el español CON aviso visible y lang="es" en el cuerpo', s.body.includes('Manifiesto sintético') && s.lang === 'es' && s.banners.some((b) => b.includes('not yet available in English')), JSON.stringify({ lang: s.lang, banners: s.banners }))
    else check('[es] sin inglés: se muestra el español y NUNCA el aviso', s.body.includes('Manifiesto sintético') && s.banners.length === 0, JSON.stringify(s.banners)); await s.ctx.close() }
  // axe + desborde del respaldo (EN con aviso) y del texto con inglés
  for (const scheme of ['light', 'dark']) for (const width of [1360, 390, 320]) { const s = await pub(br, 'en', width, scheme); const v = await axe(s.page); check(`axe = 0 y sin desborde · /manifiesto EN con aviso · ${scheme} ${width}px`, v.length === 0 && !s.ox, JSON.stringify({ v, ox: s.ox })); await s.ctx.close() }
  await call(SUP, 'PUT', `/api/board/manifest/${list[2].id}/activate`)
  for (const scheme of ['light', 'dark']) for (const width of [1360, 390]) for (const lang of ['es', 'en']) { const s = await pub(br, lang, width, scheme); const v = await axe(s.page); check(`axe = 0 y sin desborde · /manifiesto con inglés · ${lang} ${scheme} ${width}px`, v.length === 0 && !s.ox, JSON.stringify({ v, ox: s.ox })); await s.ctx.close() }
  // ── Administración real
  for (const lang of ['es', 'en']) { const { ctx, page, errs } = await open(br, { lang }); await page.goto(BASE + '/admin/manifest'); await page.waitForSelector('main', { timeout: 20000 }); await page.waitForTimeout(1200)
    const head = await page.evaluate(() => ({ chips: [...document.querySelectorAll('.cg-chip')].map((c) => c.innerText.trim()), ox: document.documentElement.scrollWidth > innerWidth + 1 }))
    check(`[${lang}] /admin/manifest: la versión activa muestra la marca «EN» (con inglés)`, head.chips.some((c) => c.includes('EN')), JSON.stringify(head.chips))
    await page.getByRole('button', { name: /Nueva versión|New version/ }).first().click({ timeout: 8000 }); await page.waitForTimeout(500)
    const f = await page.evaluate(() => ({ en: !!document.getElementById('bm-content-en'), lab: document.querySelector('label[for="bm-content-en"]')?.textContent, lang: document.getElementById('bm-content-en')?.getAttribute('lang') }))
    check(`[${lang}] formulario: campo «${lang === 'es' ? 'Versión en inglés (opcional)' : 'English version (optional)'}» presente, con lang="en"`, f.en && f.lang === 'en' && (lang === 'es' ? f.lab.includes('Versión en inglés (opcional)') : f.lab.includes('English version (optional)')), JSON.stringify(f))
    await page.fill('#bm-content', ES + ' (desde la pantalla)'); await page.fill('#bm-content-en', 'corto'); await page.getByRole('button', { name: /Publicar y activar|Publish and activate/ }).first().click(); await page.waitForTimeout(600)
    const cnt0 = Number((await db.query('SELECT count(*) n FROM "EthicManifests"')).rows[0].n)
    const err = await page.evaluate(() => ({ txt: document.body.innerText.includes('50') || !!document.querySelector('#bm-content-en[aria-invalid="true"]'), focus: document.activeElement && document.activeElement.id }))
    check(`[${lang}] inglés < 50 caracteres: error en el campo, foco en él y no se envía nada`, err.txt && err.focus === 'bm-content-en' && cnt0 === 3 + (lang === 'es' ? 0 : 1), JSON.stringify({ ...err, cnt0 }))
    const v = await axe(page); check(`[${lang}] axe = 0 en /admin/manifest con el formulario y el error`, v.length === 0 && !head.ox, v.join(';'))
    await page.fill('#bm-content-en', ''); const reqs = []; page.on('request', (r) => { if (r.method() === 'POST' && r.url().includes('/manifest')) reqs.push(r.postData()) })
    await page.getByRole('button', { name: /Publicar y activar|Publish and activate/ }).first().click(); await page.waitForTimeout(1500)
    check(`[${lang}] inglés vacío: se publica sin la clave contentEn`, reqs.length === 1 && !reqs[0].includes('contentEn'), reqs.join('|').slice(0, 200))
    check(`[${lang}] sin errores de JavaScript`, errs.length === 0, errs.join('|')); await ctx.close() }
  console.log(`UI+API #409: ${ok} correctas, ${bad} fallos`); await db.end(); await br.close(); process.exit(bad ? 1 : 0)
})().catch((e) => { console.error('ABORTA', e); process.exit(2) })
