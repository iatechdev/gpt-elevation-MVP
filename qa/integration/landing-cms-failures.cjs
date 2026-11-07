// [QA-Claude] La landing con fallos del contenido (/api/landing-content) simulados por intercepción: 503, vacío, JSON inválido, nulos y de otro tipo, parcial, respuesta lenta del otro idioma.
// Uso: PLAYWRIGHT_MODULE=<ruta> PLAYWRIGHT_BROWSERS_PATH=<ruta> LANDING_URL=http://127.0.0.1:8174 SELECTOR=<selector de un título de la sección> TAG=ES74 node qa/integration/landing-cms-failures.cjs
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.LANDING_URL, tag = process.env.TAG || 'LND';
const check = (id, ok, d = '') => console.log(JSON.stringify({ id, ok: !!ok, detail: d }));
(async () => {
  const browser = await chromium.launch({ headless: true });
  const modes = {
    '503': r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"x"}' }),
    vacio: r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    jsonInvalido: r => r.fulfill({ status: 200, contentType: 'application/json', body: '{no json' }),
    tiposRaros: r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'landing.join.title': null, 'landing.join.step1': 123, 'landing.project.title': { a: 1 }, 'landing.offering.title': '', hero_title: ['x'] }) }),
    html: r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'landing.join.title': '<img src=x onerror=window.__x=1> "comillas" <script>window.__x=1</script>', hero_title: '<b>negrita</b>' }) }),
    larga: r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'landing.join.title': 'palabra'.repeat(400), hero_title: 'x'.repeat(5000) }) }),
  };
  const baseline = {};
  for (const [name, handler] of [['sin_fallo', null], ...Object.entries(modes)]) {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 900 } }); await ctx.addInitScript(() => localStorage.setItem('elv_lang', 'es'));
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message.slice(0, 80)));
    if (handler) await page.route('**/api/landing-content*', handler);
    await page.goto(url + '/'); await page.waitForTimeout(1800);
    const info = await page.evaluate(() => ({ text: document.body.innerText, hs: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, x: !!window.__x, imgs: document.querySelectorAll('main img[src="x"]').length, h2: [...document.querySelectorAll('h2')].length }));
    if (!handler) baseline.h2 = info.h2;
    const bad = /undefined|null|\[object|NaN/.test(info.text);
    const ok = !bad && !info.x && info.imgs === 0 && !info.hs && errs.length === 0 && (name === 'sin_fallo' || info.h2 >= (baseline.h2 || 1));
    check(`${tag}-C01 fallo «${name}»: sin undefined/null, sin ejecutar HTML, sin desbordar a 320 px, sin errores y con las mismas secciones`, ok, `bad=${bad} xss=${info.x} img=${info.imgs} hs=${info.hs} h2=${info.h2}/${baseline.h2} err=${errs.length}`);
    await ctx.close();
  }
  { // respuesta lenta de ES no pisa la vista EN
    const ctx = await browser.newContext(); await ctx.addInitScript(() => localStorage.setItem('elv_lang', 'es')); const page = await ctx.newPage();
    await page.route('**/api/landing-content*', async r => { const l = new URL(r.request().url()).searchParams.get('lang'); if (l === 'es') await new Promise(x => setTimeout(x, 1800)); await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'landing.problem.title': l === 'es' ? 'TITULO-ES-LENTO' : 'TITLE-EN-RAPIDO' }) }); });
    await page.goto(url + '/'); await page.waitForTimeout(300); await page.getByRole('button', { name: 'EN', exact: true }).first().click(); await page.waitForTimeout(3000);
    const t = await page.locator('body').innerText(); check(`${tag}-C02 una respuesta ES lenta no reemplaza la vista en EN`, /TITLE-EN-RAPIDO/.test(t) && !/TITULO-ES-LENTO/.test(t), t.slice(0, 80).replace(/\n+/g, ' | '));
    await ctx.close();
  }
  await browser.close(); console.log(JSON.stringify({ fin: true }));
})().catch(e => { console.error(e); process.exit(1); });
