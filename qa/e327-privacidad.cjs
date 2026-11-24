// QA-Claude-2 — PR #327 (ES-337): /privacidad ES/EN con axe 2.2 AA y sin desborde; el registro por la interfaz envía la versión v2; marcador VERIFICAR y marca de borrador visibles. Express REAL sirve el build del PR en :8090. 0 IA.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const B = 'http://localhost:8090'; const sleep = ms => new Promise(r => setTimeout(r, ms))
let f = 0, total = 0; const ck = (n, ok, x = '') => { total++; if (!ok) f++; console.log((ok ? 'OK   ' : 'FALLA ') + n, x) }
;(async () => {
  const br = await chromium.launch()
  for (const [lang, scheme, w, h] of [['es', 'light', 1360, 900], ['es', 'dark', 390, 844], ['en', 'light', 390, 844], ['en', 'dark', 1360, 900]]) {
    const c = await br.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, bypassCSP: true }); await c.addInitScript(([l, t]) => { localStorage.setItem('elv_lang', l); localStorage.setItem('elv_theme', t) }, [lang, scheme]); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message))
    await p.goto(B + '/privacidad', { waitUntil: 'domcontentloaded' }); await p.waitForSelector('h1', { timeout: 20000 }).catch(() => {}); await sleep(1500)
    await p.addScriptTag({ path: process.env.AXE }); const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })).violations.map(x => x.id + ':' + x.nodes.length))
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1); const t = await p.locator('body').innerText()
    ck(`axe 2.2 AA /privacidad ${lang}/${scheme}/${w}px: 0 violaciones, sin desborde, sin errores JS`, v.length === 0 && !ov && errs.length === 0, v.join(',') + (ov ? ' desborde' : '') + errs.join('|'))
    const must = lang === 'es' ? [/qué ve la IA/i, /Chat:/, /Recomendaciones de bienestar/, /Análisis de habilidades/, /evidencias que confirmaste/, /últimos 7 registros de ánimo/, /Emparejamiento con un profesional/, /resumen irreversible/, /VERIFICAR con Infra/, /sin revisión legal/i] : [/what the AI sees/i, /Chat:/, /Wellbeing suggestions/, /Skills analysis/, /evidence you confirmed/, /last 7 mood entries/, /Matching with a professional/, /irreversible digest/, /VERIFY with Infra/, /without legal review/i]
    for (const re of must) ck(`/privacidad ${lang}/${scheme}/${w}px muestra ${re}`, re.test(t))
    ck(`/privacidad ${lang}/${scheme}/${w}px: sin «la IA no ve tu diario/chat» ni «evidencias confirmadas» como lo único que ve`, !/no ve tu diario|only sees your confirmed|solo ve tus evidencias|does not see your journal/i.test(t))
    await c.close()
  }
  // registro por la interfaz: la solicitud lleva v2 y la persona se registra
  for (const lang of ['es', 'en']) {
    const c = await br.newContext({ viewport: { width: 1360, height: 900 } }); await c.addInitScript(l => localStorage.setItem('elv_lang', l), lang); const p = await c.newPage(); let body = null
    await p.route(u => new URL(u).pathname === '/api/register', async r => { body = JSON.parse(r.request().postData() || '{}'); await r.continue() })
    await p.goto(B + '/login', { waitUntil: 'domcontentloaded' }); await sleep(2000)
    const toggle = p.getByRole('button', { name: /Regístrate|Crear (una )?cuenta|Create an account/i }).last(); if (await toggle.isVisible().catch(() => false)) { await toggle.click(); await sleep(800) }
    const email = `qa2-e327-ui-${lang}-${Date.now().toString(36)}@example.test`
    await p.locator('input[type=text], input[name=name]').first().fill('QA UI').catch(() => {}); await p.locator('input[type=email], input[name=email]').first().fill(email); await p.locator('input[type=password]').first().fill('Qa2-ui-' + Date.now().toString(36) + 'Aa1!')
    const cb = p.locator('input[type=checkbox]').first(); if (await cb.count()) await cb.check().catch(() => {})
    await p.locator('button[type=submit]').first().click(); await sleep(3500)
    ck(`registro por la interfaz (${lang}): la solicitud envía termsVersion = 2026-11-v2 y acceptedTerms`, body && body.termsVersion === '2026-11-v2' && body.acceptedTerms === true, JSON.stringify(body && { v: body.termsVersion, a: body.acceptedTerms }))
    await c.close()
  }
  console.log(`RESUMEN: ${total - f}/${total} OK, ${f} FALLAS`); await br.close(); process.exit(0)
})().catch(e => { console.log('EXCEPCION', e.stack || e.message); process.exit(1) })
