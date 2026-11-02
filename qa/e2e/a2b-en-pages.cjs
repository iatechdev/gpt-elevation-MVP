// [QA-Claude] ES-40 A2b (0 tokens de IA): verifica en EN las pantallas que A2 marcó (siguiente paso, plan, herramientas, ejercicios) con persona sintética nueva y espera robusta (sin networkidle).
const L = require('./lib.cjs'); const { chromium, API, injectSession } = L;
(async () => {
  const s = await L.newPersona('a2b'); const ses = await L.login(s); if (!ses) { console.log('ERROR sin sesión'); process.exit(1); }
  const b = await chromium.launch(); const out = [];
  for (const lang of ['en', 'es']) for (const r of ['/app/next-step', '/app/next-step/plan', '/app/space/tools', '/app/exercises']) {
    const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); await injectSession(ctx, ses, lang); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await p.goto(API + r, { waitUntil: 'load' }); await p.waitForTimeout(3500); const t = await p.evaluate(() => document.body.innerText.trim()); const leak = lang === 'en' ? (t.match(L.ES_LEAK) || [null])[0] : null;
    out.push({ lang, r, url: new URL(p.url()).pathname, len: t.length, leak, errs, muestra: t.slice(0, 80).replace(/\s+/g, ' ') }); await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
