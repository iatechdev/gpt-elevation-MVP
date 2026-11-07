// [QA-Claude] ES-130 (datos para Dev): alto del héroe de la landing a 390 px antes y después de que llega /api/landing-content. Solo lectura pasiva de staging, sin cuentas ni IA.
const { chromium } = require('C:/Users/Usuario/tools/playwright/node_modules/playwright');
const BASE = process.env.BASE || 'https://backend-staging-e3a6.up.railway.app';
(async () => {
  const b = await chromium.launch(); const out = [];
  for (const lang of ['en', 'es']) for (const w of [390, 1440]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); await ctx.addInitScript(l => { try { localStorage.setItem('elv_lang', l); } catch { /* */ } }, lang);
    const p = await ctx.newPage(); await p.route('**/api/landing-content**', async r => { await new Promise(x => setTimeout(x, 3000)); r.continue(); });
    await p.goto(BASE + '/', { waitUntil: 'commit' });
    const m = () => p.evaluate(() => { const h = document.querySelector('h1'); if (!h) return null; const sec = h.closest('section') || h.parentElement; const r = h.getBoundingClientRect(); const sub = h.nextElementSibling; const sr = sub && sub.getBoundingClientRect(); return { h1: h.innerText, h1Top: Math.round(r.top), h1H: Math.round(r.height), subText: sub ? sub.innerText.slice(0, 60) : null, subH: sr ? Math.round(sr.height) : null, blockH: sr ? Math.round(sr.bottom - r.top) : Math.round(r.height), sectionH: Math.round(sec.getBoundingClientRect().height), font: getComputedStyle(h).fontSize + ' ' + getComputedStyle(h).fontFamily.slice(0, 30) }; });
    await p.waitForSelector('h1', { timeout: 15000 }).catch(() => {}); await p.waitForTimeout(800); const before = await m();
    await p.waitForTimeout(3500); const after = await m(); out.push({ lang, w, before, after, saltoBloque: before && after ? after.blockH - before.blockH : null, saltoSeccion: before && after ? after.sectionH - before.sectionH : null }); await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
