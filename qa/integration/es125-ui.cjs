// [QA-Claude] ES-125 · PR #111: el cliente envía { lang } al generar recomendaciones (dashboard y chat) y la pantalla queda en un solo idioma. Proveedor SIMULADO.
// Uso: QA_API=<servidor> QA_MOCK=<mock IA> OUT=<carpeta> node qa/integration/es125-ui.cjs
const fs = require('fs'); const path = require('path'); const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const API = process.env.QA_API, MOCK = process.env.QA_MOCK, OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true }); const stamp = Date.now();
const R = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: String(d).slice(0, 300) }));
const ES = [{ category: 'mindfulness', content: 'Respira hondo tres veces antes de empezar tu día.' }, { category: 'habit', content: 'Camina diez minutos sin el teléfono.' }, { category: 'reflection', content: 'Anota algo que hoy salió mejor de lo que esperabas.' }];
const EN = [{ category: 'mindfulness', content: 'Take three slow breaths before you start your day.' }, { category: 'habit', content: 'Walk for ten minutes without your phone.' }, { category: 'reflection', content: 'Write down something that went better than you expected.' }];
const setText = v => fetch(MOCK + '/_text?v=' + encodeURIComponent(JSON.stringify(v)));
(async () => {
  const b = await chromium.launch();
  for (const lg of ['es', 'en']) for (const [w, h] of [[1440, 900], [390, 844]]) for (const where of ['dashboard', 'chat']) {
    const email = `qa111ui-${stamp}-${lg}-${w}-${where}@example.test`, password = 'Qa111-' + stamp + 'aA!'; await fetch(API + '/api/register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'QA111 UI', email, password }) });
    const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const tag = `${where}-${w}-${lg}`; const bodies = []; p.on('request', r => { if (r.url().includes('/api/recommendations/generate')) bodies.push(r.postData()); });
    await p.goto(API + '/login', { waitUntil: 'networkidle' }); await p.fill('input[type=email]', email); await p.fill('input[type=password]', password); await p.keyboard.press('Enter'); await p.waitForTimeout(2500);
    await setText(lg === 'en' ? EN : ES);
    if (where === 'dashboard') { await p.goto(API + '/app/dashboard', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); if (lg === 'en') { await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(600); } const m = p.locator('button', { hasText: /😊|🙂/ }).first(); if (await m.count()) { await m.click().catch(() => {}); await p.waitForTimeout(1000); } }
    else { await p.goto(API + '/app/chat', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); if (lg === 'en') { await p.getByRole('button', { name: 'EN', exact: true }).first().click().catch(() => {}); await p.waitForTimeout(600); } }
    if (where === 'chat') { const star = p.locator('button[aria-label]').filter({ has: p.locator('path[d^="M12 2l3.09"]') }).first(); if (await star.count()) { await star.click().catch(() => {}); await p.waitForTimeout(700); } }
    const btn = p.locator('button', { hasText: /Generar nuevas|Generate new|Generar recomendaciones|Generate recommendations|Generate new ones/ }).first();
    if (!(await btn.count())) { R(`F2 ${tag}: existe el botón para generar recomendaciones`, false, 'no se encontró el botón (¿el chat no lo muestra en este estado?)'); await p.screenshot({ path: path.join(OUT, `sin-boton-${tag}.png`) }); await ctx.close(); continue; }
    await btn.click(); await p.waitForTimeout(2500); let lang = null; try { lang = JSON.parse(bodies[0] || '{}').lang; } catch { /* */ }
    R(`F2 ${tag}: la petición de generar lleva { lang: "${lg}" }`, bodies.length >= 1 && lang === lg, `peticiones=${bodies.length} cuerpo=${bodies[0]}`);
    const body = await p.innerText('body'); const shown = lg === 'en' ? /Take three slow breaths/.test(body) : /Respira hondo/.test(body); const sw = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    const mixed = lg === 'en' ? /(Respira hondo|Camina diez|Todavía no|Generar)/.test(body) : /(Take three slow|Walk for ten|No recommendations yet|Generate new)/.test(body);
    R(`F6 ${tag}: las recomendaciones se muestran en ${lg === 'en' ? 'inglés' : 'español'}, sin mezcla de idiomas y sin desborde`, shown && !mixed && !sw, JSON.stringify({ shown, mixed, sw })); await p.screenshot({ path: path.join(OUT, `recs-${tag}.png`), fullPage: true }); await ctx.close();
  }
  await b.close();
})().catch(e => { console.log(JSON.stringify({ id: 'ERROR del script', ok: false, detail: String(e).slice(0, 300) })); process.exit(1); });
