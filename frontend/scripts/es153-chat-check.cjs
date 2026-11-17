// ES-153 (E280-4): el chat no hace scroll de página y «Límites del asistente» queda dentro de la pantalla, en 1360×700, 390×844, 480×700, 320×568 y 320×480.
// En pantallas bajas (≤600 px de ancho y ≤760 de alto) la página puede desplazarse, pero la caja con el aviso queda fija abajo y a la vista (condición 2 de Infra).
// Uso: ES153_URL=http://127.0.0.1:4153 PLAYWRIGHT_MODULE=... node scripts/es153-chat-check.cjs
const assert = require('node:assert/strict');
(async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE); const base = process.env.ES153_URL; const browser = await chromium.launch(); let n = 0;
  for (const lang of ['es', 'en']) for (const [w, h] of [[1360, 700], [390, 844], [480, 700], [320, 568], [320, 480]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
    await page.addInitScript(([l]) => { localStorage.setItem('elevation_token', 't'); localStorage.setItem('elevation_role', 'user'); localStorage.setItem('elv_lang', l); }, [lang]);
    await page.route('**/api/**', (r) => { const p = new URL(r.request().url()).pathname; return r.fulfill({ json: p === '/api/session' ? { role: 'user', onboardingCompleted: true } : [] }); });
    await page.goto(base + '/app/chat', { waitUntil: 'networkidle' }); const note = page.locator('.chat-limits'); await note.waitFor(); await page.waitForTimeout(1200); // ES-333: el hilo se desplaza solo al final (scrollIntoView suave) y el marco con él: se mide cuando se asienta
    const m = await page.evaluate(() => { const r = document.querySelector('.chat-limits').getBoundingClientRect(); return { scroll: document.documentElement.scrollHeight - innerHeight, top: r.top, bottom: r.bottom, h: innerHeight }; });
    if (h >= 760 || w > 600) assert.ok(m.scroll <= 0, `sin scroll de página (${lang} ${w}×${h}): sobran ${m.scroll}px`); assert.ok(m.top >= 0 && m.bottom <= m.h, `«Límites» dentro de la pantalla (${lang} ${w}×${h}): ${m.top}–${m.bottom} de ${m.h}`);
    await ctx.close(); n++;
  }
  console.log(`PASS ${n} combinaciones`); await browser.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
